/** True when dashboard URL search param `humanOnly` requests the human-handling-only inbox filter. */
export function parseHumanOnlySearchParam(raw: string | null | undefined): boolean {
  const v = raw?.trim().toLowerCase() ?? "";
  return v === "1" || v === "true" || v === "yes";
}

/** Builds query string for GET /api/user/conversations (q, labelId, humanOnly, connectionId). */
export function buildConversationsQuery(
  searchQuery: string,
  labelId: string,
  humanOnly: boolean,
  connectionId: string
): string {
  const params = new URLSearchParams();
  const q = searchQuery.trim();
  const lid = labelId.trim();
  const cid = connectionId.trim();
  if (q) params.set("q", q);
  if (lid) params.set("labelId", lid);
  if (humanOnly) params.set("humanOnly", "1");
  if (cid) params.set("connectionId", cid);
  const s = params.toString();
  return s ? `?${s}` : "";
}
