import { useEffect, useState, type ReactNode } from "react";
import { ConfirmDestructiveDialog } from "@/components/confirm-destructive-dialog";
import { api, ApiError } from "@/lib/api";
import {
  ConnectionDeleteBlockedNotice,
  ConnectionDeleteStatus,
} from "@/pages/dashboard/connect/components/connection-delete-status";
import type { WhatsappConnectionDeletePreflight } from "@/types/repositories";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connectionId: string;
  displayName: string;
  isDeleting: boolean;
  onConfirm: () => void | Promise<void>;
};

export function ConnectionDeleteDialog({
  open,
  onOpenChange,
  connectionId,
  displayName,
  isDeleting,
  onConfirm,
}: Props) {
  const [preflight, setPreflight] = useState<WhatsappConnectionDeletePreflight | null>(null);
  const [checking, setChecking] = useState(false);

  // Fresh status + attached agent each time the dialog opens; Delete stays unavailable until it settles.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setPreflight(null);
    setChecking(true);
    void (async () => {
      try {
        const result = await api.get<WhatsappConnectionDeletePreflight>(
          `/api/user/connections/${connectionId}/delete-preflight`,
        );
        if (!cancelled) setPreflight(result);
      } catch {
        if (!cancelled) {
          setPreflight({ status: "unavailable", agent: null, deletable: true, blockedReason: null });
        }
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, connectionId]);

  const blocked = preflight?.blockedReason === "connection_attached_to_agent";

  function renderError(error: unknown): ReactNode {
    if (error instanceof ApiError && error.code === "connection_attached_to_agent") {
      const agentName =
        typeof error.body.agentName === "string" && error.body.agentName.trim()
          ? error.body.agentName
          : "an agent";
      const agentId = typeof error.body.agentId === "string" ? error.body.agentId : "";
      return (
        <ConnectionDeleteBlockedNotice
          agentId={agentId}
          agentName={agentName}
          onNavigate={() => onOpenChange(false)}
        />
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
      pendingConfirmLabel={checking ? "Checking…" : "Deleting…"}
      isConfirming={isDeleting || checking}
      confirmDisabled={blocked}
      details={
        <ConnectionDeleteStatus
          checking={checking}
          preflight={preflight}
          onNavigate={() => onOpenChange(false)}
        />
      }
      onConfirm={onConfirm}
      renderError={renderError}
    />
  );
}
