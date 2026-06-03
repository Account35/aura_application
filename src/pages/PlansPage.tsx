import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/layouts/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Check, Loader2, Sparkles, Zap, Star } from 'lucide-react';
import { getEffectivePlanName, isInTrial } from '@/lib/planUtils';
import { upgradePlan, initializePlanUpgrade, getPaystackPublicKey } from '@/db/api';

// ─── Paystack Popup global type (only used when public key is available) ──────
declare global {
  interface Window {
    PaystackPop: {
      setup(options: {
        key: string;
        email: string;
        amount: number;
        currency: string;
        ref: string;
        metadata?: Record<string, unknown>;
        callback: (response: { reference: string }) => void;
        onClose: () => void;
      }): { openIframe(): void };
    };
  }
}

type BillingPeriod = 'two_months' | 'annual';

interface PlanConfig {
  key: 'free' | 'pro' | 'career_accelerator';
  name: string;
  icon: React.ReactNode;
  description: string;
  pricing: Partial<Record<BillingPeriod, { display: string; subtext: string; kobo: number }>> | null;
  billingOptions: BillingPeriod[];
  features: string[];
  highlight?: boolean;
}

// Prices match landing page exactly
const PLANS: PlanConfig[] = [
  {
    key: 'free',
    name: 'Free',
    icon: <Star className="w-5 h-5" />,
    description: '5-day trial with all features',
    pricing: null,
    billingOptions: [],
    features: [
      '10 generations per month',
      'Manual editing only (after trial)',
      'No AI refinement (after trial)',
      'No ATS score access (after trial)',
    ],
  },
  {
    key: 'pro',
    name: 'Pro',
    icon: <Zap className="w-5 h-5" />,
    description: 'Start with a 5-day trial',
    pricing: {
      two_months: { display: 'R30', subtext: 'for 2 months', kobo: 3000 },
      annual: { display: 'R300', subtext: 'per year', kobo: 30000 },
    },
    billingOptions: ['two_months', 'annual'],
    features: [
      'Unlimited generations',
      '3 AI refinement messages per cover letter',
      'ATS score visible (reasons blurred)',
    ],
  },
  {
    key: 'career_accelerator',
    name: 'Career Accelerator',
    icon: <Sparkles className="w-5 h-5" />,
    description: 'Start with a 5-day trial',
    pricing: {
      annual: { display: 'R300', subtext: 'per year', kobo: 30000 },
    },
    billingOptions: ['annual'],
    highlight: true,
    features: [
      'Unlimited generations',
      'Unlimited AI chat',
      'Full ATS score with all reasons',
    ],
  },
];

