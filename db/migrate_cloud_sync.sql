-- Run once in Neon SQL Editor for existing databases (after users table exists).

CREATE TABLE IF NOT EXISTS event_cloud_snapshots (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  event_sync_id UUID NOT NULL,
  payload JSONB NOT NULL,
  payload_version INTEGER NOT NULL DEFAULT 2,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, event_sync_id)
);

CREATE INDEX IF NOT EXISTS idx_event_cloud_snapshots_user_id ON event_cloud_snapshots (user_id);

CREATE TABLE IF NOT EXISTS user_sync_preferences (
  user_id INTEGER PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  monthly_backup_email BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
