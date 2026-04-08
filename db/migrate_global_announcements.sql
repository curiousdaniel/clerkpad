-- Super-admin broadcast announcements: persisted delivery + message center.
-- Run once in Neon (SQL Editor or psql). Reflected in db/schema.sql.

CREATE TABLE IF NOT EXISTS global_announcements (
  id UUID PRIMARY KEY,
  title TEXT,
  body TEXT NOT NULL,
  severity VARCHAR(16) NOT NULL CHECK (severity IN ('info', 'warning')),
  issued_at TIMESTAMPTZ NOT NULL,
  delivery_audience VARCHAR(32) NOT NULL
    CHECK (delivery_audience IN ('online_now', 'persist_cross_session')),
  visible_in_message_center BOOLEAN NOT NULL DEFAULT true,
  created_by_user_id INTEGER REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_global_announcements_issued_at
  ON global_announcements (issued_at DESC);

CREATE TABLE IF NOT EXISTS user_announcement_toasts_shown (
  user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  announcement_id UUID NOT NULL REFERENCES global_announcements (id) ON DELETE CASCADE,
  shown_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, announcement_id)
);

CREATE INDEX IF NOT EXISTS idx_user_announcement_toasts_user
  ON user_announcement_toasts_shown (user_id);
