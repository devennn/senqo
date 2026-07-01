import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export const AGENT_KNOWLEDGE_IMPORT_REVIEW_EXIT_MS = 300;

type Phase = "visible" | "exiting" | "hidden";

type Props = {
  visible: boolean;
  children: ReactNode;
  className?: string;
};

export function AgentKnowledgeImportReviewAnimatedItem({ visible, children, className }: Props) {
  const [phase, setPhase] = useState<Phase>(visible ? "visible" : "hidden");

  useEffect(() => {
    if (visible) {
      setPhase("visible");
      return;
    }
    if (phase !== "visible") return;
    setPhase("exiting");
    const timer = window.setTimeout(() => setPhase("hidden"), AGENT_KNOWLEDGE_IMPORT_REVIEW_EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [phase, visible]);

  if (phase === "hidden") return null;

  return (
    <div
      className={cn(
        "grid transition-[grid-template-rows,opacity,margin-block] duration-300 ease-in-out motion-reduce:transition-none",
        phase === "exiting" ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100",
        className,
      )}
      aria-hidden={phase === "exiting"}
    >
      <div
        className={cn(
          "min-h-0 overflow-hidden transition-[transform,opacity] duration-300 ease-in-out motion-reduce:transition-none",
          phase === "exiting" && "-translate-y-1 scale-[0.98] opacity-0",
        )}
      >
        {children}
      </div>
    </div>
  );
}
