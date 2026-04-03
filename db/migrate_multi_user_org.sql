-- Run once in Neon SQL Editor on existing databases (after users + event_cloud_snapshots exist).
-- Safe to re-run on databases that already completed this migration (no-ops when legacy user_id is gone).
--
-- Adds: org roles, vendor_invites, and vendor-scoped event_cloud_snapshots (shared org backup).

-- 1) Org role on users
ALTER TABLE users ADD COLUMN IF NOT EXISTS org_role VARCHAR(20) NOT NULL DEFAULT 'admin';

DO $$
BEGIN
  ALTER TABLE users ADD CONSTRAINT users_org_role_check
    CHECK (org_role IN ('admin', 'clerk', 'cashier'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2) Invites
CREATE TABLE IF NOT EXISTS vendor_invites (
  id SERIAL PRIMARY KEY,
  vendor_id INTEGER NOT NULL REFERENCES vendors (id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  org_role VARCHAR(20) NOT NULL,
  token_hash VARCHAR(64) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_by_user_id INTEGER REFERENCES users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  consumed_at TIMESTAMPTZ,
  CONSTRAINT vendor_invites_org_role_check CHECK (org_role IN ('admin', 'clerk', 'cashier')),
  CONSTRAINT vendor_invites_token_hash_unique UNIQUE (token_hash)
);

CREATE INDEX IF NOT EXISTS idx_vendor_invites_vendor_id ON vendor_invites (vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_invites_email_lower ON vendor_invites (lower(email));

-- 3) Snapshots: add vendor columns if migrating from legacy user-scoped rows
ALTER TABLE event_cloud_snapshots ADD COLUMN IF NOT EXISTS vendor_id INTEGER REFERENCES vendors (id) ON DELETE CASCADE;
ALTER TABLE event_cloud_snapshots ADD COLUMN IF NOT EXISTS last_push_user_id INTEGER REFERENCES users (id) ON DELETE SET NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'event_cloud_snapshots'
      AND column_name = 'user_id'
  ) THEN
    UPDATE event_cloud_snapshots ecs
    SET
      vendor_id = u.vendor_id,
      last_push_user_id = ecs.user_id
    FROM users u
    WHERE u.id = ecs.user_id;

    DELETE FROM event_cloud_snapshots a
    USING event_cloud_snapshots b
    WHERE a.vendor_id IS NOT NULL
      AND b.vendor_id IS NOT NULL
      AND a.vendor_id = b.vendor_id
      AND a.event_sync_id = b.event_sync_id
      AND (
        a.updated_at < b.updated_at
        OR (a.updated_at = b.updated_at AND a.id < b.id)
      );

    ALTER TABLE event_cloud_snapshots ALTER COLUMN vendor_id SET NOT NULL;

    ALTER TABLE event_cloud_snapshots DROP CONSTRAINT IF EXISTS event_cloud_snapshots_user_id_event_sync_id_key;

    DROP INDEX IF EXISTS idx_event_cloud_snapshots_user_id;

    ALTER TABLE event_cloud_snapshots DROP COLUMN user_id;
  END IF;
END $$;

DO $$
BEGIN
  ALTER TABLE event_cloud_snapshots ADD CONSTRAINT event_cloud_snapshots_vendor_id_event_sync_id_key UNIQUE (vendor_id, event_sync_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_event_cloud_snapshots_vendor_id ON event_cloud_snapshots (vendor_id);
