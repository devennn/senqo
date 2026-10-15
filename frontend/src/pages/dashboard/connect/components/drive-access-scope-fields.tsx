import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { InlineHelpHint } from "@/components/ui/inline-help-hint";
import { GoogleDriveIcon } from "@/components/icons/google-drive-icon";
import {
  getCachedDriveItems,
  type DriveAccessMode,
  type DriveFileListItem,
  type WorkspaceAppStatus,
} from "@/hooks/useWorkspaceApps";
import {
  DriveScopeItemPicker,
  FOLDER_MIME,
} from "@/pages/dashboard/connect/components/drive-scope-item-picker";
import { cn } from "@/lib/utils";

type Props = {
  drive: WorkspaceAppStatus;
  listDriveItems: (opts?: {
    q?: string;
    purpose?: "browse" | "scope";
    kind?: "file" | "folder" | "any";
  }) => Promise<DriveFileListItem[]>;
  updateDriveAccessScope: (input: {
    accessMode: DriveAccessMode;
    scopeId?: string | null;
    scopeName?: string | null;
    scopeMimeType?: string | null;
  }) => Promise<void>;
  disabled?: boolean;
};

const MODE_OPTIONS = [
  { id: "entire_drive" as const, label: "Entire Drive" },
  { id: "folder" as const, label: "Folder" },
  { id: "file" as const, label: "One file" },
];

function draftLabel(
  mode: DriveAccessMode,
  selected: DriveFileListItem | null,
): string {
  if (mode === "entire_drive") return "Entire Drive";
  if (mode === "folder") {
    return selected ? `Folder: ${selected.name}` : "Folder (pick one)";
  }
  return selected ? `File: ${selected.name}` : "One file (pick one)";
}

function selectionForMode(
  mode: DriveAccessMode,
  drive: WorkspaceAppStatus,
): DriveFileListItem | null {
  if (mode === "entire_drive") return null;
  if ((drive.accessMode ?? "entire_drive") !== mode) return null;
  if (!drive.scopeId || !drive.scopeName) return null;
  return {
    id: drive.scopeId,
    name: drive.scopeName,
    mimeType: mode === "folder" ? FOLDER_MIME : "application/octet-stream",
  };
}

function savedKeyFor(drive: WorkspaceAppStatus): string {
  return `${drive.accessMode ?? "entire_drive"}|${drive.scopeId ?? ""}|${drive.scopeName ?? ""}`;
}

export function DriveAccessScopeFields({
  drive,
  listDriveItems,
  updateDriveAccessScope,
  disabled,
}: Props) {
  const baselineMode = drive.accessMode ?? "entire_drive";
  const [mode, setMode] = useState<DriveAccessMode>(baselineMode);
  const [selected, setSelected] = useState<DriveFileListItem | null>(() =>
    selectionForMode(baselineMode, drive),
  );
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<DriveFileListItem[]>([]);
  const [listing, setListing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listGen = useRef(0);
  const syncedKeyRef = useRef(savedKeyFor(drive));

  const dirty =
    mode !== baselineMode ||
    (mode !== "entire_drive" &&
      (selected?.id ?? null) !== (drive.scopeId ?? null));

  // Re-sync only when the server-saved scope actually changes (e.g. after Save).
  useEffect(() => {
    const key = savedKeyFor(drive);
    if (key === syncedKeyRef.current) return;
    syncedKeyRef.current = key;
    listGen.current += 1;
    const nextMode = drive.accessMode ?? "entire_drive";
    setMode(nextMode);
    setSelected(selectionForMode(nextMode, drive));
    setQuery("");
    setItems([]);
    setListing(false);
    setError(null);
  }, [drive]);

  useEffect(() => {
    if (mode === "entire_drive") {
      setListing(false);
      setItems([]);
      return;
    }
    const gen = ++listGen.current;
    const opts = {
      q: query,
      purpose: "scope" as const,
      kind: (mode === "folder" ? "folder" : "file") as "folder" | "file",
    };
    const cached = getCachedDriveItems(opts);
    if (cached) {
      setItems(cached);
      setListing(false);
      return;
    }
    setListing(true);
    setItems([]);
    void listDriveItems(opts)
      .then((files) => {
        if (gen !== listGen.current) return;
        setItems(files);
      })
      .catch((err) => {
        if (gen !== listGen.current) return;
        setError(err instanceof Error ? err.message : "Could not list Drive");
      })
      .finally(() => {
        if (gen !== listGen.current) return;
        setListing(false);
      });
  }, [mode, query, listDriveItems]);

  function handleModeChange(next: DriveAccessMode) {
    listGen.current += 1;
    setMode(next);
    setQuery("");
    setError(null);
    setSelected(selectionForMode(next, drive));
    if (next === "entire_drive") {
      setItems([]);
      setListing(false);
      return;
    }
    const cached = getCachedDriveItems({
      purpose: "scope",
      kind: next === "folder" ? "folder" : "file",
      q: "",
    });
    if (cached) {
      setItems(cached);
      setListing(false);
    } else {
      setItems([]);
      setListing(true);
    }
  }

  async function handleSave() {
    if (mode !== "entire_drive" && !selected) {
      setError("Pick a folder or file first");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateDriveAccessScope({
        accessMode: mode,
        scopeId: mode === "entire_drive" ? null : selected?.id,
        scopeName: mode === "entire_drive" ? null : selected?.name,
        scopeMimeType: mode === "entire_drive" ? null : selected?.mimeType,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save access");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-w-0 space-y-3 border-t border-border pt-4">
      <div className="flex items-start gap-2">
        <GoogleDriveIcon className="mt-0.5 size-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-sm font-medium">Docs access</p>
            <InlineHelpHint label="About Drive access limits">
              <p>
                References in Knowledge → Assets can only link files inside this boundary. The
                Google account stays connected; the limit is enforced by Senqo,
                not by Google OAuth scopes.
              </p>
            </InlineHelpHint>
          </div>
          <p className="text-xs text-muted-foreground">
            Limit what Knowledge → Assets can link from this Drive.
          </p>
        </div>
      </div>

      <div
        role="tablist"
        aria-label="Drive access mode"
        className="flex w-full min-w-0 gap-0.5 rounded-lg border border-border bg-muted/40 p-0.5"
      >
        {MODE_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={mode === opt.id}
            disabled={disabled || saving}
            onClick={() => handleModeChange(opt.id)}
            className={cn(
              "min-w-0 flex-1 truncate rounded-md px-2 py-2 text-center text-xs font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50",
              mode === opt.id
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {mode !== "entire_drive" && (
        <DriveScopeItemPicker
          mode={mode}
          query={query}
          onQueryChange={setQuery}
          items={items}
          listing={listing}
          selected={selected}
          onSelect={setSelected}
          disabled={disabled || saving}
        />
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 text-xs text-muted-foreground">
          {dirty ? (
            <>
              <span className="text-foreground">Pending:</span>{" "}
              {draftLabel(mode, selected)}
            </>
          ) : (
            <>Saved: {drive.accessLabel ?? "Entire Drive"}</>
          )}
        </p>
        <Button
          type="button"
          size="sm"
          disabled={
            disabled ||
            saving ||
            !dirty ||
            (mode !== "entire_drive" && !selected)
          }
          onClick={() => void handleSave()}
        >
          {saving ? "Saving…" : "Save access"}
        </Button>
      </div>
    </div>
  );
}
