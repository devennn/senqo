import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { buttonVariants } from "@/components/ui/button";
import { ConfirmDestructiveDialog } from "@/components/confirm-destructive-dialog";
import { useWorkspace } from "@/context/workspace";
import { ApiError } from "@/lib/api";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  displayName: string;
  isDeleting: boolean;
  onConfirm: () => void | Promise<void>;
};

export function ConnectionDeleteDialog({
  open,
  onOpenChange,
  displayName,
  isDeleting,
  onConfirm,
}: Props) {
  const { wsPath } = useWorkspace();

  function renderError(error: unknown): ReactNode {
    if (error instanceof ApiError && error.code === "connection_attached_to_agent") {
      const agentName =
        typeof error.body.agentName === "string" && error.body.agentName.trim()
          ? error.body.agentName
          : "an agent";
      const agentId = typeof error.body.agentId === "string" ? error.body.agentId : "";
      return (
        <div className="space-y-3 text-sm">
          <p>
            This number is still live and attached to agent{" "}
            <span className="font-medium text-foreground">{agentName}</span>. Remove it from the
            agent before deleting — until then, the agent keeps replying on this number.
          </p>
          <Link
            to={
              agentId
                ? `${wsPath("/agent")}?agentId=${encodeURIComponent(agentId)}`
                : wsPath("/agent")
            }
            className={buttonVariants({ variant: "outline", size: "sm" })}
            onClick={() => onOpenChange(false)}
          >
            Open agent setup
          </Link>
        </div>
      );
    }

    return (
      <p className="text-sm text-destructive">
        {error instanceof Error ? error.message : "Something went wrong."}
      </p>
    );
  }

  return (
    <ConfirmDestructiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Delete connection?"
      description={
        <>
          This removes <span className="font-medium text-foreground">{displayName}</span> from your
          workspace and signs out the linked WhatsApp session. Any scheduled tasks using it will be
          cancelled. Scan a new QR to connect again.
        </>
      }
      confirmLabel="Delete"
      pendingConfirmLabel="Deleting…"
      isConfirming={isDeleting}
      onConfirm={onConfirm}
      renderError={renderError}
    />
  );
}
