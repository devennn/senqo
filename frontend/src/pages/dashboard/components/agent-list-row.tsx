import * as React from "react";
import { Link } from "react-router-dom";
import { Bot, MoreVertical } from "lucide-react";
import { useWorkspace } from "@/context/workspace";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AgentListRowDialogs,
  type AgentListRowPanel,
} from "@/pages/dashboard/components/agent-list-row-dialogs";
import { AgentKnowledgeImportDialog } from "@/pages/dashboard/components/agent-knowledge-import-dialog";
import { useAgentKnowledgeImportJobs } from "@/hooks/useAgentKnowledgeImportJobs";
import { cn } from "@/lib/utils";
import type { AgentListRowProps } from "@/types/ui";

function importJobLabel(status: string): string {
  switch (status) {
    case "ready":
      return "Review import";
    case "failed":
      return "Import failed";
    case "processing":
    case "queued":
      return "Import in progress";
    default:
      return "Import docs";
  }
}

export function AgentListRow({
  agent,
  isSelected,
  hasAttachedConnection,
  hasBeenUsed,
  renameAgent,
  archiveAgent,
  onImportApplied,
}: AgentListRowProps) {
  const [panel, setPanel] = React.useState<AgentListRowPanel>("closed");
  const [importOpen, setImportOpen] = React.useState(false);
  const [resumeJobId, setResumeJobId] = React.useState<string | null>(null);
  const { wsPath } = useWorkspace();
  const { activeJob, refresh } = useAgentKnowledgeImportJobs(agent.id);

  async function openImport(jobId?: string | null) {
    const jobs = await refresh();
    const latest =
      jobs.find((job) => job.id === jobId) ??
      jobs.find((job) => job.status === "ready") ??
      jobs.find((job) => job.status === "processing" || job.status === "queued") ??
      jobs.find((job) => job.status === "failed") ??
      null;
    setResumeJobId(latest?.id ?? jobId ?? activeJob?.id ?? null);
    setImportOpen(true);
  }

  return (
    <>
      <div
        className={cn(
          "flex items-center gap-0.5 rounded-md border transition-colors",
          isSelected
            ? "border-primary/60 bg-primary/5"
            : "border-border/70 hover:bg-muted/40",
        )}
      >
        <Link
          to={`${wsPath("/agent")}?agentId=${agent.id}`}
          className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2"
        >
          <Bot
            className={cn(
              "size-4 shrink-0",
              isSelected ? "text-primary" : "text-muted-foreground",
            )}
          />
          <span className="truncate text-sm font-semibold">
            {agent.profile_name}
          </span>
          {hasAttachedConnection ? (
            <span
              className="size-2 shrink-0 rounded-full bg-primary"
              aria-label="Connected"
            />
          ) : null}
          {activeJob ? (
            <Badge variant="secondary" className="max-w-full truncate">
              {activeJob.status === "ready"
                ? "Import ready"
                : activeJob.status === "failed"
                  ? "Import failed"
                  : "Import running"}
            </Badge>
          ) : null}
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="mr-1 shrink-0 text-muted-foreground"
              />
            }
          >
            <MoreVertical className="size-4" />
            <span className="sr-only">Open agent actions</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-auto min-w-40">
            <DropdownMenuItem onClick={() => setPanel("rename")}>
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                void openImport(activeJob?.id);
              }}
            >
              {importJobLabel(activeJob?.status ?? "new")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {hasAttachedConnection ? (
              <DropdownMenuItem onClick={() => setPanel("blocked")}>
                Archive
              </DropdownMenuItem>
            ) : hasBeenUsed ? (
              <DropdownMenuItem onClick={() => setPanel("used")}>
                Archive
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setPanel("archive")}
              >
                Archive
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <AgentKnowledgeImportDialog
        open={importOpen}
        onOpenChange={(open) => {
          if (!open) {
            void refresh();
          }
          setImportOpen(open);
        }}
        agentId={agent.id}
        profileName={agent.profile_name}
        resumeJobId={resumeJobId}
        onJobStarted={(jobId) => {
          setResumeJobId(jobId);
          void refresh();
        }}
        onApplied={() => {
          void refresh();
          onImportApplied?.();
        }}
        onCleared={() => {
          void refresh();
        }}
      />

      <AgentListRowDialogs
        panel={panel}
        onOpenChange={(open) => {
          if (!open) {
            setPanel("closed");
          }
        }}
        agentId={agent.id}
        profileName={agent.profile_name}
        renameAgent={renameAgent}
        archiveAgent={archiveAgent}
      />
    </>
  );
}
