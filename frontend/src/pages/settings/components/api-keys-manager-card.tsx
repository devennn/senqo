import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ApiKeyCreateResponse, ApiKeyListItem } from "@/types/repositories";

type Props = {
  items: ApiKeyListItem[];
  creating: boolean;
  revokingId: string | null;
  createResult: ApiKeyCreateResponse | null;
  clearCreateResult: () => void;
  onCreate: (input: { label: string; expiresAt: string | null }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

export function ApiKeysManagerCard({
  items,
  creating,
  revokingId,
  createResult,
  clearCreateResult,
  onCreate,
  onDelete,
}: Props) {
  const [showCreate, setShowCreate] = useState(false);
  const [label, setLabel] = useState("");
  const [expiresAtInput, setExpiresAtInput] = useState("");
  const canSubmit = useMemo(() => label.trim().length > 0, [label]);

  function toIsoOrNull(datetimeLocalValue: string): string | null {
    if (!datetimeLocalValue.trim()) return null;
    const date = new Date(datetimeLocalValue);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
  }

  async function handleCreate(input: { label: string; expiresAt: string | null }) {
    try {
      await onCreate(input);
      toast.success("API key created");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "api_key_create_failed";
      toast.error(message.replace(/_/g, " "));
    }
  }

  async function handleDelete(apiKeyId: string) {
    try {
      await onDelete(apiKeyId);
      toast.success("API key deleted");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "api_key_delete_failed";
      toast.error(message.replace(/_/g, " "));
    }
  }

  async function handleCreateSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSubmit || creating) return;
    await handleCreate({ label: label.trim(), expiresAt: toIsoOrNull(expiresAtInput) });
    setLabel("");
    setExpiresAtInput("");
  }

  function handleHideCreatePanel() {
    setShowCreate(false);
    clearCreateResult();
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>API keys</CardTitle>
          <Button
            type="button"
            onClick={() => {
              setShowCreate((prev) => !prev);
              if (showCreate) clearCreateResult();
            }}
          >
            Create API key
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {showCreate ? (
          <div className="space-y-3 rounded-lg border border-border/70 p-3">
            {createResult ? (
              <div className="space-y-3">
                <div className="rounded-md border border-primary/40 bg-secondary px-3 py-2">
                  <p className="text-sm font-medium text-secondary-foreground">
                    API key created. Copy it now; it will not be shown again after you close this
                    section.
                  </p>
                </div>
                <pre className="overflow-x-auto rounded-md border border-border/70 bg-muted/40 p-3 text-xs text-foreground">
                  {createResult.apiKey}
                </pre>
                <div className="flex justify-end">
                  <Button type="button" variant="outline" onClick={handleHideCreatePanel}>
                    Close
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateSubmit} className="grid gap-3 md:grid-cols-3">
                <div className="space-y-2 md:col-span-1">
                  <Label htmlFor="apiKeyLabelInline">Label</Label>
                  <Input
                    id="apiKeyLabelInline"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="External Scheduler"
                    maxLength={80}
                    required
                  />
                </div>
                <div className="space-y-2 md:col-span-1">
                  <Label htmlFor="apiKeyExpiresAtInline">Expires at (optional)</Label>
                  <Input
                    id="apiKeyExpiresAtInline"
                    type="datetime-local"
                    value={expiresAtInput}
                    onChange={(e) => setExpiresAtInput(e.target.value)}
                  />
                </div>
                <div className="flex items-end gap-2 md:col-span-1">
                  <Button type="submit" disabled={!canSubmit || creating}>
                    {creating ? "Creating..." : "Create API key"}
                  </Button>
                  <Button type="button" variant="outline" onClick={handleHideCreatePanel}>
                    Cancel
                  </Button>
                </div>
              </form>
            )}
          </div>
        ) : null}
        <div className="space-y-2">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No API keys created yet.</p>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{item.label}</p>
                  <p className="text-xs text-muted-foreground">
                    Prefix: {item.keyPrefix} • Expires:{" "}
                    {item.expiresAt ? new Date(item.expiresAt).toLocaleString() : "Never"}
                  </p>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={revokingId === item.id}
                  onClick={() => void handleDelete(item.id)}
                >
                  {revokingId === item.id ? "Deleting..." : "Delete"}
                </Button>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
