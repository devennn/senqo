import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LayoutGrid, List, Loader2, LogOut, Search } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { logout } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppVersionLabel } from "@/components/layout/app-version-footer";
import { cn } from "@/lib/utils";
import type { WorkspaceSummary } from "@/types/repositories";

type ViewMode = "grid" | "list";

export default function WorkspaceChooserPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [entering, setEntering] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<ViewMode>("grid");

  useEffect(() => {
    api
      .get<{ workspaces: WorkspaceSummary[] }>("/api/user/workspaces")
      .then(({ workspaces: list }) => setWorkspaces(list))
      .catch(() => setWorkspaces([]))
      .finally(() => setLoading(false));
  }, []);

  async function handleSignOut() {
    await logout();
    navigate("/sign-in");
  }

  function enterWorkspace(id: string) {
    if (entering) return;
    setEntering(id);
    navigate(`/${id}/dashboard`);
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return workspaces;
    return workspaces.filter((ws) => ws.name.toLowerCase().includes(q));
  }, [workspaces, search]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col bg-background px-4 py-6 sm:px-6 sm:py-8 md:px-10 md:py-10 lg:px-14 lg:py-14">
      {/* Greeting */}
      <div className="mb-6 sm:mb-8 md:mb-10">
        <p className="text-sm text-muted-foreground sm:text-base">
          Hi,{" "}
          <span className="font-medium text-foreground">
            {user?.email ?? "…"}
          </span>
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Workspaces
        </h1>
      </div>

      {/* Toolbar */}
      <div className="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-center">
        <div className="relative w-full sm:w-80">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search for a workspace"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-11 pl-10 text-base"
          />
        </div>

        <div className="flex items-center gap-2 sm:ml-auto">
          <div className="flex rounded-lg border border-border/60 bg-card">
            <button
              type="button"
              aria-label="Grid view"
              onClick={() => setView("grid")}
              className={cn(
                "flex size-11 items-center justify-center rounded-l-lg transition-colors",
                view === "grid"
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <LayoutGrid className="size-5" />
            </button>
            <button
              type="button"
              aria-label="List view"
              onClick={() => setView("list")}
              className={cn(
                "flex size-11 items-center justify-center rounded-r-lg transition-colors",
                view === "list"
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <List className="size-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1">
        {loading ? (
          <p className="text-base text-muted-foreground">Loading…</p>
        ) : filtered.length === 0 ? (
          <div className="card-surface p-10 text-center text-base text-muted-foreground">
            {search
              ? "No workspaces match your search."
              : "No workspaces found. Contact your workspace owner."}
          </div>
        ) : view === "grid" ? (
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((ws) => (
              <WorkspaceCard
                key={ws.id}
                ws={ws}
                isEntering={entering === ws.id}
                disabled={entering !== null}
                onEnter={enterWorkspace}
              />
            ))}
          </ul>
        ) : (
          <ul className="card-surface divide-y divide-border/60 overflow-hidden">
            {filtered.map((ws) => (
              <WorkspaceRow
                key={ws.id}
                ws={ws}
                isEntering={entering === ws.id}
                disabled={entering !== null}
                onEnter={enterWorkspace}
              />
            ))}
          </ul>
        )}
      </div>

      {/* Footer */}
      <div className="mt-10 flex items-center justify-between gap-4 border-t border-border/60 pt-6 sm:mt-12 md:mt-16">
        <Button
          variant="ghost"
          className="gap-2 text-sm text-muted-foreground sm:text-base"
          onClick={handleSignOut}
        >
          <LogOut className="size-5" />
          Sign out
        </Button>
        <AppVersionLabel />
      </div>
    </main>
  );
}

function WorkspaceCard({
  ws,
  isEntering,
  disabled,
  onEnter,
}: {
  ws: WorkspaceSummary;
  isEntering: boolean;
  disabled: boolean;
  onEnter: (id: string) => void;
}) {
  return (
    <li>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onEnter(ws.id)}
        className={cn(
          "group relative flex h-44 w-full flex-col justify-between card-surface p-4 text-left transition-all sm:h-52 sm:p-6",
          isEntering
            ? "shadow-elevated ring-2 ring-primary/30"
            : "hover:shadow-elevated",
          disabled && !isEntering && "opacity-50 cursor-not-allowed",
        )}
      >
        <div>
          <p className="truncate text-base font-semibold text-foreground sm:text-lg">{ws.name}</p>
          <p className="mt-1 text-sm text-muted-foreground capitalize">{ws.role}</p>
        </div>
        <div className="flex items-center justify-between">
          <span className="type-label-sm inline-block rounded-full bg-secondary px-2.5 py-1 uppercase text-primary sm:text-xs">
            {ws.role}
          </span>
          {isEntering && (
            <Loader2 className="size-4 animate-spin text-primary" />
          )}
        </div>
      </button>
    </li>
  );
}

function WorkspaceRow({
  ws,
  isEntering,
  disabled,
  onEnter,
}: {
  ws: WorkspaceSummary;
  isEntering: boolean;
  disabled: boolean;
  onEnter: (id: string) => void;
}) {
  return (
    <li>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onEnter(ws.id)}
        className={cn(
          "flex w-full flex-wrap items-center gap-2 px-4 py-4 text-left transition-colors sm:flex-nowrap sm:gap-4 sm:px-6 sm:py-5",
          isEntering ? "bg-muted/60" : "hover:bg-muted/40",
          disabled && !isEntering && "opacity-50 cursor-not-allowed",
        )}
      >
        <span className="min-w-0 flex-1">
          <span className="block text-base font-semibold text-foreground">{ws.name}</span>
          <span className="mt-0.5 block text-sm text-muted-foreground capitalize sm:ml-4 sm:mt-0 sm:inline">
            {ws.role}
          </span>
        </span>
        <span className="type-label-sm shrink-0 rounded-full bg-secondary px-2.5 py-1 uppercase text-primary sm:text-xs">
          {ws.role}
        </span>
        {isEntering ? (
          <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
        ) : (
          <span className="size-4 shrink-0" />
        )}
      </button>
    </li>
  );
}
