import { useEffect, useState } from "react";
import { ScrollText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PageLoader } from "@/components/ui/spinner";
import { useWorkspace } from "@/context/workspace";
import { api } from "@/lib/api";
import {
  formatAgentMessageContent,
  formatAgentMessageProviderOptions,
} from "@/lib/format-agent-message-content";
import {
  AGENT_RUN_LOG_KIND_LLM_OUTPUT,
  AGENT_RUN_LOG_KIND_WHATSAPP_SENT,
  agentRunLogKind,
} from "@/lib/agent-run-log";
import { cn } from "@/lib/utils";
import type {
  AgentMessageRecord,
  ConversationAgentMessagesResponse,
} from "@/types/repositories";

const ROLE_LABELS: Record<AgentMessageRecord["role"], string> = {
  system: "System",
  user: "User",
  assistant: "Assistant",
  tool: "Tool",
};

function logBadge(message: AgentMessageRecord): { label: string; className: string } {
  const kind = agentRunLogKind(message.provider_options);
  if (kind === AGENT_RUN_LOG_KIND_LLM_OUTPUT) {
    return {
      label: "LLM output",
      className: "bg-sky-500/10 text-sky-800 dark:text-sky-300",
    };
  }
  if (kind === AGENT_RUN_LOG_KIND_WHATSAPP_SENT) {
    return {
      label: "WhatsApp sent",
      className: "bg-violet-500/10 text-violet-800 dark:text-violet-300",
    };
  }
  return {
    label: ROLE_LABELS[message.role],
    className: cn(
      message.role === "system" && "bg-muted text-muted-foreground",
      message.role === "user" && "bg-primary/10 text-primary",
      message.role === "assistant" && "bg-emerald-500/10 text-emerald-700",
      message.role === "tool" && "bg-amber-500/10 text-amber-800",
    ),
  };
}

function AgentLogRow({ message }: { message: AgentMessageRecord }) {
  const formatted = formatAgentMessageContent(message.content);
  const providerOptions = formatAgentMessageProviderOptions(message.provider_options);
  const createdAt = new Date(message.created_at);
  const timestamp = Number.isNaN(createdAt.getTime())
    ? message.created_at
    : `${createdAt.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })}, ${createdAt
        .toLocaleTimeString("en-GB", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        })
        .toLowerCase()}`;
  const badge = logBadge(message);

  return (
    <article className="min-w-0 overflow-hidden rounded-lg border border-border/60 bg-secondary/30 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("rounded-md px-2 py-0.5 text-xs font-semibold", badge.className)}>
          {badge.label}
        </span>
        <time className="text-xs text-muted-foreground">{timestamp}</time>
      </div>
      {formatted.kind === "text" ? (
        <p className="mt-2 whitespace-pre-wrap break-words text-sm [overflow-wrap:anywhere]">
          {formatted.text}
        </p>
      ) : (
        <pre className="mt-2 max-h-80 overflow-y-auto overflow-x-hidden rounded-md bg-background/80 p-2 font-mono text-xs leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
          {formatted.json}
        </pre>
      )}
      {providerOptions ? (
        <details className="mt-2 min-w-0 text-xs text-muted-foreground">
          <summary className="cursor-pointer select-none">Provider options</summary>
          <pre className="mt-2 max-h-40 overflow-y-auto overflow-x-hidden rounded-md bg-background/80 p-2 font-mono text-xs leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
            {providerOptions}
          </pre>
        </details>
      ) : null}
    </article>
  );
}

export function ConversationAgentLogsDialog({
  conversationId,
}: {
  conversationId: string;
}) {
  const { workspaceId } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<AgentMessageRecord[]>([]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    void api
      .get<ConversationAgentMessagesResponse>(
        `/api/user/conversations/${conversationId}/agent-messages`,
        { workspaceId },
      )
      .then((data) => {
        if (cancelled) return;
        setMessages(data.messages);
      })
      .catch(() => {
        if (cancelled) return;
        setMessages([]);
        setError("Could not load agent logs.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [conversationId, open, workspaceId]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 shrink-0 gap-1.5 px-2 text-xs"
          />
        }
      >
        <ScrollText className="size-3.5" />
        View logs
      </DialogTrigger>
      <DialogContent className="flex max-h-[min(85vh,48rem)] w-[calc(100vw-2rem)] max-w-3xl flex-col overflow-hidden sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Agent logs</DialogTitle>
          <DialogDescription>
            Internal agent transcript for this conversation. Workspace owners only.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
          {loading ? (
            <PageLoader label="Loading agent logs…" />
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : messages.length === 0 ? (
            <p className="text-sm text-muted-foreground">No agent messages yet.</p>
          ) : (
            <div className="grid min-w-0 gap-3">
              {[...messages].reverse().map((message) => (
                <AgentLogRow key={message.id} message={message} />
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
