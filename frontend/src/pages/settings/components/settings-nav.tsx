import { NavLink } from "react-router-dom";
import { Building2, KeyRound, Lock, User, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/context/workspace";

const itemDefs = [
  { path: "/settings/profile", label: "Profile", icon: User },
  { path: "/settings/workspace", label: "Workspace", icon: Building2 },
  { path: "/settings/api", label: "API", icon: KeyRound },
  { path: "/settings/secrets", label: "Secrets", icon: Lock },
  { path: "/settings/team", label: "Team", icon: Users },
] as const;

export function SettingsNav({ className }: { className?: string }) {
  const { wsPath } = useWorkspace();

  return (
    <nav className={cn("flex flex-col gap-0.5", className)} aria-label="Settings sections">
      {itemDefs.map((item) => (
        <NavLink
          key={item.path}
          to={wsPath(item.path)}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors",
              isActive
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted/80 hover:text-foreground",
            )
          }
        >
          <item.icon className="size-[18px] shrink-0 opacity-90" aria-hidden />
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
