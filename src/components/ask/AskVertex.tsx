import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Check,
  ChevronDown,
  Copy,
  Loader2,
  RotateCcw,
  SendHorizontal,
  Sparkles,
  X,
  Zap,
} from 'lucide-react';

import { Markdown } from '@/components/ask/Markdown';
import {
  ASK_STATUS_KEY,
  AskError,
  QUICK_QUESTIONS,
  askAi,
  batchOptionLabel,
  runQuick,
  useAskStatus,
  type AskStatus,
  type QuickQuestion,
} from '@/lib/ask';
import { cn } from '@/lib/utils';

interface Message {
  role: 'user' | 'assistant';
  text: string;
  /** ai: a typed question or the AI's answer; quick: a quick question (no AI); note: a notice. */
  source: 'ai' | 'quick' | 'note';
}

const STORE = 'vertex:ask';
const load = (): Message[] => {
  try {
    return JSON.parse(sessionStorage.getItem(STORE) ?? '[]') as Message[];
  } catch {
    return [];
  }
};

const NOTES: Record<string, string> = {
  daily_limit:
    "Today's free AI allowance is used up. Quick questions below still work, and the AI is back tomorrow.",
  user_limit: "You've used today's AI questions. Quick questions below still work.",
  busy: 'The AI is busy right now. Try again in a minute, or use a quick question.',
  not_configured: 'The AI is not set up yet. Quick questions below still work.',
};

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      aria-label="Copy answer"
      onClick={() => {
        navigator.clipboard?.writeText(text).then(
          () => {
            setDone(true);
            setTimeout(() => setDone(false), 1500);
          },
          () => undefined
        );
      }}
      className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
    >
      {done ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
    </button>
  );
}

/**
 * Ask Vertex: a chat panel on every page for signed-in staff. Quick questions answer from the
 * data straight away (no AI); typed questions go to the AI, which looks up the same data.
 * Either way only the campuses the person may see.
 */
