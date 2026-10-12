import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { TRANSIENT_SUCCESS_FEEDBACK_MS } from "@/lib/transient-feedback";
import type { WhatsappConnectionCheckStatus } from "@/types/repositories";

const CHECK_MESSAGES: Record<WhatsappConnectionCheckStatus, string> = {
  connected: "Connection is live.",
  disconnected: "This connection is offline. Reconnect with a new QR.",
  pending_qr: "Waiting for a QR scan — use Reconnect QR.",
  unavailable: "Couldn't reach the WhatsApp service. Try again.",
};

type Props = {
  connectionId: string;
  onCheck: (id: string) => Promise<WhatsappConnectionCheckStatus>;
};

/** Asks the WhatsApp service whether this line is actually still signed in. */
export function ConnectionTestButton({ connectionId, onCheck }: Props) {
  const [testing, setTesting] = useState(false);
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
    setMessage(null);
    if (dismissTimer.current !== null) window.clearTimeout(dismissTimer.current);
    try {
      const status = await onCheck(connectionId);
      setMessage(CHECK_MESSAGES[status]);
    } catch {
      setMessage(CHECK_MESSAGES.unavailable);
    } finally {
      setTesting(false);
      dismissTimer.current = window.setTimeout(() => setMessage(null), TRANSIENT_SUCCESS_FEEDBACK_MS);
    }
  }

  return (
    <div className="flex w-full flex-col gap-1 sm:w-auto">
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="w-full sm:w-auto"
        disabled={testing}
        onClick={() => void handleTest()}
      >
        {testing ? "Testing…" : "Test connection"}
      </Button>
      <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
        {message ?? ""}
      </p>
    </div>
  );
}
