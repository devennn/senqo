import { HandoffTopicGroupTopicsBlock } from "@/pages/dashboard/components/handoff-topic-group-topics-block";
import type { WorkspaceHandoffTopicEntryRecord } from "@/types/repositories";

type Props = {
  groupId: string;
  entries: WorkspaceHandoffTopicEntryRecord[];
  reloadGroup: () => Promise<void>;
  onWorkspaceStale: () => Promise<void>;
};

export function HandoffTopicGroupEditorContent({
  groupId,
  entries,
  reloadGroup,
  onWorkspaceStale,
}: Props) {
  return (
    <HandoffTopicGroupTopicsBlock
      groupId={groupId}
      entries={entries}
      reloadGroup={reloadGroup}
      onWorkspaceStale={onWorkspaceStale}
    />
  );
}
