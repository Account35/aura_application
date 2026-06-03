import { useRef, useEffect, useState } from 'react';
import { MessageCircle, X, Send, Loader2, Lock, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useChat } from '@/contexts/ChatContext';
import { useAuth } from '@/contexts/AuthContext';
import { hasAIChatAccess, isInTrial } from '@/lib/planUtils';
import { cn } from '@/lib/utils';

/**
 * Global floating AI chat widget — rendered once in Layout, visible on every
 * authenticated page. Context-aware: knows about the most recent generation.
 */
export default function ChatWidget() {
  const { user, profile } = useAuth();
  const {
    isOpen,
    toggleChat,
    closeChat,
    messages,
    sendMessage,
    loading,
    generatedContext,
  } = useChat();

  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const canChat = hasAIChatAccess(profile);
  const inTrial = isInTrial(profile);
  const isCareerAccelerator = profile?.plan === 'career_accelerator';

  // Auto-scroll to latest message
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen && canChat) {
      setTimeout(() => textareaRef.current?.focus(), 150);
    }
  }, [isOpen, canChat]);

  const handleSend = async () => {
    if (!input.trim() || loading || !user) return;
    const text = input.trim();
    setInput('');
    await sendMessage(text, profile?.plan ?? 'free');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Context label shown in the header
  const contextLabel = generatedContext
    ? generatedContext.type === 'cover_letter'
      ? `Context: Cover Letter (${generatedContext.jobTitle})`
      : `Context: Personalised CV (${generatedContext.jobTitle})`
    : null;

  return (
    <>
      {/* ── Floating toggle button ─────────────────────────────────────────── */}
      <button
        onClick={toggleChat}
        className={cn(
          'fixed bottom-6 right-6 z-40 w-13 h-13 rounded-full flex items-center justify-center shadow-lg',
          'bg-accent text-accent-foreground transition-all duration-200',
          'hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
          isOpen && 'opacity-0 pointer-events-none'
        )}
        style={{ width: 52, height: 52 }}
        aria-label="Open AI Career Assistant"
      >
        <MessageCircle className="w-5 h-5" />
      </button>

      {/* ── Chat panel ────────────────────────────────────────────────────── */}
      <div
        className={cn(
          'fixed bottom-0 right-0 z-50 flex flex-col transition-all duration-300 ease-out',
          'bg-card border border-border',
          'w-full md:w-[380px] md:bottom-6 md:right-6 md:rounded-2xl',
          'max-h-[90dvh] md:max-h-[600px]',
          isOpen
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 translate-y-4 pointer-events-none'
        )}
        style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.18)' }}
        aria-hidden={!isOpen}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-full bg-accent flex items-center justify-center shrink-0">
              <Sparkles className="w-3.5 h-3.5 text-accent-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-tight truncate">AI Career Assistant</p>
              {contextLabel && (
                <p className="text-xs text-secondary truncate">{contextLabel}</p>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 h-7 w-7 text-secondary hover:text-foreground"
            onClick={closeChat}
            aria-label="Close chat"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto min-h-0 px-4 py-3 space-y-3">
          {/* Access gate */}
          {!canChat && (
            <div className="flex flex-col items-center justify-center h-full gap-3 py-8 text-center">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                <Lock className="w-5 h-5 text-secondary" />
              </div>
              <p className="text-sm font-semibold text-balance">AI Chat requires an upgrade</p>
              <p className="text-xs text-secondary text-pretty max-w-[240px]">
                {profile?.plan === 'free' && !inTrial
                  ? 'AI chat is available on Pro and Career Accelerator plans. Upgrade to get started.'
                  : 'AI chat is not available on your current plan.'}
              </p>
            </div>
          )}

          {/* Welcome message when no messages yet */}
          {canChat && messages.length === 0 && (
            <div className="flex flex-col gap-2 pt-2">
              <div className="bg-muted rounded-xl p-3 text-sm leading-relaxed text-pretty">
                <p className="font-medium mb-1">Hello! I'm your AI Career Assistant. 👋</p>
                <p className="text-secondary text-xs">
                  {isCareerAccelerator
                    ? 'Ask me anything — career advice, interview prep, or request a personalised CV tailored to a job.'
                    : 'Ask me anything about your career, interviews, cover letters, or how to improve your application.'}
                </p>
              </div>

              {/* Suggested prompts */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {[
                  'How do I improve my cover letter?',
                  'Tips for my upcoming interview',
                  isCareerAccelerator ? 'Generate a personalised CV for me' : 'What skills should I highlight?',
                ].map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => {
                      setInput(prompt);
                      textareaRef.current?.focus();
                    }}
                    className="text-xs px-2.5 py-1 rounded-full border border-border bg-muted hover:bg-accent/10 hover:border-accent/30 text-secondary hover:text-foreground transition-colors"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          {canChat &&
            messages
              .filter((m) => m.role !== 'system')
              .map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    'flex',
                    msg.role === 'user' ? 'justify-end' : 'justify-start'
                  )}
                >
                  <div
                    className={cn(
                      'max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed text-pretty',
                      msg.role === 'user'
                        ? 'bg-accent text-accent-foreground rounded-br-sm'
                        : 'bg-muted text-foreground border border-border rounded-bl-sm'
                    )}
                  >
                    <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                  </div>
                </div>
              ))}

          {/* Loading indicator */}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-muted border border-border rounded-2xl rounded-bl-sm px-3 py-2 flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-secondary" />
                <span className="text-xs text-secondary">Thinking…</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        {canChat && (
          <div className="px-4 py-3 border-t border-border shrink-0">
            <div className="flex items-end gap-2">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything about your career…"
                rows={1}
                disabled={loading}
                className="flex-1 min-w-0 resize-none bg-muted border-border text-sm min-h-[38px] max-h-28 py-2 px-3"
                style={{ fieldSizing: 'content' } as React.CSSProperties}
              />
              <Button
                size="icon"
                onClick={handleSend}
                disabled={!input.trim() || loading}
                className="shrink-0 h-9 w-9"
                aria-label="Send message"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-secondary mt-1.5 text-center">
              Press Enter to send · Shift+Enter for new line
            </p>
          </div>
        )}
      </div>

      {/* Backdrop on mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={closeChat}
          aria-hidden="true"
        />
      )}
    </>
  );
}
