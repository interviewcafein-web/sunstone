// Multi-row inserts for Neon's HTTP driver, for use inside sql.transaction([...]).

import type { NeonQueryFunction } from '@neondatabase/serverless';

/** Inserts in batches that stay well under Postgres' 65,535-parameter limit. */
export function batchInserts<T extends Record<string, unknown>>(
  sql: NeonQueryFunction<false, false>,
  table: string,
  rows: T[]
) {
  if (!rows.length) return [];
  const columns = Object.keys(rows[0]);
  const perBatch = Math.max(1, Math.floor(20_000 / columns.length));
  const queries = [];
  for (let start = 0; start < rows.length; start += perBatch) {
    const values: unknown[] = [];
    const tuples = rows.slice(start, start + perBatch).map((row) => {
      const placeholders = columns.map((column) => {
        values.push(row[column]);
        return `$${values.length}`;
      });
      return `(${placeholders.join(', ')})`;
    });
    queries.push(
      sql.query(`insert into ${table} (${columns.join(', ')}) values ${tuples.join(', ')}`, values)
    );
  }
  return queries;
}
