import { ConfirmDestructiveDialog } from "@/components/confirm-destructive-dialog";
import type { AdminPendingInviteRecord, AdminUserRecord } from "@/lib/admin-api";

export type PendingAdminConfirm =
  | { kind: "delete-user"; user: AdminUserRecord }
  | { kind: "cancel-invite"; invite: AdminPendingInviteRecord };

type Props = {
  pending: PendingAdminConfirm | null;
  isConfirming: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
};

export function AdminConfirmDialog({ pending, isConfirming, onOpenChange, onConfirm }: Props) {
  const isDeleteUser = pending?.kind === "delete-user";
  const email = pending
    ? pending.kind === "delete-user"
      ? pending.user.email
      : pending.invite.email
    : "";

  return (
    <ConfirmDestructiveDialog
      open={pending !== null}
      onOpenChange={onOpenChange}
      title={isDeleteUser ? "Delete user?" : "Cancel invite?"}
      description={
        isDeleteUser
          ? `${email} will be removed permanently. This cannot be undone.`
          : `The signup link sent to ${email} will stop working.`
      }
      confirmLabel={isDeleteUser ? "Delete" : "Cancel invite"}
      pendingConfirmLabel={isDeleteUser ? "Deleting…" : "Cancelling…"}
      isConfirming={isConfirming}
      onConfirm={onConfirm}
    />
  );
}
