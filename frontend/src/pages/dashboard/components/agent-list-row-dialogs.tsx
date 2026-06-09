import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type AgentListRowPanel = "closed" | "rename" | "blocked" | "used" | "archive";

export function AgentListRowDialogs({
  panel,
  onOpenChange,
  agentId,
  profileName,
  renameAgent,
  archiveAgent,
}: {
  panel: AgentListRowPanel;
  onOpenChange: (open: boolean) => void;
  agentId: string;
  profileName: string;
  renameAgent: (formData: FormData) => boolean | Promise<boolean>;
  archiveAgent: (formData: FormData) => void | Promise<void>;
}) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(profileName);
  const close = () => onOpenChange(false);
  useEffect(() => {
    if (panel !== "rename") {
      setIsRenaming(false);
    }
  }, [panel]);
  useEffect(() => {
    if (panel === "rename") {
      setRenameValue(profileName);
    }
  }, [panel, profileName]);

  const isRenameDirty = renameValue.trim() !== profileName.trim();
  const canSubmitRename = isRenameDirty && renameValue.trim().length > 0;

  return (
    <Dialog open={panel !== "closed"} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton className="sm:max-w-md">
        {panel === "blocked" ? (
          <>
            <DialogHeader>
              <DialogTitle>Detach WhatsApp first</DialogTitle>
              <DialogDescription>
                This agent is still attached to a WhatsApp connection. On the{" "}
                <Link to="/connect" className="font-medium text-foreground underline underline-offset-2">
                  Connect
                </Link>{" "}
                page, set that connection to &quot;Not attached&quot; (or attach it to another agent), then try again.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="sm:justify-end">
              <Button type="button" variant="outline" onClick={close}>
                Close
              </Button>
              <Link to="/connect" className={buttonVariants({ variant: "default", size: "sm" })}>
                Go to Connect
              </Link>
            </DialogFooter>
          </>
        ) : null}

        {panel === "rename" ? (
          <>
            <DialogHeader>
              <DialogTitle>Rename agent</DialogTitle>
              <DialogDescription>
                Update the profile name used in your agents list.
              </DialogDescription>
            </DialogHeader>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!canSubmitRename || isRenaming) {
                  return;
                }
                setIsRenaming(true);
                const renamed = await renameAgent(new FormData(e.currentTarget));
                setIsRenaming(false);
                if (renamed) {
                  close();
                }
              }}
              className="space-y-4"
            >
              <input type="hidden" name="agentId" value={agentId} />
              <div className="space-y-2">
                <Label htmlFor={`rename-${agentId}`}>Profile name</Label>
                <Input
                  id={`rename-${agentId}`}
                  name="profileName"
                  value={renameValue}
                  onChange={(event) => setRenameValue(event.target.value)}
                  required
                  maxLength={80}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={close} disabled={isRenaming}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isRenaming || !canSubmitRename}>
                  {isRenaming ? "Saving..." : "Save changes"}
                </Button>
              </DialogFooter>
            </form>
          </>
        ) : null}

        {panel === "used" ? (
          <>
            <DialogHeader>
              <DialogTitle>Cannot archive this agent</DialogTitle>
              <DialogDescription>
                This agent has already been used in conversations, so it cannot be archived.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="sm:justify-end">
              <Button type="button" variant="outline" onClick={close}>
                Close
              </Button>
            </DialogFooter>
          </>
        ) : null}

        {panel === "archive" ? (
          <>
            <DialogHeader>
              <DialogTitle>Archive this agent?</DialogTitle>
              <DialogDescription>
                It will be removed from this list.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); archiveAgent(new FormData(e.currentTarget)); }}>
              <input type="hidden" name="agentId" value={agentId} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={close}>
                  Cancel
                </Button>
                <Button type="submit" variant="destructive">
                  Archive
                </Button>
              </DialogFooter>
            </form>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
