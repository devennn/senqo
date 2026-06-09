import { useEffect, useState } from "react";
import { MessageComposerAiHandled } from "@/pages/dashboard/components/message-composer-ai-handled";
import { MessageComposerHumanForm } from "@/pages/dashboard/components/message-composer-human-form";
import type {
  ConversationAttachmentInput,
  ConversationHandlingMode,
  ConversationHeaderData,
} from "@/types/repositories";
import type { FormEvent } from "react";

export function MessageComposer({
  handlingMode,
  connectionAiEnabled,
  canSendManualWhatsapp = true,
  handlingModeSaving = false,
  onHandlingModeChange,
  onSend,
  onSendAttachment,
  whatsappConnection,
}: {
  handlingMode?: ConversationHandlingMode;
  connectionAiEnabled?: boolean | null;
  canSendManualWhatsapp?: boolean;
  handlingModeSaving?: boolean;
  whatsappConnection?: ConversationHeaderData["whatsappConnection"];
  onHandlingModeChange?: (mode: ConversationHandlingMode) => void | Promise<void>;
  onSend?: (message: string) => void | Promise<void>;
  onSendAttachment?: (attachment: ConversationAttachmentInput) => void | Promise<void>;
}) {
  const [text, setText] = useState("");
  const [recordingAudio, setRecordingAudio] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState<{
    file: File;
    kind: ConversationAttachmentInput["kind"];
  } | null>(null);
  const [showAiDisabledNote, setShowAiDisabledNote] = useState(false);
  const isAiHandled = handlingMode === "ai";
  const isConnectionAiDisabled = connectionAiEnabled === false;
  const connectionUnavailable = !canSendManualWhatsapp;
  const manualSendingUnavailable = handlingMode === "human" && connectionUnavailable;
  const canChangeHandlingMode = handlingMode !== undefined && onHandlingModeChange !== undefined;
  const trimmedText = text.trim();
  const inputDisabled =
    manualSendingUnavailable || recordingAudio || pendingAttachment?.kind === "audio";
  const canSubmitText = !manualSendingUnavailable && !pendingAttachment && !!onSend && trimmedText.length > 0;
  const canSubmitAttachment = !manualSendingUnavailable && !!pendingAttachment && !!onSendAttachment;

  useEffect(() => {
    setShowAiDisabledNote(false);
  }, [connectionAiEnabled]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (manualSendingUnavailable) return;
    if (pendingAttachment) {
      if (!onSendAttachment) return;
      const snap = { ...pendingAttachment };
      const captionForSend = pendingAttachment.kind === "audio" ? "" : trimmedText;
      setPendingAttachment(null);
      setText("");
      try {
        await onSendAttachment({
          file: snap.file,
          kind: snap.kind,
          caption: captionForSend,
        });
      } catch {
        setPendingAttachment(snap);
        setText(captionForSend);
      }
      return;
    }
    if (!onSend || !trimmedText) return;
    const toSend = trimmedText;
    setText("");
    try {
      await onSend(toSend);
    } catch {
      // Errors are shown on the optimistic row in the thread.
    }
  }

  async function handleAttachment(file: File, kind: ConversationAttachmentInput["kind"]) {
    if (manualSendingUnavailable) return;
    if (kind === "audio") {
      setText("");
      setPendingAttachment({ file, kind });
      return;
    }
    setPendingAttachment({ file, kind });
  }

  async function handleHandlingModeChange(mode: ConversationHandlingMode) {
    if (mode === "ai" && isConnectionAiDisabled) {
      setShowAiDisabledNote(true);
      await onHandlingModeChange?.(mode);
      return;
    }
    setShowAiDisabledNote(false);
    await onHandlingModeChange?.(mode);
  }

  return (
    <div className="shrink-0 border-t border-border/60 bg-card/90 px-3 py-3 shadow-[0_-8px_24px_rgb(21_28_39_/_6%)] sm:px-4">
      {isAiHandled ? (
        <MessageComposerAiHandled
          connectionUnavailable={connectionUnavailable}
          showAiDisabledNote={showAiDisabledNote}
          whatsappConnection={whatsappConnection}
          canChangeHandlingMode={canChangeHandlingMode}
          handlingModeSaving={handlingModeSaving}
          onHandlingModeChange={handleHandlingModeChange}
        />
      ) : (
        <MessageComposerHumanForm
          manualSendingUnavailable={manualSendingUnavailable}
          text={text}
          onTextChange={setText}
          pendingAttachment={pendingAttachment}
          onRemoveAttachment={() => setPendingAttachment(null)}
          onAttachment={handleAttachment}
          onRecordingChange={setRecordingAudio}
          inputDisabled={inputDisabled}
          canSubmitText={canSubmitText}
          canSubmitAttachment={canSubmitAttachment}
          whatsappConnection={whatsappConnection}
          canChangeHandlingMode={canChangeHandlingMode}
          handlingMode={handlingMode ?? "human"}
          handlingModeSaving={handlingModeSaving}
          onHandlingModeChange={handleHandlingModeChange}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}
