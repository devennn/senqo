import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { InlineHelpHint } from "@/components/ui/inline-help-hint";
import type { AgentConnectionAttachFieldsProps } from "@/types/ui";

export function AgentConnectionAttachFields({
  agentId,
  connections,
  sectionDirty,
  saving,
}: AgentConnectionAttachFieldsProps) {
  const initiallyAttached = connections
    .filter((connection) => connection.attachedAgentId === agentId)
    .map((connection) => connection.id);
  const [selectedIds, setSelectedIds] = useState<string[]>(() => initiallyAttached);
  const availableConnections = connections.filter(
    (connection) => !connection.attachedAgentId || connection.attachedAgentId === agentId,
  );
  const saveDisabled = saving || !sectionDirty;
  const attachedConnections = availableConnections.filter((connection) =>
    selectedIds.includes(connection.id),
  );

  function toggleConnection(connectionId: string, checked: boolean) {
    setSelectedIds((current) => {
      if (checked) {
        if (current.includes(connectionId)) return current;
        return [...current, connectionId];
      }
      return current.filter((id) => id !== connectionId);
    });
  }

  return (
    <fieldset className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Label>Attached WhatsApp connections</Label>
        <InlineHelpHint label="About attached WhatsApp connections">
          <p>
            Attach one or more WhatsApp lines to this agent. Edits to this profile apply to every attached
            line.
          </p>
        </InlineHelpHint>
      </div>
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1 space-y-2 rounded-md border border-border bg-background px-3 py-2">
          {availableConnections.length === 0 ? (
            <p className="text-sm text-muted-foreground">No WhatsApp connections available.</p>
          ) : (
            availableConnections.map((connection) => {
              const label = `${connection.displayName}${
                connection.phoneNumber ? ` (${connection.phoneNumber})` : ""
              }`;
              const checked = selectedIds.includes(connection.id);
              return (
                <label
                  key={connection.id}
                  className="flex cursor-pointer items-center gap-2 text-sm"
                >
                  <input
                    type="checkbox"
                    name="attachedConnectionIds"
                    value={connection.id}
                    checked={checked}
                    onChange={(event) => toggleConnection(connection.id, event.target.checked)}
                    className="size-4 rounded border-border"
                  />
                  <span>{label}</span>
                </label>
              );
            })
          )}
        </div>
        {sectionDirty ? (
          <Button type="submit" size="sm" disabled={saveDisabled}>
            {saving ? "Saving…" : "Save"}
          </Button>
        ) : null}
      </div>
      {attachedConnections.length > 0 ? (
        <p className="text-xs text-primary">
          Active on{" "}
          <span className="font-semibold">
            {attachedConnections
              .map(
                (connection) =>
                  `${connection.displayName}${
                    connection.phoneNumber ? ` (${connection.phoneNumber})` : ""
                  }`,
              )
              .join(", ")}
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
