import { useRef, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { NewContact } from "@/hooks/useContacts";

type Props = {
  search: string;
  hasMetadataOnly: boolean;
  testOnly: boolean;
  onApply: (search: string, hasMetadata: boolean, testOnly: boolean) => void;
  onAdd: (contact: NewContact) => Promise<void>;
};

function AddContactDialog({ onAdd }: { onAdd: (c: NewContact) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    await onAdd({ firstName: String(fd.get("firstName") ?? ""), lastName: String(fd.get("lastName") ?? ""), phone: String(fd.get("phone") ?? ""), note: String(fd.get("note") ?? "") });
    setSaving(false);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <Plus className="mr-1.5 size-3.5" /> Add contact
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add contact</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2"><Label>First name</Label><Input name="firstName" required /></div>
            <div className="space-y-2"><Label>Last name</Label><Input name="lastName" required /></div>
          </div>
          <div className="space-y-2"><Label>Phone</Label><Input name="phone" type="tel" required /></div>
          <div className="space-y-2"><Label>Additional info (optional)</Label><Input name="note" /></div>
          <Button type="submit" className="w-full" disabled={saving}>{saving ? "Saving…" : "Add contact"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CrmFilters({ search, hasMetadataOnly, testOnly, onApply, onAdd }: Props) {
  const searchRef = useRef<HTMLInputElement>(null);
  const metaRef = useRef<HTMLInputElement>(null);
  const testRef = useRef<HTMLInputElement>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onApply(
      searchRef.current?.value.trim() ?? "",
      metaRef.current?.checked ?? false,
      testRef.current?.checked ?? false,
    );
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <input ref={searchRef} name="search" defaultValue={search} placeholder="Search name or phone" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm sm:w-auto sm:min-w-64" />
        <label className="flex min-h-10 items-center gap-2 text-sm">
          <input ref={metaRef} type="checkbox" name="hasMetadata" defaultChecked={hasMetadataOnly} />
          Has additional info
        </label>
        <label className="flex min-h-10 items-center gap-2 text-sm">
          <input ref={testRef} type="checkbox" name="testOnly" defaultChecked={testOnly} />
          Test contacts only
        </label>
        <button type="submit" className="h-10 rounded-md border border-input bg-background px-3 text-sm hover:bg-muted">Apply</button>
        {(search || hasMetadataOnly || testOnly) && (
          <button type="button" onClick={() => onApply("", false, false)} className="h-10 rounded-md border border-input bg-background px-3 text-sm hover:bg-muted">Reset</button>
        )}
      </form>
      <AddContactDialog onAdd={onAdd} />
    </div>
  );
}
