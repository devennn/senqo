import { useEffect, useMemo, useState } from "react";
import { useHandoffNotifyRecipients } from "@/hooks/useHandoffNotifyRecipients";
import {
  agentHasHandoffGroup,
  buildHandoffAttachPuts,
  commonHandoffNotifyUserIds,
  handoffAttachSaveErrorMessage,
  sortedHandoffIds,
  unavailableNotifySelections,
} from "@/lib/agent-handoff-attach";
import { api } from "@/lib/api";
import { AgentHandoffAttachAgentOptions } from "@/pages/dashboard/components/agent-handoff-attach-agent-options";
import { AgentHandoffAttachSaveRow } from "@/pages/dashboard/components/agent-handoff-attach-save-row";
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
  const { recipients, membersById, status: teammateStatus } = useHandoffNotifyRecipients();
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

  const selectedAgentIdList = useMemo(() => sortedHandoffIds(selectedIds), [selectedIds]);
  const notifyIdList = useMemo(() => sortedHandoffIds(notifyIds), [notifyIds]);
  const agentsDirty = selectedAgentIdList.join(",") !== baselineAgentIds.join(",");
  const notifyDirty = notifyIdList.join(",") !== baselineNotifyIds.join(",");
  const dirty = agentsDirty || notifyDirty;

  const unavailable = useMemo(
    () =>
      teammateStatus === "ready"
        ? unavailableNotifySelections({ notifyUserIds: notifyIdList, recipients, membersById })
        : [],
    [teammateStatus, notifyIdList, recipients, membersById],
  );
  const blockedByUnavailable = unavailable.length > 0;

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
      const puts = buildHandoffAttachPuts(agents, groupId, selectedIds, notifyIdList, notifyDirty);
      await Promise.all(puts.map((put) => api.put(`/api/user/agents/${put.agentId}`, put.body)));
      await onSaved();
      setSaveSuccess("Handoff settings saved.");
    } catch (err) {
      setSaveError(handoffAttachSaveErrorMessage(err, membersById));
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
      <AgentHandoffAttachSaveRow
        dirty={dirty}
        saving={saving}
        blocked={blockedByUnavailable}
        onSave={() => void handleSave()}
      />
      <AgentHandoffAttachAgentOptions
        agents={agents}
        selectedIds={selectedIds}
        disabled={saving}
        onToggle={toggleAgent}
      />
      <AgentHandoffNotifyField
        recipients={recipients}
        unavailable={unavailable}
        status={teammateStatus}
        selectedIds={notifyIds}
        disabled={saving}
        onToggle={toggleNotify}
      />
      {blockedByUnavailable && dirty ? (
        <p className="text-xs text-destructive" role="status">
          Uncheck the flagged notify people to save.
        </p>
      ) : null}
      <AgentHandoffAttachStatus saving={saving} saveSuccess={saveSuccess} saveError={saveError} />
    </div>
  );
}
