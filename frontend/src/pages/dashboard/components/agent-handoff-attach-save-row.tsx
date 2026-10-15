import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type Props = {
  dirty: boolean;
  saving: boolean;
  blocked: boolean;
  onSave: () => void;
};

/** "Agents" heading with the save affordance, shown only when there is something to save. */
export function AgentHandoffAttachSaveRow({ dirty, saving, blocked, onSave }: Props) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <Label>Agents</Label>
      {dirty || saving ? (
        <Button type="button" size="sm" disabled={saving || !dirty || blocked} onClick={onSave}>
          {saving ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Saving…
            </>
          ) : (
            "Save"
          )}
        </Button>
      ) : null}
    </div>
  );
}
