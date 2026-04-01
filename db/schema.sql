-- ClerkBid / ClerkPad — required before registration works.
--
-- Neon (Vercel Storage): Dashboard → your project → SQL Editor → paste this file → Run.
-- CLI: psql "$DATABASE_URL" -f db/schema.sql   (use pooled or direct URL from Neon)

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
  name VARCHAR(255),
  vendor_id INTEGER NOT NULL REFERENCES vendors (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_vendor_id ON users (vendor_id);
