import { Link } from "react-router-dom";
import { BookOpen } from "lucide-react";
import { useKnowledgeRefLinks, knowledgeRefLookupKey } from "@/hooks/useKnowledgeRefLinks";
import type {
  ConversationKnowledgeKind,
  ConversationKnowledgeRef,
} from "@/lib/conversation-operator-ai-reasoning";

const KIND_LABEL: Record<ConversationKnowledgeKind, string> = {
  context: "Context",
  template: "Template",
  skill: "Skill",
  handoff: "Handoff",
};

const chipClass =
  "rounded-md border border-border/70 bg-secondary px-2 py-1 text-xs text-secondary-foreground";

export function ConversationKnowledgeRefChips({ sources }: { sources: ConversationKnowledgeRef[] }) {
  const hrefByKey = useKnowledgeRefLinks(sources);

  return (
    <div>
      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        <BookOpen className="size-3.5" aria-hidden />
        References
      </p>
      <ul className="flex flex-wrap gap-1.5">
        {sources.map((ref) => {
          const href = ref.id ? hrefByKey[knowledgeRefLookupKey(ref)] : null;
          return (
            <li key={`${ref.kind}-${ref.label}-${ref.id ?? ""}`}>
              {href ? (
                <Link
                  to={href}
                  className={`${chipClass} font-medium text-primary underline-offset-4 hover:underline`}
                >
                  <span className="font-semibold">{KIND_LABEL[ref.kind]}</span>
                  <span className="mx-1 text-muted-foreground/50">·</span>
                  <span>{ref.label}</span>
                </Link>
              ) : (
                <span className={chipClass}>
                  <span className="font-semibold text-muted-foreground">{KIND_LABEL[ref.kind]}</span>
                  <span className="mx-1 text-muted-foreground/50">·</span>
                  <span>{ref.label}</span>
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
