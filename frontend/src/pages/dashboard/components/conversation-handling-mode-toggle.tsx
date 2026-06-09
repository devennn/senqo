import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ConversationHandlingMode } from "@/types/repositories";

export function ConversationHandlingModeToggle({
  mode,
  saving = false,
  onChange,
}: {
  mode: ConversationHandlingMode;
  saving?: boolean;
  onChange: (mode: ConversationHandlingMode) => void | Promise<void>;
}) {
  return (
    <div
      className="inline-flex shrink-0 rounded-full border border-border/60 bg-muted/40 p-0.5"
      role="group"
      aria-label="AI or human handles replies"
    >
      <Button
        type="button"
        size="sm"
        variant={mode === "ai" ? "default" : "ghost"}
        className={cn(
          "h-7 rounded-full px-3 text-xs",
          mode === "ai" && "shadow-sm",
          mode !== "ai" && "text-muted-foreground hover:text-foreground"
        )}
        disabled={saving}
        onClick={() => void onChange("ai")}
      >
        AI
      </Button>
      <Button
        type="button"
        size="sm"
        variant={mode === "human" ? "default" : "ghost"}
        className={cn(
          "h-7 rounded-full px-3 text-xs",
          mode === "human" && "shadow-sm",
          mode !== "human" && "text-muted-foreground hover:text-foreground"
        )}
        disabled={saving}
        onClick={() => void onChange("human")}
      >
        Human
      </Button>
    </div>
  );
}
