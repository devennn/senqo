import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AgentListRow } from "@/pages/dashboard/components/agent-list-row";
import type { AgentListProps } from "@/types/ui";

export function AgentList({
  agents,
  selectedAgentId,
  attachedAgentIds,
  renameAgent,
  archiveAgent,
  onImportApplied,
}: AgentListProps) {
  const attachedAgentIdSet = new Set(attachedAgentIds);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Agents</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {agents.map((agent) => {
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
              onImportApplied={onImportApplied}
            />
          );
        })}
      </CardContent>
    </Card>
  );
}
