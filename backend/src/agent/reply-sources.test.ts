import { describe, it, expect } from "vitest";
import {
  emptyKnowledgeSourceCatalog,
  needsKnowledgeSourcesRegen,
  resolveAgentReplySources,
  resolveHandoffTopicLabel,
  type AgentKnowledgeSourceCatalog,
  type KnowledgeCatalogItem,
} from "./reply-sources.js";

function item(
  kind: KnowledgeCatalogItem["kind"],
  label: string,
  id: string,
  groupId: string | null = null,
  groupLabel: string | null = null,
): KnowledgeCatalogItem {
  return { kind, label, groupLabel, id, groupId };
}

const catalog: AgentKnowledgeSourceCatalog = {
  items: [
    item("context", "Refund policy", "ctx-e1", "ctx-g1", "Policies"),
    item("context", "Hours", "ctx-e2", "ctx-g1", "Policies"),
    item("context", "Policies", "ctx-g1", "ctx-g1", null),
    item("context", "Operating Hours", "kl-e1", "kl-g1", "Kuala Lumpur"),
    item("context", "Operating Hours", "pen-e1", "pen-g1", "Penang"),
    item("context", "Kuala Lumpur", "kl-g1", "kl-g1", null),
    item("context", "Penang", "pen-g1", "pen-g1", null),
    item("template", "Greeting", "tpl-e1", "tpl-g1", "Greetings"),
    item("skill", "Booking flow", "sk-1"),
    item("handoff", "Billing", "ho-e1", "ho-g1", "Escalations"),
    item("handoff", "Human handoff", "ho-generic", null),
  ],
  handoffByEntryId: {
    "entry-1": item("handoff", "Billing", "ho-e1", "ho-g1", "Escalations"),
  },
};

