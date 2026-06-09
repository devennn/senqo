import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useWorkspace } from "@/context/workspace";
import type { WorkspaceContextGroupSummary } from "@/types/repositories";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InlineHelpHint } from "@/components/ui/inline-help-hint";
import { ContextCreateGroupForm } from "@/pages/dashboard/components/context-create-group-form";
import { ContextGroupEditor } from "@/pages/dashboard/components/context-group-editor";
import { ContextGroupsSidebar } from "@/pages/dashboard/components/context-groups-sidebar";

type Props = {
  groups: WorkspaceContextGroupSummary[];
  reload: () => Promise<void>;
  agentId: string | undefined;
};


export function ContextGroupsPanel({ groups, reload, agentId }: Props) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { wsPath } = useWorkspace();
  const [createOpen, setCreateOpen] = useState(false);

  function contextPanelHref(id: string | undefined, contextGroupId: string): string {
    const params = new URLSearchParams();
    params.set("tab", "context");
    if (id) params.set("agentId", id);
    params.set("contextGroupId", contextGroupId);
    return `${wsPath("/agent")}?${params.toString()}`;
  }

  const urlGroupId = searchParams.get("contextGroupId") ?? undefined;

  const canonicalGroupId = useMemo(() => {
    if (!urlGroupId) return undefined;
    return groups.some((g) => g.id === urlGroupId) ? urlGroupId : undefined;
  }, [groups, urlGroupId]);

  const firstGroupId = groups[0]?.id;

  const groupHref = useMemo(() => (id: string) => contextPanelHref(agentId, id), [agentId]);

  const sidebarSelectedId = canonicalGroupId ?? firstGroupId;

  const editorGroupId = groups.length > 0 ? canonicalGroupId ?? firstGroupId : undefined;

  useEffect(() => {
    if (searchParams.get("context") !== "new") return;
    setCreateOpen(true);
    const p = new URLSearchParams(searchParams);
    p.delete("context");
    setSearchParams(p, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (groups.length === 0) return;
    const fallbackId = groups[0].id;
    if (!urlGroupId || !groups.some((g) => g.id === urlGroupId)) {
      navigate(contextPanelHref(agentId, fallbackId), { replace: true });
    }
  }, [agentId, groups, navigate, urlGroupId]);

  function handleCreated(newId: string) {
    setCreateOpen(false);
    navigate(contextPanelHref(agentId, newId), { replace: true });
    void reload();
  }

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <ContextGroupsSidebar
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
                  <span>No context groups yet</span>
                  <InlineHelpHint label="Context groups overview">
                    <p>Use Add group, name the folder, then add fact entries (title + body). Attach groups on Profile.</p>
                  </InlineHelpHint>
                </CardTitle>
                <p className="mt-2 text-[0.9rem] leading-relaxed text-muted-foreground">Use Add group to open the creation dialog.</p>
              </CardHeader>
            </Card>
          )}

          {editorGroupId !== undefined ? <ContextGroupEditor key={editorGroupId} groupId={editorGroupId} onSaved={reload} /> : null}
        </div>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>New context group</DialogTitle>
            <DialogDescription>Name this set of workspace facts.</DialogDescription>
          </DialogHeader>
          <ContextCreateGroupForm active={createOpen} onSuccess={handleCreated} onCancel={() => setCreateOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}
