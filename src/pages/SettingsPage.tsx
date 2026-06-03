import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from '@/components/ui/alert-dialog';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import Layout from '@/components/layouts/Layout';
import { updateProfile, cancelSubscription, reinstateSubscription } from '@/db/api';
import {
  getEffectivePlanName,
  isInTrial,
  getTrialDaysRemaining,
  hasLearningHubAccess,
  formatReadableDate,
  canCancelPlan,
  canReinstatePlan,
  canCancelLearningHub,
  canReinstateLearningHub,
} from '@/lib/planUtils';
import { BookOpen, CheckCircle2, XCircle, AlertTriangle, RotateCcw } from 'lucide-react';

// ─── Cancellation Modal ───────────────────────────────────────────────────────
interface CancelModalProps {
  open: boolean;
  target: 'plan' | 'learning_hub';
  planName: string;
  endDate: string | null | undefined;
  onConfirm: () => Promise<void>;
  onClose: () => void;
  loading: boolean;
}

function CancelModal({ open, target, planName, endDate, onConfirm, onClose, loading }: CancelModalProps) {
  return (
    <AlertDialog open={open} onOpenChange={(v) => !v && onClose()}>
      <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-balance">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
            Cancel {target === 'plan' ? planName : 'Learning Hub'} Subscription
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm text-left">
              <p className="text-foreground/80">
                Before you cancel, here's what you need to know:
              </p>
              <ul className="space-y-2">
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground shrink-0 mt-1.5" />
                  <span>
                    Your subscription will <strong className="text-foreground">stop renewing</strong> on
                    the next billing date — no further charges will occur.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground shrink-0 mt-1.5" />
                  <span>
                    You'll retain{' '}
                    <strong className="text-foreground">full access to all current features</strong>{' '}
                    until your existing billing period ends.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground shrink-0 mt-1.5" />
                  <span>
                    You can <strong className="text-foreground">reinstate at any time</strong> before
                    that end date to resume automatic billing.
                  </span>
                </li>
              </ul>

              {endDate && (
                <div className="mt-4 p-3 rounded-lg bg-muted/40 border border-border">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                    Your access ends on
                  </p>
                  <p className="font-semibold text-foreground">{formatReadableDate(endDate)}</p>
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex flex-col-reverse sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={loading}
            className="w-full sm:w-auto"
          >
            Go Back
          </Button>
          <Button
            onClick={onConfirm}
            disabled={loading}
            className="w-full sm:w-auto"
          >
            {loading ? 'Cancelling…' : 'Confirm Cancellation'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ─── Reinstatement Modal ──────────────────────────────────────────────────────
interface ReinstateModalProps {
  open: boolean;
  target: 'plan' | 'learning_hub';
  planName: string;
  renewalDate: string | null | undefined;
  planAmount: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
  loading: boolean;
}

function ReinstateModal({
  open,
  target,
  planName,
  renewalDate,
  planAmount,
  onConfirm,
  onClose,
  loading,
}: ReinstateModalProps) {
  return (
    <AlertDialog open={open} onOpenChange={(v) => !v && onClose()}>
      <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-balance">
            <RotateCcw className="w-5 h-5 text-accent shrink-0" />
            Reinstate {target === 'plan' ? planName : 'Learning Hub'} Subscription
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm text-left">
              <p className="text-foreground/80">
                Great news — you can pick up right where you left off.
              </p>
              <ul className="space-y-2">
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground shrink-0 mt-1.5" />
                  <span>
                    Reinstating will{' '}
                    <strong className="text-foreground">resume automatic recurring billing</strong>{' '}
                    from your existing billing end date — no gap or interruption.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground shrink-0 mt-1.5" />
                  <span>Your billing cycle continues exactly where it left off.</span>
                </li>
              </ul>

              {renewalDate && (
                <div className="mt-4 p-3 rounded-lg bg-muted/40 border border-border space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                      Next billing date
                    </p>
                    <p className="font-semibold text-foreground">{formatReadableDate(renewalDate)}</p>
                  </div>
                  <Separator />
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                      Amount to be charged
                    </p>
                    <p className="font-semibold text-foreground">{planAmount}</p>
                  </div>
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex flex-col-reverse sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={loading}
            className="w-full sm:w-auto"
          >
            Go Back
          </Button>
          <Button
            onClick={onConfirm}
            disabled={loading}
            className="w-full sm:w-auto"
          >
            {loading ? 'Reinstating…' : 'Confirm Reinstatement'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ─── Main Settings Page ───────────────────────────────────────────────────────
export default function SettingsPage() {
  const { profile, refreshProfile } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);

  // Modal state
  const [cancelModal, setCancelModal] = useState<{ open: boolean; target: 'plan' | 'learning_hub' }>({
    open: false,
    target: 'plan',
  });
  const [reinstateModal, setReinstateModal] = useState<{ open: boolean; target: 'plan' | 'learning_hub' }>({
    open: false,
    target: 'plan',
  });
  const [actionLoading, setActionLoading] = useState(false);

  const effectivePlan = getEffectivePlanName(profile);
  const inTrial = isInTrial(profile);
  const trialDaysLeft = getTrialDaysRemaining(profile);
  const lhActive = hasLearningHubAccess(profile);

  const showCancelPlan = canCancelPlan(profile);
  const showReinstatePlan = canReinstatePlan(profile);
  const showCancelLH = canCancelLearningHub(profile);
  const showReinstateLH = canReinstateLearningHub(profile);

  const planDisplayName =
    profile?.plan === 'career_accelerator'
      ? 'Career Accelerator'
      : profile?.plan === 'pro'
      ? 'Pro'
      : 'Free';

  // Derive plan amount string for reinstatement modal
  const planAmountDisplay = (() => {
    if (!profile) return '';
    if (profile.plan === 'pro') return 'R300/year or R30 for 2 months (based on your billing period)';
    if (profile.plan === 'career_accelerator') return 'R300/year';
    return '';
  })();

  const lhAmountDisplay = (() => {
    if (!profile) return '';
    if (profile.plan === 'pro') return 'R250/year or R50 for 2 months';
    if (profile.plan === 'career_accelerator') return 'R500/year or R100 for 2 months';
    return '';
  })();

  useEffect(() => {
    if (profile) {
      setName(profile.name);
      setEmail(profile.email);
    }
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    if (!profile) { toast.error('Profile not loaded'); setSaving(false); return; }
    const success = await updateProfile(profile.id, { name, email });
    if (success) { await refreshProfile(); toast.success('Profile updated successfully'); }
    else toast.error('Failed to update profile');
    setSaving(false);
  };

  // ── Cancel handler ───────────────────────────────────────────────────────
  const handleCancelConfirm = async () => {
    setActionLoading(true);
    const target = cancelModal.target;
    try {
      const result = await cancelSubscription(target);
      if (result?.success) {
        await refreshProfile();
        const endDate = target === 'plan'
          ? profile?.plan_renewal_date
          : profile?.learning_hub_renewal_date;
        toast.success(
          `Subscription cancelled. Your access continues until ${formatReadableDate(endDate)}.`,
          { duration: 6000 }
        );
        setCancelModal({ open: false, target: 'plan' });
      } else {
        toast.error('Unable to cancel subscription at this time. Please try again or contact support.');
      }
    } catch {
      toast.error('Unable to cancel subscription at this time. Please try again or contact support.');
    } finally {
      setActionLoading(false);
    }
  };

  // ── Reinstate handler ────────────────────────────────────────────────────
  const handleReinstateConfirm = async () => {
    setActionLoading(true);
    const target = reinstateModal.target;
    try {
      const result = await reinstateSubscription(target);
      if (result?.success) {
        await refreshProfile();
        const nextDate = result.next_billing_date
          ?? (target === 'plan' ? profile?.plan_renewal_date : profile?.learning_hub_renewal_date);
        toast.success(
          `Subscription reinstated! Your next billing date is ${formatReadableDate(nextDate)}.`,
          { duration: 6000 }
        );
        setReinstateModal({ open: false, target: 'plan' });
      } else {
        toast.error('Unable to reinstate subscription at this time. Please try again or contact support.');
      }
    } catch {
      toast.error('Unable to reinstate subscription at this time. Please try again or contact support.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-2xl space-y-8">
        <div>
          <h1 className="text-4xl font-bold mb-2">Settings</h1>
          <p className="text-xl text-muted-foreground">Manage your account information</p>
        </div>

        {/* Profile */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-2xl">Profile Information</CardTitle>
            <CardDescription className="text-base">
              Update your name and email address
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="bg-muted border-border"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="bg-muted border-border"
                />
              </div>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Save Changes'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Billing & Subscription */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-2xl">Billing & Subscription</CardTitle>
            <CardDescription className="text-base">Your subscription details</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-0">
              {/* Trial banner */}
              {inTrial && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-accent/10 border border-accent/20 mb-5">
                  <span className="text-lg leading-none mt-px">🎉</span>
                  <div>
                    <p className="text-sm font-semibold text-accent">Trial Active</p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {trialDaysLeft} day{trialDaysLeft === 1 ? '' : 's'} remaining — full access to
                      all premium features
                    </p>
                  </div>
                </div>
              )}

              {/* Cancelled plan notice */}
              {profile?.plan_status === 'cancelled' && profile.plan !== 'free' && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 mb-5">
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                      Subscription Cancelled
                    </p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Your {planDisplayName} plan access continues until{' '}
                      <strong className="text-foreground">
                        {formatReadableDate(profile.plan_renewal_date)}
                      </strong>
                      . Reinstate before then to avoid losing access.
                    </p>
                  </div>
                </div>
              )}

              {/* Base plan */}
              <div className="flex items-start justify-between gap-4 py-4 border-b border-border">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Base Plan</p>
                  <p className="font-semibold">{effectivePlan}</p>
                </div>
                <Badge variant={inTrial ? 'default' : 'secondary'} className="shrink-0 mt-0.5">
                  {inTrial ? 'Trial' : planDisplayName}
                </Badge>
              </div>

              {/* Plan status */}
              {profile?.plan !== 'free' && !inTrial && (
                <div className="flex items-start justify-between gap-4 py-4 border-b border-border">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                      Subscription Status
                    </p>
                    <p className="font-semibold capitalize">
                      {profile?.plan_status ?? 'active'}
                    </p>
                  </div>
                  <Badge
                    variant={profile?.plan_status === 'cancelled' ? 'outline' : 'default'}
                    className="shrink-0 mt-0.5"
                  >
                    {profile?.plan_status === 'cancelled' ? 'Cancelled' : 'Active'}
                  </Badge>
                </div>
              )}

              {/* Base plan renewal */}
              <div className="flex items-start justify-between gap-4 py-4 border-b border-border">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                    {profile?.plan_status === 'cancelled' ? 'Access Ends' : 'Next Renewal'}
                  </p>
                  <p className="font-semibold">
                    {formatReadableDate(profile?.plan_renewal_date)}
                  </p>
                </div>
              </div>

              {/* Learning Hub status */}
              <div className="flex items-start justify-between gap-4 py-4 border-b border-border">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                      Learning Hub Add-on
                    </p>
                    <div className="flex items-center gap-2">
                      {lhActive ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-accent" />
                          <span className="font-semibold">Active</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-4 h-4 text-muted-foreground" />
                          <span className="font-semibold text-muted-foreground">Inactive</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <Badge variant={lhActive ? 'default' : 'outline'} className="shrink-0 mt-0.5">
                  {lhActive ? 'Active' : 'Not subscribed'}
                </Badge>
              </div>

              {/* Learning Hub renewal */}
              {lhActive && profile?.plan !== 'career_accelerator' && (
                <div className="flex items-start justify-between gap-4 py-4 border-b border-border">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                      {profile?.learning_hub_plan_status === 'cancelled'
                        ? 'Learning Hub Access Ends'
                        : 'Learning Hub Renewal'}
                    </p>
                    <p className="font-semibold">
                      {formatReadableDate(profile?.learning_hub_renewal_date)}
                    </p>
                  </div>
                </div>
              )}

              {/* 3-week extension note */}
              {lhActive && profile?.plan !== 'career_accelerator' && (
                <div className="flex items-start gap-3 p-3 rounded-lg border border-border bg-muted/40 mt-1 mb-3">
                  <span className="text-base leading-none mt-px">📅</span>
                  <p className="text-xs text-muted-foreground">
                    Your subscription renewal date includes a{' '}
                    <span className="font-medium text-foreground">3-week extension</span> applied
                    when the Learning Hub add-on was activated.
                  </p>
                </div>
              )}

              {/* Generation count for free plan */}
              {profile?.plan === 'free' && (
                <div className="flex items-start justify-between gap-4 py-4">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                      Monthly Generations
                    </p>
                    <p className="font-semibold">{profile?.generation_count ?? 0} remaining</p>
                  </div>
                </div>
              )}

              {/* ── Subscription Action Buttons ── */}
              {(showCancelPlan || showReinstatePlan || showCancelLH || showReinstateLH) && (
                <>
                  <Separator className="my-2" />
                  <div className="pt-4 space-y-3">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-3">
                      Subscription Actions
                    </p>

                    {/* Base plan: cancel */}
                    {showCancelPlan && (
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-medium">{planDisplayName} Subscription</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Access until {formatReadableDate(profile?.plan_renewal_date)}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="shrink-0"
                          onClick={() => setCancelModal({ open: true, target: 'plan' })}
                        >
                          Cancel Subscription
                        </Button>
                      </div>
                    )}

                    {/* Base plan: reinstate */}
                    {showReinstatePlan && (
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-medium">{planDisplayName} Subscription</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Cancelled · Access until {formatReadableDate(profile?.plan_renewal_date)}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          className="shrink-0"
                          onClick={() => setReinstateModal({ open: true, target: 'plan' })}
                        >
                          Reinstate Subscription
                        </Button>
                      </div>
                    )}

                    {/* Learning Hub: cancel */}
                    {showCancelLH && (
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-medium">Learning Hub Add-on</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Access until {formatReadableDate(profile?.learning_hub_renewal_date)}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="shrink-0"
                          onClick={() => setCancelModal({ open: true, target: 'learning_hub' })}
                        >
                          Cancel Add-on
                        </Button>
                      </div>
                    )}

                    {/* Learning Hub: reinstate */}
                    {showReinstateLH && (
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-medium">Learning Hub Add-on</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Cancelled · Access until {formatReadableDate(profile?.learning_hub_renewal_date)}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          className="shrink-0"
                          onClick={() => setReinstateModal({ open: true, target: 'learning_hub' })}
                        >
                          Reinstate Add-on
                        </Button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cancel Modal */}
      <CancelModal
        open={cancelModal.open}
        target={cancelModal.target}
        planName={planDisplayName}
        endDate={
          cancelModal.target === 'plan'
            ? profile?.plan_renewal_date
            : profile?.learning_hub_renewal_date
        }
        onConfirm={handleCancelConfirm}
        onClose={() => setCancelModal({ open: false, target: 'plan' })}
        loading={actionLoading}
      />

      {/* Reinstate Modal */}
      <ReinstateModal
        open={reinstateModal.open}
        target={reinstateModal.target}
        planName={planDisplayName}
        renewalDate={
          reinstateModal.target === 'plan'
            ? profile?.plan_renewal_date
            : profile?.learning_hub_renewal_date
        }
        planAmount={reinstateModal.target === 'plan' ? planAmountDisplay : lhAmountDisplay}
        onConfirm={handleReinstateConfirm}
        onClose={() => setReinstateModal({ open: false, target: 'plan' })}
        loading={actionLoading}
      />
    </Layout>
  );
}


