// Runs a read-only SQL query on Sunstone's Redash (LMS database) and returns the rows.
// REDASH_KEY must be set; REDASH_URL / REDASH_DATA_SOURCE override the defaults.

const REDASH_URL = process.env.REDASH_URL ?? 'https://redash.sunstone.in';
const REDASH_DATA_SOURCE = Number(process.env.REDASH_DATA_SOURCE ?? 1);

export async function redash<T>(sql: string): Promise<T[]> {
  const key = process.env.REDASH_KEY;
  if (!key) throw new Error('REDASH_KEY is not set.');
  // Redash's JSON responses, loosely typed: only the fields read below are relied on.
  const call = async (path: string, body?: unknown): Promise<any> => {
    const response = await fetch(REDASH_URL + path, {
      method: body ? 'POST' : 'GET',
      headers: { Authorization: `Key ${key}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok)
      throw new Error(`Redash ${path}: ${response.status} ${await response.text()}`);
    return response.json();
  };

  const first = await call('/api/query_results', {
    data_source_id: REDASH_DATA_SOURCE,
    query: sql,
    max_age: 0,
  });
  let resultId = first.query_result?.id;
  for (let attempt = 0; !resultId; attempt++) {
    if (attempt > 200) throw new Error('Redash query timed out.');
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const { job } = await call(`/api/jobs/${first.job.id}`);
    if (job.status === 4) throw new Error(`Redash query failed: ${job.error}`);
    if (job.status === 3) resultId = job.query_result_id;
  }
  const { query_result } = await call(`/api/query_results/${resultId}`);
  return query_result.data.rows as T[];
}
