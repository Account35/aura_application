import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useGeneration } from '@/contexts/GenerationContext';
import type { CoverLetterResult, PersonalisedCVResult } from '@/contexts/GenerationContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import Layout from '@/components/layouts/Layout';
import {
  generateMultiTurn,
  extractPdfText,
  createChatMessage,
  getChatMessages,
  countChatMessages,
  updateProfileCV,
} from '@/db/api';
import {
  Copy,
  Download,
  Upload,
  Loader2,
  Send,
  AlertCircle,
  FileText,
  Target,
  Sparkles,
  CheckCircle2,
  Lock,
  FileSearch,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { ChatMessage } from '@/types/types';
import {
  hasAIChatAccess,
  getChatMessageLimit,
  hasATSAccess,
  canSeeATSReasons,
  isInTrial,
  getTrialDaysRemaining,
} from '@/lib/planUtils';
import { downloadCVAsPDF } from '@/lib/pdfUtils';

export default function GeneratePage() {
  const { user, profile, refreshProfile } = useAuth();
  const generation = useGeneration();

  // ── Shared inputs ──────────────────────────────────────────────────────────
  const [cvContent, setCvContent] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [usingSavedCV, setUsingSavedCV] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Cover letter results (populated from context after background run) ─────
  const [coverLetter, setCoverLetter] = useState('');
  const [atsScore, setAtsScore] = useState<number | null>(null);
  const [atsReasons, setAtsReasons] = useState<string[]>([]);
  const [cvSummary, setCvSummary] = useState('');
  const [coverLetterId, setCoverLetterId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  // ── Personalised CV results ────────────────────────────────────────────────
  const [personalisedCV, setPersonalisedCV] = useState('');

  // ── Active output tab (for result display area) ────────────────────────────
  const [activeTab, setActiveTab] = useState<'cover_letter' | 'personalised_cv'>('cover_letter');

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
        setCoverLetterId(d.letterId);
        setActiveTab('cover_letter');
        generation.markResultViewed();
      } else if (result.type === 'personalised_cv') {
        const d = result.data as PersonalisedCVResult;
        setPersonalisedCV(d.cvContent);
        setActiveTab('personalised_cv');
        generation.markResultViewed();
      }
    }
  }, [generation.status, generation.result]); // eslint-disable-line react-hooks/exhaustive-deps

  const canGenerate = profile && (profile.plan !== 'free' || profile.generation_count > 0);
  const hasPersonalisedCVAccess =
    profile?.plan === 'pro' || profile?.plan === 'career_accelerator' || isInTrial(profile);

  // ── File upload ────────────────────────────────────────────────────────────
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError('');
    setCvContent('');
    setUploadedFileName('');
    setShowManualInput(false);
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
          'Unable to extract text from your PDF. This may be a scanned image or have security restrictions.'
        );
        setShowManualInput(true);
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
      let msg = 'Unable to process your PDF. Try pasting the content instead.';
      if (err.message?.includes('INSUFFICIENT_TEXT'))
        msg = 'Your PDF appears empty or scanned as an image.';
      else if (err.message?.includes('INVALID_FILE_TYPE'))
        msg = 'Please upload a valid PDF file.';
      else if (err.message?.includes('FILE_TOO_LARGE'))
        msg = 'Your file is too large. Please compress to under 1MB.';
      setUploadError(msg);
      setShowManualInput(true);
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

  // ── Personalised CV background generation ─────────────────────────────────
  const handleGeneratePersonalisedCV = () => {
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
    generation.startPersonalisedCVGeneration(
      { cvContent, jobTitle, jobDescription },
      user.id,
      profile?.plan !== 'free',
      refreshProfile
    );

    toast.info('Generation started — you can browse other pages while we work on it.');
  };

  // ── Chat ───────────────────────────────────────────────────────────────────
  const handleSendMessage = async () => {
    if (!chatInput.trim() || !coverLetterId || !user) return;

    const userMessageCount = await countChatMessages(coverLetterId, 'user');
    if (!hasAIChatAccess(profile)) {
      toast.error('AI refinement is not available on the Free plan');
      return;
    }
    const limit = getChatMessageLimit(profile);
    if (limit !== null && userMessageCount >= limit) {
      toast.error(`You have reached the ${limit} message limit for your plan`);
      return;
    }

    setChatLoading(true);
    const userMessage = chatInput;
    setChatInput('');

    await createChatMessage(coverLetterId, 'user', userMessage);
    const allMessages = await getChatMessages(coverLetterId);
    setChatMessages(allMessages);

    const systemMessage = {
      role: 'system',
      content: `You are helping refine a cover letter. Original cover letter:\n${coverLetter}\n\nCV:\n${cvContent}\n\nJob Title:\n${jobTitle}\n\nJob Description:\n${jobDescription}\n\nProvide helpful refinements based on user requests.`,
    };

    const messagesToSend = [
      systemMessage,
      ...allMessages.map((msg) => ({
        role: msg.role,
        content: msg.content,
        reasoning_details: msg.reasoning_details,
      })),
    ];

    const response = await generateMultiTurn(messagesToSend, coverLetterId);
    if (response) {
      const updated = await getChatMessages(coverLetterId);
      setChatMessages(updated);
    } else {
      toast.error('Failed to get AI response');
    }
    setChatLoading(false);
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

  const handleDownloadPersonalisedCV = () => {
    if (!personalisedCV) return;
    downloadCVAsPDF(personalisedCV, jobTitle || 'position');
    toast.success('Personalised CV downloaded as PDF');
  };

  // ── Derived state ──────────────────────────────────────────────────────────
  const canUseChat = hasAIChatAccess(profile);
  const chatLimit = getChatMessageLimit(profile);
  const chatLimitReached = chatLimit !== null && chatMessages.filter((m) => m.role === 'user').length >= chatLimit;
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
            Cover letters, ATS scoring, and personalised CVs — tailored to your target role
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
                  {showManualInput && (
                    <p className="mt-2 text-xs">
                      <strong>Solution:</strong> Paste your CV content in the text area below.
                    </p>
                  )}
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

            {showManualInput && (
              <div className="space-y-2 pt-2 border-t border-border">
                <Label htmlFor="cvManual" className="text-sm font-semibold">
                  Manual CV Input (Fallback)
                </Label>
                <Textarea
                  id="cvManual"
                  placeholder="Paste or type your CV content here..."
                  value={cvContent}
                  onChange={(e) => {
                    setCvContent(e.target.value);
                    if (e.target.value.trim().length > 50) setUploadError('');
                  }}
                  rows={12}
                  className="bg-muted border-border font-mono text-sm"
                />
                <p className="text-xs text-secondary">
                  Copy and paste your CV content here if the PDF upload didn't work.
                </p>
              </div>
            )}

            {/* Always-visible manual paste toggle */}
            {!showManualInput && (
              <button
                onClick={() => setShowManualInput(true)}
                className="text-xs text-secondary hover:text-foreground underline underline-offset-2 transition-colors"
              >
                Prefer to paste text instead?
              </button>
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

        {/* ── Output tabs ─────────────────────────────────────────────── */}
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as 'cover_letter' | 'personalised_cv')}
        >
          <TabsList className="grid w-full grid-cols-2 bg-muted">
            <TabsTrigger value="cover_letter" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Cover Letter
            </TabsTrigger>
            <TabsTrigger value="personalised_cv" className="flex items-center gap-2">
              <FileSearch className="w-4 h-4" />
              Personalised CV
            </TabsTrigger>
          </TabsList>

          {/* ── Cover Letter tab ───────────────────────────────────────── */}
          <TabsContent value="cover_letter" className="mt-6 space-y-6">
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

                {/* AI Chat */}
                {canUseChat && coverLetterId && (
                  <Card className="border-border">
                    <CardHeader>
                      <CardTitle className="text-xl text-balance">AI Refinement Chat</CardTitle>
                      <CardDescription>
                        {chatLimit !== null
                          ? `Ask the AI to refine your cover letter (${chatMessages.filter((m) => m.role === 'user').length}/${chatLimit} messages used)`
                          : 'Unlimited refinements — ask the AI to improve your cover letter'}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {chatMessages.length > 0 && (
                        <div className="space-y-3 max-h-80 overflow-y-auto">
                          {chatMessages
                            .filter((m) => m.role !== 'system')
                            .map((msg) => (
                              <div
                                key={msg.id}
                                className={`p-4 rounded-lg border border-border text-sm leading-relaxed ${
                                  msg.role === 'user'
                                    ? 'bg-accent/10 ml-8'
                                    : 'bg-muted mr-8'
                                }`}
                              >
                                <p className="text-xs font-semibold text-secondary mb-1 uppercase tracking-wide">
                                  {msg.role === 'user' ? 'You' : 'Aur.a'}
                                </p>
                                <p className="whitespace-pre-wrap text-pretty">{msg.content}</p>
                              </div>
                            ))}
                        </div>
                      )}

                      {!chatLimitReached ? (
                        <div className="flex gap-2">
                          <Textarea
                            placeholder='e.g. "Make the tone more formal" or "Emphasise my leadership experience"'
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSendMessage();
                              }
                            }}
                            rows={3}
                            className="flex-1 bg-muted border-border resize-none"
                            disabled={chatLoading}
                          />
                          <Button
                            onClick={handleSendMessage}
                            disabled={!chatInput.trim() || chatLoading}
                            size="icon"
                            className="self-end h-10 w-10 shrink-0"
                          >
                            {chatLoading ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Send className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                      ) : (
                        <Alert className="border-accent/50 bg-accent/10">
                          <AlertDescription>
                            You have used all {chatLimit} AI refinement messages for this cover letter.
                            Upgrade to Career Accelerator for unlimited chat.
                          </AlertDescription>
                        </Alert>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </TabsContent>

          {/* ── Personalised CV tab ─────────────────────────────────────── */}
          <TabsContent value="personalised_cv" className="mt-6 space-y-6">
            {!hasPersonalisedCVAccess ? (
              /* Access gate */
              <Card className="border-border">
                <CardContent className="pt-10 pb-10 flex flex-col items-center gap-5 text-center">
                  <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
                    <Lock className="w-6 h-6 text-secondary" />
                  </div>
                  <div className="space-y-2 max-w-sm">
                    <h3 className="text-xl font-semibold text-balance">
                      Personalised CV Generation
                    </h3>
                    <p className="text-secondary text-pretty">
                      Get a fully restructured, ATS-optimised CV tailored to your target job
                      description. Available on Pro and Career Accelerator plans.
                    </p>
                  </div>
                  <Button asChild>
                    <a href="/plans">View Plans</a>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="flex justify-center">
                  <Button
                    size="lg"
                    onClick={handleGeneratePersonalisedCV}
                    disabled={!coverLetterInputsReady || isRunning || !canGenerate}
                    className="px-8"
                  >
                    {isRunning && generation.jobType === 'personalised_cv' ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Generating in background…
                      </>
                    ) : (
                      'Generate Personalised CV'
                    )}
                  </Button>
                </div>

                {isRunning && generation.jobType === 'personalised_cv' && (
                  <Alert className="border-accent/30 bg-accent/5">
                    <Loader2 className="h-4 w-4 animate-spin text-accent" />
                    <AlertDescription className="text-sm">
                      Your personalised CV is being crafted. You can navigate away — we'll notify you
                      when it's ready.
                    </AlertDescription>
                  </Alert>
                )}

                {personalisedCV && (
                  <Card className="border-border">
                    <CardHeader className="pb-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-2xl text-balance">Your Personalised CV</CardTitle>
                          <CardDescription className="text-base mt-1">
                            ATS-optimised and tailored to <span className="font-medium text-foreground">{jobTitle}</span>
                          </CardDescription>
                        </div>
                        <Button
                          variant="outline"
                          onClick={handleDownloadPersonalisedCV}
                          className="shrink-0 gap-2"
                        >
                          <Download className="w-4 h-4" />
                          Download PDF
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="whitespace-pre-wrap font-mono text-sm text-foreground leading-relaxed bg-muted p-6 rounded-lg border border-border max-h-[60vh] overflow-y-auto">
                        {personalisedCV}
                      </div>
                      <p className="text-xs text-secondary mt-3 text-pretty">
                        This CV is structured with ATS-approved section headings and keywords from the
                        job description. Download the PDF for a clean, submission-ready format.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}

