import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useWorkspace } from "@/context/workspace";
import type { ConversationKnowledgeRef } from "@/lib/conversation-operator-ai-reasoning";

type KnowledgeRefLink = {
  kind: ConversationKnowledgeRef["kind"];
  id: string;
  href: string | null;
};

function refsPayload(refs: ConversationKnowledgeRef[]): string {
  return JSON.stringify(
    refs
      .filter((ref) => Boolean(ref.id))
      .map((ref) => ({
        kind: ref.kind,
        id: ref.id,
        ...(ref.groupId ? { groupId: ref.groupId } : {}),
      })),
  );
}

export function knowledgeRefLookupKey(ref: ConversationKnowledgeRef): string {
  return `${ref.kind}:${ref.id ?? ""}`;
}

export function toWorkspaceKnowledgeHref(
  wsPath: (path: string) => string,
  href: string,
): string {
  const q = href.indexOf("?");
  if (q === -1) return wsPath(href);
  return `${wsPath(href.slice(0, q))}?${href.slice(q + 1)}`;
}

/** Resolve dashboard hrefs for knowledge refs that still exist. */
export function useKnowledgeRefLinks(
  refs: ConversationKnowledgeRef[],
): Record<string, string | null> {
  const { workspaceId, wsPath } = useWorkspace();
  const payloadKey = refsPayload(refs);
  const [hrefByKey, setHrefByKey] = useState<Record<string, string | null>>({});

  useEffect(() => {
    const parsed = JSON.parse(payloadKey) as Array<{
      kind: ConversationKnowledgeRef["kind"];
      id: string;
      groupId?: string;
    }>;
    if (!workspaceId || parsed.length === 0) {
      setHrefByKey({});
      return;
    }
    let cancelled = false;
    void api
      .post<{ links: KnowledgeRefLink[] }>("/api/user/knowledge-ref-links", { refs: parsed })
      .then((res) => {
        if (cancelled) return;
        const next: Record<string, string | null> = {};
        for (const link of res.links) {
          next[`${link.kind}:${link.id}`] = link.href
            ? toWorkspaceKnowledgeHref(wsPath, link.href)
            : null;
        }
        setHrefByKey(next);
      })
      .catch(() => {
        if (!cancelled) setHrefByKey({});
      });
    return () => {
      cancelled = true;
    };
  }, [payloadKey, workspaceId, wsPath]);

  return hrefByKey;
}
