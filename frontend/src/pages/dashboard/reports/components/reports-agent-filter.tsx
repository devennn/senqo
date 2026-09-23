import { Label } from "@/components/ui/label";

type Props = {
  agents: { id: string; name: string }[];
  value: string;
  onChange: (agentId: string | null) => void;
};

export function ReportsAgentFilter({ agents, value, onChange }: Props) {
  return (
    <div className="grid gap-1">
      <Label htmlFor="reports-agent-filter" className="text-xs text-muted-foreground">
        Agent
      </Label>
      <select
        id="reports-agent-filter"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-[10.5rem] rounded-md border border-border bg-background px-2.5 text-sm"
      >
        <option value="">All agents</option>
        {agents.map((agent) => (
          <option key={agent.id} value={agent.id}>
            {agent.name}
          </option>
        ))}
      </select>
    </div>
  );
}