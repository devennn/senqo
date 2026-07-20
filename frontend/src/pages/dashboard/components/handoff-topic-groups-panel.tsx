import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useWorkspace } from "@/context/workspace";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { InlineHelpHint } from "@/components/ui/inline-help-hint";
import { AgentHandoffAttachDialog } from "@/pages/dashboard/components/agent-handoff-attach-dialog";
import { HandoffTopicCreateGroupDialog } from "@/pages/dashboard/components/handoff-topic-create-group-dialog";
import { HandoffTopicGroupsSidebar } from "@/pages/dashboard/components/handoff-topic-groups-sidebar";
import { HandoffTopicGroupEditor } from "@/pages/dashboard/components/handoff-topic-group-editor";
import type { AgentConfigRecord, WorkspaceHandoffTopicGroupSummary } from "@/types/repositories";

type Props = {
  groups: WorkspaceHandoffTopicGroupSummary[];
  reload: (options?: { silent?: boolean }) => Promise<void>;
  agentId: string | undefined;
  agents: AgentConfigRecord[];
};

export function HandoffTopicGroupsPanel({ groups, reload, agentId, agents }: Props) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { wsPath } = useWorkspace();
  const [createOpen, setCreateOpen] = useState(false);
  const [attachDialogOpen, setAttachDialogOpen] = useState(false);
  const [settingsGroupId, setSettingsGroupId] = useState<string | null>(null);

  function handoffPanelHref(id: string | undefined, handoffGroupId: string): string {
    const params = new URLSearchParams();
    params.set("tab", "handoff");
    if (id) params.set("agentId", id);
    params.set("handoffGroupId", handoffGroupId);
    return `${wsPath("/agent")}?${params.toString()}`;
  }

  const urlGroupId = searchParams.get("handoffGroupId") ?? undefined;

  const canonicalGroupId = useMemo(() => {
    if (!urlGroupId) return undefined;
    return groups.some((g) => g.id === urlGroupId) ? urlGroupId : undefined;
  }, [groups, urlGroupId]);

  const firstGroupId = groups[0]?.id;
  const groupHref = useMemo(() => (id: string) => handoffPanelHref(agentId, id), [agentId]);
  const sidebarSelectedId = canonicalGroupId ?? firstGroupId;
  const editorGroupId = groups.length > 0 ? canonicalGroupId ?? firstGroupId : undefined;
  const settingsGroup = useMemo(() => {
    const id = settingsGroupId ?? editorGroupId;
    return groups.find((g) => g.id === id) ?? null;
  }, [groups, settingsGroupId, editorGroupId]);

  function openHandoffSettings(groupId: string) {
    setSettingsGroupId(groupId);
    setAttachDialogOpen(true);
  }

  useEffect(() => {
    if (searchParams.get("handoff") !== "new") return;
    setCreateOpen(true);
    const p = new URLSearchParams(searchParams);
    p.delete("handoff");
    setSearchParams(p, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (groups.length === 0) return;
    const fallbackId = groups[0].id;
    if (!urlGroupId || !groups.some((g) => g.id === urlGroupId)) {
      navigate(handoffPanelHref(agentId, fallbackId), { replace: true });
    }
  }, [agentId, groups, navigate, urlGroupId]);

  function handleCreated(newId: string) {
    setCreateOpen(false);
    navigate(handoffPanelHref(agentId, newId), { replace: true });
    void reload();
  }

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <HandoffTopicGroupsSidebar
          groups={groups}
          selectedGroupId={sidebarSelectedId}
          onAddGroup={() => setCreateOpen(true)}
          groupHref={groupHref}
          onOpenAttachDialog={openHandoffSettings}
        />

        <div>
          {groups.length === 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span>No handoff groups yet</span>
                  <InlineHelpHint label="Handoff groups overview">
                    <p>
                      Choose Add group, name the folder in the dialog, then select it from the list and add topics.
                      Use Handoff settings on a group to choose agents and notify.
                    </p>
                  </InlineHelpHint>
                </CardTitle>
                <p className="mt-2 text-[0.9rem] leading-relaxed text-muted-foreground">
                  Use Add group to open the creation dialog.
                </p>
              </CardHeader>
            </Card>
          )}

          {editorGroupId !== undefined && (
            <HandoffTopicGroupEditor
              key={editorGroupId}
              groupId={editorGroupId}
              onSaved={reload}
              onOpenAttachDialog={() => openHandoffSettings(editorGroupId)}
            />
          )}
        </div>
      </div>

      <AgentHandoffAttachDialog
        open={attachDialogOpen}
        onOpenChange={setAttachDialogOpen}
        group={settingsGroup}
        agents={agents}
        onSaved={() => reload({ silent: true })}
      />
      <HandoffTopicCreateGroupDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={handleCreated}
      />
    </>
  );
}
