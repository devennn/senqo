import type { AgentConfigRecord } from "@/types/repositories";

type Props = {
  agents: AgentConfigRecord[];
  selectedIds: ReadonlySet<string>;
  disabled?: boolean;
  onToggle: (agentId: string, checked: boolean) => void;
};

/** Checkbox list of agents that can use a handoff group. */
export function AgentHandoffAttachAgentOptions({
  agents,
  selectedIds,
  disabled,
  onToggle,
}: Props) {
  return (
    <div className="grid min-w-0 gap-2">
      {agents.map((agent) => (
        <label
          key={agent.id}
          className="flex min-w-0 max-w-full items-center gap-2 overflow-hidden rounded-md border border-border/70 px-3 py-2 text-sm"
        >
          <input
            type="checkbox"
            className="shrink-0"
            checked={selectedIds.has(agent.id)}
            disabled={disabled}
            onChange={(e) => onToggle(agent.id, e.target.checked)}
          />
          <span className="min-w-0 flex-1 truncate font-medium">{agent.profile_name}</span>
        </label>
      ))}
    </div>
  );
}
