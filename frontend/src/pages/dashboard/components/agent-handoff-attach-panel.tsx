import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useHandoffNotifyRecipients } from "@/hooks/useHandoffNotifyRecipients";
import {
  agentHasHandoffGroup,
  buildHandoffAttachPuts,
  commonHandoffNotifyUserIds,
  sortedHandoffIds,
} from "@/lib/agent-handoff-attach";
import { api } from "@/lib/api";
import { AgentHandoffNotifyField } from "@/pages/dashboard/components/agent-handoff-notify-field";
import { AgentHandoffAttachStatus } from "@/pages/dashboard/components/agent-handoff-attach-status";
import type { AgentConfigRecord } from "@/types/repositories";

type Props = {
  groupId: string;
  agents: AgentConfigRecord[];
  onSaved: () => Promise<void>;
};

/** Attach this handoff group to one or more agents and set their notify people. */
export function AgentHandoffAttachPanel({ groupId, agents, onSaved }: Props) {
  const recipients = useHandoffNotifyRecipients();
  const baselineAgentIds = useMemo(
    () => sortedHandoffIds(agents.filter((a) => agentHasHandoffGroup(a, groupId)).map((a) => a.id)),
    [agents, groupId],
  );
  const baselineNotifyIds = useMemo(
    () => commonHandoffNotifyUserIds(agents, groupId),
    [agents, groupId],
  );

  const [selectedIds, setSelectedIds] = useState(() => new Set(baselineAgentIds));
  const [notifyIds, setNotifyIds] = useState(() => new Set(baselineNotifyIds));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  useEffect(() => {
    setSelectedIds(new Set(baselineAgentIds));
    setNotifyIds(new Set(baselineNotifyIds));
    setSaveError(null);
  }, [baselineAgentIds, baselineNotifyIds, groupId]);

  useEffect(() => {
    setSaveSuccess(null);
    setSaveError(null);
  }, [groupId]);

  const dirty =
    sortedHandoffIds(selectedIds).join(",") !== baselineAgentIds.join(",") ||
    sortedHandoffIds(notifyIds).join(",") !== baselineNotifyIds.join(",");

  function toggleAgent(agentId: string, checked: boolean) {
    setSaveSuccess(null);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(agentId);
      else next.delete(agentId);
      return next;
    });
  }

  function toggleNotify(userId: string, checked: boolean) {
    setSaveSuccess(null);
    setNotifyIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(userId);
      else next.delete(userId);
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(null);
    try {
      const puts = buildHandoffAttachPuts(agents, groupId, selectedIds, sortedHandoffIds(notifyIds));
      await Promise.all(puts.map((put) => api.put(`/api/user/agents/${put.agentId}`, put.body)));
      await onSaved();
      setSaveSuccess("Handoff settings saved.");
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Could not save handoff settings.");
    } finally {
      setSaving(false);
    }
  }

  if (agents.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Create an agent on Profile, then choose it here.</p>
    );
  }

  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label>Agents</Label>
        {dirty || saving ? (
          <Button type="button" size="sm" disabled={saving || !dirty} onClick={() => void handleSave()}>
            {saving ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Saving…
              </>
            ) : (
              "Save"
            )}
          </Button>
        ) : null}
      </div>
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
              disabled={saving}
              onChange={(e) => toggleAgent(agent.id, e.target.checked)}
            />
            <span className="min-w-0 flex-1 truncate font-medium">{agent.profile_name}</span>
          </label>
        ))}
      </div>
      <AgentHandoffNotifyField
        recipients={recipients}
        selectedIds={notifyIds}
        disabled={saving}
        onToggle={toggleNotify}
      />
      <AgentHandoffAttachStatus saving={saving} saveSuccess={saveSuccess} saveError={saveError} />
    </div>
  );
}
