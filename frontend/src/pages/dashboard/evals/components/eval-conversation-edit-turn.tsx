import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageMedia } from "@/pages/dashboard/components/message-media";
import { cn } from "@/lib/utils";
import type { EvalTurn } from "@/types/evals";

type Props = {
  turn: EvalTurn;
  index: number;
  total: number;
  onContentChange: (content: string) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
};

export function EvalConversationEditTurn({
  turn,
  index,
  total,
  onContentChange,
  onMoveUp,
  onMoveDown,
  onRemove,
}: Props) {
  const isUser = turn.role === "user";

  return (
    <div className={cn("flex w-full", isUser ? "justify-start" : "justify-end")}>
      <div
        className={cn(
          "w-full max-w-[min(100%,28rem)] rounded-md border px-3 py-2 shadow-sm",
          isUser
            ? "border-border/70 bg-chat-incoming"
            : "border-purple-500/20 bg-purple-500/10 dark:bg-purple-500/20",
        )}
      >
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="text-[0.68rem] font-semibold uppercase tracking-wide text-muted-foreground">
            {isUser ? "User" : "AI"}
          </span>
          <div className="flex items-center gap-0.5">
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="Move up"
              disabled={index === 0}
              onClick={onMoveUp}
            >
              <ArrowUp className="size-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="Move down"
              disabled={index === total - 1}
              onClick={onMoveDown}
            >
              <ArrowDown className="size-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="Remove message"
              onClick={onRemove}
            >
              <Trash2 className="size-3.5 text-muted-foreground" />
            </Button>
          </div>
        </div>
        {turn.media ? <MessageMedia media={turn.media} /> : null}
        <Textarea
          aria-label={`${isUser ? "User" : "AI"} message ${index + 1}`}
          className="mt-1 min-h-16 resize-none border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
          value={turn.content}
          onChange={(event) => onContentChange(event.target.value)}
        />
      </div>
    </div>
  );
}
