import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useWorkspace } from "@/context/workspace";
import type { WorkspaceHandoffTopicGroupSummary } from "@/types/repositories";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InlineHelpHint } from "@/components/ui/inline-help-hint";
import { HandoffTopicCreateGroupForm } from "@/pages/dashboard/components/handoff-topic-create-group-form";
import { HandoffTopicGroupsSidebar } from "@/pages/dashboard/components/handoff-topic-groups-sidebar";
import { HandoffTopicGroupEditor } from "@/pages/dashboard/components/handoff-topic-group-editor";

type Props = {
  groups: WorkspaceHandoffTopicGroupSummary[];
  reload: () => Promise<void>;
  agentId: string | undefined;
};

export function HandoffTopicGroupsPanel({ groups, reload, agentId }: Props) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { wsPath } = useWorkspace();
  const [createOpen, setCreateOpen] = useState(false);

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

  const groupHref = useMemo(
    () => (id: string) => handoffPanelHref(agentId, id),
    [agentId],
  );

  const sidebarSelectedId = canonicalGroupId ?? firstGroupId;

  const editorGroupId = groups.length > 0 ? canonicalGroupId ?? firstGroupId : undefined;

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
                      Attach groups on Profile when editing an agent.
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
            <HandoffTopicGroupEditor key={editorGroupId} groupId={editorGroupId} onSaved={reload} />
          )}
        </div>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-x-2 gap-y-1 pr-8">
              <span>New handoff group</span>
              <InlineHelpHint label="What is a handoff group">
                <p>
                  Choose a short workspace-wide name (for example Escalations). Then add topics in the group editor after you create it.
                </p>
              </InlineHelpHint>
            </DialogTitle>
            <DialogDescription>
              Create a workspace folder for related human takeover topics.
            </DialogDescription>
          </DialogHeader>
          <HandoffTopicCreateGroupForm
            active={createOpen}
            onSuccess={handleCreated}
            onCancel={() => setCreateOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
