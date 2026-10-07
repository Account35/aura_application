import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/layouts/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getCoverLetters, getMockInterviewSessions, getMockInterviewUsage, runMockInterviewAction } from '@/db/api';
import type { CoverLetter, MockInterviewFeedbackReport, MockInterviewSession, MockInterviewUsage } from '@/types/types';
import { ArrowRight, BookOpen, CheckCircle2, Clock3, Loader2, LockKeyhole, Video } from 'lucide-react';
import { toast } from 'sonner';

function roleName(letter: CoverLetter): string {
  if (letter.job_title?.trim()) return letter.job_title.trim();
  const match = letter.job_description.match(/(?:job\s*title|position|role)\s*[:\-]\s*([^\r\n]+)/i);
  return match?.[1]?.trim() || 'Application interview';
}

function ReportContent({ report }: { report: MockInterviewFeedbackReport }) {
  return (
    <div className="space-y-5">
      <p className="leading-relaxed text-secondary">{report.overall_summary}</p>
      <section>
        <h3 className="mb-2 font-semibold">Strengths</h3>
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-secondary">{report.strengths.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul>
      </section>
      <section>
        <h3 className="mb-2 font-semibold">Areas to Improve</h3>
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-secondary">{report.areas_to_improve.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul>
      </section>
      <section>
        <h3 className="mb-2 font-semibold">Recommended Next Steps</h3>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-secondary">
          {report.recommended_next_steps.map((item, index) => (
            <li key={`${index}-${item}`}>
              {index === report.recommended_next_steps.length - 1 ? (
                <>{item.replace(/\s*\(\/learning-hub\)\.?$/, '')} <Link className="inline-flex items-center font-medium text-accent hover:underline" to="/learning-hub">Visit Learning Hub <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link></>
              ) : item}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

export default function MockInterviewPage() {
  const { user } = useAuth();
  const location = useLocation();
  const preloadedLetter = (location.state as { coverLetter?: CoverLetter } | null)?.coverLetter ?? null;
  const [coverLetters, setCoverLetters] = useState<CoverLetter[]>([]);
  const [sessions, setSessions] = useState<MockInterviewSession[]>([]);
  const [usage, setUsage] = useState<MockInterviewUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedApplication, setSelectedApplication] = useState(preloadedLetter?.id ?? 'general');
  const [session, setSession] = useState<MockInterviewSession | null>(null);
  const [starting, setStarting] = useState(false);
  const [ending, setEnding] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [lockReason, setLockReason] = useState<'plan_required' | 'limit_reached' | null>(null);
  const [reportSession, setReportSession] = useState<MockInterviewSession | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);

  const selectedLetter = useMemo(
    () => coverLetters.find((letter) => letter.id === selectedApplication) ?? (preloadedLetter?.id === selectedApplication ? preloadedLetter : null),
    [coverLetters, selectedApplication, preloadedLetter],
  );
  const isTrial = usage?.is_trial ?? false;
  const accessAllowed = usage?.allowed ?? false;

  const refreshData = useCallback(async () => {
    if (!user) return;
    const [letters, pastSessions, currentUsage] = await Promise.all([
      getCoverLetters(user.id),
      getMockInterviewSessions(user.id),
      getMockInterviewUsage(),
    ]);
    setCoverLetters(letters);
    setSessions(pastSessions.filter((item) => item.status === 'ended'));
    setSession((current) => current ?? pastSessions.find((item) => item.status === 'active') ?? null);
    setUsage(currentUsage);
    setLockReason(currentUsage?.allowed === false
      ? currentUsage.plan === 'pro' && (currentUsage.used >= (currentUsage.limit ?? 5)) ? 'limit_reached' : 'plan_required'
      : null);
    setLoading(false);
  }, [user]);

  useEffect(() => { void refreshData(); }, [refreshData]);

  useEffect(() => {
    if (!preloadedLetter) return;
    setSelectedApplication(preloadedLetter.id);
    setSession(null);
  }, [preloadedLetter]);

  const handleStartInterview = async () => {
    setStarting(true);
    setRequestError(null);
    try {
      const result = await runMockInterviewAction('start', {
        coverLetterId: selectedLetter?.id ?? null,
      });
      if (!result) {
        setRequestError('Could not reach the mock interview service. Please try again.');
        return;
      }
      if (result.locked) {
        setUsage((current) => current ? { ...current, ...result.usage, allowed: false } : result.usage ?? current);
        setLockReason(result.reason ?? 'plan_required');
        return;
      }
      if (result.error || !result.session) {
        setRequestError(result.error || 'The interviewer could not be started. Please try again.');
        return;
      }
      setSession(result.session);
      setLockReason(null);
      if (result.usage) setUsage((current) => current ? { ...current, ...result.usage } : current);
      toast.success('Your interview room is ready. Allow camera and microphone access to begin.');
      void refreshData();
    } catch (error) {
      console.error('Mock interview start request failed:', error);
      setRequestError('Could not reach the mock interview service. Please try again.');
    } finally {
      setStarting(false);
    }
  };

  const updateSessionStatus = useCallback(async (currentSession: MockInterviewSession, action: 'status' | 'end') => {
    const result = await runMockInterviewAction(action, { sessionId: currentSession.id });
    if (result?.session) {
      setSession(result.session);
      if (result.session.status === 'ended') {
        await refreshData();
        if (result.session.feedback_report) toast.success('Your interview feedback report is ready.');
      }
      if (result.reportError) setRequestError(result.reportError);
    } else if (result?.error) {
      setRequestError(result.error);
    }
  }, [refreshData]);

  useEffect(() => {
    if (!session || session.status !== 'active') return;
    const timer = window.setInterval(() => { void updateSessionStatus(session, 'status'); }, 15_000);
    return () => window.clearInterval(timer);
  }, [session, updateSessionStatus]);

  const handleEndInterview = async () => {
    if (!session) return;
    setEnding(true);
    setRequestError(null);
    await updateSessionStatus(session, 'end');
    setEnding(false);
  };

  const handleViewReport = async (pastSession: MockInterviewSession) => {
    setReportSession(pastSession);
    if (pastSession.feedback_report) return;
    setLoadingReport(true);
    const result = await runMockInterviewAction('status', { sessionId: pastSession.id });
    setLoadingReport(false);
    if (result?.session) {
      setReportSession(result.session);
      setSessions((items) => items.map((item) => item.id === result.session?.id ? result.session! : item));
    } else if (result?.error) {
      toast.error(result.error);
    }
  };

  const dateLabel = (value: string) => new Date(value).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' });

  if (loading) {
    return <Layout><div className="space-y-5"><Skeleton className="h-9 w-64" /><Skeleton className="h-48 w-full" /></div></Layout>;
  }

  const report = session?.feedback_report as MockInterviewFeedbackReport | null | undefined;
  const usageCaption = usage?.plan === 'pro' && !isTrial
    ? `${usage.used} of 5 sessions used this billing month · ${usage.remaining ?? 0} remaining`
    : isTrial
      ? 'Full mock interview access is included during your free trial.'
      : usage?.plan === 'career_accelerator'
        ? 'Unlimited mock interview sessions are included in Career Accelerator.'
        : 'Mock interviews are available during your free trial or with a paid plan.';

  return (
    <Layout>
      <div className="space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold">Mock Interview</h1>
          <p className="max-w-3xl text-secondary">Practice speaking with an AI interviewer, prepare for a specific application, and get a personalized feedback report afterward.</p>
        </header>

        {!session && (
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Video className="h-5 w-5 text-accent" /> Start a practice interview</CardTitle>
              <CardDescription>Choose a saved application or practice with general interview questions.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <label htmlFor="interview-application" className="text-sm font-medium">Choose a role</label>
                <select
                  id="interview-application"
                  value={selectedApplication}
                  onChange={(event) => setSelectedApplication(event.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  disabled={!accessAllowed}
                >
                  <option value="general">General professional interview</option>
                  {coverLetters.map((letter) => <option key={letter.id} value={letter.id}>{roleName(letter)} · {dateLabel(letter.created_at)}</option>)}
                </select>
              </div>

              <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm">
                <p><span className="text-muted-foreground">Practice role:</span> <span className="font-medium">{selectedLetter ? roleName(selectedLetter) : 'General professional interview'}</span></p>
                {selectedLetter && <p className="mt-1 text-muted-foreground">The interviewer will use this application’s role and job description to tailor questions.</p>}
                <p className="mt-2"><span className="text-muted-foreground">Interviewer:</span> <span className="font-medium">Aur.a AI Interviewer</span></p>
                <p className="mt-1 text-xs text-muted-foreground">Plan for a spoken interview lasting about 15–20 minutes.</p>
              </div>

              <p className="text-sm text-muted-foreground">{usageCaption}</p>

              {!accessAllowed ? (
                  <div className="rounded-lg border border-accent/20 bg-accent/5 p-5">
                  <div className="flex items-start gap-3">
                    <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
                    <div className="space-y-2">
                      <p className="font-semibold">{lockReason === 'limit_reached' ? 'You’ve used all five sessions this billing month' : 'Mock interviews need an active plan or trial'}</p>
                      <p className="text-sm text-secondary">{lockReason === 'limit_reached' ? 'Upgrade to Career Accelerator for unlimited practice, or come back when your monthly sessions reset.' : 'Start a five-day free trial or choose a plan to practice with the AI interviewer.'}</p>
                      <Button asChild className="mt-1"><Link to="/plans">Explore plans</Link></Button>
                    </div>
                  </div>
                </div>
              ) : (
                <Button type="button" onClick={handleStartInterview} disabled={starting} className="bg-accent text-accent-foreground hover:bg-accent/90">
                  {starting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Preparing interviewer…</> : <><Video className="mr-2 h-4 w-4" /> Start Interview</>}
                </Button>
              )}
              {requestError && <p role="alert" className="text-sm text-destructive">{requestError}</p>}
            </CardContent>
          </Card>
        )}

        {session && session.status === 'active' && (
          <Card className="border-border">
            <CardHeader>
              <CardTitle>{session.role_name}</CardTitle>
              <CardDescription>{session.company_name ? `${session.company_name} · ` : ''}{session.interviewer_name}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {session.tavus_conversation_url ? (
                <iframe
                  src={session.tavus_conversation_url}
                  title="Aur.a mock interview with AI interviewer"
                  allow="camera; microphone; fullscreen; display-capture; autoplay"
                  className="aspect-video w-full rounded-xl border border-border bg-black"
                />
              ) : <p className="text-sm text-destructive">The Tavus interview room URL is missing.</p>}
              <p className="text-xs text-muted-foreground">Speak naturally with the interviewer. No written answers are needed.</p>
              <Button variant="outline" onClick={handleEndInterview} disabled={ending}>
                {ending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Ending interview…</> : 'End Interview'}
              </Button>
              {requestError && <p role="alert" className="text-sm text-destructive">{requestError}</p>}
            </CardContent>
          </Card>
        )}

        {session?.status === 'ended' && (
          <Card className="border-accent/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-accent" /> Interview complete</CardTitle>
              <CardDescription>{session.role_name} · {session.duration_seconds ? `${Math.max(1, Math.round(session.duration_seconds / 60))} minutes` : 'Session ended'}</CardDescription>
            </CardHeader>
            <CardContent>
              {report ? <ReportContent report={report} /> : <p className="text-sm text-muted-foreground">Your report is being prepared. It will appear here shortly.</p>}
              {requestError && <p role="alert" className="mt-4 text-sm text-destructive">{requestError}</p>}
              {!report && <Button variant="outline" className="mt-4" onClick={() => void updateSessionStatus(session, 'status')}>Retry feedback report</Button>}
              <Button className="ml-2 mt-4" onClick={() => { setSession(null); setRequestError(null); }}>Start another interview</Button>
            </CardContent>
          </Card>
        )}

        <section className="space-y-4">
          <div>
            <h2 className="text-2xl font-semibold">Past mock interviews</h2>
            <p className="text-sm text-muted-foreground">Review your previous practice sessions and feedback reports.</p>
          </div>
          {sessions.length === 0 ? (
            <Card className="border-border"><CardContent className="py-8 text-center text-sm text-muted-foreground">Your completed mock interviews will appear here.</CardContent></Card>
          ) : (
            <div className="space-y-3">
              {sessions.map((pastSession) => (
                <Card key={pastSession.id} className="border-border">
                  <CardContent className="flex flex-col justify-between gap-4 py-4 sm:flex-row sm:items-center">
                    <div>
                      <p className="font-medium">{pastSession.role_name}</p>
                      <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground"><Clock3 className="h-4 w-4" />{dateLabel(pastSession.started_at)}{pastSession.company_name ? ` · ${pastSession.company_name}` : ''}</p>
                    </div>
                    <Button variant="outline" onClick={() => void handleViewReport(pastSession)}>
                      <BookOpen className="mr-2 h-4 w-4" /> View report
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        <Dialog open={!!reportSession} onOpenChange={(open) => { if (!open) setReportSession(null); }}>
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{reportSession?.role_name} · Interview feedback</DialogTitle>
              <DialogDescription>{reportSession ? dateLabel(reportSession.started_at) : ''}{reportSession?.company_name ? ` · ${reportSession.company_name}` : ''}</DialogDescription>
            </DialogHeader>
            {loadingReport ? <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading feedback report…</div>
              : reportSession?.feedback_report ? <ReportContent report={reportSession.feedback_report} />
                : <p className="py-6 text-sm text-muted-foreground">The report is not available yet. Close and reopen this report in a moment.</p>}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
