import { useEffect, useRef, useState } from "react";
import { Activity, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { TRANSIENT_SUCCESS_FEEDBACK_MS } from "@/lib/transient-feedback";
import type { WhatsappConnectionCheckStatus } from "@/types/repositories";

const FAILURE_MESSAGES: Record<Exclude<WhatsappConnectionCheckStatus, "connected">, string> = {
  disconnected: "This connection is offline. Reconnect with a new QR.",
  pending_qr: "Waiting for a QR scan — use Reconnect QR.",
  unavailable: "Couldn't reach the WhatsApp service. Try again.",
};

type Props = {
  connectionId: string;
  onCheck: (id: string) => Promise<WhatsappConnectionCheckStatus>;
};

/** Button beside the status label that asks the WhatsApp service whether this line is still signed in. */
export function ConnectionTestButton({ connectionId, onCheck }: Props) {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<WhatsappConnectionCheckStatus | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const dismissTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (dismissTimer.current !== null) window.clearTimeout(dismissTimer.current);
    },
    [],
  );

  async function handleTest() {
    setTesting(true);
    setResult(null);
    setMessage(null);
    if (dismissTimer.current !== null) window.clearTimeout(dismissTimer.current);
    try {
      const status = await onCheck(connectionId);
      setResult(status);
      if (status !== "connected") setMessage(FAILURE_MESSAGES[status]);
    } catch {
      setResult("unavailable");
      setMessage(FAILURE_MESSAGES.unavailable);
    } finally {
      setTesting(false);
      dismissTimer.current = window.setTimeout(() => {
        setResult(null);
        setMessage(null);
      }, TRANSIENT_SUCCESS_FEEDBACK_MS);
    }
  }

  const showLiveTick = !testing && result === "connected";

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              size="icon-xs"
              variant="ghost"
              className="border-border text-muted-foreground hover:text-foreground"
              aria-label="Test connection"
              disabled={testing}
              onClick={() => void handleTest()}
            />
          }
        >
          {testing ? (
            <Loader2 className="size-4 animate-spin" />
          ) : showLiveTick ? (
            <Check data-testid="connection-test-ok" className="size-4 text-primary" />
          ) : (
            <Activity className="size-4" />
          )}
        </TooltipTrigger>
        <TooltipContent>Check if this number is still signed in</TooltipContent>
      </Tooltip>
      <span
        className={message ? "text-sm font-normal text-muted-foreground" : "sr-only"}
        role="status"
        aria-live="polite"
      >
        {message ?? (showLiveTick ? "Connection is live." : "")}
      </span>
    </span>
  );
}