// ─── Load Paystack inline script ────────────────────────────────────────────────
function usePaystackScript(): boolean {
  const [loaded, setLoaded] = useState(typeof window !== 'undefined' && typeof window.PaystackPop !== 'undefined');
  useEffect(() => {
    if (loaded || typeof window === 'undefined') return;
    const existing = document.querySelector('script[src*="paystack"]');
    if (existing) {
      existing.addEventListener('load', () => setLoaded(true));
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://js.paystack.co/v1/inline.js';
    script.async = true;
    script.onload = () => setLoaded(true);
    script.onerror = () => console.error('Failed to load Paystack script');
    document.head.appendChild(script);
  }, [loaded]);
  return loaded;
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function PlansPage() {
  const { profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const paystackReady = usePaystackScript();

  const [selectedPeriod, setSelectedPeriod] = useState<BillingPeriod>('annual');
  const [processingPlan, setProcessingPlan] = useState<string | null>(null);
  const [publicKey, setPublicKey] = useState<string | null>(null);

  const currentPlan = profile?.plan ?? 'free';
  const effectivePlan = getEffectivePlanName(profile);
  const inTrial = isInTrial(profile);

  // Refs for the payment popup window, polling interval, popup-close watcher, and success flag
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const popupWatcherRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const popupRef = useRef<Window | null>(null);
  const paymentSucceededRef = useRef(false);

  // Attempt to fetch Paystack public key — purely optional (enables inline popup).
  // If unavailable or wrong type, the server-side initialization fallback is used instead.
  useEffect(() => {
    let cancelled = false;
    getPaystackPublicKey().then((result) => {
      if (cancelled || !result || 'error' in result) return;
      if (result.publicKey?.startsWith('pk_')) setPublicKey(result.publicKey);
    });
    return () => { cancelled = true; };
  }, []);

  // Cleanup all intervals and popup on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (popupWatcherRef.current) clearInterval(popupWatcherRef.current);
      if (popupRef.current && !popupRef.current.closed) popupRef.current.close();
    };
  }, []);

  /** Stop all payment polling and close-watching, then reset UI state. */
  const cancelAllPolling = useCallback((showToast = true) => {
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
    if (popupWatcherRef.current) { clearInterval(popupWatcherRef.current); popupWatcherRef.current = null; }
    toast.dismiss('plan-upgrade');
    toast.dismiss('plan-init');
    setProcessingPlan(null);
    if (showToast) toast.info('Payment cancelled.');
  }, []);

  const verifyWithPolling = useCallback(
    async (reference: string, planType: string, billingPeriod: string) => {
      paymentSucceededRef.current = false;
      toast.loading('Verifying payment…', { id: 'plan-upgrade' });

      const check = async (): Promise<boolean> => {
        // Abort early if the user already cancelled
        if (!pollingRef.current && paymentSucceededRef.current === false) return false;
        try {
          const result = await upgradePlan(reference, planType, billingPeriod);
          if (result?.success) {
            paymentSucceededRef.current = true;
            if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
            if (popupWatcherRef.current) { clearInterval(popupWatcherRef.current); popupWatcherRef.current = null; }
            await refreshProfile();
            toast.success(
              `Welcome to ${planType === 'pro' ? 'Pro' : 'Career Accelerator'}! Your plan is now active.`,
              { id: 'plan-upgrade', duration: 5000 }
            );
            setProcessingPlan(null);
            navigate('/dashboard');
            return true;
          }
          return false;
        } catch {
          return false;
        }
      };

      // Immediate first check, then every 3 s for up to 5 minutes
      const immediate = await check();
      if (immediate) return;

      let attempts = 0;
      pollingRef.current = setInterval(async () => {
        attempts++;
        if (attempts > 100) {
          // ~5 minutes — give up
          if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
          if (popupWatcherRef.current) { clearInterval(popupWatcherRef.current); popupWatcherRef.current = null; }
          toast.error('Payment verification timed out. If you completed payment, contact support.', {
            id: 'plan-upgrade',
          });
          setProcessingPlan(null);
          return;
        }
        await check();
      }, 3000);
    },
    [navigate, refreshProfile, cancelAllPolling]
  );

  /**
   * Watch the payment popup window; when it's closed by the user (not by a
   * successful payment redirect), stop polling and show a cancellation notice.
   */
  const watchPopupClose = useCallback(() => {
    if (popupWatcherRef.current) clearInterval(popupWatcherRef.current);

    popupWatcherRef.current = setInterval(() => {
      if (!popupRef.current) return;
      if (popupRef.current.closed) {
        clearInterval(popupWatcherRef.current!);
        popupWatcherRef.current = null;
        // Only treat as cancellation if payment hasn't already succeeded
        if (!paymentSucceededRef.current) {
          cancelAllPolling(true);
        }
      }
    }, 500);
  }, [cancelAllPolling]);

  const openPaystackPopup = useCallback(
    (authorizationUrl: string) => {
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      popupRef.current = window.open(
        authorizationUrl,
        'paystack-payment',
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,location=no,status=no,menubar=no,scrollbars=yes,resizable=yes`
      );
    },
    []
  );

  const handleUpgrade = useCallback(
    async (plan: PlanConfig) => {
      if (!profile?.email) {
        toast.error('Please log in to upgrade your plan.');
        return;
      }
      if (!plan.pricing) return;

      const period: BillingPeriod =
        plan.billingOptions.includes(selectedPeriod) ? selectedPeriod : 'annual';
      const pricingInfo = plan.pricing[period];
      if (!pricingInfo) return;

      setProcessingPlan(plan.key);

      // ── Try inline Paystack Popup if public key is available ──────────────
      if (publicKey && paystackReady) {
        const ref = `aura-plan-${plan.key}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        try {
          const handler = window.PaystackPop.setup({
            key: publicKey,
            email: profile.email,
            amount: pricingInfo.kobo,
            currency: 'ZAR',
            ref,
            metadata: { plan_type: plan.key, billing_period: period, user_id: profile.id },
            callback: async (response: { reference: string }) => {
              toast.loading('Verifying payment…', { id: 'plan-upgrade' });
              try {
                const result = await upgradePlan(response.reference, plan.key, period);
                if (result?.success) {
                  await refreshProfile();
                  toast.success(`Welcome to ${plan.name}! Your plan is now active.`, {
                    id: 'plan-upgrade',
                    duration: 5000,
                  });
                  navigate('/dashboard');
                } else {
                  toast.error(
                    result?.message || 'Payment verified but activation failed. Contact support.',
                    { id: 'plan-upgrade' }
                  );
                }
              } catch {
                toast.error('Could not activate plan. Contact support with your payment reference.', {
                  id: 'plan-upgrade',
                });
              } finally {
                setProcessingPlan(null);
              }
            },
            onClose: () => {
              setProcessingPlan(null);
              toast.info('Payment cancelled.');
            },
          });
          handler.openIframe();
          return;
        } catch (err) {
          console.error('Paystack popup error:', err);
          // Fall through to server-side fallback
        }
      }

      // ── Fallback: server-side initialization + popup window ───────────────
      toast.loading('Preparing payment…', { id: 'plan-init' });
      try {
        const initResult = await initializePlanUpgrade(plan.key, period);
        if (!initResult) {
          toast.error('Failed to start payment. Please try again.', { id: 'plan-init' });
          setProcessingPlan(null);
          return;
        }
        toast.dismiss('plan-init');

        // Open the Paystack hosted page in a popup window
        openPaystackPopup(initResult.authorization_url);

        // Watch for the user closing the popup (cancellation detection)
        watchPopupClose();

        // Begin polling for payment confirmation
        verifyWithPolling(initResult.reference, plan.key, period);
      } catch (err) {
        console.error('Plan initialization error:', err);
        toast.error('Failed to start payment. Please try again.', { id: 'plan-init' });
        setProcessingPlan(null);
      }
    },
    [
      profile,
      publicKey,
      paystackReady,
      selectedPeriod,
      navigate,
      refreshProfile,
      openPaystackPopup,
      watchPopupClose,
      verifyWithPolling,
      cancelAllPolling,
    ]
  );

  const isTestMode = publicKey?.startsWith('pk_test');

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-10 pb-16">
        {/* Header */}
        <div className="text-center space-y-3 pt-6">
          <h1 className="text-3xl font-semibold text-balance">Choose Your Plan</h1>
          <p className="text-muted-foreground text-sm text-pretty max-w-md mx-auto">
            {inTrial
              ? `You're on a free trial. Upgrade to keep access after it ends.`
              : currentPlan !== 'free'
              ? `You're currently on the ${effectivePlan} plan.`
              : 'Unlock unlimited generations, AI refinement, and more.'}
          </p>

          {/* Billing period toggle */}
          <div className="flex items-center justify-center mt-4">
            <div className="inline-flex rounded-lg border border-border p-0.5 bg-muted/30">
              <button
                onClick={() => setSelectedPeriod('two_months')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  selectedPeriod === 'two_months'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                2 Months
              </button>
              <button
                onClick={() => setSelectedPeriod('annual')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  selectedPeriod === 'annual'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Annual
              </button>
            </div>
          </div>
        </div>

        {/* Plan cards */}
        <div className="grid md:grid-cols-3 gap-5">
          {PLANS.map((plan) => {
            const isCurrent = currentPlan === plan.key && !inTrial;
            const isProcessing = processingPlan === plan.key;
            const effectivePeriod: BillingPeriod =
              plan.billingOptions.includes(selectedPeriod) ? selectedPeriod : 'annual';
            const pricingInfo = plan.pricing?.[effectivePeriod];

            return (
              <Card
                key={plan.key}
                className={`relative flex flex-col h-full border-border ${
                  plan.highlight ? 'ring-1 ring-accent' : ''
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="text-xs px-3 py-0.5 shrink-0">Most Popular</Badge>
                  </div>
                )}

                <CardHeader className="pb-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-accent">{plan.icon}</span>
                    <CardTitle className="text-lg">{plan.name}</CardTitle>
                    {isCurrent && (
                      <Badge variant="secondary" className="text-xs ml-auto">
                        Current
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="text-pretty">{plan.description}</CardDescription>

                  {/* Price */}
                  <div className="pt-3 min-h-[3.5rem]">
                    {pricingInfo ? (
                      <>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-3xl font-bold">{pricingInfo.display}</span>
                          <span className="text-sm text-muted-foreground">{pricingInfo.subtext}</span>
                        </div>
                        {plan.billingOptions.length === 1 && (
                          <p className="text-xs text-muted-foreground mt-0.5">Annual billing only</p>
                        )}
                      </>
                    ) : (
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-3xl font-bold">Free</span>
                        <span className="text-sm text-muted-foreground">forever</span>
                      </div>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="flex flex-col flex-1 space-y-5">
                  <Separator />

                  <ul className="space-y-2.5 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5">
                        <Check className="w-4 h-4 shrink-0 mt-px text-accent" />
                        <span className="text-sm">{f}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-auto pt-2">
                    {plan.key === 'free' ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        disabled
                        onClick={() => undefined}
                      >
                        Free Plan
                      </Button>
                    ) : isCurrent ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        disabled
                        onClick={() => undefined}
                      >
                        Current Plan
                      </Button>
                    ) : (
                      <Button
                        className="w-full"
                        variant={plan.highlight ? 'default' : 'outline'}
                        disabled={isProcessing}
                        onClick={() => handleUpgrade(plan)}
                      >
                        {isProcessing ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Processing…
                          </>
                        ) : (
                          `Upgrade to ${plan.name}`
                        )}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <p className="text-center text-xs text-muted-foreground pb-2">
          Payments are processed securely via Paystack.
          {isTestMode && (
            <span className="ml-1 text-amber-600 dark:text-amber-400 font-medium">
              Test mode — no real charges will be made.
            </span>
          )}
        </p>
      </div>
    </Layout>
  );
}
