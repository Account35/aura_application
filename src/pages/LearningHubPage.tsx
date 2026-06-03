import { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/layouts/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { BookOpen, Lock, Play, CheckCircle2, Loader2, Check } from 'lucide-react';
import {
  hasLearningHubAccess,
  canAccessLearningHubAddon,
  getLearningHubPricing,
  getLearningHubAmount,
  LEARNING_HUB_CATEGORIES,
  formatReadableDate,
} from '@/lib/planUtils';
import {
  getVideoProgress,
  saveVideosToProgress,
  markVideoWatched,
  fetchYouTubeVideos,
  initializePaystackPayment,
  verifyPaystackPayment,
} from '@/db/api';
import type { VideoWatchProgress, LearningHubCategory } from '@/types/types';

// ─── Video Card ───────────────────────────────────────────────────────────────
interface VideoCardProps {
  video: VideoWatchProgress;
  onWatch: (video: VideoWatchProgress) => void;
}

function VideoCard({ video, onWatch }: VideoCardProps) {
  return (
    <Card className="border-border flex flex-col h-full overflow-hidden">
      <div className="relative aspect-video w-full overflow-hidden bg-muted">
        <img
          src={video.thumbnail_url}
          alt={video.video_title}
          className="w-full h-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${video.video_id}/hqdefault.jpg`;
          }}
        />
        {video.watched && (
          <div className="absolute top-2 right-2">
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent/90 text-accent-foreground text-xs font-medium">
              <CheckCircle2 className="w-3 h-3" /> Watched
            </span>
          </div>
        )}
      </div>
      <CardContent className="flex flex-col flex-1 p-4 gap-3">
        <div className="flex-1">
          <p className="font-semibold text-sm leading-snug line-clamp-2 text-foreground text-balance">
            {video.video_title}
          </p>
          <p className="text-xs text-muted-foreground mt-1 truncate">{video.channel_name}</p>
        </div>
        <Button
          size="sm"
          className="w-full gap-2 mt-auto"
          onClick={() => onWatch(video)}
        >
          <Play className="w-3.5 h-3.5" />
          Watch Now
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────
interface CategoryProgressProps {
  videos: VideoWatchProgress[];
  categoryLabel: string;
}

function CategoryProgress({ videos, categoryLabel }: CategoryProgressProps) {
  const total = videos.length;
  const watched = videos.filter((v) => v.watched).length;
  const pct = total === 0 ? 0 : Math.round((watched / total) * 100);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{categoryLabel}</span>
        <span className="font-medium text-foreground">
          {watched} of {total} videos watched
        </span>
      </div>
      <Progress value={pct} className="h-1.5" />
    </div>
  );
}

// ─── Free User Locked Screen ──────────────────────────────────────────────────
function LockedScreen() {
  const plansInfo = [
    {
      name: 'Pro',
      basePrice: 'R30 for 2 months or R300/year',
      features: ['Unlimited generations', '3 AI refinement messages', 'ATS score visible'],
      lhAddon: { twoMonths: 'R50 for 2 months', annual: 'R250/year' },
    },
    {
      name: 'Career Accelerator',
      basePrice: 'R300/year',
      features: ['Unlimited generations', 'Unlimited AI chat', 'Full ATS score with reasons'],
      lhAddon: { twoMonths: 'R100 for 2 months', annual: 'R500/year' },
      highlighted: true,
    },
  ];

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col items-center text-center space-y-4 pt-8">
          <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
            <Lock className="w-6 h-6 text-muted-foreground" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-2xl font-semibold">Learning Hub is Locked</h1>
            <p className="text-muted-foreground text-sm leading-relaxed text-pretty max-w-sm mx-auto">
              The Learning Hub is available as an add-on for <strong>Pro</strong> and{' '}
              <strong>Career Accelerator</strong> subscribers. Upgrade your base plan to unlock it.
            </p>
          </div>
        </div>

        {/* Inline plan cards — no navigation away */}
        <div className="grid md:grid-cols-2 gap-4">
          {plansInfo.map((plan) => (
            <Card
              key={plan.name}
              className={`border-border flex flex-col h-full ${plan.highlighted ? 'ring-1 ring-accent' : ''}`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-lg">{plan.name}</CardTitle>
                  {plan.highlighted && (
                    <Badge className="text-xs shrink-0">Most Popular</Badge>
                  )}
                </div>
                <p className="text-sm font-semibold text-foreground pt-1">{plan.basePrice}</p>
              </CardHeader>
              <CardContent className="flex flex-col flex-1 space-y-4">
                <ul className="space-y-2">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Check className="w-4 h-4 text-accent shrink-0 mt-px" />
                      {f}
                    </li>
                  ))}
                </ul>

                {/* Learning Hub add-on block */}
                <div className="rounded-lg border border-accent/20 bg-accent/5 px-3 py-2.5 space-y-1.5 mt-auto">
                  <div className="flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-accent shrink-0" />
                    <span className="text-xs font-semibold text-accent uppercase tracking-wide">
                      Learning Hub Add-on
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">Available after upgrading:</p>
                  <ul className="space-y-0.5">
                    <li className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="w-1 h-1 rounded-full bg-accent/60 shrink-0" />
                      {plan.lhAddon.twoMonths}
                    </li>
                    <li className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="w-1 h-1 rounded-full bg-accent/60 shrink-0" />
                      {plan.lhAddon.annual}
                    </li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <p className="text-center text-xs text-muted-foreground pb-4">
          Contact support or visit our homepage to upgrade your plan.
        </p>
      </div>
    </Layout>
  );
}

