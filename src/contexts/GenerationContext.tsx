import React, { createContext, useContext, useRef, useState, useCallback } from 'react';

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

interface GenerationState {
  status: GenerationStatus;
  jobType: GenerationJobType | null;
  result: GenerationResult | null;
  error: string | null;
  // Input snapshot so the Generate page can restore results after navigation
  inputs: {
    cvContent: string;
    jobTitle: string;
    jobDescription: string;
  } | null;
}

interface GenerationContextValue extends GenerationState {
  /** Start a background generation job. The runner Promise keeps going even if
   *  the caller unmounts (component navigates away). */
  startGeneration: (
    jobType: GenerationJobType,
    inputs: { cvContent: string; jobTitle: string; jobDescription: string },
    runner: () => Promise<GenerationResult>
  ) => void;
  /** Called by the Generate page once the user clicks "View Results" or it
   *  auto-displays results on mount. */
  markResultViewed: () => void;
  /** Dismiss an error banner. */
  clearError: () => void;
}

const GenerationContext = createContext<GenerationContextValue | null>(null);

export function GenerationProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<GenerationState>({
    status: 'idle',
    jobType: null,
    result: null,
    error: null,
    inputs: null,
  });

  // Keep a ref to the current job so multiple rapid triggers don't stack.
  const jobRunning = useRef(false);

  const startGeneration = useCallback(
    (
      jobType: GenerationJobType,
      inputs: { cvContent: string; jobTitle: string; jobDescription: string },
      runner: () => Promise<GenerationResult>
    ) => {
      if (jobRunning.current) return; // prevent double-kick
      jobRunning.current = true;

      setState({ status: 'running', jobType, result: null, error: null, inputs });

      // Fire-and-forget — the Promise is NOT awaited at the call-site so
      // navigation away does not cancel it.
      runner()
        .then((result) => {
          setState((prev) => ({ ...prev, status: 'complete', result }));
        })
        .catch((err) => {
          const msg =
            err instanceof Error ? err.message : 'Generation failed. Please try again.';
          setState((prev) => ({ ...prev, status: 'error', error: msg }));
        })
        .finally(() => {
          jobRunning.current = false;
        });
    },
    []
  );

  const markResultViewed = useCallback(() => {
    setState({ status: 'idle', jobType: null, result: null, error: null, inputs: null });
  }, []);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, status: 'idle', error: null }));
  }, []);

  return (
    <GenerationContext.Provider
      value={{ ...state, startGeneration, markResultViewed, clearError }}
    >
      {children}
    </GenerationContext.Provider>
  );
}

export function useGeneration(): GenerationContextValue {
  const ctx = useContext(GenerationContext);
  if (!ctx) throw new Error('useGeneration must be used inside <GenerationProvider>');
  return ctx;
}
