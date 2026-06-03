import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import Layout from '@/components/layouts/Layout';
import {
  generateSingleTurn,
  generateMultiTurn,
  extractPdfText,
  createCoverLetter,
  createChatMessage,
  getChatMessages,
  countChatMessages,
  updateProfileCV,
} from '@/db/api';
import { supabase } from '@/db/supabase';
import { Copy, Download, Upload, Loader2, Send, AlertCircle, FileText, Target, Sparkles, CheckCircle2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { ChatMessage } from '@/types/types';
import {
  hasAIChatAccess,
  hasUnlimitedChat,
  getChatMessageLimit,
  hasATSAccess,
  canSeeATSReasons,
  isInTrial,
  getTrialDaysRemaining,
} from '@/lib/planUtils';

export default function GeneratePage() {
  const { user, profile, refreshProfile } = useAuth();
  const [step, setStep] = useState<'cv' | 'job' | 'generate'>('cv');
  const [cvContent, setCvContent] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [coverLetter, setCoverLetter] = useState('');
  const [atsScore, setAtsScore] = useState<number | null>(null);
  const [atsReasons, setAtsReasons] = useState<string[]>([]);
  const [cvSummary, setCvSummary] = useState('');
  const [coverLetterId, setCoverLetterId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [usingSavedCV, setUsingSavedCV] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load saved CV on mount
  useEffect(() => {
    if (profile?.cv_content) {
      setCvContent(profile.cv_content);
      setUsingSavedCV(true);
    }
  }, [profile]);

  const canGenerate =
    profile && (profile.plan !== 'free' || profile.generation_count > 0);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset states
    setUploadError('');
    setCvContent('');
    setUploadedFileName('');
    setShowManualInput(false);
    setUsingSavedCV(false);

    // Client-side validation
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

      if (!text) {
        setUploadError('Unable to extract text from your PDF. This may be due to the PDF being scanned as an image or having security restrictions.');
        setShowManualInput(true);
        setLoading(false);
        return;
      }

      if (text.trim().length < 50) {
        setUploadError('The extracted text is too short. Please ensure your PDF contains sufficient text content.');
        setShowManualInput(true);
        setLoading(false);
        return;
      }

      setCvContent(text);
      
      // Save CV to profile
      await updateProfileCV(text);
      setUsingSavedCV(true);
      
      setLoading(false);
      toast.success(`CV uploaded and saved (${text.length} characters)`);
    } catch (error: any) {
      console.error('Upload error:', error);
      
      let errorMessage = 'Failed to process your PDF. ';
      
      if (error.message?.includes('INSUFFICIENT_TEXT')) {
        errorMessage = 'Your PDF appears to be empty or contains insufficient text. This often happens with scanned documents or image-based PDFs.';
      } else if (error.message?.includes('INVALID_FILE_TYPE')) {
        errorMessage = 'Please upload a valid PDF file.';
      } else if (error.message?.includes('FILE_TOO_LARGE')) {
        errorMessage = 'Your file is too large. Please compress your PDF to under 1MB.';
      } else {
        errorMessage = 'Unable to process your PDF. This may be due to the file format, encryption, or other technical issues.';
      }
      
      setUploadError(errorMessage);
      setShowManualInput(true);
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!cvContent.trim() || !jobTitle.trim() || !jobDescription.trim()) {
      toast.error('Please provide CV, job title, and job description');
      return;
    }

    if (!canGenerate) {
      toast.error('You have reached your monthly generation limit');
      return;
    }

    if (!user) {
      toast.error('Please sign in to generate cover letters');
      return;
    }

    setGenerating(true);

    try {
      const prompt = `CV:\n${cvContent}\n\nJob Title:\n${jobTitle}\n\nJob Description:\n${jobDescription}\n\nGenerate a professional, tailored cover letter for this position.`;

      const coverLetterContent = await generateSingleTurn('cover_letter', prompt);

      if (!coverLetterContent) {
        throw new Error('Failed to generate cover letter');
      }

      setCoverLetter(coverLetterContent);

      const atsPrompt = `CV:\n${cvContent}\n\nJob Title:\n${jobTitle}\n\nJob Description:\n${jobDescription}\n\nAnalyze ATS compatibility.`;
      const atsResult = await generateSingleTurn('ats_score', atsPrompt);

      let score = null;
      let reasons: string[] = [];

      if (atsResult) {
        try {
          const parsed = JSON.parse(atsResult);
          score = parsed.score;
          reasons = parsed.reasons || [];
        } catch {
          console.error('Failed to parse ATS result');
        }
      }

      setAtsScore(score);
      setAtsReasons(reasons);

      const summaryPrompt = `CV:\n${cvContent}\n\nProvide a brief summary.`;
      const summary = await generateSingleTurn('cv_summary', summaryPrompt);
      setCvSummary(summary || '');

      const letterId = await createCoverLetter(user.id, {
        content: coverLetterContent,
        job_description: jobDescription,
        cv_content: cvContent,
        ats_score: score,
        ats_reasons: reasons.join('\n'),
        cv_summary: summary || undefined,
      });

      if (letterId) {
        setCoverLetterId(letterId);
      }

      if (profile?.plan === 'free') {
        await supabase.rpc('decrement_generation_count', { user_id: user.id });
        await refreshProfile();
      }

      toast.success('Cover letter generated successfully!');
    } catch (error) {
      console.error('Generation error:', error);
      toast.error('Something went wrong generating your cover letter. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(coverLetter);
    toast.success('Cover letter copied to clipboard');
  };

  const handleDownload = () => {
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
      const updatedMessages = await getChatMessages(coverLetterId);
      setChatMessages(updatedMessages);
    } else {
      toast.error('Failed to get AI response');
    }

    setChatLoading(false);
  };

  const canUseChat = hasAIChatAccess(profile);
  const chatMessageCount = chatMessages.filter((m) => m.role === 'user').length;
  const chatLimit = getChatMessageLimit(profile);
  const chatLimitReached = chatLimit !== null && chatMessageCount >= chatLimit;
  const inTrial = isInTrial(profile);
  const trialDaysLeft = getTrialDaysRemaining(profile);

  return (
    <Layout>
      <div className="space-y-8 max-w-4xl mx-auto">
        <div>
          <h1 className="text-4xl font-bold mb-2">Generate Cover Letter</h1>
          <p className="text-xl text-secondary">
            Create a professional, tailored cover letter with AI
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

        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-2xl">Step 1: Your CV</CardTitle>
            <CardDescription className="text-base">
              {usingSavedCV 
                ? 'Using your saved CV. Upload a new PDF to replace it.'
                : 'Upload your CV as a PDF file (max 1MB). Ensure it\'s a text-based PDF, not a scanned image.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {usingSavedCV && cvContent && (
              <Alert className="border-accent/50 bg-accent/10">
                <CheckCircle2 className="h-4 w-4 text-accent" />
                <AlertDescription className="flex items-center justify-between">
                  <span>
                    <span className="font-semibold">Saved CV loaded</span> ({cvContent.length} characters)
                  </span>
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-4">
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
                  <div className="text-sm text-secondary">
                    <span className="font-medium">File:</span> {uploadedFileName}
                  </div>
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
                        <strong>Solution:</strong> You can manually enter your CV content below as a workaround.
                      </p>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              {cvContent && !uploadError && (
                <Alert className="border-accent/50 bg-accent/10">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <AlertDescription className="text-sm">
                    <p className="font-semibold">CV uploaded successfully!</p>
                    <p className="text-xs mt-1">Extracted {cvContent.length} characters from your CV.</p>
                  </AlertDescription>
                </Alert>
              )}

              {showManualInput && (
                <div className="space-y-2 pt-2 border-t border-border">
                  <Label htmlFor="cvManual" className="text-sm font-semibold">
                    Manual CV Input (Fallback Option)
                  </Label>
                  <Textarea
                    id="cvManual"
                    placeholder="Paste or type your CV content here..."
                    value={cvContent}
                    onChange={(e) => {
                      setCvContent(e.target.value);
                      if (e.target.value.trim().length > 50) {
                        setUploadError('');
                      }
                    }}
                    rows={12}
                    className="bg-muted border-border font-mono text-sm"
                  />
                  <p className="text-xs text-secondary">
                    Copy and paste your CV content here if the PDF upload didn't work.
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

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

        <div className="flex justify-center">
          <Button
            size="lg"
            onClick={handleGenerate}
            disabled={
              !cvContent.trim() || !jobTitle.trim() || !jobDescription.trim() || generating || !canGenerate
            }
            className="px-8"
          >
            {generating ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              'Generate Cover Letter'
            )}
          </Button>
        </div>

        {coverLetter && (
          <Card className="border-border">
            <Tabs defaultValue="cover-letter" className="w-full">
              <CardHeader className="pb-4">
                <TabsList className="grid w-full grid-cols-3 bg-muted">
                  <TabsTrigger value="cover-letter" className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    <span>Cover Letter</span>
                  </TabsTrigger>
                  <TabsTrigger value="ats-score" className="flex items-center gap-2">
                    <Target className="w-4 h-4" />
                    <span>ATS Score</span>
                  </TabsTrigger>
                  <TabsTrigger value="cv-summary" className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    <span>CV Summary</span>
                  </TabsTrigger>
                </TabsList>
              </CardHeader>

              <CardContent className="pt-6">
                <TabsContent value="cover-letter" className="space-y-8 mt-0">
                  <div className="space-y-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-2xl font-semibold mb-2">Your Cover Letter</h3>
                        <p className="text-base text-secondary">
                          AI-generated and tailored to the job description
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="icon" onClick={handleCopy}>
                          <Copy className="w-4 h-4" />
                        </Button>
                        <Button variant="outline" size="icon" onClick={handleDownload}>
                          <Download className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="whitespace-pre-wrap text-foreground leading-relaxed bg-muted p-6 rounded-lg border border-border">
                      {coverLetter}
                    </div>
                  </div>

                  {canUseChat && (
                    <div className="space-y-6 pt-8 border-t border-border">
                      <div>
                        <h3 className="text-2xl font-semibold mb-2">AI Refinement Chat</h3>
                        <p className="text-base text-secondary">
                          {chatLimit === null
                            ? 'Refine your cover letter with unlimited messages'
                            : `Refine your cover letter (${chatMessageCount}/${chatLimit} messages used)`}
                        </p>
                      </div>

                      {chatMessages.length > 0 && (
                        <div className="space-y-3 max-h-96 overflow-y-auto">
                          {chatMessages.map((msg) => (
                            <div
                              key={msg.id}
                              className={`p-4 rounded-lg ${
                                msg.role === 'user' ? 'bg-accent/10 ml-8' : 'bg-muted mr-8'
                              }`}
                            >
                              <p className="text-sm font-semibold mb-1 capitalize">{msg.role}</p>
                              <p className="text-foreground">{msg.content}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {!chatLimitReached ? (
                        <div className="flex gap-2">
                          <Input
                            placeholder="Ask the AI to refine your cover letter..."
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSendMessage();
                              }
                            }}
                            disabled={chatLoading}
                            className="bg-muted border-border"
                          />
                          <Button
                            onClick={handleSendMessage}
                            disabled={!chatInput.trim() || chatLoading}
                          >
                            {chatLoading ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Send className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                      ) : (
                        <Alert>
                          <AlertDescription>
                            You have reached the {chatLimit} message limit for your plan.{' '}
                            {!inTrial && 'Upgrade to Career Accelerator for unlimited refinement.'}
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  )}

                  {!canUseChat && (
                    <Alert className="border-accent/50 bg-accent/10 mt-8">
                      <AlertDescription>
                        AI refinement chat is not available on the Free plan after trial ends.
                        Upgrade to Pro or Career Accelerator to refine your cover letters with AI.
                      </AlertDescription>
                    </Alert>
                  )}
                </TabsContent>

                <TabsContent value="ats-score" className="space-y-6 mt-0">
                  {hasATSAccess(profile) && atsScore !== null ? (
                    <div className="space-y-8">
                      <div>
                        <h3 className="text-2xl font-semibold mb-2">ATS Compatibility Score</h3>
                        <p className="text-base text-secondary">
                          How well your CV matches the job description
                        </p>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-6xl font-bold text-accent">{atsScore}</div>
                        <div className="text-3xl text-secondary">/ 100</div>
                      </div>

                      {canSeeATSReasons(profile) && atsReasons.length > 0 && (
                        <div className="space-y-4 bg-muted p-6 rounded-lg border border-border">
                          <p className="font-semibold text-lg">Detailed Analysis</p>
                          <ul className="list-disc list-inside space-y-3 text-secondary">
                            {atsReasons.map((reason, idx) => (
                              <li key={idx} className="leading-relaxed">
                                {reason}
                              </li>
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
                        ATS scoring is not available on the Free plan after trial ends. Upgrade to
                        Pro or Career Accelerator to access this feature.
                      </AlertDescription>
                    </Alert>
                  )}
                </TabsContent>

                <TabsContent value="cv-summary" className="space-y-6 mt-0">
                  {cvSummary ? (
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-2xl font-semibold mb-2">CV Summary</h3>
                        <p className="text-base text-secondary">
                          Key highlights and strengths from your CV
                        </p>
                      </div>

                      <div className="whitespace-pre-wrap text-foreground leading-relaxed bg-muted p-6 rounded-lg border border-border">
                        {cvSummary}
                      </div>
                    </div>
                  ) : (
                    <Alert>
                      <AlertDescription>
                        CV summary is being generated. Please wait a moment.
                      </AlertDescription>
                    </Alert>
                  )}
                </TabsContent>
              </CardContent>
            </Tabs>
          </Card>
        )}
      </div>
    </Layout>
  );
}
