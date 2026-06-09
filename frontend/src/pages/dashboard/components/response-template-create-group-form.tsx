import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";

type Props = {
  /** When true, reset fields (e.g. dialog opened). */
  active: boolean;
  onSuccess: (id: string) => void;
  onCancel: () => void;
};

export function ResponseTemplateCreateGroupForm({ active, onSuccess, onCancel }: Props) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!active) return;
    setName("");
    setError(null);
  }, [active]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      setError("Enter a group name (e.g. Operation).");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { id } = await api.post<{ id: string }>("/api/user/response-template-groups", { name: trimmed });
      setName("");
      onSuccess(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create group.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="rtp-dialog-group-name">Group name</Label>
        <Input
          id="rtp-dialog-group-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Operation"
          required
          disabled={busy}
          autoFocus
        />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={busy || name.trim().length === 0}>
          {busy ? "Creating…" : "Create group"}
        </Button>
      </div>
    </form>
  );
}
