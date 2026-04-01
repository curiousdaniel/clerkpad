import { createPool } from "@vercel/postgres";
import type { QueryResult, QueryResultRow } from "@neondatabase/serverless";

type SqlPrimitive = string | number | boolean | undefined | null;

/**
 * Pooled serverless Postgres (Neon + Vercel).
 * Vercel/Neon expose both POSTGRES_* and DATABASE_URL; @vercel/postgres only
 * reads POSTGRES_URL by default, so we resolve explicitly.
 *
 * Prefer POSTGRES_URL, then DATABASE_URL (Neon's "recommended" pooled URL).
 *
 * Pool is created lazily so `next build` can run without DB env vars locally.
 */
let pool: ReturnType<typeof createPool> | null = null;

function getPool() {
  if (pool) return pool;
  const connectionString =
    process.env.POSTGRES_URL?.trim() ||
    process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error(
      "Missing POSTGRES_URL or DATABASE_URL. Copy from Vercel → Storage → Neon or run `vercel env pull`."
    );
  }
  pool = createPool({ connectionString });
  return pool;
}

export function sql<O extends QueryResultRow>(
  strings: TemplateStringsArray,
  ...values: SqlPrimitive[]
): Promise<QueryResult<O>> {
  return getPool().sql<O>(strings, ...values);
}
