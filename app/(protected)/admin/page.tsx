import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { fetchAdminUserList } from "@/lib/admin/userStats";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  let loadError: string | null = null;
  let users: Awaited<ReturnType<typeof fetchAdminUserList>> = [];

  try {
    users = await fetchAdminUserList();
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("event_cloud_snapshots") && msg.includes("does not exist")) {
      loadError =
        "Database is missing cloud sync tables. Run db/migrate_cloud_sync.sql in Neon, then reload.";
    } else {
      loadError = "Could not load user list. Check database configuration.";
    }
    console.error("[admin/page]", e);
  }

  return <AdminDashboard initialUsers={users} loadError={loadError} />;
}
