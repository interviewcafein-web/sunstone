// Ask Vertex: questions about the data, for signed-in staff, within the campuses they may see.
//
//   GET  /api/ask                                    AI status, questions left today, and the
//                                                    campuses and batches for the quick questions
//   POST /api/ask { mode: 'tool', name, args }       a quick question: one lookup, no AI
//   POST /api/ask { mode: 'chat', messages }         a typed question: the AI looks things up
//                                                    with the same lookups and answers
//   POST /api/ask { mode: 'actions', scope, points } suggested actions for pain points, saved
//                                                    and reused while the pain points stay the same
//
// The AI never queries the database itself: it asks for a lookup by name, and the lookup runs
// here with the person's own access (api/_ask-tools.ts).

import {
  AiUnavailable,
  type ChatMessage,
  aiConfigured,
  complete,
  questionsLeft,
  saveAnswer,
  savedAnswer,
  takeQuestion,
} from './_ai';
import { Context, TOOL_SPECS, runTool, toolNames } from './_ask-tools';
import { type Viewer, json, sessionViewer } from './_auth';
import { db } from './_db';
import { DIMENSIONS } from '../src/lib/insights';
import { ZONES } from '../src/lib/students/zones';

export const config = { runtime: 'edge' };

const MAX_ROUNDS = 5;
const MAX_HISTORY = 8;
const MAX_TEXT = 2000;

const ROLE_NAMES = { super_admin: 'super admin', hq: 'HQ', campus: 'campus staff' } as const;

const DEFINITIONS = `Definitions:
- Sunstone PRIME runs a placement-readiness program inside partner colleges. Vertex follows its students on five fronts:
${DIMENSIONS.map((d) => `  - ${d.label}: ${d.measure}. Doing well from ${d.good}${d.suffix}, at risk below ${d.risk}${d.suffix}.`).join('\n')}
- Coding zones by best solved count: ${ZONES.filter((zone) => zone.min !== undefined)
  .map((zone) => `${zone.label} ${zone.rule}`)
  .join(', ')}; Not linked = no usable coding username.
- Batch names: "B.Tech 2025–29" means admitted in 2025, finishing in 2029. Each batch has sections (A, B…).
- PRIME coding delivery comes from the delivery tracker that trainers fill in after each class: allocated (agreed) hours per section, added up; verified hours; hours awaiting verification; still to go. "Classes not logged yet" are PRIME coding classes in the LMS time table on days the trainer logged nothing in the tracker.
- Data is copied from the LMS and the tracker nightly (data_as_of).`;

function systemPrompt(viewer: Viewer, scopeNames: string) {
  const today = new Date().toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  return `You are Ask Vertex, the assistant inside Sunstone PRIME Vertex, the dashboard for Sunstone PRIME staff.
Today is ${today}. You are helping ${viewer.name ?? viewer.user} (${ROLE_NAMES[viewer.role]}), who can see: ${scopeNames}.

How to answer:
- Use the tools to get numbers; never guess or invent a number, name or date. If the tools have nothing, say so plainly.
- Call several tools when a question needs it, but prefer one broad lookup (campus_report, pain_points) over many small ones.
- Lead with a one or two sentence answer, then the key numbers as a short bullet list or a small markdown table. Use **bold** for the key figure. Keep it under about 200 words unless asked for more.
- Add page links only exactly as the tools gave them (the link fields), as markdown links, e.g. [Open SAGE University](/campuses?campus=9) or [Rakesh Kumar](/s/rakesh.kumar). Never make up a link.
- When you suggest reasons the data does not show, call them possible reasons.
- Mention how current the data is when it matters (data_as_of).
- When asked what to do, give concrete, practical actions (who does what, this week) for program managers, trainers and campus staff, based on the numbers.
- If asked about a campus the person cannot see, say they do not have access to it.
- You have no phone numbers or email addresses; never make them up.
- Use proper English case and plain words. Do not mention tools, JSON or field names.
- Write dates like 4 Nov 2026; give time frames ("within 3 days", "this week") rather than naming weekdays.

${DEFINITIONS}`;
}

const ACTIONS_PROMPT = `You advise Sunstone PRIME program managers. Sunstone PRIME runs a placement-readiness program inside partner colleges (coding practice on LeetCode/GFG, PRIME Mock Tests, AMCAT, internal exams, class attendance, PRIME coding classes by trainers).
Given the pain points of one scope, suggest what to do about them.

Write in markdown:
- For each of the pain points given (most pressing first, at most 5): a bold line with a short name for the problem, then 2 or 3 bullet points of concrete actions, each saying who does it (HQ, campus head, trainer, mentors, students) and what exactly, with a number or time frame where it helps.
- Then a bold line "First this week" with the 3 actions to start with.
Be practical and specific to the numbers given. Give time frames ("within 3 days", "this week"), not dates or weekdays. Under 350 words. Proper English case. No preamble, no closing remarks.

${DEFINITIONS}`;

interface Incoming {
  role: 'user' | 'assistant';
  content: string;
}

/** Turns an AI problem into a reply the page can show; the question is given back. */
async function unavailable(viewer: Viewer, error: unknown, counted: boolean) {
  if (counted) {
    await db()`update ai_usage set questions = greatest(0, questions - 1)
      where user_email = ${viewer.user} and day = (now() at time zone 'Asia/Kolkata')::date`;
  }
  if (error instanceof AiUnavailable) return json(503, { error: error.message, kind: error.kind });
  console.error('[ask]', error);
  return json(500, { error: 'Something went wrong. Try again.', kind: 'error' });
}

