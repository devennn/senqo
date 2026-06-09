import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useWorkspace } from "@/context/workspace";
import type { WorkspaceAssetGroupSummary } from "@/types/repositories";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InlineHelpHint } from "@/components/ui/inline-help-hint";
import { AssetCreateGroupForm } from "@/pages/dashboard/components/asset-create-group-form";
import { AssetGroupEditor } from "@/pages/dashboard/components/asset-group-editor";
import { AssetGroupsSidebar } from "@/pages/dashboard/components/asset-groups-sidebar";
type Props = {
  groups: WorkspaceAssetGroupSummary[];
  reload: () => Promise<void>;
  agentId: string | undefined;
};

export function AssetGroupsPanel({ groups, reload, agentId }: Props) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { wsPath } = useWorkspace();
  const [createOpen, setCreateOpen] = useState(false);

  function assetPanelHref(id: string | undefined, assetGroupId: string): string {
    const params = new URLSearchParams();
    params.set("tab", "assets");
    if (id) params.set("agentId", id);
    params.set("assetGroupId", assetGroupId);
    return `${wsPath("/agent")}?${params.toString()}`;
  }

  const urlGroupId = searchParams.get("assetGroupId") ?? undefined;
  const canonicalGroupId = useMemo(() => {
    if (!urlGroupId) return undefined;
    return groups.some((g) => g.id === urlGroupId) ? urlGroupId : undefined;
  }, [groups, urlGroupId]);

  const firstGroupId = groups[0]?.id;
  const groupHref = useMemo(() => (id: string) => assetPanelHref(agentId, id), [agentId]);
  const sidebarSelectedId = canonicalGroupId ?? firstGroupId;
  const editorGroupId = groups.length > 0 ? canonicalGroupId ?? firstGroupId : undefined;

  useEffect(() => {
    if (groups.length === 0) return;
    const fallbackId = groups[0].id;
    if (!urlGroupId || !groups.some((g) => g.id === urlGroupId)) {
      navigate(assetPanelHref(agentId, fallbackId), { replace: true });
    }
  }, [agentId, groups, navigate, urlGroupId]);

  function handleCreated(newId: string) {
    setCreateOpen(false);
    navigate(assetPanelHref(agentId, newId), { replace: true });
    void reload();
  }

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <AssetGroupsSidebar
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
                  <span>No asset groups yet</span>
                  <InlineHelpHint label="Asset groups overview">
                    <p>Use Add group, name the folder, then upload files with a short description of what each file is about. Attach groups on Profile.</p>
                  </InlineHelpHint>
                </CardTitle>
                <p className="mt-2 text-[0.9rem] leading-relaxed text-muted-foreground">Use Add group to open the creation dialog.</p>
              </CardHeader>
            </Card>
          )}
          {editorGroupId !== undefined ? (
            <AssetGroupEditor key={editorGroupId} groupId={editorGroupId} onSaved={reload} />
          ) : null}
        </div>
      </div>
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>New asset group</DialogTitle>
            <DialogDescription>Name this set of sendable files.</DialogDescription>
          </DialogHeader>
          <AssetCreateGroupForm active={createOpen} onSuccess={handleCreated} onCancel={() => setCreateOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}
