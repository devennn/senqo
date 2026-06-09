import * as React from "react";
import { Link } from "react-router-dom";
import { Bot, MoreVertical } from "lucide-react";
import { useWorkspace } from "@/context/workspace";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AgentListRowDialogs,
  type AgentListRowPanel,
} from "@/pages/dashboard/components/agent-list-row-dialogs";
import { cn } from "@/lib/utils";
import type { AgentListRowProps } from "@/types/ui";

export function AgentListRow({
  agent,
  isSelected,
  hasAttachedConnection,
  hasBeenUsed,
  renameAgent,
  archiveAgent,
}: AgentListRowProps) {
  const [panel, setPanel] = React.useState<AgentListRowPanel>("closed");
  const { wsPath } = useWorkspace();

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
          <DropdownMenuContent align="end" className="min-w-[10rem]">
            <DropdownMenuItem onClick={() => setPanel("rename")}>
              Rename
            </DropdownMenuItem>
            {hasAttachedConnection ? (
              <DropdownMenuItem onClick={() => setPanel("blocked")}>
                Archive
              </DropdownMenuItem>
            ) : hasBeenUsed ? (
              <DropdownMenuItem onClick={() => setPanel("used")}>
                Archive agent
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setPanel("archive")}
              >
                Archive agent
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

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