// ─── Upgrade Prompt (Pro / Career Accelerator without add-on) ────────────────
interface UpgradePromptProps {
  profile: NonNullable<ReturnType<typeof useAuth>['profile']>;
  onPaymentSuccess: () => void;
}

function UpgradePrompt({ profile, onPaymentSuccess }: UpgradePromptProps) {
  const pricing = getLearningHubPricing(profile);
  const [selectedPeriod, setSelectedPeriod] = useState<'two_months' | 'annual'>('two_months');
  const [paying, setPaying] = useState(false);

  const handlePay = async () => {
    setPaying(true);
    try {
      const amount = getLearningHubAmount(profile, selectedPeriod);
      const callbackUrl = `${window.location.origin}/learning-hub`;
      const result = await initializePaystackPayment(amount, selectedPeriod, callbackUrl);
      if (!result) {
        toast.error('Failed to initialize payment. Please ensure PAYSTACK_SECRET_KEY is configured.');
        return;
      }
      // Redirect to Paystack
      window.location.href = result.authorization_url;
    } catch {
      toast.error('Payment initialization failed. Please try again.');
    } finally {
      setPaying(false);
    }
  };

  if (!pricing) return null;

  return (
    <Layout>
      <div className="flex flex-col items-center justify-center min-h-[60vh] max-w-lg mx-auto text-center space-y-8">
        <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center">
          <BookOpen className="w-7 h-7 text-accent" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">Unlock the Learning Hub</h1>
          <p className="text-muted-foreground text-sm text-pretty">
            Get access to curated career development video content across five categories: Interview
            Prep, CV Writing, Job Strategies, Salary Negotiation, and Professional Communication.
          </p>
        </div>

        {/* Pricing options */}
        <div className="w-full space-y-3">
          <button
            type="button"
            onClick={() => setSelectedPeriod('two_months')}
            className={`w-full flex items-center justify-between px-5 py-4 rounded-xl border transition-colors text-left ${
              selectedPeriod === 'two_months'
                ? 'border-accent bg-accent/5'
                : 'border-border hover:border-accent/40'
            }`}
          >
            <div>
              <p className="font-medium text-sm">2-Month Access</p>
              <p className="text-xs text-muted-foreground mt-0.5">Access for two months</p>
            </div>
            <span className="text-lg font-semibold">{pricing.twoMonths}</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedPeriod('annual')}
            className={`w-full flex items-center justify-between px-5 py-4 rounded-xl border transition-colors text-left ${
              selectedPeriod === 'annual'
                ? 'border-accent bg-accent/5'
                : 'border-border hover:border-accent/40'
            }`}
          >
            <div className="flex items-center gap-2">
              <div>
                <p className="font-medium text-sm">Annual Access</p>
                <p className="text-xs text-muted-foreground mt-0.5">Best value — full year access</p>
              </div>
              <Badge variant="secondary" className="text-xs">Best Value</Badge>
            </div>
            <span className="text-lg font-semibold">{pricing.annual}</span>
          </button>
        </div>

        <div className="w-full space-y-3">
          <p className="text-xs text-muted-foreground">
            Your subscription renewal date will be extended by 3 weeks upon activation.
          </p>
          <Button className="w-full gap-2" onClick={handlePay} disabled={paying}>
            {paying ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Processing…</>
            ) : (
              <>Pay Now</>
            )}
          </Button>
        </div>
      </div>
    </Layout>
  );
}

