import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { AppErrorBoundary } from "@/components/app-error-boundary";
import { GlobalErrorToastListeners } from "@/components/global-error-toast";
import { useAuth } from "@/hooks/useAuth";
import { AuthProvider } from "@/context/auth";
import { WorkspaceProvider } from "@/context/workspace";

import WorkspaceChooserPage from "@/pages/WorkspaceChooser";
import SignInPage from "@/pages/auth/SignIn";
import SignUpPage from "@/pages/auth/SignUp";
import AuthCallbackPage from "@/pages/auth/Callback";
import DashboardPage from "@/pages/dashboard/Dashboard";
import CrmPage from "@/pages/dashboard/Crm";
import AgentPage from "@/pages/dashboard/Agent";
import ConnectPage from "@/pages/dashboard/Connect";
import LabelsPage from "@/pages/dashboard/Labels";
import TasksPage from "@/pages/dashboard/Tasks";
import SettingsLayout from "@/pages/settings/SettingsLayout";
import ProfilePage from "@/pages/settings/Profile";
import WorkspacePage from "@/pages/settings/Workspace";
import ApiKeysPage from "@/pages/settings/ApiKeys";
import SecretsPage from "@/pages/settings/Secrets";
import TeamPage from "@/pages/settings/Team";
import InstanceAdminPage from "@/pages/admin/InstanceAdmin";
import PrivacyPolicyPage from "@/pages/PrivacyPolicy";
import TermsOfServicePage from "@/pages/TermsOfService";
import NotFoundPage from "@/pages/NotFound";

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex h-screen items-center justify-center text-muted-foreground">Loading…</div>;
  if (!user) return <Navigate to="/sign-in" replace />;
  return <>{children}</>;
}

function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex h-screen items-center justify-center text-muted-foreground">Loading…</div>;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function WorkspaceRoute() {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex h-screen items-center justify-center text-muted-foreground">Loading…</div>;
  if (!user) return <Navigate to="/sign-in" replace />;
  return (
    <WorkspaceProvider>
      <Outlet />
    </WorkspaceProvider>
  );
}

export default function App() {
  return (
    <AppErrorBoundary>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <GlobalErrorToastListeners />
        <BrowserRouter>
          <AuthProvider>
          <Routes>
            <Route path="/" element={<AuthGate><WorkspaceChooserPage /></AuthGate>} />
            <Route path="/admin" element={<AuthGate><InstanceAdminPage /></AuthGate>} />
            <Route path="/sign-in" element={<PublicOnlyRoute><SignInPage /></PublicOnlyRoute>} />
            <Route path="/sign-up" element={<PublicOnlyRoute><SignUpPage /></PublicOnlyRoute>} />
            <Route path="/auth/callback" element={<AuthCallbackPage />} />
            <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
            <Route path="/terms-of-service" element={<TermsOfServicePage />} />

            <Route path="/:workspaceId" element={<WorkspaceRoute />}>
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="crm" element={<CrmPage />} />
              <Route path="agent" element={<AgentPage />} />
              <Route path="connect" element={<ConnectPage />} />
              <Route path="labels" element={<LabelsPage />} />
              <Route path="tasks" element={<TasksPage />} />
              <Route path="settings" element={<SettingsLayout />}>
                <Route index element={<Navigate to="profile" replace />} />
                <Route path="profile" element={<ProfilePage />} />
                <Route path="workspace" element={<WorkspacePage />} />
                <Route path="api" element={<ApiKeysPage />} />
                <Route path="secrets" element={<SecretsPage />} />
                <Route path="team" element={<TeamPage />} />
              </Route>
              <Route path="*" element={<NotFoundPage />} />
            </Route>

            <Route path="*" element={<NotFoundPage />} />
          </Routes>
          </AuthProvider>
        </BrowserRouter>
        <Toaster />
      </ThemeProvider>
    </AppErrorBoundary>
  );
}
