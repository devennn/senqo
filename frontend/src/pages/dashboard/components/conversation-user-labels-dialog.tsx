import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ConversationLabelBadge, ConversationLabelRecord } from "@/types/repositories";

export function ConversationUserLabelsDialog({
  open,
  onOpenChange,
  conversationId,
  catalog,
  currentLabels,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  catalog: ConversationLabelRecord[];
  currentLabels: ConversationLabelBadge[];
  onSaved: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const userIds = new Set(currentLabels.filter((l) => l.source === "user").map((l) => l.id));
    setSelected(userIds);
  }, [open, currentLabels]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      await api.put(`/api/user/conversations/${conversationId}/labels/user`, {
        labelIds: [...selected],
      });
      onSaved();
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Your labels for this chat</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Checked labels are saved as yours. AI-assigned labels stay unless you add the same label
          here (then yours take priority).
        </p>
        <div className="max-h-60 space-y-2 overflow-y-auto pr-1">
          {catalog.length === 0 ? (
            <p className="text-sm text-muted-foreground">Create labels on the Labels page (sidebar).</p>
          ) : (
            catalog.map((item) => (
              <label
                key={item.id}
                className="flex cursor-pointer items-start gap-2 rounded-md border border-border/60 px-3 py-2 text-sm"
              >
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={selected.has(item.id)}
                  onChange={() => toggle(item.id)}
                />
                <span>
                  <span className="font-medium">{item.name}</span>
                  {item.description ? (
                    <span className="mt-0.5 block text-xs text-muted-foreground">{item.description}</span>
                  ) : null}
                </span>
              </label>
            ))
          )}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" size="sm" disabled={saving || catalog.length === 0} onClick={() => void handleSave()}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
