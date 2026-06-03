import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, Sparkles, Target, Upload, FileCheck, Zap, Check, BookOpen } from 'lucide-react';

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
      ],
      addonNote: {
        twoMonths: 'R50 for 2 months',
        annual: 'R250/year',
      },
      highlighted: false,
    },
    {
      name: 'Career Accelerator',
      price: 'R300/year',
      trial: 'Start with 5-day trial',
      features: [
        'Unlimited generations',
        'Unlimited AI chat',
        'Full ATS score with all reasons',
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
              Generate Professional
              <br />
              <span className="text-accent">Cover Letters</span> with AI
            </h1>
            <p className="text-xl md:text-2xl text-secondary max-w-3xl mx-auto text-pretty">
              Aur.a helps job seekers create tailored, ATS-compatible cover letters in minutes.
              Powered by advanced AI to give you the competitive edge.
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
            <p className="text-xl text-secondary">Three simple steps to your perfect cover letter</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="border-border text-center h-full">
              <CardHeader>
                <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
                  <Upload className="w-8 h-8 text-accent" />
                </div>
                <CardTitle className="text-2xl">1. Upload your CV</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base text-secondary text-pretty">
                  Upload your CV as a PDF file. Our AI will extract and analyze all the important
                  details from your document.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="border-border text-center h-full">
              <CardHeader>
                <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-8 h-8 text-accent" />
                </div>
                <CardTitle className="text-2xl">2. Enter job details</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base text-secondary text-pretty">
                  Provide the job title and paste the job description. Our AI will analyze the
                  requirements and match them to your experience.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="border-border text-center h-full">
              <CardHeader>
                <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="w-8 h-8 text-accent" />
                </div>
                <CardTitle className="text-2xl">3. Generate your letter</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base text-secondary text-pretty">
                  Click generate and receive a professional, tailored cover letter ready to send.
                </CardDescription>
              </CardContent>
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

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="border-border h-full">
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center mb-4">
                  <Zap className="w-6 h-6 text-accent" />
                </div>
                <CardTitle className="text-2xl">AI-Powered Generation</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base text-secondary text-pretty">
                  Advanced AI analyzes your CV and the job description to create perfectly tailored
                  cover letters that highlight your relevant experience.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="border-border h-full">
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center mb-4">
                  <Target className="w-6 h-6 text-accent" />
                </div>
                <CardTitle className="text-2xl">ATS Compatibility</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base text-secondary text-pretty">
                  Get an ATS compatibility score to ensure your application passes automated
                  screening systems and reaches human recruiters.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="border-border h-full">
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center mb-4">
                  <FileCheck className="w-6 h-6 text-accent" />
                </div>
                <CardTitle className="text-2xl">Iterative Refinement</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base text-secondary text-pretty">
                  Use our AI chat panel to refine your cover letter with natural language
                  instructions until it's perfect.
                </CardDescription>
              </CardContent>
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
