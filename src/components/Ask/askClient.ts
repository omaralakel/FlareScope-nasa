import cached from '../../data/cachedAnswers.json';
import { dataset } from '../../data/dataset';

export type Citation = { investigationId: string; source: string };
export type AskResult = { answer: string; citations: Citation[]; cached: boolean };
export type CachedAnswer = { question: string; keywords: string[]; answer: string; citations: Citation[] };

export const CACHED_ANSWERS = cached as CachedAnswer[];
export const ASK_TIMEOUT_MS = 15_000;

const VALID_IDS = new Set(dataset.investigations.map((i) => i.id));

const STOP = new Set(
  'a an the of for to in on at is are was were be do does did can could i you me my we what which how who about with and or that this there here see show tell any some data say says'.split(' '),
);

/** Lowercase words without punctuation; "O2" and "oxygen" count as the same word. */
export function normalize(q: string): string[] {
  return q
    .toLowerCase()
    .replace(/o₂/g, 'o2')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => (w === 'o2' ? 'oxygen' : w));
}

const content = (words: string[]) => new Set(words.filter((w) => !STOP.has(w)));

/** Closest cached answer by word overlap with its question and keywords. */
export function bestCachedAnswer(question: string): { entry: CachedAnswer; score: number; exact: boolean } {
  const qWords = normalize(question);
  const q = content(qWords);
  let best = { entry: CACHED_ANSWERS[0], score: 0, exact: false };
  for (const entry of CACHED_ANSWERS) {
    if (qWords.join(' ') === normalize(entry.question).join(' ')) return { entry, score: 1, exact: true };
    const target = content([...normalize(entry.question), ...entry.keywords.flatMap(normalize)]);
    let hit = 0;
    q.forEach((w) => target.has(w) && hit++);
    const score = q.size === 0 ? 0 : hit / q.size;
    if (score > best.score) best = { entry, score, exact: false };
  }
  return best;
}

/** A cached answer for an offline moment: the matching one, else a pointer to the closest one. */
export function cachedFallback(question: string): AskResult {
  const { entry, score } = bestCachedAnswer(question);
  const answer =
    score >= 0.6
      ? entry.answer
      : `Live answers are offline; here is what the data shows about a related question, "${entry.question}" ${entry.answer}`;
  return { answer, citations: entry.citations, cached: true };
}

function parseLive(body: unknown): AskResult | null {
  if (!body || typeof body !== 'object') return null;
  const { answer, citations } = body as { answer?: unknown; citations?: unknown };
  if (typeof answer !== 'string' || !answer.trim() || !Array.isArray(citations)) return null;
  const cites = citations.filter(
    (c): c is Citation =>
      !!c && typeof c.investigationId === 'string' && typeof c.source === 'string' && VALID_IDS.has(c.investigationId),
  );
  return { answer: answer.trim(), citations: cites, cached: false };
}

/** Ask the live endpoint; on any failure or after 15 s, answer from the cached set instead. */
export async function ask(question: string, fetchFn: typeof fetch = fetch): Promise<AskResult> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ASK_TIMEOUT_MS);
  try {
    const res = await fetchFn('/api/ask', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question }),
      signal: ctrl.signal,
    });
    if (!res.ok) return cachedFallback(question);
    const live = parseLive(await res.json());
    return live ?? cachedFallback(question);
  } catch {
    return cachedFallback(question);
  } finally {
    clearTimeout(timer);
  }
}
