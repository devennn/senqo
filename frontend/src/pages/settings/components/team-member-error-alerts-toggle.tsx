import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { teamMemberErrorMessage } from "@/lib/team-member-errors";
import type { TeamMemberRecord } from "@/types/repositories";

type Props = {
  member: TeamMemberRecord;
  canManage: boolean;
  onChanged: () => Promise<void>;
};

/** Per-member opt-in for WhatsApp alerts when an AI run fails. Confirm on enable. */
export function TeamMemberErrorAlertsToggle({ member, canManage, onChanged }: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
  }, [member.userId]);

  const checked = Boolean(member.receivesErrorAlerts);
  const hasVerifiedPhone = (member.handoffPhones ?? []).some(
    (p) => p.status === "verified",
  );
  const disabled = !canManage || saving || (!checked && !hasVerifiedPhone);

  async function save(enabled: boolean): Promise<boolean> {
    setSaving(true);
    setError(null);
    try {
      await api.patch("/api/user/team/error-alerts", {
        userId: member.userId,
        enabled,
      });
      await onChanged();
      return true;
    } catch (err) {
      setError(
        teamMemberErrorMessage(err instanceof Error ? err.message : "unexpected_error"),
      );
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(next: boolean) {
    if (next) {
      setConfirmOpen(true);
      return;
    }
    await save(false);
  }

  async function handleConfirm() {
    if (await save(true)) setConfirmOpen(false);
  }

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          className="size-4 shrink-0 rounded border-border accent-primary"
          checked={checked}
          disabled={disabled}
          title={
            !hasVerifiedPhone && !checked
              ? "Add a verified handoff phone with Manage first."
              : undefined
          }
          onChange={(event) => void handleToggle(event.target.checked)}
        />
        Receive AI error alerts
      </label>      {error && !confirmOpen ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : null}

      <Dialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!saving) setConfirmOpen(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Receive AI error alerts?</DialogTitle>
            <DialogDescription>
              {member.email || "This member"} will get a WhatsApp alert from the
              conversation&apos;s line whenever an internal AI error prevents a reply to a
              customer. Their personal number must be a verified handoff phone on that
              line.
            </DialogDescription>
          </DialogHeader>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => setConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button type="button" disabled={saving} onClick={() => void handleConfirm()}>
              {saving ? "Turning on…" : "Turn on alerts"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
