import React, { createContext, useContext, useRef, useState, useCallback } from 'react';
import { supabase } from '@/db/supabase';
import { generateSingleTurn, createCoverLetter, createPersonalisedCV } from '@/db/api';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type GenerationStatus = 'idle' | 'running' | 'complete' | 'error';
export type GenerationJobType = 'cover_letter' | 'personalised_cv';

export interface CoverLetterResult {
  coverLetter: string;
  atsScore: number | null;
  atsReasons: string[];
  cvSummary: string;
  letterId: string | null;
}

export interface PersonalisedCVResult {
  cvContent: string;
  cvId: string | null;
}

export type GenerationResult =
  | { type: 'cover_letter'; data: CoverLetterResult }
  | { type: 'personalised_cv'; data: PersonalisedCVResult };

export interface GenerationInputs {
  cvContent: string;
  jobTitle: string;
  jobDescription: string;
}

interface GenerationState {
  status: GenerationStatus;
  jobType: GenerationJobType | null;
  result: GenerationResult | null;
  error: string | null;
  /** Snapshot of inputs — lets the Generate page restore form + results after re-mount */
  inputs: GenerationInputs | null;
}

interface GenerationContextValue extends GenerationState {
  /** Kick off a cover-letter generation job. Survives navigation. */
  startCoverLetterGeneration: (
    inputs: GenerationInputs,
    userId: string,
    isPaidUser: boolean,
    refreshProfile: () => Promise<void>
  ) => void;
  /** Kick off a personalised-CV generation job. Survives navigation. */
  startPersonalisedCVGeneration: (
    inputs: GenerationInputs,
    userId: string,
    isPaidUser: boolean,
    refreshProfile: () => Promise<void>
  ) => void;
  /** Called by the Generate page once it has displayed results. Resets to idle. */
  markResultViewed: () => void;
  /** Dismiss an error notification. */
  clearError: () => void;
}

// ─── Context ───────────────────────────────────────────────────────────────────

const GenerationContext = createContext<GenerationContextValue | null>(null);

// ─── Provider ──────────────────────────────────────────────────────────────────

export function GenerationProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<GenerationState>({
    status: 'idle',
    jobType: null,
    result: null,
    error: null,
    inputs: null,
  });

  // Prevent overlapping jobs
  const jobRunning = useRef(false);

  // ── Internal helpers ───────────────────────────────────────────────────────

  function setRunning(jobType: GenerationJobType, inputs: GenerationInputs) {
    setState({ status: 'running', jobType, result: null, error: null, inputs });
  }

  function setComplete(result: GenerationResult) {
    setState((prev) => ({ ...prev, status: 'complete', result }));
    jobRunning.current = false;
  }

  function setError(err: unknown) {
    const msg = err instanceof Error ? err.message : 'Generation failed. Please try again.';
    setState((prev) => ({ ...prev, status: 'error', error: msg }));
    jobRunning.current = false;
  }

  // ── Cover letter ───────────────────────────────────────────────────────────

  const startCoverLetterGeneration = useCallback(
    (
      inputs: GenerationInputs,
      userId: string,
      isPaidUser: boolean,
      refreshProfile: () => Promise<void>
    ) => {
      if (jobRunning.current) return;
      jobRunning.current = true;
      setRunning('cover_letter', inputs);

      // All async work is owned by THIS context, NOT by any component closure.
      (async () => {
        try {
          const { cvContent, jobTitle, jobDescription } = inputs;

          // ── Step 1: Cover letter ─────────────────────────────────────────
          const clPrompt =
            `CV:\n${cvContent}\n\nJob Title:\n${jobTitle}\n\nJob Description:\n${jobDescription}\n\n` +
            `Generate a professional, tailored cover letter for this position.`;
          const coverLetterContent = await generateSingleTurn('cover_letter', clPrompt);
          if (!coverLetterContent) throw new Error('Failed to generate cover letter');

          // ── Step 2: ATS score ────────────────────────────────────────────
          const atsPrompt =
            `CV:\n${cvContent}\n\nJob Title:\n${jobTitle}\n\nJob Description:\n${jobDescription}\n\n` +
            `Analyze ATS compatibility.`;
          const atsResult = await generateSingleTurn('ats_score', atsPrompt);

          let score: number | null = null;
          let reasons: string[] = [];
          if (atsResult) {
            try {
              const parsed = JSON.parse(atsResult);
              score = parsed.score ?? null;
              reasons = Array.isArray(parsed.reasons) ? parsed.reasons : [];
            } catch { /* ignore JSON parse errors */ }
          }

          // ── Step 3: CV summary ───────────────────────────────────────────
          const summaryPrompt = `CV:\n${cvContent}\n\nProvide a brief summary.`;
          const summary = (await generateSingleTurn('cv_summary', summaryPrompt)) ?? '';

          // ── Step 4: Persist to DB ────────────────────────────────────────
          const letterId = await createCoverLetter(userId, {
            content: coverLetterContent,
            job_description: jobDescription,
            cv_content: cvContent,
            ats_score: score ?? undefined,
            ats_reasons: reasons.join('\n'),
            cv_summary: summary,
          });

          // ── Step 5: Decrement generation count for free users ────────────
          if (!isPaidUser) {
            await supabase.rpc('decrement_generation_count', { user_id: userId });
            await refreshProfile();
          }

          setComplete({
            type: 'cover_letter',
            data: {
              coverLetter: coverLetterContent,
              atsScore: score,
              atsReasons: reasons,
              cvSummary: summary,
              letterId: letterId ?? null,
            },
          });
        } catch (err) {
          setError(err);
        }
      })();
    },
    [] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // ── Personalised CV ────────────────────────────────────────────────────────

  const startPersonalisedCVGeneration = useCallback(
    (
      inputs: GenerationInputs,
      userId: string,
      isPaidUser: boolean,
      refreshProfile: () => Promise<void>
    ) => {
      if (jobRunning.current) return;
      jobRunning.current = true;
      setRunning('personalised_cv', inputs);

      (async () => {
        try {
          const { cvContent, jobTitle, jobDescription } = inputs;

          const prompt =
            `CV:\n${cvContent}\n\nJob Title:\n${jobTitle}\n\nJob Description:\n${jobDescription}\n\n` +
            `Create a personalised, ATS-optimised CV for this position.`;
          const cvGenerated = await generateSingleTurn('personalised_cv', prompt);
          if (!cvGenerated) throw new Error('Failed to generate personalised CV');

          const cvId = await createPersonalisedCV(userId, {
            content: cvGenerated,
            job_title: jobTitle,
            job_description: jobDescription,
            cv_content: cvContent,
          });

          if (!isPaidUser) {
            await supabase.rpc('decrement_generation_count', { user_id: userId });
            await refreshProfile();
          }

          setComplete({
            type: 'personalised_cv',
            data: { cvContent: cvGenerated, cvId: cvId ?? null },
          });
        } catch (err) {
          setError(err);
        }
      })();
    },
    [] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // ── Public control methods ─────────────────────────────────────────────────

  const markResultViewed = useCallback(() => {
    setState({ status: 'idle', jobType: null, result: null, error: null, inputs: null });
  }, []);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, status: 'idle', error: null }));
  }, []);

  return (
    <GenerationContext.Provider
      value={{
        ...state,
        startCoverLetterGeneration,
        startPersonalisedCVGeneration,
        markResultViewed,
        clearError,
      }}
    >
      {children}
    </GenerationContext.Provider>
  );
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useGeneration(): GenerationContextValue {
  const ctx = useContext(GenerationContext);
  if (!ctx) throw new Error('useGeneration must be used inside <GenerationProvider>');
  return ctx;
}