// ─── Main Learning Hub Page ───────────────────────────────────────────────────
export default function LearningHubPage() {
  const { user, profile, refreshProfile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [activeCategory, setActiveCategory] = useState<LearningHubCategory>(
    LEARNING_HUB_CATEGORIES[0].key
  );
  const [videosByCategory, setVideosByCategory] = useState<
    Record<string, VideoWatchProgress[]>
  >({});
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [modalVideo, setModalVideo] = useState<VideoWatchProgress | null>(null);
  const [showWatchedPrompt, setShowWatchedPrompt] = useState(false);
  const [verifyingPayment, setVerifyingPayment] = useState(false);
  const [paymentVerified, setPaymentVerified] = useState(false);

  // Handle Paystack callback — reference in URL
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const reference = params.get('reference') || params.get('trxref');
    if (!reference || verifyingPayment) return;

    setVerifyingPayment(true);
    (async () => {
      const result = await verifyPaystackPayment(reference);
      if (result?.success) {
        await refreshProfile();
        setPaymentVerified(true);
        toast.success('Learning Hub activated! Welcome aboard.');
      } else {
        toast.error(result?.message || 'Payment verification failed. Please contact support.');
      }
      setVerifyingPayment(false);
      // Clean URL
      navigate('/learning-hub', { replace: true });
    })();
  }, [location.search]);

  // Load or fetch videos when category changes
  const loadCategoryVideos = useCallback(
    async (category: LearningHubCategory) => {
      if (!user) return;
      setLoadingVideos(true);

      try {
        // First load existing DB progress
        let existing = await getVideoProgress(user.id, category);

        if (existing.length === 0) {
          // No videos yet — fetch from SerpApi
          const meta = LEARNING_HUB_CATEGORIES.find((c) => c.key === category)!;
          const fetched = await fetchYouTubeVideos(meta.query, []);
          if (fetched.length > 0) {
            await saveVideosToProgress(
              user.id,
              category,
              fetched.map((v) => ({
                video_id: v.video_id,
                video_title: v.title,
                thumbnail_url: v.thumbnail_url,
                channel_name: v.channel_name,
              })),
              0
            );
            existing = await getVideoProgress(user.id, category);
          }
        } else {
          // Check if all are watched → fetch more
          const allWatched = existing.length >= 10 && existing.every((v) => v.watched);
          if (allWatched) {
            const meta = LEARNING_HUB_CATEGORIES.find((c) => c.key === category)!;
            const excludeIds = existing.map((v) => v.video_id);
            const fetched = await fetchYouTubeVideos(meta.query, excludeIds);
            if (fetched.length > 0) {
              const startOrder = existing.length;
              await saveVideosToProgress(
                user.id,
                category,
                fetched.map((v) => ({
                  video_id: v.video_id,
                  video_title: v.title,
                  thumbnail_url: v.thumbnail_url,
                  channel_name: v.channel_name,
                })),
                startOrder
              );
              existing = await getVideoProgress(user.id, category);
            }
          }
        }

        setVideosByCategory((prev) => ({ ...prev, [category]: existing }));
      } finally {
        setLoadingVideos(false);
      }
    },
    [user]
  );

  useEffect(() => {
    if (hasLearningHubAccess(profile)) {
      loadCategoryVideos(activeCategory);
    }
  }, [activeCategory, profile]);

  const handleWatchVideo = (video: VideoWatchProgress) => {
    setModalVideo(video);
  };

  const handleCloseModal = () => {
    setShowWatchedPrompt(true);
  };

  const handleMarkWatched = async (confirmed: boolean) => {
    setShowWatchedPrompt(false);
    if (confirmed && modalVideo && user && !modalVideo.watched) {
      const ok = await markVideoWatched(user.id, modalVideo.video_id);
      if (ok) {
        // Update local state immediately
        setVideosByCategory((prev) => {
          const list = prev[activeCategory] ?? [];
          return {
            ...prev,
            [activeCategory]: list.map((v) =>
              v.video_id === modalVideo.video_id
                ? { ...v, watched: true, watched_at: new Date().toISOString() }
                : v
            ),
          };
        });
        toast.success('Marked as watched');
        // Check if all done → trigger load more
        const updatedList =
          videosByCategory[activeCategory]?.map((v) =>
            v.video_id === modalVideo.video_id ? { ...v, watched: true } : v
          ) ?? [];
        if (updatedList.length >= 10 && updatedList.every((v) => v.watched)) {
          await loadCategoryVideos(activeCategory);
        }
      }
    }
    setModalVideo(null);
  };

  // ─── Access control ──────────────────────────────────────────────────────────
  if (verifyingPayment) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
          <p className="text-muted-foreground text-sm">Verifying your payment…</p>
        </div>
      </Layout>
    );
  }

  if (!profile) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <Loader2 className="w-6 h-6 animate-spin text-accent" />
        </div>
      </Layout>
    );
  }

  if (!canAccessLearningHubAddon(profile)) {
    return <LockedScreen />;
  }

  if (!hasLearningHubAccess(profile)) {
    return <UpgradePrompt profile={profile} onPaymentSuccess={() => refreshProfile()} />;
  }

  const currentVideos = videosByCategory[activeCategory] ?? [];
  const activeMeta = LEARNING_HUB_CATEGORIES.find((c) => c.key === activeCategory)!;

  return (
    <Layout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-4xl font-bold mb-2">Learning Hub</h1>
            <p className="text-xl text-muted-foreground">
              Curated career development videos to help you succeed
            </p>
          </div>
          {profile.learning_hub_renewal_date && profile.plan !== 'career_accelerator' && (
            <Badge variant="secondary" className="text-xs shrink-0 mt-1">
              Active until {formatReadableDate(profile.learning_hub_renewal_date)}
            </Badge>
          )}
          {profile.plan === 'career_accelerator' && (
            <Badge variant="secondary" className="text-xs shrink-0 mt-1">
              Included in your plan
            </Badge>
          )}
        </div>

        {/* Payment success message */}
        {paymentVerified && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-accent/20 bg-accent/5">
            <CheckCircle2 className="w-4 h-4 text-accent shrink-0" />
            <p className="text-sm">
              <span className="font-medium text-accent">Learning Hub activated!</span>{' '}
              <span className="text-muted-foreground">
                Your renewal date has been extended by 3 weeks:{' '}
                {formatReadableDate(profile.learning_hub_renewal_date)}.
              </span>
            </p>
          </div>
        )}

        {/* Category tabs */}
        <div className="flex overflow-x-auto gap-1 border-b border-border pb-px">
          {LEARNING_HUB_CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              type="button"
              onClick={() => setActiveCategory(cat.key)}
              className={`px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
                activeCategory === cat.key
                  ? 'border-accent text-accent'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Progress tracker */}
        {currentVideos.length > 0 && (
          <CategoryProgress
            videos={currentVideos}
            categoryLabel={activeMeta.label}
          />
        )}

        {/* Video grid */}
        {loadingVideos ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Card key={i} className="border-border overflow-hidden">
                <Skeleton className="aspect-video w-full bg-muted" />
                <CardContent className="p-4 space-y-2">
                  <Skeleton className="h-4 w-full bg-muted" />
                  <Skeleton className="h-3 w-2/3 bg-muted" />
                  <Skeleton className="h-8 w-full bg-muted mt-2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : currentVideos.length === 0 ? (
          <Card className="border-border">
            <CardContent className="py-16 text-center">
              <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground text-sm">
                Unable to load videos. Please check your connection and try again.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => loadCategoryVideos(activeCategory)}
              >
                Retry
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {currentVideos.map((video) => (
              <VideoCard key={video.video_id} video={video} onWatch={handleWatchVideo} />
            ))}
          </div>
        )}
      </div>

      {/* Video modal */}
      <Dialog
        open={!!modalVideo && !showWatchedPrompt}
        onOpenChange={(open) => { if (!open) handleCloseModal(); }}
      >
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-3xl p-0 overflow-hidden border-border">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
            <DialogTitle className="text-base font-semibold leading-snug text-balance pr-6">
              {modalVideo?.video_title}
            </DialogTitle>
            {modalVideo?.channel_name && (
              <p className="text-xs text-muted-foreground mt-1">{modalVideo.channel_name}</p>
            )}
          </DialogHeader>
          {modalVideo && (
            <div className="aspect-video w-full bg-black">
              <iframe
                src={`https://www.youtube.com/embed/${modalVideo.video_id}?autoplay=1&rel=0`}
                title={modalVideo.video_title}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Mark as watched prompt */}
      <AlertDialog open={showWatchedPrompt} onOpenChange={setShowWatchedPrompt}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark as Watched?</AlertDialogTitle>
            <AlertDialogDescription>
              Would you like to mark{' '}
              <span className="font-medium text-foreground">
                &ldquo;{modalVideo?.video_title}&rdquo;
              </span>{' '}
              as watched? This will update your progress tracker.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => handleMarkWatched(false)}>
              Not yet
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => handleMarkWatched(true)}>
              Yes, mark as watched
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
