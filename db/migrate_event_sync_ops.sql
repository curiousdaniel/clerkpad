-- Operation-level event sync (alongside event_cloud_snapshots). Run once in Neon.

CREATE TABLE IF NOT EXISTS event_sync_ops (
  id BIGSERIAL PRIMARY KEY,
  vendor_id INTEGER NOT NULL REFERENCES vendors (id) ON DELETE CASCADE,
  event_sync_id UUID NOT NULL,
  op_id UUID NOT NULL,
  actor_user_id INTEGER REFERENCES users (id) ON DELETE SET NULL,
  op_type VARCHAR(64) NOT NULL,
  payload JSONB NOT NULL,
  client_created_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT event_sync_ops_op_id_unique UNIQUE (op_id)
);

CREATE INDEX IF NOT EXISTS idx_event_sync_ops_vendor_event_id
  ON event_sync_ops (vendor_id, event_sync_id, id);
