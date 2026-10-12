import { Bot, Info, Loader2, QrCode, TriangleAlert, Wifi, WifiOff } from "lucide-react";
import { Link } from "react-router-dom";
import { buttonVariants } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useWorkspace } from "@/context/workspace";
import type {
  WhatsappConnectionCheckStatus,
  WhatsappConnectionDeletePreflight,
} from "@/types/repositories";

const STATUS_LABELS: Record<WhatsappConnectionCheckStatus, string> = {
  connected: "Live",
  disconnected: "Offline",
  pending_qr: "Waiting for a QR scan",
  unavailable: "Couldn't reach the WhatsApp service",
};

function StatusIcon({ status }: { status: WhatsappConnectionCheckStatus }) {
  if (status === "connected") return <Wifi className="size-4 text-primary" aria-hidden />;
  if (status === "pending_qr") return <QrCode className="size-4 text-muted-foreground" aria-hidden />;
  if (status === "unavailable") return <TriangleAlert className="size-4 text-muted-foreground" aria-hidden />;
  return <WifiOff className="size-4 text-muted-foreground" aria-hidden />;
}

type BlockedNoticeProps = {
  agentId: string;
  agentName: string;
  onNavigate: () => void;
};

/** Explains why the delete is blocked and links to the agent setup where the line can be detached. */
export function ConnectionDeleteBlockedNotice({ agentId, agentName, onNavigate }: BlockedNoticeProps) {
  const { wsPath } = useWorkspace();

  return (
    <div className="space-y-3 text-sm">
      <p>
        This number is still live and attached to agent{" "}
        <span className="font-medium text-foreground">{agentName}</span>. Remove it from the agent
        before deleting — until then, the agent keeps replying on this number.
      </p>
      <Link
        to={
          agentId
            ? `${wsPath("/agent")}?agentId=${encodeURIComponent(agentId)}`
            : wsPath("/agent")
        }
        className={buttonVariants({ variant: "outline", size: "sm" })}
        onClick={onNavigate}
      >
        Open agent setup
      </Link>
    </div>
  );
}

type Props = {
  checking: boolean;
  preflight: WhatsappConnectionDeletePreflight | null;
  onNavigate: () => void;
};

/** Fresh live status + attached agent for the delete dialog, with the block reason when deleting is not allowed. */
export function ConnectionDeleteStatus({ checking, preflight, onNavigate }: Props) {
  const agentName = preflight?.agent ? preflight.agent.name ?? "Unnamed agent" : null;
  const blocked = preflight?.blockedReason === "connection_attached_to_agent";

  return (
    <div className="space-y-3">
      <div className="space-y-1.5 rounded-md border border-border bg-secondary/60 px-3 py-2 text-sm">
        <p className="flex flex-wrap items-center gap-2">
          {checking ? (
            <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden />
          ) : preflight ? (
            <StatusIcon status={preflight.status} />
          ) : null}
          <span className="text-muted-foreground">Connection status:</span>
          <span className="font-medium text-foreground">
            {checking || !preflight ? "Checking…" : STATUS_LABELS[preflight.status]}
          </span>
          <Tooltip>
            <TooltipTrigger
              type="button"
              aria-label="About connection status"
              className="ml-auto inline-flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <Info className="size-3.5" aria-hidden />
            </TooltipTrigger>
            <TooltipContent className="max-w-64">
              Checked live with the WhatsApp service just now. If the line is live and attached to
              an agent, deleting it is blocked.
            </TooltipContent>
          </Tooltip>
        </p>
        {agentName ? (
          <p className="flex flex-wrap items-center gap-2">
            <Bot className="size-4 text-muted-foreground" aria-hidden />
            <span className="text-muted-foreground">Agent:</span>
            <span className="font-medium text-foreground" data-testid="connection-delete-agent">
              {agentName}
            </span>
          </p>
        ) : null}
      </div>
      {blocked && preflight?.agent ? (
        <ConnectionDeleteBlockedNotice
          agentId={preflight.agent.id}
          agentName={preflight.agent.name ?? "an agent"}
          onNavigate={onNavigate}
        />
      ) : null}
    </div>
  );
}
