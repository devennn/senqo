import { Brain, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function ConversationOperatorAiReasoning({
  text,
  alignEnd,
}: {
  text: string;
  alignEnd: boolean;
}) {
  return (
    <div
      className={cn(
        "mt-2 flex gap-3",
        alignEnd && "flex-row-reverse",
      )}
    >
      <div className="size-8 shrink-0" aria-hidden />
      <div className="min-w-0 max-w-[calc(100%-2.75rem)] sm:max-w-[85%]">
        <details className="group w-full rounded-lg text-left">
          <summary className="flex w-full cursor-pointer list-none items-center gap-2 py-1 text-muted-foreground outline-none select-none marker:content-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
            <Brain className="size-4 shrink-0 text-muted-foreground" aria-hidden strokeWidth={1.5} />
            <span className="text-sm text-muted-foreground">Reasoning</span>
            <span className="sr-only">Operators only — not visible to the customer</span>
            <ChevronDown
              className="ml-auto size-4 shrink-0 text-muted-foreground transition-transform duration-200 ease-out group-open:rotate-180"
              aria-hidden
              strokeWidth={2}
            />
          </summary>
          <p className="mt-2 border-l border-border/50 pl-3 text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap break-words">
            {text}
          </p>
        </details>
      </div>
    </div>
  );
}
