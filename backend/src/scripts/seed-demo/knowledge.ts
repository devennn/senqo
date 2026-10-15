/**
 * Demo seed — WhatsApp lines, workspace knowledge, catalogs, agents, and labels.
 * All writes go through repositories so schema and limits stay enforced.
 */

import { randomUUID } from "node:crypto";

import {
  DEMO_AGENTS,
  DEMO_ASSET_GROUPS,
  DEMO_CONNECTIONS,
  DEMO_CONTEXT_GROUPS,
  DEMO_CUSTOM_TOOLS,
  DEMO_HANDOFF_GROUPS,
  DEMO_LABELS,
  DEMO_SKILLS,
  DEMO_TEMPLATE_GROUPS,
  type DemoAgentKey,
  type DemoConnectionKey,
  type DemoKnowledgeRef,
} from "./dataset.js";

type KnowledgeEntry = {
  id: string;
  groupLabel: string;
  groupId?: string;
};

export type DemoKnowledgeIndex = {
  context: Map<string, KnowledgeEntry>;
  template: Map<string, KnowledgeEntry>;
  handoff: Map<string, KnowledgeEntry>;
  skill: Map<string, KnowledgeEntry>;
};

export type DemoSeedContext = {
  workspaceId: string;
  demoUserId: string;
  connectionIds: Record<DemoConnectionKey, string>;
  agentIds: Record<DemoAgentKey, string>;
  labelIds: Record<string, string>;
  knowledge: DemoKnowledgeIndex;
  warnings: string[];
};

export function knowledgeKey(group: string, label: string): string {
  return `${group}::${label}`;
}

/** Resolves a scenario knowledge reference into the `ai_sources` metadata shape. */
export function resolveKnowledgeSource(
  knowledge: DemoKnowledgeIndex,
  ref: DemoKnowledgeRef,
): { kind: string; label: string; groupLabel?: string; id?: string; groupId?: string } {
  const entry = knowledge[ref.kind].get(knowledgeKey(ref.group, ref.label));
  if (!entry) {
    return { kind: ref.kind, label: ref.label, groupLabel: ref.group };
  }
  return {
    kind: ref.kind,
    label: ref.label,
    groupLabel: entry.groupLabel,
    id: entry.id,
    groupId: entry.groupId,
  };
}

function must(ok: boolean, step: string, message: string): void {
  if (!ok) {
    throw new Error(`[DemoSeed] ${step} failed: ${message}`);
  }
}

/** Narrows `{ ok: true, ... } | { ok: false, ... }` repository results. */
function ensureOk<T extends { ok: boolean }>(
  result: T,
  step: string,
  message: string,
): asserts result is Extract<T, { ok: true }> {
  if (!result.ok) {
    throw new Error(`[DemoSeed] ${step} failed: ${message}`);
  }
}

function normalizeKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export async function seedConnectionsAndKnowledge(params: {
  workspaceId: string;
  demoUserId: string;
}): Promise<DemoSeedContext> {
  const { workspaceId, demoUserId } = params;
  const warnings: string[] = [];

  const { createConnection, updateConnectionSyncState, updateConnectionMode, recordConnectionEvent, syncAgentWhatsappConnections } =
    await import("../../repositories/whatsapp.js");
  const { createWorkspaceContextGroup, addWorkspaceContextEntry } = await import(
    "../../repositories/workspace-context-groups.js"
  );
  const { createWorkspaceResponseTemplateGroup, addWorkspaceResponseTemplateEntry } = await import(
    "../../repositories/response-templates.js"
  );
  const { createWorkspaceHandoffTopicGroup, addWorkspaceHandoffTopicEntry } = await import(
    "../../repositories/handoff-topic-groups.js"
  );
  const {
    createWorkspaceAssetGroup,
    createAgentDriveDocInGroup,
    createAgentAssetInGroup,
  } = await import("../../repositories/workspace-asset-groups.js");
  const { upsertWorkspaceCustomTool } = await import("../../repositories/workspace-custom-tools.js");
  const { createWorkspaceSkill } = await import("../../repositories/skills.js");
  const { createAgentConfig, updateAgentConfig } = await import("../../repositories/agent.js");
  const { createConversationLabel } = await import("../../repositories/conversation-labels.js");

  // --- WhatsApp lines -------------------------------------------------------
  const connectionIds = {} as Record<DemoConnectionKey, string>;
  for (const spec of DEMO_CONNECTIONS) {
    const created = await createConnection({
      workspaceId,
      displayName: spec.displayName,
      webhookToken: randomUUID(),
    });
    must(created.ok && created.id !== null, "createConnection", created.message);
    const connectionId = created.id as string;
    connectionIds[spec.key] = connectionId;

    const synced = await updateConnectionSyncState(workspaceId, connectionId, {
      status: "authorized",
      phoneNumber: spec.phoneNumber,
      stateInstance: "authorized",
      statusInstance: "online",
      waDeviceId: `demo-device-${spec.key}`,
    });
    must(synced.ok, "updateConnectionSyncState", synced.message);

    const mode = await updateConnectionMode(workspaceId, connectionId, spec.mode);
    must(mode.ok, "updateConnectionMode", mode.message);

    const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();
    await recordConnectionEvent({
      workspaceId,
      connectionIdSnapshot: connectionId,
      displayName: spec.displayName,
      phoneNumber: spec.phoneNumber,
      eventType: "connection_created",
      source: "user",
      stateInstance: "pending_qr",
      statusInstance: null,
      message: `WhatsApp connection setup started for ${spec.displayName}.`,
      createdAt: hoursAgo(72),
    });
    await recordConnectionEvent({
      workspaceId,
      connectionIdSnapshot: connectionId,
      displayName: spec.displayName,
      phoneNumber: spec.phoneNumber,
      eventType: "connection_authorized",
      source: "webhook",
      stateInstance: "authorized",
      statusInstance: "online",
      message: `${spec.displayName} authorised and online.`,
      createdAt: hoursAgo(71),
    });
  }

  // --- Context groups -------------------------------------------------------
  const knowledge: DemoKnowledgeIndex = {
    context: new Map(),
    template: new Map(),
    handoff: new Map(),
    skill: new Map(),
  };
  const contextGroupIds = new Map<string, string>();
  for (const group of DEMO_CONTEXT_GROUPS) {
    const created = await createWorkspaceContextGroup(workspaceId, group.name);
    ensureOk(created, "createWorkspaceContextGroup", group.name);
    contextGroupIds.set(group.name, created.id);
    for (const entry of group.entries) {
      const added = await addWorkspaceContextEntry({
        workspaceId,
        groupId: created.id,
        title: entry.title,
        bodyText: entry.body,
      });
      ensureOk(added, "addWorkspaceContextEntry", `${group.name} > ${entry.title}`);
      knowledge.context.set(knowledgeKey(group.name, entry.title), {
        id: added.entry.id,
        groupId: created.id,
        groupLabel: group.name,
      });
    }
  }

  // --- Response templates ---------------------------------------------------
  const templateGroupIds = new Map<string, string>();
  for (const group of DEMO_TEMPLATE_GROUPS) {
    const created = await createWorkspaceResponseTemplateGroup(workspaceId, group.name);
    ensureOk(created, "createWorkspaceResponseTemplateGroup", group.name);
    templateGroupIds.set(group.name, created.id);
    for (const entry of group.entries) {
      const added = await addWorkspaceResponseTemplateEntry({
        workspaceId,
        groupId: created.id,
        questionText: entry.question,
        answerText: entry.answer,
      });
      ensureOk(added, "addWorkspaceResponseTemplateEntry", `${group.name} > ${entry.question}`);
      knowledge.template.set(knowledgeKey(group.name, entry.question), {
        id: added.entry.id,
        groupId: created.id,
        groupLabel: group.name,
      });
    }
  }

  // --- Handoff topics -------------------------------------------------------
  const handoffGroupIds = new Map<string, string>();
  for (const group of DEMO_HANDOFF_GROUPS) {
    const created = await createWorkspaceHandoffTopicGroup(workspaceId, group.name);
    ensureOk(created, "createWorkspaceHandoffTopicGroup", group.name);
    handoffGroupIds.set(group.name, created.id);
    for (const topic of group.topics) {
      const added = await addWorkspaceHandoffTopicEntry({
        workspaceId,
        groupId: created.id,
        topic: topic.title,
        description: topic.description,
      });
      ensureOk(added, "addWorkspaceHandoffTopicEntry", `${group.name} > ${topic.title}`);
      knowledge.handoff.set(knowledgeKey(group.name, topic.title), {
        id: added.entry.id,
        groupId: created.id,
        groupLabel: group.name,
      });
    }
  }

  // --- Asset groups (drive references + uploads where storage is available) --
  const assetGroupIds = new Map<string, string>();
  for (const group of DEMO_ASSET_GROUPS) {
    const created = await createWorkspaceAssetGroup(workspaceId, group.name);
    ensureOk(created, "createWorkspaceAssetGroup", group.name);
    assetGroupIds.set(group.name, created.id);

    for (const doc of group.docs) {
      const added = await createAgentDriveDocInGroup({
        workspaceId,
        groupId: created.id,
        driveFileId: doc.driveFileId,
        fileName: doc.fileName,
        mimeType: doc.mimeType,
        description: doc.description,
      });
      must(added.ok, "createAgentDriveDocInGroup", added.message);
    }

    for (const upload of group.uploads) {
      const buffer = Buffer.from(upload.contentBase64, "base64");
      const data = buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength,
      ) as ArrayBuffer;
      const added = await createAgentAssetInGroup({
        workspaceId,
        groupId: created.id,
        fileName: upload.fileName,
        mimeType: upload.mimeType,
        description: upload.description,
        data,
      });
      if (!added.ok) {
        warnings.push(`Skipped asset upload ${upload.fileName} (storage): ${added.message}`);
      }
    }
  }

  // --- Custom tools ---------------------------------------------------------
  const toolKeys = new Set<string>(DEMO_AGENTS.flatMap((agent) => agent.tools));
  for (const tool of DEMO_CUSTOM_TOOLS) {
    const saved = await upsertWorkspaceCustomTool({
      workspaceId,
      displayName: tool.displayName,
      description: tool.description,
      sourceCode: tool.sourceCode,
      requiredEnv: [],
      isActive: true,
    });
    if (!saved.ok) {
      warnings.push(`Skipped tool ${tool.displayName}: ${saved.message}`);
      toolKeys.delete(normalizeKey(tool.displayName));
    }
  }

  // --- Skills ---------------------------------------------------------------
  const skillKeys = new Set<string>();
  for (const skill of DEMO_SKILLS) {
    const created = await createWorkspaceSkill({
      workspaceId,
      displayName: skill.displayName,
      description: skill.description,
      content: skill.content,
    });
    const skillKey = normalizeKey(skill.displayName);
    if (!created.ok || !created.skillId) {
      warnings.push(`Skipped skill ${skill.displayName} (storage): ${created.message}`);
      continue;
    }
    skillKeys.add(skillKey);
    knowledge.skill.set(knowledgeKey("Skills", skill.displayName), {
      id: created.skillId,
      groupLabel: "Skills",
    });
  }

  // --- Agents ---------------------------------------------------------------
  const agentIds = {} as Record<DemoAgentKey, string>;
  for (const spec of DEMO_AGENTS) {
    const created = await createAgentConfig({
      workspace_id: workspaceId,
      profile_name: spec.profileName,
    });
    must(created.ok && created.id !== null, "createAgentConfig", spec.profileName);
    const agentId = created.id as string;
    agentIds[spec.key] = agentId;

    const contextIds = spec.contextGroups
      .map((name) => contextGroupIds.get(name))
      .filter((id): id is string => Boolean(id));
    const templateIds = spec.templateGroups
      .map((name) => templateGroupIds.get(name))
      .filter((id): id is string => Boolean(id));
    const handoffIds = spec.handoffGroups
      .map((name) => handoffGroupIds.get(name))
      .filter((id): id is string => Boolean(id));
    const assetIds = spec.assetGroups
      .map((name) => assetGroupIds.get(name))
      .filter((id): id is string => Boolean(id));

    const updated = await updateAgentConfig({
      id: agentId,
      workspace_id: workspaceId,
      profile_name: spec.profileName,
      behavior: spec.behavior,
      tools: spec.tools.filter((key) => toolKeys.has(key)),
      skills: spec.skills.filter((key) => skillKeys.has(key)),
      auto_assign_conversation_labels: true,
      response_template_groups: templateIds,
      handoff_topic_groups: handoffIds,
      context_groups: contextIds,
      asset_groups: assetIds,
      handoff_notify_user_ids: spec.notifyDemoUser ? [demoUserId] : [],
    });
    must(updated.ok, "updateAgentConfig", spec.profileName);

    if (spec.connections.length > 0) {
      const synced = await syncAgentWhatsappConnections(
        workspaceId,
        agentId,
        spec.connections.map((key) => connectionIds[key]),
      );
      must(synced.ok, "syncAgentWhatsappConnections", spec.profileName);
    }
  }

  // --- Conversation labels --------------------------------------------------
  const labelIds: Record<string, string> = {};
  for (const label of DEMO_LABELS) {
    const created = await createConversationLabel({
      workspaceId,
      name: label.name,
      description: label.description,
    });
    must(created.ok && Boolean(created.id), "createConversationLabel", label.name);
    labelIds[label.name] = created.id as string;
  }

  return { workspaceId, demoUserId, connectionIds, agentIds, labelIds, knowledge, warnings };
}
