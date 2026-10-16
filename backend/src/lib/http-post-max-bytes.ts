import { AGENT_KNOWLEDGE_IMPORT_MAX_FILE_BYTES, AGENT_KNOWLEDGE_IMPORT_MAX_FILES } from "./agent-knowledge-import.js";
import { WORKSPACE_ASSET_MAX_BYTES } from "./workspace-asset-limits.js";

const MB = 1024 * 1024;

/** Multipart wrapping, description fields, and extra form parts. */
const HTTP_POST_MULTIPART_SLACK_BYTES = 1 * MB;

/**
 * Global POST ceiling. Must cover one 20 MB asset and a 5-file knowledge-import
 * batch at 20 MB each, plus multipart overhead. Enforced by hono's `bodyLimit`
 * middleware, which also covers chunked requests without a Content-Length.
 */
export const HTTP_POST_MAX_BYTES =
  Math.max(
    WORKSPACE_ASSET_MAX_BYTES,
    AGENT_KNOWLEDGE_IMPORT_MAX_FILES * AGENT_KNOWLEDGE_IMPORT_MAX_FILE_BYTES,
  ) + HTTP_POST_MULTIPART_SLACK_BYTES;
