import type { ModelMessage } from "ai";
import type { AgentMessageRole } from "../types/repositories.js";

function guessImageMediaTypeFromUrl(url: string): string {
  const path = url.split("?")[0]?.toLowerCase() ?? "";
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".webp")) return "image/webp";
  if (path.endsWith(".gif")) return "image/gif";
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
  return "image/jpeg";
}

function normalizeContentPart(
  role: AgentMessageRole,
  part: unknown,
): unknown {
  if (!part || typeof part !== "object") {
    return part;
  }

  const p = part as Record<string, unknown>;
  const type = p.type;

  if (type === "image_url" && p.image_url && typeof p.image_url === "object") {
    const url = (p.image_url as Record<string, unknown>).url;
    if (typeof url !== "string" || url.length === 0) {
      return part;
    }
    if (role === "user") {
      return {
        type: "image",
        image: url,
        mediaType: guessImageMediaTypeFromUrl(url),
      };
    }
    if (role === "assistant") {
      return {
        type: "file",
        data: url,
        mediaType: guessImageMediaTypeFromUrl(url),
      };
    }
    return part;
  }

  return part;
}

/**
 * Maps persisted multimodal shapes (including OpenAI-style `image_url` parts)
 * to content the Vercel AI SDK accepts on model messages.
 */
export function normalizeStoredContentForModelMessage(input: {
  role: AgentMessageRole;
  content: unknown;
}): ModelMessage["content"] {
  const { role, content } = input;

  if (role === "tool" || role === "system") {
    return content as ModelMessage["content"];
  }

  if (typeof content === "string") {
    return content;
  }

  if (!Array.isArray(content)) {
    return content as ModelMessage["content"];
  }

  const mapped = content.map((part) => normalizeContentPart(role, part));
  return mapped as ModelMessage["content"];
}
