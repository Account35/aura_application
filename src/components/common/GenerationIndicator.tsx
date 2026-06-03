import { useNavigate } from 'react-router-dom';
import { Loader2, CheckCircle2, AlertCircle, X, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useGeneration } from '@/contexts/GenerationContext';

/**
 * Floating pill displayed across all authenticated pages while any background
 * generation job is running, complete, or errored. Invisible when idle.
 */
export default function GenerationIndicator() {
  const { status, jobType, error, markResultViewed, clearError } = useGeneration();
  const navigate = useNavigate();

  if (status === 'idle') return null;

  const jobLabel =
    jobType === 'personalised_cv' ? 'Personalised CV' : 'Cover Letter';

  const handleViewResults = () => {
    navigate('/generate');
    markResultViewed();
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-[calc(100%-3rem)] md:max-w-sm animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-3 shadow-lg">
        {/* Icon */}
        {status === 'running' && (
          <Loader2 className="w-4 h-4 shrink-0 text-accent animate-spin" />
        )}
        {status === 'complete' && (
          <CheckCircle2 className="w-4 h-4 shrink-0 text-green-500" />
        )}
        {status === 'error' && (
          <AlertCircle className="w-4 h-4 shrink-0 text-destructive" />
        )}

        {/* Label */}
        <div className="flex-1 min-w-0">
          {status === 'running' && (
            <p className="text-sm font-medium truncate">
              Generating {jobLabel}
              <span className="text-secondary"> · running in background</span>
            </p>
          )}
          {status === 'complete' && (
            <p className="text-sm font-medium truncate text-foreground">
              {jobLabel} ready
            </p>
          )}
          {status === 'error' && (
            <p className="text-sm font-medium truncate text-destructive">
              {error ?? 'Generation failed'}
            </p>
          )}
        </div>

        {/* Actions */}
        {status === 'complete' && (
          <Button
            size="sm"
            className="shrink-0 h-7 px-2 text-xs gap-1"
            onClick={handleViewResults}
          >
            View
            <ArrowRight className="w-3 h-3" />
          </Button>
        )}
        {(status === 'error' || status === 'complete') && (
          <button
            onClick={status === 'error' ? clearError : markResultViewed}
            className="shrink-0 p-1 rounded hover:bg-muted text-secondary hover:text-foreground transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
