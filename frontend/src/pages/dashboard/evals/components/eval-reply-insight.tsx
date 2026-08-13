import { BookOpen, Brain, ChevronDown } from "lucide-react";
import { EvalRunBadge } from "@/pages/dashboard/evals/components/eval-badges";
import type { EvalKnowledgeKind, EvalKnowledgeRef, EvalRunStatus } from "@/types/evals";

const KIND_LABEL: Record<EvalKnowledgeKind, string> = {
  context: "Context",
  template: "Template",
  skill: "Skill",
  handoff: "Handoff",
};

type Props = {
  /** Operator / agent reasoning for the reply (same role as live chat Reasoning). */
  reasoning: string | null | undefined;
  sources: EvalKnowledgeRef[] | undefined;
  /** Optional run outcome shown beside the Reasoning summary. */
  runStatus?: EvalRunStatus | null;
};

/** Collapsible Reasoning + References under an AI bubble — matches live chat Reasoning UI. */
export function EvalReplyInsight({ reasoning, sources, runStatus = null }: Props) {
  const text = reasoning?.trim() || null;
  const refs = sources?.filter((s) => s.label.trim().length > 0) ?? [];
  if (!text && refs.length === 0 && runStatus == null) return null;

  return (
    <div className="-mt-3 mb-5 flex flex-row-reverse gap-3">
      <div className="size-8 shrink-0" aria-hidden />
      <div className="min-w-0 max-w-[calc(100%-2.75rem)] sm:max-w-[85%]">
        <details className="group w-full rounded-lg text-left">
          <summary className="flex w-full cursor-pointer list-none items-center gap-2 py-1 text-muted-foreground outline-none select-none marker:content-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
            <Brain className="size-4 shrink-0 text-muted-foreground" aria-hidden strokeWidth={1.5} />
            <span className="text-sm text-muted-foreground">Reasoning</span>
            {runStatus != null ? <EvalRunBadge status={runStatus} /> : null}
            {refs.length > 0 ? (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[0.65rem] font-semibold text-muted-foreground">
                {refs.length} ref{refs.length === 1 ? "" : "s"}
              </span>
            ) : null}
            <ChevronDown
              className="ml-auto size-4 shrink-0 text-muted-foreground transition-transform duration-200 ease-out group-open:rotate-180"
              aria-hidden
              strokeWidth={2}
            />
          </summary>
          <div className="mt-2 space-y-3 border-l border-border/50 pl-3">
            {text ? (
              <p className="text-sm leading-relaxed whitespace-pre-wrap break-words text-muted-foreground">
                {text}
              </p>
            ) : null}
            {refs.length > 0 ? (
              <div>
                <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                  <BookOpen className="size-3.5" aria-hidden />
                  References
                </p>
                <ul className="flex flex-wrap gap-1.5">
                  {refs.map((ref) => (
                    <li
                      key={`${ref.kind}-${ref.label}`}
                      className="rounded-md border border-border/70 bg-secondary px-2 py-1 text-xs text-secondary-foreground"
                    >
                      <span className="font-semibold text-muted-foreground">
                        {KIND_LABEL[ref.kind]}
                      </span>
                      <span className="mx-1 text-muted-foreground/50">·</span>
                      <span>{ref.label}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </details>
      </div>
    </div>
  );
}
