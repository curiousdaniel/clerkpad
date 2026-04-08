# Operation-level cloud sync (sales & invoices)

This mode augments **snapshot** cloud backup with an **append-only op log** so two devices can merge concurrent clerking and invoice edits without always forcing a full restore.

## Enable

1. Apply the SQL migration on your Neon database: `db/migrate_event_sync_ops.sql` (also reflected in `db/schema.sql`).
2. Set for **both** local dev and Vercel:
   - `NEXT_PUBLIC_SYNC_OPS=1` — turns on client op queue, pull/push loop, and Settings → “needs review”.
   - Optional server-only override: `SYNC_OPS=1` — enables `POST /api/sync/ops/push/` and `GET /api/sync/ops/pull/` (these routes return 404 when disabled).

## Behavior

- Local writes enqueue ops in Dexie `syncOutbox` (when the flag is on).
- The background sync cycle **pulls remote ops first**, applies them with deterministic rules, then **pushes** the outbox, then continues **snapshot** push/pull as before (dual-write).
- `syncKey` on each sale and invoice is the stable cross-device identity (export v6 includes them).

## Conflicts

Destructive or identity clashes (e.g. same sale `syncKey` but different lot/bidder) append rows to `syncConflicts` and appear under **Settings → Operation sync — needs review**. Dismiss after you fix data locally.

## Rollback

1. Unset `NEXT_PUBLIC_SYNC_OPS` and `SYNC_OPS` and redeploy.
2. Clients fall back to **snapshot-only** sync; existing IndexedDB outbox rows are ignored.
3. The `event_sync_ops` table can remain; it does not affect snapshot routes.

## Tests

`npm test` runs Vitest, including parsers in `lib/sync/ops/parseBodies.test.ts`.
