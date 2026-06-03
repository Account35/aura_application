import type { Profile, UserPlan, LearningHubCategory } from '@/types/types';

/**
 * Check if user is currently in trial period
 */
export function isInTrial(profile: Profile | null): boolean {
  if (!profile || !profile.trial_ends_at) return false;
  
  const trialEnd = new Date(profile.trial_ends_at);
  const now = new Date();
  
  return now < trialEnd;
}

/**
 * Get remaining trial days
 */
export function getTrialDaysRemaining(profile: Profile | null): number {
  if (!profile || !profile.trial_ends_at) return 0;
  
  const trialEnd = new Date(profile.trial_ends_at);
  const now = new Date();
  
  if (now >= trialEnd) return 0;
  
  const diffTime = trialEnd.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
}

/**
 * Returns true when plan_status is 'active' or NULL (NULL = legacy row created
 * before the column existed, treated as active for backward compatibility).
 */
function isPlanActive(status: string | null | undefined): boolean {
  return !status || status === 'active';
}

/**
 * Check if user has AI chat refinement access.
 * Cancelled plans retain access until expiry date.
 */
export function hasAIChatAccess(profile: Profile | null): boolean {
  if (!profile) return false;
  if (isInTrial(profile)) return true;
  const isEligiblePlan = profile.plan === 'pro' || profile.plan === 'career_accelerator';
  if (!isEligiblePlan) return false;
  // Cancelled but unexpired still has access
  if (profile.plan_status === 'cancelled' && profile.plan_renewal_date) {
    return new Date() < new Date(profile.plan_renewal_date);
  }
  return isPlanActive(profile.plan_status);
}

/**
 * Check if user has unlimited AI chat messages.
 * Cancelled Career Accelerator retains access until expiry.
 */
export function hasUnlimitedChat(profile: Profile | null): boolean {
  if (!profile) return false;
  if (isInTrial(profile)) return true;
  if (profile.plan !== 'career_accelerator') return false;
  if (profile.plan_status === 'cancelled' && profile.plan_renewal_date) {
    return new Date() < new Date(profile.plan_renewal_date);
  }
  return isPlanActive(profile.plan_status);
}

/**
 * Get chat message limit for user. Returns null for unlimited.
 * Cancelled plans retain their limit until expiry.
 */
export function getChatMessageLimit(profile: Profile | null): number | null {
  if (!profile) return 0;
  if (isInTrial(profile)) return null;

  const isExpiredCancelled = (renewalDate: string | null) =>
    !renewalDate || new Date() >= new Date(renewalDate);

  if (profile.plan === 'career_accelerator') {
    if (profile.plan_status === 'cancelled' && isExpiredCancelled(profile.plan_renewal_date)) return 0;
    return null;
  }
  if (profile.plan === 'pro') {
    if (profile.plan_status === 'cancelled' && isExpiredCancelled(profile.plan_renewal_date)) return 0;
    return 3;
  }
  return 0;
}

/**
 * Check if user can generate personalised CVs.
 * ONLY Career Accelerator users (active, trial, or cancelled-but-unexpired).
 * Pro and Free users do NOT get this feature.
 */
export function hasPersonalisedCVAccess(profile: Profile | null): boolean {
  if (!profile) return false;
  if (isInTrial(profile)) return true;
  if (profile.plan !== 'career_accelerator') return false;
  if (profile.plan_status === 'cancelled' && profile.plan_renewal_date) {
    return new Date() < new Date(profile.plan_renewal_date);
  }
  return isPlanActive(profile.plan_status);
}

/**
 * Check if user has access to the ATS scoring feature.
 * Cancelled plans retain access until expiry date.
 */
export function hasATSAccess(profile: Profile | null): boolean {
  if (!profile) return false;
  if (isInTrial(profile)) return true;
  const isEligiblePlan = profile.plan === 'pro' || profile.plan === 'career_accelerator';
  if (!isEligiblePlan) return false;
  if (profile.plan_status === 'cancelled' && profile.plan_renewal_date) {
    return new Date() < new Date(profile.plan_renewal_date);
  }
  return isPlanActive(profile.plan_status);
}

/**
 * Check if user can see ATS reasons (not just score).
 * Cancelled Career Accelerator retains full access until expiry.
 */
export function canSeeATSReasons(profile: Profile | null): boolean {
  if (!profile) return false;
  if (isInTrial(profile)) return true;
  if (profile.plan !== 'career_accelerator') return false;
  if (profile.plan_status === 'cancelled' && profile.plan_renewal_date) {
    return new Date() < new Date(profile.plan_renewal_date);
  }
  return isPlanActive(profile.plan_status);
}

/**
 * Get user's effective plan name for display
 */
