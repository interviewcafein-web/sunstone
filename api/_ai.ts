// The AI behind Ask Vertex: Groq's OpenAI-compatible chat API on its free daily allowance
// (GROQ_API_KEY in Vercel's environment variables, never in the code). When a model is over
// its limit the next one is tried; when all are, the caller says so and the quick questions
// (no AI) keep working.

import { digest } from './_auth';
import { db } from './_db';

const ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
/** Best first: each has its own free allowance. */
const MODELS = ['openai/gpt-oss-120b', 'openai/gpt-oss-20b'];
/** AI questions per person per day (India time), a fair share of the free allowance. */
export const DAILY_QUESTIONS = 40;

export interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface ToolSpec {
  type: 'function';
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

export type AiProblem = 'not_configured' | 'daily_limit' | 'busy' | 'error';

export class AiUnavailable extends Error {
  constructor(
    public kind: AiProblem,
    message: string
  ) {
    super(message);
  }
}

export const aiConfigured = () => Boolean(process.env.GROQ_API_KEY);

/** One reply from the model (text, or tool calls to make), from the first model with room. */
export async function complete(
  messages: ChatMessage[],
  tools?: ToolSpec[]
): Promise<{ message: ChatMessage; model: string }> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new AiUnavailable('not_configured', 'The AI is not set up yet.');
  let problem = new AiUnavailable('error', 'The AI could not answer.');
  for (const model of MODELS) {
    let response: Response;
    try {
      response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages,
          ...(tools ? { tools, tool_choice: 'auto' } : {}),
          temperature: 0.2,
          max_completion_tokens: 1800,
          reasoning_effort: 'low',
          include_reasoning: false,
        }),
      });
    } catch {
      problem = new AiUnavailable('error', 'The AI service could not be reached.');
      continue;
    }
    if (response.ok) {
      const body = (await response.json()) as {
        choices?: { message?: { content?: unknown; tool_calls?: ToolCall[] } }[];
      };
      const message = body.choices?.[0]?.message ?? {};
      return {
        model,
        message: {
          role: 'assistant',
          content: typeof message.content === 'string' ? message.content : null,
          ...(message.tool_calls?.length ? { tool_calls: message.tool_calls } : {}),
        },
      };
    }
    const text = await response.text();
    if (response.status === 429 || response.status === 413) {
      // "Rate limit reached ... on tokens per day (TPD)" vs per minute.
      problem = /per day|\bTPD\b|\bRPD\b/i.test(text)
        ? new AiUnavailable('daily_limit', "Today's free AI allowance is used up.")
        : new AiUnavailable('busy', 'The AI is busy. Try again in a minute.');
      continue;
    }
    console.error('[ai]', model, response.status, text.slice(0, 300));
    problem = new AiUnavailable('error', 'The AI could not answer.');
  }
  throw problem;
}

const today = `(now() at time zone 'Asia/Kolkata')::date`;

/** Counts one AI question for the person; false when they have used today's share. */
export async function takeQuestion(user: string): Promise<boolean> {
  const rows = await db().query(
    `insert into ai_usage (user_email, day, questions) values ($1, ${today}, 1)
     on conflict (user_email, day) do update set questions = ai_usage.questions + 1
       where ai_usage.questions < $2
     returning questions`,
    [user, DAILY_QUESTIONS]
  );
  return rows.length > 0;
}

/** Questions the person has left today. */
export async function questionsLeft(user: string): Promise<number> {
  const [row] = await db().query(
    `select questions from ai_usage where user_email = $1 and day = ${today}`,
    [user]
  );
  return Math.max(0, DAILY_QUESTIONS - Number(row?.questions ?? 0));
}

/** A saved answer to the same prompt from the last few days, if there is one. */
export async function savedAnswer(prompt: string): Promise<{ key: string; answer: string | null }> {
  const key = await digest(prompt);
  const [row] = await db().query(
    `select answer from ai_answers where key = $1 and created_at > now() - interval '3 days'`,
    [key]
  );
  return { key, answer: row ? String(row.answer) : null };
}

export async function saveAnswer(key: string, answer: string, model: string) {
  await db().query(
    `insert into ai_answers (key, answer, model) values ($1, $2, $3)
     on conflict (key) do update set answer = excluded.answer, model = excluded.model,
       created_at = now()`,
    [key, answer, model]
  );
}