async function chat(viewer: Viewer, incoming: Incoming[]) {
  const history = incoming
    .filter(
      (item) =>
        (item.role === 'user' || item.role === 'assistant') && typeof item.content === 'string'
    )
    .slice(-MAX_HISTORY)
    .map((item) => ({ role: item.role, content: item.content.slice(0, MAX_TEXT) }) as ChatMessage);
  if (!history.length || history[history.length - 1].role !== 'user') {
    return json(400, { error: 'Ask a question.' });
  }
  if (!aiConfigured())
    return json(503, { error: 'The AI is not set up yet.', kind: 'not_configured' });
  if (!(await takeQuestion(viewer.user))) {
    return json(429, {
      error: "You have used today's AI questions. Quick questions still work.",
      kind: 'user_limit',
    });
  }

  const context = new Context(viewer);
  const visible = await context.campuses();
  const scopeNames =
    viewer.campusIds === null
      ? 'every campus'
      : visible.map((item) => item.name).join('; ') || 'no campus yet';
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt(viewer, scopeNames) },
    ...history,
  ];
  try {
    for (let round = 0; round < MAX_ROUNDS; round++) {
      const { message, model } = await complete(messages, TOOL_SPECS);
      if (!message.tool_calls?.length) {
        return json(200, {
          answer: message.content?.trim() || 'I could not find an answer to that.',
          model,
          questionsLeft: await questionsLeft(viewer.user),
        });
      }
      messages.push({
        role: 'assistant',
        content: message.content ?? '',
        tool_calls: message.tool_calls,
      });
      const results = await Promise.all(
        message.tool_calls.map(async (call) => {
          let args: Record<string, unknown> = {};
          try {
            args = JSON.parse(call.function.arguments || '{}');
          } catch {
            // Malformed arguments: run with none, the tool explains what is missing.
          }
          return { id: call.id, result: await runTool(context, call.function.name, args) };
        })
      );
      for (const { id, result } of results) {
        messages.push({
          role: 'tool',
          tool_call_id: id,
          content: JSON.stringify(result).slice(0, 14000),
        });
      }
    }
    return json(200, {
      answer: 'That needed more lookups than I can make at once. Try a narrower question.',
      questionsLeft: await questionsLeft(viewer.user),
    });
  } catch (error) {
    return unavailable(viewer, error, true);
  }
}

async function actions(viewer: Viewer, scope: string, points: unknown[]) {
  const clean = points
    .filter(
      (point): point is Record<string, unknown> => Boolean(point) && typeof point === 'object'
    )
    .slice(0, 8)
    .map((point) => ({
      severity: String(point.severity ?? '').slice(0, 10),
      title: String(point.title ?? '').slice(0, 200),
      detail: String(point.detail ?? '').slice(0, 300),
    }))
    .filter((point) => point.title);
  if (!clean.length) return json(400, { error: 'No pain points to act on.' });
  const prompt = `Scope: ${String(scope).slice(0, 200)}\nPain points:\n${clean
    .map((point, index) => `${index + 1}. [${point.severity}] ${point.title}. ${point.detail}`)
    .join('\n')}`;
  const { key, answer } = await savedAnswer(`actions:v1\n${prompt}`);
  if (answer)
    return json(200, { answer, saved: true, questionsLeft: await questionsLeft(viewer.user) });

  if (!aiConfigured())
    return json(503, { error: 'The AI is not set up yet.', kind: 'not_configured' });
  if (!(await takeQuestion(viewer.user))) {
    return json(429, { error: "You have used today's AI questions.", kind: 'user_limit' });
  }
  try {
    const { message, model } = await complete([
      { role: 'system', content: ACTIONS_PROMPT },
      { role: 'user', content: prompt },
    ]);
    const text = message.content?.trim();
    if (!text) throw new AiUnavailable('error', 'The AI could not answer.');
    await saveAnswer(key, text, model);
    return json(200, { answer: text, model, questionsLeft: await questionsLeft(viewer.user) });
  } catch (error) {
    return unavailable(viewer, error, true);
  }
}

export default async function handler(request: Request): Promise<Response> {
  if (!process.env.DATABASE_URL) return json(404, { error: 'No database configured' });
  const viewer = await sessionViewer(request);
  if (!viewer) return json(401, { error: 'Login required' });

  if (request.method === 'GET') {
    const [left, campuses] = await Promise.all([
      questionsLeft(viewer.user),
      new Context(viewer).campuses(),
    ]);
    return json(200, {
      ai: aiConfigured(),
      questionsLeft: left,
      campuses: campuses.map((item) => ({
        id: item.id,
        name: item.name,
        code: item.code,
        batches: item.batches.sort((a, b) => b.year - a.year || a.program.localeCompare(b.program)),
      })),
    });
  }
  if (request.method !== 'POST') return json(405, { error: 'Method not allowed' });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json(400, { error: 'Invalid JSON' });
  }
  if (body.mode === 'tool') {
    const name = String(body.name ?? '');
    if (!toolNames.includes(name)) return json(400, { error: 'Unknown question' });
    const result = await runTool(
      new Context(viewer),
      name,
      (body.args as Record<string, unknown>) ?? {}
    );
    return json(200, { result });
  }
  if (body.mode === 'chat') return chat(viewer, (body.messages as Incoming[]) ?? []);
  if (body.mode === 'actions') {
    return actions(viewer, String(body.scope ?? ''), Array.isArray(body.points) ? body.points : []);
  }
  return json(400, { error: 'Unknown mode' });
}
