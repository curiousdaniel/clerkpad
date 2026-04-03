-- One-time tokens for super-admin "sign in as user" (and revert). Run once in Neon SQL Editor.
-- After deploy, super admin can use /admin to impersonate; tokens are hashed at rest.

CREATE TABLE IF NOT EXISTS admin_impersonation_tokens (
  id SERIAL PRIMARY KEY,
  token_hash VARCHAR(64) NOT NULL UNIQUE,
  created_by_user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  subject_user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_admin_impersonation_expires
  ON admin_impersonation_tokens (expires_at)
  WHERE used_at IS NULL;
