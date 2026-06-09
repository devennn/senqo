import { AlertCircle, Loader2 } from "lucide-react";
import type { ConversationMessage } from "@/types/repositories";

export function ConversationOutboundSendIndicator({
  message,
}: {
  message: ConversationMessage;
}) {
  if (message.clientSendState === "sending") {
    return (
      <Loader2
        className="size-4 shrink-0 animate-spin text-muted-foreground"
        aria-label="Sending"
      />
    );
  }
  if (message.clientSendState === "failed") {
    return (
      <span className="inline-flex shrink-0" title="Failed to send">
        <AlertCircle
          className="size-4 text-destructive"
          aria-label="Failed to send"
        />
      </span>
    );
  }
  return null;
}
