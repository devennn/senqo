import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { AgentConnectionAttachFieldsProps } from "@/types/ui";

export function AgentConnectionAttachFields({
  agentId,
  connections,
  sectionDirty,
  saving,
}: AgentConnectionAttachFieldsProps) {
  const attachedConnection = connections.find((connection) => connection.attachedAgentId === agentId);
  const availableConnections = connections.filter(
    (connection) => !connection.attachedAgentId || connection.attachedAgentId === agentId,
  );
  const saveDisabled = saving || !sectionDirty;

  return (
    <fieldset className="space-y-2">
      <Label htmlFor="attachedConnectionId">Attached WhatsApp connection</Label>
      <div className="flex flex-wrap items-center gap-2">
        <select
          id="attachedConnectionId"
          name="attachedConnectionId"
          defaultValue={attachedConnection?.id ?? ""}
          className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="">Not attached</option>
          {availableConnections.map((connection) => (
            <option key={connection.id} value={connection.id}>
              {connection.displayName}
              {connection.phoneNumber ? ` (${connection.phoneNumber})` : ""}
            </option>
          ))}
        </select>
        {sectionDirty ? (
          <Button type="submit" size="sm" disabled={saveDisabled}>
            {saving ? "Saving…" : "Save"}
          </Button>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">
        One WhatsApp connection can be attached to this agent. Each agent can only own one connection.
      </p>
      {attachedConnection ? (
        <p className="text-xs text-primary">
          Active: this agent replies to chats on{" "}
          <span className="font-semibold">
            {attachedConnection.displayName}
            {attachedConnection.phoneNumber ? ` (${attachedConnection.phoneNumber})` : ""}
          </span>
          .
        </p>
      ) : (
        <p className="text-xs text-amber-600">
          Inactive: this agent is not replying to any chat. Attach a WhatsApp connection to activate it.
        </p>
      )}
    </fieldset>
  );
}
