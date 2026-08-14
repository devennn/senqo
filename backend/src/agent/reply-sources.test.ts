import { describe, it, expect } from "vitest";
import {
  emptyKnowledgeSourceCatalog,
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
): KnowledgeCatalogItem {
  return { kind, label, id, groupId };
}

const catalog: AgentKnowledgeSourceCatalog = {
  items: [
    item("context", "Refund policy", "ctx-e1", "ctx-g1"),
    item("context", "Hours", "ctx-e2", "ctx-g1"),
    item("template", "Greeting", "tpl-e1", "tpl-g1"),
    item("skill", "Booking flow", "sk-1"),
    item("handoff", "Billing", "ho-e1", "ho-g1"),
    item("handoff", "Human handoff", "ho-generic", null),
  ],
  handoffByEntryId: {
    "entry-1": item("handoff", "Billing", "ho-e1", "ho-g1"),
  },
};

describe("resolveAgentReplySources", () => {
  // Model cites attached knowledge → keep canonical labels and ids so chips can deep-link.
  it("keeps model sources that match the catalog, using catalog casing and ids", () => {
    const sources = resolveAgentReplySources({
      modelSources: [
        { kind: "context", label: "refund policy" },
        { kind: "template", label: "Greeting" },
      ],
      loadedSkillNames: [],
      handoffTopicLabel: null,
      catalog,
    });
    expect(sources).toEqual([
      { kind: "context", label: "Refund policy", id: "ctx-e1", groupId: "ctx-g1" },
      { kind: "template", label: "Greeting", id: "tpl-e1", groupId: "tpl-g1" },
    ]);
  });

  // Invented labels must not appear as references; operators should only see real knowledge.
  it("drops model sources that are not in the catalog", () => {
    const sources = resolveAgentReplySources({
      modelSources: [{ kind: "context", label: "Made up policy" }],
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
      { kind: "handoff", label: "Billing", id: "ho-e1", groupId: "ho-g1" },
    ]);
  });

  // Duplicate kind+label from model plus tools must collapse to one chip.
  it("dedupes the same kind and label from model and tools", () => {
    const sources = resolveAgentReplySources({
      modelSources: [{ kind: "skill", label: "Booking flow" }],
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