describe("resolveAgentReplySources", () => {
  // Model cites attached knowledge → keep canonical labels and ids so chips can deep-link.
  it("keeps model sources that match the catalog, using catalog casing and ids", () => {
    const sources = resolveAgentReplySources({
      modelSources: [
        { kind: "context", group: "Policies", label: "refund policy" },
        { kind: "template", group: "Greetings", label: "Greeting" },
      ],
      loadedSkillNames: [],
      handoffTopicLabel: null,
      catalog,
    });
    expect(sources).toEqual([
      {
        kind: "context",
        label: "Refund policy",
        groupLabel: "Policies",
        id: "ctx-e1",
        groupId: "ctx-g1",
      },
      {
        kind: "template",
        label: "Greeting",
        groupLabel: "Greetings",
        id: "tpl-e1",
        groupId: "tpl-g1",
      },
    ]);
  });

  // Two groups can hold a fact with the same title. `group` is what tells them apart, so the
  // chip links to the entry the reply actually used instead of an arbitrary first match.
  it("picks the entry from the group the model named", () => {
    const sources = resolveAgentReplySources({
      modelSources: [{ kind: "context", group: "Penang", label: "Operating Hours" }],
      loadedSkillNames: [],
      handoffTopicLabel: null,
      catalog,
    });
    expect(sources).toEqual([
      {
        kind: "context",
        label: "Operating Hours",
        groupLabel: "Penang",
        id: "pen-e1",
        groupId: "pen-g1",
      },
    ]);
  });

  // Model named a real group but a fact we cannot match: keep a group-level ref so the chip
  // still opens the group rather than vanishing from the reply.
  it("falls back to the group when the entry label does not match", () => {
    const sources = resolveAgentReplySources({
      modelSources: [{ kind: "context", group: "Policies", label: "Nonexistent fact" }],
      loadedSkillNames: [],
      handoffTopicLabel: null,
      catalog,
    });
    expect(sources).toEqual([
      { kind: "context", label: "Policies", id: "ctx-g1", groupId: "ctx-g1" },
    ]);
  });

  // Sloppy output puts the group heading in `label` and leaves `group` empty. That must still
  // resolve to the group so the ref stays clickable instead of being dropped.
  it("resolves a group heading placed in label with an empty group", () => {
    const sources = resolveAgentReplySources({
      modelSources: [{ kind: "context", group: "", label: "Policies" }],
      loadedSkillNames: [],
      handoffTopicLabel: null,
      catalog,
    });
    expect(sources).toEqual([
      { kind: "context", label: "Policies", id: "ctx-g1", groupId: "ctx-g1" },
    ]);
  });

  // A wrong group must not discard a fact title that exists; prefer the entry over the group
  // so the chip still expands a fact.
  it("matches an entry by label when the named group is wrong", () => {
    const sources = resolveAgentReplySources({
      modelSources: [{ kind: "context", group: "Greetings", label: "Refund policy" }],
      loadedSkillNames: [],
      handoffTopicLabel: null,
      catalog,
    });
    expect(sources).toEqual([
      {
        kind: "context",
        label: "Refund policy",
        groupLabel: "Policies",
        id: "ctx-e1",
        groupId: "ctx-g1",
      },
    ]);
  });

  // Same fact title in two groups is two distinct references, so dedupe must not collapse them.
  it("keeps same-titled entries from different groups as separate refs", () => {
    const sources = resolveAgentReplySources({
      modelSources: [
        { kind: "context", group: "Kuala Lumpur", label: "Operating Hours" },
        { kind: "context", group: "Penang", label: "Operating Hours" },
      ],
      loadedSkillNames: [],
      handoffTopicLabel: null,
      catalog,
    });
    expect(sources.map((s) => s.id)).toEqual(["kl-e1", "pen-e1"]);
  });

  // Invented labels must not appear as references; operators should only see real knowledge.
  it("drops model sources that are not in the catalog", () => {
    const sources = resolveAgentReplySources({
      modelSources: [{ kind: "context", group: "Fictional", label: "Made up policy" }],
      loadedSkillNames: [],
      handoffTopicLabel: null,
      catalog,
    });
    expect(sources).toEqual([]);
  });

  // A successful load_skills call is a real grounding trace even if the model omitted it.
  it("appends loaded skills even when the model omitted them", () => {
    const sources = resolveAgentReplySources({
      modelSources: [],
      loadedSkillNames: ["Booking flow"],
      handoffTopicLabel: null,
      catalog,
    });
    expect(sources).toEqual([
      { kind: "skill", label: "Booking flow", id: "sk-1" },
    ]);
  });

  // Handoff tool use should surface as a Handoff chip for operators.
  it("appends the handoff topic when a handoff ran", () => {
    const sources = resolveAgentReplySources({
      modelSources: [],
      loadedSkillNames: [],
      handoffTopicLabel: "Billing",
      catalog,
    });
    expect(sources).toEqual([
      {
        kind: "handoff",
        label: "Billing",
        groupLabel: "Escalations",
        id: "ho-e1",
        groupId: "ho-g1",
      },
    ]);
  });

  // Duplicate kind+label from model plus tools must collapse to one chip.
  it("dedupes the same kind and label from model and tools", () => {
    const sources = resolveAgentReplySources({
      modelSources: [{ kind: "skill", group: "", label: "Booking flow" }],
      loadedSkillNames: ["booking flow"],
      handoffTopicLabel: null,
      catalog,
    });
    expect(sources).toEqual([
      { kind: "skill", label: "Booking flow", id: "sk-1" },
    ]);
  });

  // Loaded skills unknown to the catalog stay as labels without ids (not clickable).
  it("keeps an unmatched loaded skill label without an id", () => {
    const sources = resolveAgentReplySources({
      modelSources: [],
      loadedSkillNames: ["Mystery skill"],
      handoffTopicLabel: null,
      catalog: emptyKnowledgeSourceCatalog(),
    });
    expect(sources).toEqual([{ kind: "skill", label: "Mystery skill" }]);
  });
});

describe("resolveHandoffTopicLabel", () => {
  // Topic id from the tool maps to the authored topic name for the chip.
  it("returns the catalog topic name for a known entry id", () => {
    expect(resolveHandoffTopicLabel("entry-1", catalog, true)).toBe("Billing");
  });

  // Handoff without a topic still needs a chip so operators see the transfer.
  it("returns Human handoff when called without a matching topic", () => {
    expect(resolveHandoffTopicLabel(null, catalog, true)).toBe("Human handoff");
  });

  // No handoff tool call → no handoff reference.
  it("returns null when handoff was not called", () => {
    expect(resolveHandoffTopicLabel("entry-1", catalog, false)).toBeNull();
  });
});

describe("needsKnowledgeSourcesRegen", () => {
  // Claimed knowledge use with no resolved refs → regenerate structured output.
  it("returns true when knowledge_used is true and resolved sources are empty", () => {
    expect(needsKnowledgeSourcesRegen(true, [])).toBe(true);
  });

  // Valid knowledge turn keeps the first structured output.
  it("returns false when knowledge_used is true and resolved sources exist", () => {
    expect(
      needsKnowledgeSourcesRegen(true, [
        {
          kind: "context",
          label: "Refund policy",
          groupLabel: "Policies",
          id: "ctx-e1",
          groupId: "ctx-g1",
        },
      ]),
    ).toBe(false);
  });

  // Greetings / small talk must not trigger a sources retry.
  it("returns false when knowledge_used is false", () => {
    expect(needsKnowledgeSourcesRegen(false, [])).toBe(false);
  });
});