export function getEffectivePlanName(profile: Profile | null): string {
  if (!profile) return 'Free';
  
  if (isInTrial(profile)) {
    const daysLeft = getTrialDaysRemaining(profile);
    return `Trial (${daysLeft} day${daysLeft === 1 ? '' : 's'} left)`;
  }
  
  const planNames: Record<UserPlan, string> = {
    free: 'Free',
    pro: 'Pro',
    career_accelerator: 'Career Accelerator',
  };
  
  return planNames[profile.plan] || 'Free';
}

/**
 * Check if user's base plan supports the Learning Hub add-on
 * (Pro or Career Accelerator only; not Free).
 * Cancelled-but-unexpired plans still qualify.
 */
export function canAccessLearningHubAddon(profile: Profile | null): boolean {
  if (!profile) return false;
  const isEligible = profile.plan === 'pro' || profile.plan === 'career_accelerator';
  if (!isEligible) return false;
  // Cancelled-but-expired base plan → no longer eligible
  if (profile.plan_status === 'cancelled' && profile.plan_renewal_date) {
    return new Date() < new Date(profile.plan_renewal_date);
  }
  return true;
}

/**
 * Check if user has an active Learning Hub subscription.
 * Career Accelerator includes it automatically (no add-on required).
 * Cancelled-but-unexpired Learning Hub subscriptions retain access.
 */
export function hasLearningHubAccess(profile: Profile | null): boolean {
  if (!profile) return false;

  // Career Accelerator includes Learning Hub — check base plan access
  if (profile.plan === 'career_accelerator') {
    if (profile.plan_status === 'cancelled' && profile.plan_renewal_date) {
      return new Date() < new Date(profile.plan_renewal_date);
    }
    return isPlanActive(profile.plan_status);
  }

  // Pro users need an active (or cancelled-but-unexpired) Learning Hub add-on
  if (!profile.learning_hub_addon) return false;
  if (!profile.learning_hub_renewal_date) return false;
  return new Date() < new Date(profile.learning_hub_renewal_date);
}

/**
 * Get Learning Hub add-on pricing for the user's plan
 */
export function getLearningHubPricing(profile: Profile | null): { twoMonths: string; annual: string } | null {
  if (!profile) return null;
  if (profile.plan === 'pro') return { twoMonths: 'R50', annual: 'R250/year' };
  if (profile.plan === 'career_accelerator') return { twoMonths: 'R100', annual: 'R500/year' };
  return null;
}

/**
 * Get Learning Hub add-on amount in kobo (ZAR cents) for Paystack
 */
export function getLearningHubAmount(
  profile: Profile | null,
  period: 'two_months' | 'annual'
): number {
  if (!profile) return 0;
  if (profile.plan === 'pro') return period === 'two_months' ? 5000 : 25000; // R50 or R250 in cents
  if (profile.plan === 'career_accelerator') return period === 'two_months' ? 10000 : 50000; // R100 or R500
  return 0;
}

/**
 * Check if user's base plan can be cancelled (paid + active + not yet expired)
 */
export function canCancelPlan(profile: Profile | null): boolean {
  if (!profile) return false;
  if (profile.plan === 'free') return false;
  return profile.plan_status === 'active';
}

/**
 * Check if user's base plan can be reinstated
 * (cancelled + expiry date has NOT yet passed)
 */
export function canReinstatePlan(profile: Profile | null): boolean {
  if (!profile) return false;
  if (profile.plan_status !== 'cancelled') return false;
  if (!profile.plan_renewal_date) return false;
  return new Date() < new Date(profile.plan_renewal_date);
}

/**
 * Check if Learning Hub add-on can be cancelled
 */
export function canCancelLearningHub(profile: Profile | null): boolean {
  if (!profile) return false;
  if (!profile.learning_hub_addon) return false;
  // Career Accelerator LH is bundled — they cancel the base plan instead
  if (profile.plan === 'career_accelerator') return false;
  return profile.learning_hub_plan_status === 'active';
}

/**
 * Check if Learning Hub add-on can be reinstated
 */
export function canReinstateLearningHub(profile: Profile | null): boolean {
  if (!profile) return false;
  if (profile.plan === 'career_accelerator') return false;
  if (profile.learning_hub_plan_status !== 'cancelled') return false;
  if (!profile.learning_hub_renewal_date) return false;
  return new Date() < new Date(profile.learning_hub_renewal_date);
}

/**
 * Format a date string in human-readable format: day month year
 */
export function formatReadableDate(dateString: string | null | undefined): string {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export const LEARNING_HUB_CATEGORIES: Array<{ key: LearningHubCategory; label: string; query: string }> = [
  { key: 'interview_preparation', label: 'Interview Preparation', query: 'job interview tips and techniques' },
  { key: 'cv_writing_tips', label: 'CV Writing Tips', query: 'how to write a professional CV' },
  { key: 'job_application_strategies', label: 'Job Application Strategies', query: 'job application strategies for job seekers' },
  { key: 'salary_negotiation', label: 'Salary Negotiation', query: 'how to negotiate salary effectively' },
  { key: 'professional_communication', label: 'Professional Communication', query: 'professional communication skills for the workplace' },
];