export function AskVertex() {
  const [open, setOpen] = useState(false);
  const status = useAskStatus(open);
  const client = useQueryClient();
  const [messages, setMessages] = useState<Message[]>(load);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [campusId, setCampusId] = useState<number | ''>('');
  const [batch, setBatch] = useState('');
  // Open to start with; folded away once the conversation is going, to leave room for it.
  const [showQuick, setShowQuick] = useState(true);
  const scroller = useRef<HTMLDivElement>(null);

  const campuses = useMemo(() => status.data?.campuses ?? [], [status.data]);
  const campus = campuses.find((item) => item.id === campusId);
  // One campus: chosen for them.
  useEffect(() => {
    if (campuses.length === 1 && campusId === '') setCampusId(campuses[0].id);
  }, [campuses, campusId]);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORE, JSON.stringify(messages.slice(-40)));
    } catch {
      // Storage blocked: the conversation lasts until the page closes.
    }
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' });
  }, [messages, busy]);

  const examples = useMemo(() => {
    const name = campuses[0]?.code ?? campuses[0]?.name ?? 'my campus';
    return [
      'Which campus is furthest behind on PRIME coding delivery?',
      `How is ${name} doing? Give me the top 3 problems.`,
      `Who needs attention first at ${name}, and what should we do?`,
      `Which trainers at ${name} have classes not logged yet?`,
    ];
  }, [campuses]);

  const add = (message: Message) => {
    setMessages((list) => [...list, message]);
    if (message.role === 'user') setShowQuick(false);
  };

  async function quick(question: QuickQuestion) {
    if (busy) return;
    const [program, year] = batch.split(':');
    const scopeText = [campus?.name, batch && batchOptionLabel(program, Number(year))]
      .filter(Boolean)
      .join(' · ');
    add({
      role: 'user',
      text: `${question.label}${question.needsCampus || scopeText ? ` · ${scopeText || 'all campuses'}` : ''}`,
      source: 'quick',
    });
    setBusy('Looking it up…');
    try {
      add({
        role: 'assistant',
        text: await runQuick(question, { campus, batch: batch || undefined }),
        source: 'quick',
      });
    } catch (error) {
      add({
        role: 'assistant',
        text: error instanceof Error ? error.message : 'Something went wrong.',
        source: 'note',
      });
    } finally {
      setBusy(null);
    }
  }

  async function send(text: string) {
    const question = text.trim();
    if (!question || busy) return;
    setInput('');
    const next: Message = { role: 'user', text: question, source: 'ai' };
    const history = [...messages, next]
      .filter((message) => message.source === 'ai')
      .map((message) => ({ role: message.role, content: message.text }));
    add(next);
    setBusy('Thinking…');
    try {
      const reply = await askAi(history);
      add({ role: 'assistant', text: reply.answer, source: 'ai' });
      if (reply.questionsLeft !== undefined) {
        client.setQueryData<AskStatus>(ASK_STATUS_KEY, (data) =>
          data ? { ...data, questionsLeft: reply.questionsLeft! } : data
        );
      }
    } catch (error) {
      const kind = error instanceof AskError ? error.kind : 'error';
      add({
        role: 'assistant',
        text: NOTES[kind] ?? (error instanceof Error ? error.message : 'Something went wrong.'),
        source: 'note',
      });
    } finally {
      setBusy(null);
    }
  }

  const aiReady = status.data?.ai !== false;
  const left = status.data?.questionsLeft;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="bg-brand-700 hover:bg-brand-800 fixed right-4 bottom-4 z-40 flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_30px_-8px_rgb(15_23_42/0.55)] transition-transform hover:-translate-y-0.5 sm:right-6 sm:bottom-6"
      >
        <Sparkles className="size-4 text-amber-300" aria-hidden />
        Ask Vertex
      </button>
    );
  }

  return (
    <section
      aria-label="Ask Vertex"
      className="bg-surface fixed inset-x-2 bottom-2 z-50 flex h-[min(680px,calc(100dvh-1rem))] flex-col overflow-hidden rounded-2xl border border-slate-200 shadow-[0_24px_60px_-20px_rgb(15_23_42/0.55)] sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-[440px]"
    >
      <header className="from-brand-800 to-brand-600 flex items-center gap-3 bg-gradient-to-r px-4 py-3 text-white">
        <span className="flex size-9 items-center justify-center rounded-xl bg-white/15">
          <Sparkles className="size-5 text-amber-300" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base leading-tight font-bold">Ask Vertex</h2>
          <p className="truncate text-xs text-white/75">
            {status.isPending
              ? 'Getting ready…'
              : !aiReady
                ? 'Quick questions only (AI not set up)'
                : left !== undefined
                  ? `AI on · ${left} question${left === 1 ? '' : 's'} left today`
                  : 'AI on'}
          </p>
        </div>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={() => setMessages([])}
            className="rounded-lg p-1.5 text-white/80 hover:bg-white/15 hover:text-white"
            aria-label="New conversation"
            title="New conversation"
          >
            <RotateCcw className="size-4" />
          </button>
        )}
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg p-1.5 text-white/80 hover:bg-white/15 hover:text-white"
          aria-label="Close"
        >
          <X className="size-5" />
        </button>
      </header>

      <div ref={scroller} className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {messages.length === 0 && (
          <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
            <p>
              Ask about students, campuses, PRIME Mock Tests, attendance, AMCAT, exams and PRIME
              coding delivery. Answers cover only the campuses you can see.
            </p>
            {aiReady && (
              <div className="mt-3 flex flex-col gap-1.5">
                {examples.map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => send(example)}
                    className="hover:border-brand-300 hover:text-brand-700 bg-surface rounded-lg border border-slate-200 px-3 py-2 text-left text-[13px] text-slate-700"
                  >
                    {example}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {messages.map((message, index) =>
          message.role === 'user' ? (
            <div key={index} className="flex justify-end">
              <p className="bg-brand-700 max-w-[85%] rounded-2xl rounded-br-md px-3 py-2 text-sm text-white">
                {message.text}
              </p>
            </div>
          ) : (
            <div key={index} className="max-w-[95%]">
              <div
                className={cn(
                  'rounded-2xl rounded-bl-md border px-3 py-2.5',
                  message.source === 'note'
                    ? 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200'
                    : 'border-slate-200 bg-slate-50/70'
                )}
              >
                <Markdown text={message.text} />
              </div>
              {message.source !== 'note' && (
                <div className="mt-0.5 flex items-center gap-1 pl-1 text-[10px] text-slate-400">
                  {message.source === 'quick' ? (
                    <>
                      <Zap className="size-3" aria-hidden /> Quick answer · no AI
                    </>
                  ) : (
                    <>
                      <Sparkles className="size-3" aria-hidden /> AI answer · check before acting
                    </>
                  )}
                  <CopyButton text={message.text} />
                </div>
              )}
            </div>
          )
        )}
        {busy && (
          <p className="flex items-center gap-2 pl-1 text-xs text-slate-500">
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
            {busy}
          </p>
        )}
      </div>

      <div className="border-t border-slate-200 bg-slate-50/60 px-3 pt-2 pb-3">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowQuick(!showQuick)}
            aria-expanded={showQuick}
            className="flex items-center gap-1.5 rounded-md py-0.5 pr-1 text-[11px] font-semibold tracking-wide whitespace-nowrap text-slate-500 uppercase hover:text-slate-700"
          >
            <Zap className="size-3.5 shrink-0 text-amber-500" aria-hidden />
            Quick questions
            <ChevronDown
              className={cn('size-3.5 transition-transform', showQuick && 'rotate-180')}
              aria-hidden
            />
          </button>
          {showQuick && (
            <>
              <select
                value={campusId}
                onChange={(event) => {
                  setCampusId(event.target.value ? Number(event.target.value) : '');
                  setBatch('');
                }}
                className="bg-surface ml-auto max-w-[9.5rem] truncate rounded-md border border-slate-200 px-1.5 py-1 text-xs"
                aria-label="Campus"
              >
                {campuses.length !== 1 && <option value="">All campuses</option>}
                {campuses.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code ?? item.name}
                  </option>
                ))}
              </select>
              <select
                value={batch}
                onChange={(event) => setBatch(event.target.value)}
                disabled={!campus}
                className="bg-surface max-w-[8.5rem] rounded-md border border-slate-200 px-1.5 py-1 text-xs disabled:opacity-50"
                aria-label="Batch"
              >
                <option value="">All batches</option>
                {campus?.batches.map((item) => (
                  <option
                    key={`${item.program}:${item.year}`}
                    value={`${item.program}:${item.year}`}
                  >
                    {batchOptionLabel(item.program, item.year)}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>
        {showQuick && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {QUICK_QUESTIONS.map((question) => (
              <button
                key={question.id}
                type="button"
                onClick={() => quick(question)}
                disabled={Boolean(busy) || (question.needsCampus && !campus)}
                title={question.needsCampus && !campus ? 'Choose a campus first' : undefined}
                className="hover:border-brand-300 hover:text-brand-700 bg-surface shrink-0 rounded-full border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 disabled:opacity-40"
              >
                {question.label}
              </button>
            ))}
          </div>
        )}
        <form
          className="mt-2 flex items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            send(input);
          }}
        >
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                send(input);
              }
            }}
            rows={input.split('\n').length > 2 ? 3 : 1}
            maxLength={1000}
            disabled={!aiReady}
            placeholder={
              aiReady
                ? 'Ask anything about your campuses…'
                : 'AI is not set up; use a quick question'
            }
            className="bg-surface focus:border-brand-400 max-h-32 min-h-[2.5rem] flex-1 resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={!input.trim() || Boolean(busy) || !aiReady}
            className="bg-brand-700 hover:bg-brand-800 flex size-10 shrink-0 items-center justify-center rounded-xl text-white disabled:opacity-40"
            aria-label="Send"
          >
            <SendHorizontal className="size-4" />
          </button>
        </form>
      </div>
    </section>
  );
}
