import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { WorkspaceSecretCreateResponse } from "@/types/repositories";

type Props = {
  creating: boolean;
  createResult: WorkspaceSecretCreateResponse | null;
  clearCreateResult: () => void;
  onCreate: (name: string, description: string, value: string) => Promise<void>;
};

export function SecretsCreateDialog({
  creating,
  createResult,
  clearCreateResult,
  onCreate,
}: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [value, setValue] = useState("");
  const canCreate = name.trim().length > 0 && value.trim().length > 0;

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setName("");
      setDescription("");
      setValue("");
      clearCreateResult();
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canCreate || creating) return;
    await onCreate(name.trim(), description.trim(), value);
    setName("");
    setDescription("");
    setValue("");
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button type="button" size="sm" />}>Create secret</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{createResult ? "Secret saved" : "Create secret"}</DialogTitle>
          <DialogDescription>
            {createResult
              ? "Copy this value now. It will not be shown again."
              : "Workspace env var for custom tools. Use MY_ENV style names."}
          </DialogDescription>
        </DialogHeader>
        {createResult ? (
          <div className="space-y-3">
            <pre className="overflow-auto rounded-md border border-border/70 bg-muted/40 p-3 font-mono text-xs">
              {createResult.value}
            </pre>
            <div className="flex justify-end">
              <Button type="button" size="sm" onClick={() => handleOpenChange(false)}>
                Done
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="secret-name">Name</Label>
              <Input
                id="secret-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="MY_API_KEY"
                className="font-mono"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="secret-description">Description</Label>
              <Input
                id="secret-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional note for your team"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="secret-value">Value</Label>
              <Input
                id="secret-value"
                type="password"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                required
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={!canCreate || creating}>
                {creating ? "Saving…" : "Create secret"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
