import { useCallback, useState } from "react";
import { api } from "@/lib/api";
import type { DriveFileListItem } from "@/hooks/useWorkspaceApps";

/** AI drafts an asset description from a picked upload or Drive file (before it is saved). */
export function useAssetSummaryDraft(groupId: string) {
  const [summarizing, setSummarizing] = useState(false);

  const summarizeUpload = useCallback(
    async (file: File) => {
      setSummarizing(true);
      try {
        const form = new FormData();
        form.set("file", file);
        const res = await api.postForm<{ description: string }>(
          `/api/user/workspace-asset-groups/${groupId}/assets/summarize`,
          form,
        );
        return res.description;
      } finally {
        setSummarizing(false);
      }
    },
    [groupId],
  );

  const summarizeDrive = useCallback(
    async (item: DriveFileListItem) => {
      setSummarizing(true);
      try {
        const res = await api.post<{ description: string }>(
          `/api/user/workspace-asset-groups/${groupId}/assets/summarize-drive`,
          {
            source: "google_drive",
            driveFileId: item.id,
            fileName: item.name,
            mimeType: item.mimeType,
          },
        );
        return res.description;
      } finally {
        setSummarizing(false);
      }
    },
    [groupId],
  );

  return { summarizing, summarizeUpload, summarizeDrive };
}
