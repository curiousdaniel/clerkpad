-- ClerkBid / ClerkPad — required before registration works.
--
-- Neon (Vercel Storage): Dashboard → your project → SQL Editor → paste this file → Run.
-- CLI: psql "$DATABASE_URL" -f db/schema.sql   (use pooled or direct URL from Neon)
--
-- If you already created `users` with a single `name` column, run
-- db/migrate_users_first_last.sql once instead of re-running the full CREATE below.

CREATE TABLE IF NOT EXISTS vendors (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(120) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(255) NOT NULL,
  last_name VARCHAR(255) NOT NULL,
  vendor_id INTEGER NOT NULL REFERENCES vendors (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_vendor_id ON users (vendor_id);
