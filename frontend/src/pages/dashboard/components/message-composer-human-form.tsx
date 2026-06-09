import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageComposerAttachmentPreview } from "@/pages/dashboard/components/message-composer-attachment-preview";
import { MessageComposerViaLine } from "@/pages/dashboard/components/message-composer-via-line";
import { ConversationHandlingModeToggle } from "@/pages/dashboard/components/conversation-handling-mode-toggle";
import { MessageComposerAttachments } from "@/pages/dashboard/components/message-composer-attachments";
import type {
  ConversationAttachmentInput,
  ConversationHandlingMode,
  ConversationHeaderData,
} from "@/types/repositories";
import type { FormEvent } from "react";

export function MessageComposerHumanForm({
  manualSendingUnavailable,
  text,
  onTextChange,
  pendingAttachment,
  onRemoveAttachment,
  onAttachment,
  onRecordingChange,
  inputDisabled,
  canSubmitText,
  canSubmitAttachment,
  whatsappConnection,
  canChangeHandlingMode,
  handlingMode,
  handlingModeSaving,
  onHandlingModeChange,
  onSubmit,
}: {
  manualSendingUnavailable: boolean;
  text: string;
  onTextChange: (value: string) => void;
  pendingAttachment: { file: File; kind: ConversationAttachmentInput["kind"] } | null;
  onRemoveAttachment: () => void;
  onAttachment: (file: File, kind: ConversationAttachmentInput["kind"]) => void;
  onRecordingChange: (recording: boolean) => void;
  inputDisabled: boolean;
  canSubmitText: boolean;
  canSubmitAttachment: boolean;
  whatsappConnection?: ConversationHeaderData["whatsappConnection"];
  canChangeHandlingMode: boolean;
  handlingMode: ConversationHandlingMode;
  handlingModeSaving: boolean;
  onHandlingModeChange: (mode: ConversationHandlingMode) => void | Promise<void>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
}) {
  return (
    <form onSubmit={(event) => void onSubmit(event)}>
      <div className="relative flex items-end gap-2">
        {manualSendingUnavailable ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl border border-amber-500/30 bg-background/85 px-4 text-center backdrop-blur-sm">
            <p className="max-w-md text-sm font-medium leading-relaxed text-amber-800 dark:text-amber-200">
              This WhatsApp connection is not connected. Reconnect it from Connect before AI or human replies can be sent.
            </p>
          </div>
        ) : null}
        <div className="flex min-w-0 flex-1 flex-col gap-2 rounded-xl border border-border/60 bg-background px-3.5 py-2.5 shadow-sm">
          {pendingAttachment ? (
            <MessageComposerAttachmentPreview
              file={pendingAttachment.file}
              kind={pendingAttachment.kind}
              disabled={inputDisabled}
              onRemove={onRemoveAttachment}
            />
          ) : null}
          <Textarea
            placeholder={
              pendingAttachment?.kind === "audio"
                ? "Voice note ready to send"
                : pendingAttachment
                  ? "Add a caption..."
                  : "Type a message…"
            }
            value={text}
            onChange={(e) => onTextChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
            rows={2}
            disabled={inputDisabled}
            className="min-h-[2.75rem] resize-none border-0 bg-transparent px-2 py-2.5 shadow-none focus-visible:ring-0"
          />
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/40 pt-2">
            <MessageComposerAttachments
              disabled={manualSendingUnavailable}
              onAttachment={(file, kind) => void onAttachment(file, kind)}
              onRecordingChange={onRecordingChange}
            />
            <div className="flex min-w-0 items-center gap-3">
              {whatsappConnection ? (
                <MessageComposerViaLine connection={whatsappConnection} className="shrink-0" />
              ) : null}
              {canChangeHandlingMode ? (
                <ConversationHandlingModeToggle
                  mode={handlingMode}
                  saving={handlingModeSaving}
                  onChange={onHandlingModeChange}
                />
              ) : null}
              <Button
                type="submit"
                size="icon"
                className="size-9 shrink-0"
                aria-label="Send message"
                disabled={!canSubmitText && !canSubmitAttachment}
              >
                <Send className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
