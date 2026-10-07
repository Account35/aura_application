import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Upload, Zap, Check, BookOpen, BriefcaseBusiness, Video } from 'lucide-react';

export default function LandingPage() {
  const plans = [
    {
      name: 'Free',
      price: 'Free forever',
      trial: '5-day trial with all features',
      features: [
        '10 generations per month',
        'Manual editing only (after trial)',
        'No AI refinement (after trial)',
        'No ATS score access (after trial)',
      ],
      addonNote: null,
      highlighted: false,
    },
    {
      name: 'Pro',
      price: 'R30 for 2 months or R300/year',
      trial: 'Start with 5-day trial',
      features: [
        'Unlimited generations',
        '3 AI refinement messages per cover letter',
        'ATS score visible (reasons blurred)',
        '5 mock interview sessions per month',
      ],
      addonNote: {
        twoMonths: 'R50 for 2 months',
        annual: 'R250/year',
      },
      highlighted: false,
    },
    {
      name: 'Career Accelerator',
      price: 'R600/year',
      trial: 'Start with 5-day trial',
      features: [
        'Unlimited generations',
        'Unlimited AI chat',
        'Full ATS score with all reasons',
        'Unlimited mock interview sessions',
        'Learning Hub included',
        'Full post-interview AI feedback report',
      ],
      addonNote: {
        twoMonths: 'R100 for 2 months',
        annual: 'R500/year',
      },
      highlighted: true,
    },
  ];

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative py-20 md:py-32">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="text-center space-y-8">
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-balance">
              From Application to Interview
              <br />
              <span className="text-accent">Your Complete Job Search</span>
            </h1>
            <p className="text-xl md:text-2xl text-secondary max-w-3xl mx-auto text-pretty">
              Aur.a supports your entire job seeking journey with AI cover letter generation,
              application tracking, mock interview preparation, and career learning resources.
            </p>
            <div className="flex flex-col items-center gap-4">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 border border-accent/20">
                <span className="text-sm font-semibold text-accent">
                  🎉 Start with a 5-day free trial — all features unlocked!
                </span>
              </div>
              <Button asChild size="lg" className="text-lg px-8 py-6">
                <Link to="/signup">Start Free Trial</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 bg-card/50">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-balance">How It Works</h2>
            <p className="text-xl text-secondary">From your first application to your next opportunity</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <Card className="border-border text-center h-full">
              <CardHeader>
                <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
                  <Upload className="w-8 h-8 text-accent" />
                </div>
                <CardTitle className="text-2xl">1. Generate your cover letter</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base text-secondary text-pretty">
                  Create a tailored cover letter matched to your experience and the role.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="border-border text-center h-full">
              <CardHeader>
                <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
                  <BriefcaseBusiness className="w-8 h-8 text-accent" />
                </div>
                <CardTitle className="text-2xl">2. Track your application status</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base text-secondary text-pretty">
                  Keep every application organized from submission through interview and offer.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="border-border text-center h-full">
              <CardHeader>
                <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
                  <Video className="w-8 h-8 text-accent" />
                </div>
                <CardTitle className="text-2xl">3. Prepare with a mock interview</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base text-secondary text-pretty">
                  Practice with an AI interviewer and build confidence for your next conversation.
                </CardDescription>
              </CardContent>
            </Card>
            <Card className="border-border text-center h-full">
              <CardHeader>
                <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4"><Sparkles className="w-8 h-8 text-accent" /></div>
                <CardTitle className="text-2xl">4. Land the job</CardTitle>
              </CardHeader>
              <CardContent><CardDescription className="text-base text-secondary text-pretty">Use career learning resources and interview feedback to keep improving.</CardDescription></CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-balance">Why Choose Aur.a?</h2>
            <p className="text-xl text-secondary">
              Powerful features to accelerate your job search
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <Card className="border-border h-full">
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center mb-4">
                  <BriefcaseBusiness className="w-6 h-6 text-accent" />
                </div>
                <CardTitle className="text-2xl">Application Tracking</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base text-secondary text-pretty">
                  Keep every application organized and see your progress from Applied through Interview and Offer.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="border-border h-full">
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center mb-4">
                  <Video className="w-6 h-6 text-accent" />
                </div>
                <CardTitle className="text-2xl">Mock Interview Practice</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base text-secondary text-pretty">
                  Practice realistic interview conversations and get feedback to strengthen your answers.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="border-border h-full">
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center mb-4">
                  <BookOpen className="w-6 h-6 text-accent" />
                </div>
                <CardTitle className="text-2xl">Career Learning Resources</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base text-secondary text-pretty">
                  Build job search, communication, and career skills with curated learning resources.
                </CardDescription>
              </CardContent>
            </Card>
            <Card className="border-border h-full">
              <CardHeader><div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center mb-4"><Zap className="w-6 h-6 text-accent" /></div><CardTitle className="text-2xl">Tailored Applications</CardTitle></CardHeader>
              <CardContent><CardDescription className="text-base text-secondary text-pretty">Generate tailored cover letters with ATS insights and AI refinement to help your application stand out.</CardDescription></CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 bg-card/50">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-balance">
              Simple, Transparent Pricing
            </h2>
            <p className="text-xl text-secondary">Choose the plan that fits your needs</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {plans.map((plan) => (
              <Card
                key={plan.name}
                className={`border-border flex flex-col h-full ${plan.highlighted ? 'ring-2 ring-accent' : ''}`}
              >
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-2xl">{plan.name}</CardTitle>
                    {plan.highlighted && (
                      <Badge className="text-xs shrink-0">Most Popular</Badge>
                    )}
                  </div>
                  <CardDescription className="text-lg font-semibold text-foreground pt-2">
                    {plan.price}
                  </CardDescription>
                  <p className="text-sm text-accent font-medium pt-1">{plan.trial}</p>
                </CardHeader>
                <CardContent className="flex flex-col flex-1 space-y-6">
                  <ul className="space-y-3 flex-1">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-3">
                        <Check className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                        <span className="text-secondary text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {/* Learning Hub add-on section */}
                  {plan.addonNote ? (
                    <div className="rounded-lg border border-accent/20 bg-accent/5 px-4 py-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-accent shrink-0" />
                        <span className="text-xs font-semibold text-accent uppercase tracking-wide">
                          Learning Hub Add-on
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Unlock curated career development videos:
                      </p>
                      <ul className="space-y-1">
                        <li className="flex items-center gap-2 text-xs text-secondary">
                          <span className="w-1 h-1 rounded-full bg-accent/60 shrink-0" />
                          {plan.addonNote.twoMonths}
                        </li>
                        <li className="flex items-center gap-2 text-xs text-secondary">
                          <span className="w-1 h-1 rounded-full bg-accent/60 shrink-0" />
                          {plan.addonNote.annual}
                        </li>
                      </ul>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-border px-4 py-3">
                      <div className="flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className="text-xs text-muted-foreground">
                          Learning Hub not available on Free plan
                        </span>
                      </div>
                    </div>
                  )}

                  <Button
                    asChild
                    className="w-full mt-auto"
                    variant={plan.highlighted ? 'default' : 'outline'}
                  >
                    <Link to="/signup">Start Free Trial</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-border">
        <div className="container mx-auto px-4 max-w-6xl">
          <p className="text-center text-secondary">
            Built with passion to help job seekers succeed, developed by Lwando Ntlemeza.
          </p>
          <p className="text-center text-sm text-muted-foreground mt-2">
            © 2026 Aur.a. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
