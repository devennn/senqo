import { useCallback, useRef, useState } from "react";
import { Image as ImageIcon, Mic, Paperclip, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { startWavRecording } from "@/lib/wav-recorder";
import type { ConversationAttachmentKind } from "@/types/repositories";

export function MessageComposerAttachments({
  disabled = false,
  onAttachment,
  onRecordingChange,
}: {
  disabled?: boolean;
  onAttachment?: (file: File, kind: ConversationAttachmentKind) => void | Promise<void>;
  onRecordingChange?: (recording: boolean) => void;
}) {
  const [recording, setRecording] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const audioRecorderRef = useRef<{ stop: () => Promise<File> } | null>(null);

  function setRecordingState(nextRecording: boolean) {
    setRecording(nextRecording);
    onRecordingChange?.(nextRecording);
  }

  async function handleFileChange(file: File | undefined, kind: ConversationAttachmentKind) {
    if (!file || !onAttachment) return;
    await onAttachment(file, kind);
  }

  const toggleVoiceNote = useCallback(async () => {
    if (disabled || !onAttachment) return;
    if (audioRecorderRef.current) {
      const recorder = audioRecorderRef.current;
      audioRecorderRef.current = null;
      setRecordingState(false);
      const file = await recorder.stop();
      void onAttachment(file, "audio");
      return;
    }
    try {
      audioRecorderRef.current = await startWavRecording();
      setRecordingState(true);
    } catch {
      setRecordingState(false);
      audioRecorderRef.current = null;
    }
  }, [disabled, onAttachment, onRecordingChange]);

  return (
    <>
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        aria-hidden
        disabled={disabled}
        onChange={(event) => {
          void handleFileChange(event.target.files?.[0], "image").finally(() => {
            imageInputRef.current && (imageInputRef.current.value = "");
          });
        }}
      />
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        aria-hidden
        disabled={disabled}
        onChange={(event) => {
          void handleFileChange(event.target.files?.[0], "file").finally(() => {
            fileInputRef.current && (fileInputRef.current.value = "");
          });
        }}
      />
      <div className="flex items-center gap-0.5">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-9 text-muted-foreground"
          aria-label="Attach file"
          disabled={disabled || recording || !onAttachment}
          onClick={() => fileInputRef.current?.click()}
        >
          <Paperclip className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-9 text-muted-foreground"
          aria-label="Attach image"
          disabled={disabled || recording || !onAttachment}
          onClick={() => imageInputRef.current?.click()}
        >
          <ImageIcon className="size-4" />
        </Button>
        {recording ? (
          <div
            className="flex h-9 items-center gap-2 rounded-full border border-destructive/30 bg-destructive/10 px-3 text-xs font-medium text-destructive"
            role="status"
            aria-live="polite"
          >
            <span className="size-2 animate-pulse rounded-full bg-destructive" />
            Recording
          </div>
        ) : null}
        <Button
          type="button"
          variant={recording ? "secondary" : "ghost"}
          size={recording ? "sm" : "icon"}
          className={recording ? "h-9 shrink-0 gap-1.5 text-destructive" : "size-9 text-muted-foreground"}
          aria-label={recording ? "Stop voice note" : "Record voice note"}
          disabled={(disabled && !recording) || !onAttachment}
          onClick={() => {
            void toggleVoiceNote();
          }}
        >
          {recording ? (
            <>
              <Square className="size-3 fill-current" />
              Stop
            </>
          ) : (
            <Mic className="size-4" />
          )}
        </Button>
      </div>
    </>
  );
}
