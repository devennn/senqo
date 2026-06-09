import { ConversationHandlingModeToggle } from "@/pages/dashboard/components/conversation-handling-mode-toggle";
import { MessageComposerViaLine } from "@/pages/dashboard/components/message-composer-via-line";
import type { ConversationHandlingMode, ConversationHeaderData } from "@/types/repositories";

export function MessageComposerAiHandled({
  connectionUnavailable,
  showAiDisabledNote,
  whatsappConnection,
  canChangeHandlingMode,
  handlingModeSaving,
  onHandlingModeChange,
}: {
  connectionUnavailable: boolean;
  showAiDisabledNote: boolean;
  whatsappConnection?: ConversationHeaderData["whatsappConnection"];
  canChangeHandlingMode: boolean;
  handlingModeSaving: boolean;
  onHandlingModeChange?: (mode: ConversationHandlingMode) => void | Promise<void>;
}) {
  return (
    <div className="flex min-h-[4.5rem] flex-col justify-center gap-3 rounded-xl border border-border/60 bg-muted/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col justify-center gap-2">
        <div className="flex flex-col gap-0.5">
          <p className="text-sm text-muted-foreground">
            {connectionUnavailable
              ? "This WhatsApp connection is not connected."
              : "AI is replying automatically..."}
          </p>
          {whatsappConnection ? (
            <MessageComposerViaLine connection={whatsappConnection} />
          ) : null}
        </div>
        {connectionUnavailable ? (
          <p className="text-xs leading-relaxed text-amber-700 dark:text-amber-300">
            Reconnect it from Connect before AI or human replies can be sent.
          </p>
        ) : null}
        {showAiDisabledNote ? (
          <p className="text-xs leading-relaxed text-amber-700 dark:text-amber-300">
            AI is off for this conversation for this WhatsApp connection (check Connect or Test contact settings).
          </p>
        ) : null}
      </div>
      {canChangeHandlingMode && onHandlingModeChange ? (
        <ConversationHandlingModeToggle
          mode="ai"
          saving={handlingModeSaving}
          onChange={onHandlingModeChange}
        />
      ) : null}
    </div>
  );
}
