import { Link, useNavigate } from "react-router-dom";
import { LayoutGrid, LogOut, Settings, User } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { logout } from "@/lib/auth-client";
import { useWorkspace } from "@/context/workspace";
import { cn } from "@/lib/utils";

function userInitials(email: string | undefined): string {
  const local = email?.split("@")[0]?.trim() ?? "";
  if (!local) return "?";
  return local.slice(0, 2).toUpperCase();
}

export function ProfileMenu({
  expanded = true,
  onNavigate,
  className,
}: {
  expanded?: boolean;
  onNavigate?: () => void;
  className?: string;
}) {
  const navigate = useNavigate();
  const { user, loading, setUser } = useAuth();
  const { wsPath } = useWorkspace();
  const email = user?.email ?? (loading ? "" : "Account");
  const initials = user?.email ? userInitials(user.email) : loading ? "" : "?";

  async function handleSignOut() {
    onNavigate?.();
    await logout();
    setUser(null);
    navigate("/sign-in");
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            className={cn(
              "h-auto w-full justify-start gap-3 rounded-lg px-3 py-2.5 text-left font-semibold text-sidebar-foreground/70 hover:bg-sidebar-accent/10 hover:text-sidebar-foreground",
              !expanded && "size-10 justify-center px-0",
              className,
            )}
            aria-label="Open account menu"
          />
        }
      >
        <Avatar size="sm" className="size-8 shrink-0">
          <AvatarFallback className="bg-sidebar-accent text-xs text-sidebar-accent-foreground">
            {initials}
          </AvatarFallback>
        </Avatar>
        {expanded ? (
          <span className="min-w-0 flex-1 truncate text-sm">{email}</span>
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-normal">
            <div className="flex items-center gap-2">
              <User className="size-4 shrink-0 text-muted-foreground" />
              <span className="truncate text-sm font-medium text-foreground">{email}</span>
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          render={<Link to={wsPath("/settings/profile")} onClick={onNavigate} />}
        >
          <Settings className="size-4" />
          Settings
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link to="/" onClick={onNavigate} />}>
          <LayoutGrid className="size-4" />
          Workspaces
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => void handleSignOut()}>
          <LogOut className="size-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
