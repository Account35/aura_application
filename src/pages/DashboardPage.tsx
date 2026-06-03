import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { FileText, Sparkles } from 'lucide-react';
import Layout from '@/components/layouts/Layout';
import { isInTrial, getTrialDaysRemaining, getEffectivePlanName } from '@/lib/planUtils';

export default function DashboardPage() {
  const { profile } = useAuth();
  const inTrial = isInTrial(profile);
  const trialDaysLeft = getTrialDaysRemaining(profile);
  const effectivePlan = getEffectivePlanName(profile);

  return (
    <Layout>
      <div className="space-y-8">
        <div>
          <h1 className="text-4xl font-bold mb-2">
            Welcome back, {profile?.name || 'there'}!
          </h1>
          <p className="text-xl text-secondary">
            Ready to create your next professional cover letter?
          </p>
          {inTrial && (
            <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent/10 border border-accent/20">
              <span className="text-lg font-semibold text-accent">
                🎉 Trial Active: {trialDaysLeft} day{trialDaysLeft === 1 ? '' : 's'} remaining
              </span>
            </div>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card className="border-border">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-accent" />
                </div>
                <div>
                  <CardTitle className="text-2xl">Generations Remaining</CardTitle>
                  <CardDescription className="text-base">
                    {profile?.plan === 'free'
                      ? 'Free plan monthly limit'
                      : 'Unlimited generations'}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {profile?.plan === 'free' ? (
                <div className="space-y-4">
                  <div className="text-5xl font-bold text-accent">
                    {profile?.generation_count || 0}
                  </div>
                  <p className="text-secondary">
                    {profile?.generation_count === 0
                      ? 'You have used all your generations for this month'
                      : `${profile?.generation_count} generation${profile?.generation_count === 1 ? '' : 's'} left this month`}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="text-5xl font-bold text-accent">∞</div>
                  <p className="text-secondary">
                    Unlimited cover letter generations with your {profile?.plan} plan
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center">
                  <FileText className="w-6 h-6 text-accent" />
                </div>
                <div>
                  <CardTitle className="text-2xl">Quick Actions</CardTitle>
                  <CardDescription className="text-base">
                    Get started with your next application
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button asChild className="w-full justify-start" size="lg">
                <Link to="/generate">
                  <FileText className="w-5 h-5 mr-2" />
                  Generate New Cover Letter
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full justify-start" size="lg">
                <Link to="/history">View Past Cover Letters</Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        {profile?.plan === 'free' && !inTrial && (
          <Card className="border-accent/50 bg-accent/5">
            <CardHeader>
              <CardTitle className="text-2xl">Your Trial Has Ended</CardTitle>
              <CardDescription className="text-base">
                Upgrade to Pro or Career Accelerator to continue using premium features
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-secondary mb-4">
                Your 5-day trial has ended. Upgrade now to unlock unlimited generations, AI-powered
                refinement chat, and full ATS compatibility scoring.
              </p>
              <Button asChild>
                <Link to="/plans">View Plans</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {inTrial && (
          <Card className="border-accent/50 bg-accent/5">
            <CardHeader>
              <CardTitle className="text-2xl">🎉 Enjoying Your Trial?</CardTitle>
              <CardDescription className="text-base">
                You have {trialDaysLeft} day{trialDaysLeft === 1 ? '' : 's'} left with full access to all features
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-secondary mb-4">
                During your trial, you have unlimited access to AI refinement chat and full ATS scoring.
                Upgrade before your trial ends to keep these premium features!
              </p>
              <div className="space-y-2 text-sm text-secondary">
                <p>✓ Unlimited AI chat refinement</p>
                <p>✓ Full ATS compatibility scoring with detailed reasons</p>
                <p>✓ CV summary generation</p>
                <p>✓ 10 cover letter generations per month</p>
              </div>
              <Button asChild className="mt-4">
                <Link to="/plans">Upgrade Now</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
