import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AGENTS_UI_PAGE_SIZE } from "@/lib/agents-limits";
import { AgentListRow } from "@/pages/dashboard/components/agent-list-row";
import { TablePagination } from "@/pages/dashboard/components/table-pagination";
import type { AgentListProps } from "@/types/ui";

export function AgentList({
  agents,
  selectedAgentId,
  attachedAgentIds,
  renameAgent,
  archiveAgent,
}: AgentListProps) {
  const pageSize = AGENTS_UI_PAGE_SIZE;
  const [page, setPage] = useState(1);
  const attachedAgentIdSet = new Set(attachedAgentIds);

  useEffect(() => {
    if (!selectedAgentId || agents.length === 0) return;
    const idx = agents.findIndex((a) => a.id === selectedAgentId);
    if (idx < 0) return;
    setPage(Math.floor(idx / pageSize) + 1);
  }, [selectedAgentId, pageSize, agents]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(agents.length / pageSize));
    setPage((p) => Math.min(Math.max(p, 1), totalPages));
  }, [agents.length, pageSize]);

  const totalPages = Math.max(1, Math.ceil(agents.length / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const startOffset = (safePage - 1) * pageSize;
  const listAgents = agents.slice(startOffset, startOffset + pageSize);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Agents</CardTitle>
        <CardDescription>Select an agent to configure.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {agents.length > 0 ? (
          <>
            {listAgents.map((agent) => {
              const isSelected = selectedAgentId === agent.id;
              const hasAttachedConnection = attachedAgentIdSet.has(agent.id);
              const hasBeenUsed = Boolean(agent.first_used_at);
              return (
                <AgentListRow
                  key={agent.id}
                  agent={agent}
                  isSelected={isSelected}
                  hasAttachedConnection={hasAttachedConnection}
                  hasBeenUsed={hasBeenUsed}
                  renameAgent={renameAgent}
                  archiveAgent={archiveAgent}
                />
              );
            })}
            {agents.length > pageSize ? (
              <TablePagination
                page={safePage}
                total={agents.length}
                pageSize={pageSize}
                onPage={setPage}
                compact
              />
            ) : null}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">No agents yet.</p>
        )}
      </CardContent>
    </Card>
  );
}
