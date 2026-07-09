import { Link, useLocation } from "react-router-dom";
import { useState } from "react";
import {
  Menu,
  LayoutDashboard,
  Contact,
  Plug,
  Settings,
  Bot,
  ListChecks,
  Tags,
  LayoutGrid,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProfileMenu } from "@/components/layout/profile-menu";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/context/workspace";

const navItemDefs = [
  { path: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { path: "/crm", icon: Contact, label: "CRM" },
  { path: "/tasks", icon: ListChecks, label: "Tasks" },
  { path: "/agent", icon: Bot, label: "Agent" },
  { path: "/labels", icon: Tags, label: "Labels" },
  { path: "/connect", icon: Plug, label: "Connect" },
  { path: "/settings/profile", icon: Settings, label: "Settings" },
];

export function AppNavigation({
  expanded = true,
  onNavigate,
  className,
}: {
  expanded?: boolean;
  onNavigate?: () => void;
  className?: string;
}) {
  const location = useLocation();
  const { wsPath } = useWorkspace();
  const pathname = location.pathname;

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      <nav className="flex-1 space-y-1 p-2.5">
        {navItemDefs.map((item) => {
          const href = wsPath(item.path);
          const isActive = item.path.startsWith("/settings")
            ? pathname.includes("/settings")
            : pathname.includes(item.path.replace(/^\//, ""));
          return (
            <Link
              key={item.path}
              to={href}
              onClick={onNavigate}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/15 hover:text-sidebar-foreground"
              }`}
            >
              <item.icon className="size-[18px] shrink-0" />
              {expanded && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-2.5 space-y-0.5">
        <Link
          to="/"
          onClick={onNavigate}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-sidebar-foreground/50 transition-colors hover:bg-sidebar-accent/10 hover:text-sidebar-foreground/75"
        >
          <LayoutGrid className="size-[18px] shrink-0" />
          {expanded && <span className="truncate">Workspaces</span>}
        </Link>
        <ProfileMenu expanded={expanded} onNavigate={onNavigate} />
      </div>
    </div>
  );
}

export function Sidebar({ className }: { className?: string }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <aside
      className={cn(
        "flex flex-col rounded-2xl border border-sidebar-border bg-sidebar/95 shadow-soft backdrop-blur transition-[width] duration-200",
        expanded ? "w-60" : "w-[68px]",
        className,
      )}
    >
      <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-3.5">
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 text-sidebar-foreground/60 hover:bg-sidebar-accent/10 hover:text-sidebar-foreground"
          onClick={() => setExpanded((s) => !s)}
        >
          <Menu className="size-5" />
        </Button>
        {expanded && (
          <div className="flex items-center gap-3 overflow-hidden">
            <img
              src="/icon_transparent_bg.png"
              alt="Senqo logo"
              className="size-9 shrink-0 object-contain"
            />
            <span className="truncate text-base font-bold text-sidebar-foreground">
              Senqo
            </span>
          </div>
        )}
      </div>
      <AppNavigation expanded={expanded} />
    </aside>
  );
}
