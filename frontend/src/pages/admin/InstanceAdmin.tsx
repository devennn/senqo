import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { InstanceAdminRegistrationSection } from "@/pages/admin/components/instance-admin-registration-section";
import { InstanceAdminWorkspacesSection } from "@/pages/admin/components/instance-admin-workspaces-section";
import { InstanceAdminUsersSection } from "@/pages/admin/components/instance-admin-users-section";

export default function InstanceAdminPage() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!user?.isInstanceAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Instance admin</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage registration, workspaces, and users for this Senqo instance.
          </p>
        </div>
        <Button variant="outline" render={<Link to="/" />}>
          Back to workspaces
        </Button>
      </div>

      <div className="space-y-8">
        <InstanceAdminRegistrationSection />
        <InstanceAdminWorkspacesSection />
        <InstanceAdminUsersSection currentUserId={user.id} />
      </div>
    </main>
  );
}
