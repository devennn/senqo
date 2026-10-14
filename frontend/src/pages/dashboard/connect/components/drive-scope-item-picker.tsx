import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GoogleDriveFileIcon } from "@/components/icons/google-drive-file-icon";
import type { DriveFileListItem } from "@/hooks/useWorkspaceApps";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";

const FOLDER_MIME = "application/vnd.google-apps.folder";

type Props = {
  mode: "folder" | "file";
  query: string;
  onQueryChange: (value: string) => void;
  items: DriveFileListItem[];
  listing: boolean;
  selected: DriveFileListItem | null;
  onSelect: (item: DriveFileListItem | null) => void;
  disabled?: boolean;
};

export function DriveScopeItemPicker({
  mode,
  query,
  onQueryChange,
  items,
  listing,
  selected,
  onSelect,
  disabled,
}: Props) {
  return (
    <div className="min-w-0 space-y-2">
      <Label htmlFor="drive-scope-search">
        {mode === "folder" ? "Choose folder" : "Choose file"}
      </Label>
      <Input
        id="drive-scope-search"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder="Search by name"
        disabled={disabled}
        className="w-full max-w-full"
      />
      {selected && (
        <div className="flex min-w-0 items-center gap-2 rounded-md border border-primary/30 bg-secondary px-3 py-2 text-sm">
          <GoogleDriveFileIcon
            mimeType={selected.mimeType || (mode === "folder" ? FOLDER_MIME : "")}
            className="size-4"
          />
          <span className="min-w-0 flex-1 truncate font-medium">{selected.name}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={disabled}
            aria-label="Clear selection"
            onClick={() => onSelect(null)}
          >
            <X className="size-3.5" />
          </Button>
        </div>
      )}
      <div className="max-h-44 min-w-0 overflow-y-auto rounded-md border border-border">
        {listing ? (
          <p className="p-3 text-sm text-muted-foreground">Loading…</p>
        ) : items.length === 0 ? (
          <p className="p-3 text-sm text-muted-foreground">No matches</p>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((item) => {
              const isSelected = selected?.id === item.id;
              return (
                <li key={item.id} className="min-w-0">
                  <button
                    type="button"
                    disabled={disabled}
                    className={cn(
                      "flex w-full min-w-0 items-center gap-2 px-3 py-2.5 text-left text-sm",
                      isSelected
                        ? "bg-secondary font-medium"
                        : "hover:bg-muted/60",
                    )}
                    onClick={() => onSelect(isSelected ? null : item)}
                  >
                    <GoogleDriveFileIcon
                      mimeType={item.mimeType}
                      className="size-4"
                    />
                    <span className="min-w-0 flex-1 truncate">{item.name}</span>
                    {isSelected && (
                      <Check className="size-4 shrink-0 text-primary" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

export { FOLDER_MIME };
