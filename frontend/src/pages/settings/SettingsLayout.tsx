import { Outlet } from "react-router-dom";
import { AppFrame } from "@/components/layout/app-frame";
import { SettingsNav } from "@/pages/settings/components/settings-nav";

export default function SettingsLayout() {
  return (
    <AppFrame
      conversations={[]}
      messages={[]}
      hideConversationRail
      mainPanel={
        <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden md:flex-row">
          <aside className="shrink-0 border-b border-border/60 bg-card/40 px-4 py-4 md:w-56 md:border-b-0 md:border-r md:border-border/60 md:py-6 md:pl-6 md:pr-4">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Settings
            </h2>
            <SettingsNav />
          </aside>
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
            <Outlet />
          </div>
        </div>
      }
    />
  );
}
