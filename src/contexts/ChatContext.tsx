import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface ChatMsg {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  reasoning_details?: unknown;
}

/** Context about the most-recently generated content this session. */
export interface GeneratedContentSnapshot {
  type: 'cover_letter' | 'personalised_cv';
  coverLetter?: string;
  personalisedCV?: string;
  jobTitle?: string;
  jobDescription?: string;
  cvContent?: string;
  letterId?: string | null;
  cvId?: string | null;
}

interface ChatContextValue {
  isOpen: boolean;
  openChat: () => void;
  closeChat: () => void;
  toggleChat: () => void;
  messages: ChatMsg[];
  /** Expose recently generated content so the chat can reference / modify it. */
  setGeneratedContext: (ctx: GeneratedContentSnapshot | null) => void;
  generatedContext: GeneratedContentSnapshot | null;
  /** Called by ChatWidget when it sends a message — returns assistant reply or null. */
  sendMessage: (userText: string, userPlan: string) => Promise<void>;
  loading: boolean;
  clearMessages: () => void;
}

// ─── Context ───────────────────────────────────────────────────────────────────

const ChatContext = createContext<ChatContextValue | null>(null);

// ─── Provider ──────────────────────────────────────────────────────────────────

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [loading, setLoading] = useState(false);
  const [generatedContext, setGeneratedContext] = useState<GeneratedContentSnapshot | null>(null);

  // We import the API function lazily to avoid circular imports
  const apiRef = useRef<typeof import('@/db/api') | null>(null);

  const getApi = async () => {
    if (!apiRef.current) {
      apiRef.current = await import('@/db/api');
    }
    return apiRef.current;
  };

  const openChat = useCallback(() => setIsOpen(true), []);
  const closeChat = useCallback(() => setIsOpen(false), []);
  const toggleChat = useCallback(() => setIsOpen((v) => !v), []);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  const sendMessage = useCallback(
    async (userText: string, userPlan: string) => {
      if (!userText.trim()) return;
      setLoading(true);

      const userMsg: ChatMsg = {
        id: crypto.randomUUID(),
        role: 'user',
        content: userText,
      };

      // Optimistic UI
      setMessages((prev) => [...prev, userMsg]);

      try {
        const api = await getApi();

        // Build system prompt with current context awareness
        let systemContent =
          `You are Aur.a's AI Career Assistant — a professional career advisor. ` +
          `You help job seekers with cover letters, CVs, interview preparation, and career advice. ` +
          `Be concise, warm, and genuinely helpful. `;

        if (generatedContext) {
          if (generatedContext.type === 'cover_letter' && generatedContext.coverLetter) {
            systemContent +=
              `\n\nThe user has just generated a cover letter for the role of "${generatedContext.jobTitle}". ` +
              `Here is the cover letter:\n${generatedContext.coverLetter}\n\n` +
              `Job description:\n${generatedContext.jobDescription}\n\n` +
              `CV content:\n${generatedContext.cvContent}\n\n` +
              `If the user asks you to change, improve, or rewrite the cover letter, do so and provide the full updated text. ` +
              `Always respond in English.`;
          } else if (generatedContext.type === 'personalised_cv' && generatedContext.personalisedCV) {
            systemContent +=
              `\n\nThe user has just generated a personalised CV for the role of "${generatedContext.jobTitle}". ` +
              `Here is the personalised CV:\n${generatedContext.personalisedCV}\n\n` +
              `Job description:\n${generatedContext.jobDescription}\n\n` +
              `CV content:\n${generatedContext.cvContent}\n\n` +
              `If the user asks you to change, improve, or rewrite the CV, do so and provide the full updated text. ` +
              `Always respond in English.`;
          }
        }

        // Career Accelerator: can request personalised CV generation via chat
        if (userPlan === 'career_accelerator') {
          systemContent +=
            `\n\nThis user is on the Career Accelerator plan. ` +
            `If they provide a CV and job description and ask you to generate or rewrite their CV, ` +
            `produce a fully restructured ATS-optimised CV in English with ALL CAPS section headings: ` +
            `PROFESSIONAL SUMMARY, CORE SKILLS, WORK EXPERIENCE, EDUCATION. ` +
            `Separate sections with blank lines. Use plain text only — no markdown, no asterisks.`;
        }

        // Build message history (without system messages in the array sent to API)
        const historyForApi = [
          { role: 'system', content: systemContent },
          ...messages.map((m) => ({
            role: m.role,
            content: m.content,
            reasoning_details: m.reasoning_details,
          })),
          { role: 'user', content: userText },
        ];

        const result = await api.generateGlobalChat(historyForApi);

        if (result) {
          const assistantMsg: ChatMsg = {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: result.content,
            reasoning_details: result.reasoning_details,
          };
          setMessages((prev) => [...prev, assistantMsg]);
        } else {
          const errMsg: ChatMsg = {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: 'Sorry, something went wrong. Please try again.',
          };
          setMessages((prev) => [...prev, errMsg]);
        }
      } catch {
        const errMsg: ChatMsg = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: 'Sorry, something went wrong. Please try again.',
        };
        setMessages((prev) => [...prev, errMsg]);
      } finally {
        setLoading(false);
      }
    },
    [messages, generatedContext]
  );

  return (
    <ChatContext.Provider
      value={{
        isOpen,
        openChat,
        closeChat,
        toggleChat,
        messages,
        setGeneratedContext,
        generatedContext,
        sendMessage,
        loading,
        clearMessages,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useChat(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used inside <ChatProvider>');
  return ctx;
}
