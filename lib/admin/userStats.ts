import { sql } from "@/lib/db/postgres";

export type AdminUserRow = {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  created_at: Date;
  vendor_id: number;
  vendor_name: string;
  vendor_slug: string;
  synced_events: number;
  total_lots: string;
  total_bidders: string;
  total_consignors: string;
  total_sales: string;
  total_invoices: string;
  last_cloud_sync: Date | null;
};

/**
 * Aggregates from `event_cloud_snapshots` JSONB only (not local-only IndexedDB data).
 */
export async function fetchAdminUserList(): Promise<AdminUserRow[]> {
  const { rows } = await sql<AdminUserRow>`
    SELECT
      u.id,
      u.email,
      u.first_name,
      u.last_name,
      u.created_at,
      v.id AS vendor_id,
      v.name AS vendor_name,
      v.slug AS vendor_slug,
      COUNT(ecs.id)::int AS synced_events,
      COALESCE(
        SUM(
          CASE
            WHEN jsonb_typeof(ecs.payload->'lots') = 'array'
            THEN jsonb_array_length(ecs.payload->'lots')
            ELSE 0
          END
        ),
        0
      )::text AS total_lots,
      COALESCE(
        SUM(
          CASE
            WHEN jsonb_typeof(ecs.payload->'bidders') = 'array'
            THEN jsonb_array_length(ecs.payload->'bidders')
            ELSE 0
          END
        ),
        0
      )::text AS total_bidders,
      COALESCE(
        SUM(
          CASE
            WHEN jsonb_typeof(ecs.payload->'consignors') = 'array'
            THEN jsonb_array_length(ecs.payload->'consignors')
            ELSE 0
          END
        ),
        0
      )::text AS total_consignors,
      COALESCE(
        SUM(
          CASE
            WHEN jsonb_typeof(ecs.payload->'sales') = 'array'
            THEN jsonb_array_length(ecs.payload->'sales')
            ELSE 0
          END
        ),
        0
      )::text AS total_sales,
      COALESCE(
        SUM(
          CASE
            WHEN jsonb_typeof(ecs.payload->'invoices') = 'array'
            THEN jsonb_array_length(ecs.payload->'invoices')
            ELSE 0
          END
        ),
        0
      )::text AS total_invoices,
      MAX(ecs.updated_at) AS last_cloud_sync
    FROM users u
    INNER JOIN vendors v ON v.id = u.vendor_id
    LEFT JOIN event_cloud_snapshots ecs ON ecs.user_id = u.id
    GROUP BY
      u.id,
      u.email,
      u.first_name,
      u.last_name,
      u.created_at,
      v.id,
      v.name,
      v.slug
    ORDER BY u.id ASC
  `;
  return rows;
}
