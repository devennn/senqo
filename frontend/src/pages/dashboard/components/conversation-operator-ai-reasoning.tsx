import { Brain, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ConversationKnowledgeRef } from "@/lib/conversation-operator-ai-reasoning";
import { ConversationKnowledgeRefChips } from "@/pages/dashboard/components/conversation-knowledge-ref-chips";

export function ConversationOperatorAiReasoning({
  text,
  sources = [],
  alignEnd,
}: {
  text: string | null;
  sources?: ConversationKnowledgeRef[];
  alignEnd: boolean;
}) {
  const reasoning = text?.trim() || null;
  const refs = sources.filter((s) => s.label.trim().length > 0);
  if (!reasoning && refs.length === 0) return null;

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
            {refs.length > 0 ? (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[0.65rem] font-semibold text-muted-foreground">
                {refs.length} ref{refs.length === 1 ? "" : "s"}
              </span>
            ) : null}
            <span className="sr-only">Operators only — not visible to the customer</span>
            <ChevronDown
              className="ml-auto size-4 shrink-0 text-muted-foreground transition-transform duration-200 ease-out group-open:rotate-180"
              aria-hidden
              strokeWidth={2}
            />
          </summary>
          <div className="mt-2 space-y-3 border-l border-border/50 pl-3">
            {reasoning ? (
              <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap break-words">
                {reasoning}
              </p>
            ) : null}
            {refs.length > 0 ? <ConversationKnowledgeRefChips sources={refs} /> : null}
          </div>
        </details>
      </div>
    </div>
  );
}
