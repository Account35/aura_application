import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useGeneration } from '@/contexts/GenerationContext';
import { useChat } from '@/contexts/ChatContext';
import type { CoverLetterResult } from '@/contexts/GenerationContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import Layout from '@/components/layouts/Layout';
import {
  extractPdfText,
  updateProfileCV,
} from '@/db/api';
import {
  Copy,
  Download,
  Upload,
  Loader2,
  AlertCircle,
  Target,
  Sparkles,
  CheckCircle2,
  MessageCircle,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  hasATSAccess,
  canSeeATSReasons,
  isInTrial,
  getTrialDaysRemaining,
} from '@/lib/planUtils';

export default function GeneratePage() {
  const { user, profile, refreshProfile } = useAuth();
  const generation = useGeneration();
  const { setGeneratedContext, openChat } = useChat();

  // ── Shared inputs ──────────────────────────────────────────────────────────
  const [cvContent, setCvContent] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [usingSavedCV, setUsingSavedCV] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Cover letter results (populated from context after background run) ─────
  const [coverLetter, setCoverLetter] = useState('');
  const [atsScore, setAtsScore] = useState<number | null>(null);
  const [atsReasons, setAtsReasons] = useState<string[]>([]);
  const [cvSummary, setCvSummary] = useState('');

  // ── Load saved CV on mount ─────────────────────────────────────────────────
  useEffect(() => {
    if (profile?.cv_content) {
      setCvContent(profile.cv_content);
      setUsingSavedCV(true);
    }
  }, [profile]);

  // ── Hydrate results from context when user returns to this page ───────────
  useEffect(() => {
    if (generation.status === 'complete' && generation.result) {
      const { result, inputs } = generation;

      // Restore shared inputs so the form looks populated
      if (inputs) {
        if (!cvContent) setCvContent(inputs.cvContent);
        if (!jobTitle) setJobTitle(inputs.jobTitle);
        if (!jobDescription) setJobDescription(inputs.jobDescription);
      }

      if (result.type === 'cover_letter') {
        const d = result.data as CoverLetterResult;
        setCoverLetter(d.coverLetter);
        setAtsScore(d.atsScore);
        setAtsReasons(d.atsReasons);
        setCvSummary(d.cvSummary);

        // Expose to global chat widget
        setGeneratedContext({
          type: 'cover_letter',
          coverLetter: d.coverLetter,
          jobTitle: inputs?.jobTitle ?? '',
          jobDescription: inputs?.jobDescription ?? '',
          cvContent: inputs?.cvContent ?? '',
          letterId: d.letterId,
        });

        generation.markResultViewed();
      }
    }
  }, [generation.status, generation.result]); // eslint-disable-line react-hooks/exhaustive-deps

  const canGenerate = profile && (profile.plan !== 'free' || profile.generation_count > 0);

  // ── File upload ────────────────────────────────────────────────────────────
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError('');
    setCvContent('');
    setUploadedFileName('');
    setUsingSavedCV(false);

    if (file.type !== 'application/pdf') {
      setUploadError('Please upload a PDF file only.');
      return;
    }
    if (file.size > 1024 * 1024) {
      setUploadError('File size must be less than 1MB. Please compress your PDF or use a smaller file.');
      return;
    }

    setLoading(true);
    setUploadedFileName(file.name);

    try {
      const text = await extractPdfText(file);

      if (!text || text.trim().length < 50) {
        setUploadError(
          'Unable to extract text from your PDF. Please try another PDF file or upload a text-based version.'
        );
        setLoading(false);
        return;
      }

      setCvContent(text);
      await updateProfileCV(text);
      setUsingSavedCV(true);
      setLoading(false);
      toast.success(`CV uploaded and saved (${text.length} characters)`);
    } catch (error: unknown) {
      const err = error as Error;
      let msg = 'Unable to process your PDF. Please try another PDF file.';
      if (err.message?.includes('INSUFFICIENT_TEXT'))
        msg = 'Your PDF appears empty or scanned as an image. Please upload a text-based PDF.';
      else if (err.message?.includes('INVALID_FILE_TYPE'))
        msg = 'Please upload a valid PDF file.';
      else if (err.message?.includes('FILE_TOO_LARGE'))
        msg = 'Your file is too large. Please compress to under 1MB.';
      setUploadError(msg);
      setLoading(false);
    }
  };

  // ── Cover letter background generation ────────────────────────────────────
  const handleGenerateCoverLetter = () => {
    if (!cvContent.trim() || !jobTitle.trim() || !jobDescription.trim()) {
      toast.error('Please provide your CV, job title, and job description');
      return;
    }
    if (!canGenerate) {
      toast.error('You have reached your monthly generation limit');
      return;
    }
    if (!user) {
      toast.error('Please sign in to generate');
      return;
    }

    // All async logic lives in the context — no component closure is captured.
    generation.startCoverLetterGeneration(
      { cvContent, jobTitle, jobDescription },
      user.id,
      profile?.plan !== 'free',
      refreshProfile
    );

    toast.info('Generation started — you can browse other pages while we work on it.');
  };

  // ── Download helpers ───────────────────────────────────────────────────────
  const handleCopyCoverLetter = () => {
    navigator.clipboard.writeText(coverLetter);
    toast.success('Cover letter copied to clipboard');
  };

  const handleDownloadCoverLetter = () => {
    const blob = new Blob([coverLetter], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cover-letter-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Cover letter downloaded');
  };

  // ── Derived state ──────────────────────────────────────────────────────────
  const inTrial = isInTrial(profile);
  const trialDaysLeft = getTrialDaysRemaining(profile);
  const isRunning = generation.status === 'running';

  const coverLetterInputsReady =
    cvContent.trim().length > 0 && jobTitle.trim().length > 0 && jobDescription.trim().length > 0;

  return (
    <Layout>
      <div className="space-y-8 max-w-4xl mx-auto">
        {/* ── Page header ──────────────────────────────────────────────── */}
        <div>
          <h1 className="text-4xl font-bold mb-2 text-balance">Generate</h1>
          <p className="text-xl text-secondary">
            Generate tailored cover letters with ATS scoring — powered by AI
          </p>
          {inTrial && (
            <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 border border-accent/20">
              <span className="text-sm font-semibold text-accent">
                🎉 Trial Active: {trialDaysLeft} day{trialDaysLeft === 1 ? '' : 's'} left
              </span>
              <span className="text-xs text-secondary">All features unlocked!</span>
            </div>
          )}
        </div>

        {!canGenerate && (
          <Alert className="border-destructive/50 bg-destructive/10">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              You have reached your monthly generation limit. Upgrade to Pro or Career Accelerator
              for unlimited generations.
            </AlertDescription>
          </Alert>
        )}

        {/* ── Shared inputs ──────────────────────────────────────────── */}
        {/* Step 1: CV */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-2xl">Step 1: Your CV</CardTitle>
            <CardDescription className="text-base">
              {usingSavedCV
                ? 'Using your saved CV. Upload a new PDF to replace it.'
                : "Upload your CV as a PDF file (max 1MB). It must be text-based, not a scanned image."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {usingSavedCV && cvContent && (
              <Alert className="border-accent/50 bg-accent/10">
                <CheckCircle2 className="h-4 w-4 text-accent" />
                <AlertDescription>
                  <span className="font-semibold">Saved CV loaded</span> ({cvContent.length} characters)
                </AlertDescription>
              </Alert>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              onChange={handleFileUpload}
              className="hidden"
            />

            <div className="flex flex-col gap-3">
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                size="lg"
                className="w-full sm:w-auto"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing PDF...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    {usingSavedCV ? 'Upload New CV' : cvContent ? 'Upload Different PDF' : 'Upload PDF'}
                  </>
                )}
              </Button>

              {uploadedFileName && !uploadError && !usingSavedCV && (
                <p className="text-sm text-secondary">
                  <span className="font-medium">File:</span> {uploadedFileName}
                </p>
              )}
            </div>

            {uploadError && (
              <Alert className="border-destructive/50 bg-destructive/10">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  <p className="font-semibold mb-1">Upload Failed</p>
                  <p>{uploadError}</p>
                </AlertDescription>
              </Alert>
            )}

            {cvContent && !uploadError && !usingSavedCV && (
              <Alert className="border-accent/50 bg-accent/10">
                <CheckCircle2 className="h-4 w-4 text-accent" />
                <AlertDescription className="text-sm">
                  <p className="font-semibold">CV uploaded successfully!</p>
                  <p className="text-xs mt-1">Extracted {cvContent.length} characters.</p>
                </AlertDescription>
              </Alert>
            )}

          </CardContent>
        </Card>

        {/* Step 2: Job details */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-2xl">Step 2: Job Details</CardTitle>
            <CardDescription className="text-base">
              Enter the job title and paste the job description
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="jobTitle">Job Title</Label>
              <Input
                id="jobTitle"
                placeholder="e.g. Senior Software Engineer"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                className="bg-muted border-border"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="jobDescription">Job Description</Label>
              <Textarea
                id="jobDescription"
                placeholder="Paste the job description here..."
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                rows={8}
                className="bg-muted border-border"
              />
            </div>
          </CardContent>
        </Card>

        {/* ── Generate button ──────────────────────────────────────────── */}
        <div className="flex justify-center">
          <Button
            size="lg"
            onClick={handleGenerateCoverLetter}
            disabled={!coverLetterInputsReady || isRunning || !canGenerate}
            className="px-8"
          >
            {isRunning && generation.jobType === 'cover_letter' ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Generating in background…
              </>
            ) : (
              'Generate Cover Letter'
            )}
          </Button>
        </div>

        {isRunning && generation.jobType === 'cover_letter' && (
          <Alert className="border-accent/30 bg-accent/5">
            <Loader2 className="h-4 w-4 animate-spin text-accent" />
            <AlertDescription className="text-sm">
              Your cover letter is being generated. You can freely navigate to other pages — we'll
              notify you when it's ready.
            </AlertDescription>
          </Alert>
        )}

        {coverLetter && (
          <div className="space-y-6">
            {/* Cover letter text */}
            <Card className="border-border">
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-2xl text-balance">Your Cover Letter</CardTitle>
                    <CardDescription className="text-base mt-1">
                      AI-generated and tailored to the job description
                    </CardDescription>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button variant="outline" size="icon" onClick={handleCopyCoverLetter}>
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={handleDownloadCoverLetter}>
                      <Download className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="whitespace-pre-wrap text-foreground leading-relaxed bg-muted p-6 rounded-lg border border-border">
                  {coverLetter}
                </div>
                {/* Chat prompt */}
                <div className="mt-4 flex items-center gap-3 p-4 rounded-lg border border-border bg-muted/50">
                  <MessageCircle className="w-5 h-5 text-accent shrink-0" />
                  <p className="text-sm text-secondary flex-1 text-pretty">
                    Not happy with the result? Use the AI chat to refine it.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={openChat}
                    className="shrink-0 gap-1.5"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    Refine with AI
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* ATS Score */}
            <Card className="border-border">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-accent" />
                  <CardTitle className="text-xl text-balance">ATS Compatibility Score</CardTitle>
                </div>
                <CardDescription>How well your CV matches the job description</CardDescription>
              </CardHeader>
              <CardContent>
                {hasATSAccess(profile) && atsScore !== null ? (
                  <div className="space-y-6">
                    <div className="flex items-baseline gap-2">
                      <span className="text-5xl font-bold text-accent">{atsScore}</span>
                      <span className="text-2xl text-secondary">/ 100</span>
                    </div>
                    {canSeeATSReasons(profile) && atsReasons.length > 0 && (
                      <div className="space-y-3 bg-muted p-5 rounded-lg border border-border">
                        <p className="font-semibold">Detailed Analysis</p>
                        <ul className="list-disc list-inside space-y-2 text-secondary">
                          {atsReasons.map((r, i) => (
                            <li key={i} className="leading-relaxed text-pretty">{r}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {!canSeeATSReasons(profile) && profile?.plan === 'pro' && !inTrial && (
                      <Alert className="border-accent/50 bg-accent/10">
                        <AlertDescription>
                          Upgrade to Career Accelerator to see detailed reasons and improve your
                          ATS compatibility.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                ) : (
                  <Alert className="border-accent/50 bg-accent/10">
                    <AlertDescription>
                      ATS scoring is available on Pro and Career Accelerator plans.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            {/* CV Summary */}
            {cvSummary && (
              <Card className="border-border">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-accent" />
                    <CardTitle className="text-xl text-balance">CV Summary</CardTitle>
                  </div>
                  <CardDescription>Key highlights and strengths from your CV</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-foreground leading-relaxed text-pretty bg-muted p-5 rounded-lg border border-border">
                    {cvSummary}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}

