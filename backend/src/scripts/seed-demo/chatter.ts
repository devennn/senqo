/**
 * Demo seed — CRM contacts, inbox conversations with scripted threads,
 * agent logs, label assignments, and reported conversations.
 */

import {
  DEMO_CONTACT_NOTES,
  DEMO_COUNTS,
  DEMO_FIRST_NAMES,
  DEMO_LAST_NAMES,
  DEMO_SCENARIOS,
  intBetween,
  isoMinutesBefore,
  malaysianMobile,
  pickOne,
  shuffle,
  type DemoScenario,
} from "./dataset.js";
import type { DemoSeedContext } from "./knowledge.js";
import { knowledgeKey, resolveKnowledgeSource } from "./knowledge.js";

export type DemoChatSummary = {
  messages: number;
  contacts: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    isTest: boolean;
  }[];
  conversations: {
    id: string;
    contactId: string | null;
    scenarioKey: string;
    handledBy: "ai" | "human";
    labels: string[];
  }[];
};

const DAY_MINUTES = 26 * 24 * 60;

type PlannedMessage =
  | { kind: "user"; text: string }
  | { kind: "ai"; text: string; reasoning: string; refs: DemoScenario["aiReplies"][number]["sources"] }
  | { kind: "handoff"; reason: string; topicGroup: string; topic: string };

function buildThread(scenario: DemoScenario, rng: () => number, allowChitChat: boolean): PlannedMessage[] {
  const thread: PlannedMessage[] = [];
  const exchanges = Math.min(scenario.userTurns.length, scenario.aiReplies.length);
  for (let i = 0; i < exchanges; i += 1) {
    thread.push({ kind: "user", text: scenario.userTurns[i] as string });
    const reply = scenario.aiReplies[i] as DemoScenario["aiReplies"][number];
    thread.push({ kind: "ai", text: reply.text, reasoning: reply.reasoning, refs: reply.sources });
  }
  for (let i = exchanges; i < scenario.userTurns.length; i += 1) {
    thread.push({ kind: "user", text: scenario.userTurns[i] as string });
  }
  if (allowChitChat && !scenario.handoff) {
    const closings = intBetween(rng, 1, 2);
    for (let i = 0; i < closings; i += 1) {
      const closing = pickOne(rng, CLOSING_TURNS);
      thread.push({ kind: "user", text: closing.user });
      thread.push({
        kind: "ai",
        text: closing.ai,
        reasoning: closing.reasoning,
        refs: [],
      });
    }
  }
  if (scenario.handoff) {
    thread.push({
      kind: "handoff",
      reason: scenario.handoff.reason,
      topicGroup: scenario.handoff.topicGroup,
      topic: scenario.handoff.topic,
    });
  }
  return thread;
}

/** On-brand staff replies used when a teammate picks up a conversation. */
const HUMAN_REPLIES: readonly string[] = [
  "Hi, this is Priya from Acme — taking over this chat now. Give me a moment to check the details.",
  "Hello, Sam here from Acme. I have reviewed your order and will sort this out today.",
  "Hi, Daniel from Acme — thanks for the photo. I am arranging the replacement now.",
  "Hello, Mei Ling from Acme accounts here — checking the payment records now.",
  "Hi, Nurul from Acme — I will call J&T Express and update you within the hour.",
];

const CLOSING_TURNS: readonly { user: string; ai: string; reasoning: string }[] = [
  {
    user: "Great, thanks!",
    ai: "Anytime — message here if anything else comes up.",
    reasoning: "Courtesy close after answering the request.",
  },
  {
    user: "Perfect, ordering now.",
    ai: "Lovely — we will confirm dispatch as soon as it ships.",
    reasoning: "Courtesy close after pricing was confirmed.",
  },
  {
    user: "Thanks for the quick reply.",
    ai: "You are welcome. We are around Monday to Saturday, 10:00-22:00.",
    reasoning: "Closing with the operating hours.",
  },
  {
    user: "Sounds good, I will think about it.",
    ai: "Of course — the offer runs all month if you decide later.",
    reasoning: "No-pressure close.",
  },
  {
    user: "Can you send the location pin?",
    ai: "Yes — 18 Jalan Telawi 3, Bangsar, 59100 Kuala Lumpur. See you!",
    reasoning: "Shared the store location as a closing.",
  },
  {
    user: "Can you send that again next week?",
    ai: "Sure — I will keep the details ready for you.",
    reasoning: "Promised a follow-up without committing a date.",
  },
  {
    user: "Okay, will collect from Lot 10 then.",
    ai: "Great choice — the Lot 10 counter is open Friday to Sunday.",
    reasoning: "Confirmed the Bukit Bintang collection point.",
  },
];

export async function seedChatter(params: {
  ctx: DemoSeedContext;
  rng: () => number;
  nowMs: number;
}): Promise<DemoChatSummary> {
  const { ctx, rng, nowMs } = params;
  const { workspaceId } = ctx;

  const {
    createContact,
    updateContactIsTest,
    listContactsPage,
  } = await import("../../repositories/contacts.js");
  const {
    findOrCreateConversationByWhatsappChatId,
    createConversationMessage,
  } = await import("../../repositories/whatsapp.js");
  const { updateConversationHandlingMode } = await import("../../repositories/conversations.js");
  const { replaceAssignmentsForConversation } = await import(
    "../../repositories/conversation-labels.js"
  );
  const { createConversationReport } = await import("../../repositories/conversation-reports.js");
  const { createAgentSession } = await import("../../repositories/agent-sessions.js");
  const { insertAgentMessages } = await import("../../repositories/agent-messages.js");
  const { asStorableAgentMessageContent } = await import("../../agent/messages.js");

  // --- Contacts -------------------------------------------------------------
  const testIndexes = new Set([3, 8, 11, 19, 24, 28, 33, 37, 44, 48, 51, 58]);
  const mobilePrefixes = ["12", "13", "16", "17", "19", "18", "14", "11"];
  for (let i = 0; i < DEMO_COUNTS.contacts; i += 1) {
    const firstName = DEMO_FIRST_NAMES[i % DEMO_FIRST_NAMES.length] as string;
    const lastName = DEMO_LAST_NAMES[(i * 7 + 3) % DEMO_LAST_NAMES.length] as string;
    const prefix = mobilePrefixes[i % mobilePrefixes.length] as string;
    const local7 = String(1000000 + i * 931);
    const phone = malaysianMobile(prefix, local7);
    const created = await createContact({
      workspace_id: workspaceId,
      first_name: firstName,
      last_name: lastName,
      phone,
      metadata: {
        note: DEMO_CONTACT_NOTES[i % DEMO_CONTACT_NOTES.length] as string,
        source: i % 4 === 0 ? "WhatsApp inbound" : "Manual import",
      },
    });
    if (!created.ok) {
      throw new Error(`[DemoSeed] createContact failed for ${phone}: ${created.message}`);
    }
  }

  const contactPage = await listContactsPage(workspaceId, { page: 1, pageSize: 100 });
  const contacts = contactPage.items.map((row) => ({
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone,
    isTest: row.is_test,
  }));
  if (contacts.length < DEMO_COUNTS.contacts) {
    throw new Error(
      `[DemoSeed] expected ${DEMO_COUNTS.contacts} contacts, loaded ${contacts.length}`,
    );
  }
  for (const index of testIndexes) {
    const contact = contacts[index];
    if (!contact) continue;
    await updateContactIsTest(workspaceId, contact.id, true);
    contact.isTest = true;
  }

  // --- Plan unique (contact, line) conversation pairs -----------------------
  const connectionKeys = Object.keys(ctx.connectionIds) as (keyof typeof ctx.connectionIds)[];
  const pairs: { contactIndex: number; connectionKey: keyof typeof ctx.connectionIds }[] = [];
  for (let contactIndex = 0; contactIndex < contacts.length; contactIndex += 1) {
    for (const connectionKey of connectionKeys) {
      pairs.push({ contactIndex, connectionKey });
    }
  }
  const planned = shuffle(rng, pairs).slice(0, DEMO_COUNTS.conversations);

  const summary: DemoChatSummary = { messages: 0, contacts, conversations: [] };
  const reportCandidates: string[] = [];
  let agentLogBudget = 12;
  let agentErrorsAdded = 0;

  // Guarantee a few failed outbound sends (hidden from threads, counted in Reports).
  const failedSendIndexes = new Set(
    planned
      .map((plan, index) => ({ plan, index }))
      .filter((entry) => entry.plan.connectionKey === "main")
      .slice(0, 5)
      .map((entry) => entry.index),
  );

  for (let index = 0; index < planned.length; index += 1) {
    const plan = planned[index] as { contactIndex: number; connectionKey: keyof typeof ctx.connectionIds };
    const contact = contacts[plan.contactIndex] as (typeof contacts)[number];
    const connectionId = ctx.connectionIds[plan.connectionKey];
    const scenario = DEMO_SCENARIOS[(index * 5 + 1) % DEMO_SCENARIOS.length] as DemoScenario;
    const displayName = `${contact.firstName} ${contact.lastName}`;
    const digits = contact.phone.replace(/\D/g, "");
    const chatId = `${digits}@s.whatsapp.net`;

    const conversationId = await findOrCreateConversationByWhatsappChatId(
      workspaceId,
      connectionId,
      contact.id,
      displayName,
      chatId,
    );
    if (!conversationId) {
      throw new Error(`[DemoSeed] conversation create failed for ${displayName} (${plan.connectionKey})`);
    }

    const isDryRunLine = plan.connectionKey === "sales";
    const isTestingLine = plan.connectionKey === "support";
    const aiAllowed = !isTestingLine || contact.isTest;

    // Dry-run lines keep AI handling and persist drafts. Testing lines only
    // reply to test contacts; everyone else waits for a human.
    const handledByHuman = isDryRunLine
      ? false
      : Boolean(scenario.handoff) || !aiAllowed || rng() < 0.22;
    const thread = buildThread(scenario, rng, !handledByHuman);

    // Stagger thread start across the past ~26 days, expand forward.
    let minutesAgo = intBetween(rng, 60, DAY_MINUTES);
    let messageIndex = 0;
    const agentTranscript: { role: "user" | "assistant"; text: string }[] = [];

    const pushMessage = async (
      role: "user" | "assistant",
      content: string,
      metadata: Record<string, unknown>,
      sender: "ai_agent" | "human" | null,
      options: { status?: "failed" | "dry_run" } = {},
    ): Promise<void> => {
      const saved = await createConversationMessage(
        workspaceId,
        conversationId,
        role,
        content,
        metadata,
        sender,
        {
          createdAt: isoMinutesBefore(nowMs, minutesAgo),
          waMessageId: `demo-${index}-${messageIndex}`,
          ...(options.status ? { status: options.status } : {}),
        },
      );
      if (!saved.ok) {
        throw new Error(`[DemoSeed] message insert failed (conversation ${conversationId})`);
      }
      summary.messages += 1;
      messageIndex += 1;
      minutesAgo = Math.max(1, minutesAgo - intBetween(rng, 3, 40));
    };

    for (const message of thread) {
      if (message.kind === "user") {
        await pushMessage("user", message.text, {}, null);
        if (aiAllowed) {
          agentTranscript.push({ role: "user", text: message.text });
        }
        continue;
      }
      if (message.kind === "ai") {
        if (!aiAllowed) {
          continue;
        }
        const sources = message.refs.map((ref) => resolveKnowledgeSource(ctx.knowledge, ref));
        const metadata: Record<string, unknown> = {
          ai_reasoning: message.reasoning,
          ai_sources: sources,
        };
        if (isDryRunLine) {
          metadata.dry_run = true;
        }
        await pushMessage("assistant", message.text, metadata, "ai_agent", {
          status: isDryRunLine ? "dry_run" : undefined,
        });
        agentTranscript.push({ role: "assistant", text: message.text });
        continue;
      }
      if (message.kind === "handoff") {
        if (!aiAllowed) {
          continue;
        }
        const topicEntry = ctx.knowledge.handoff.get(knowledgeKey(message.topicGroup, message.topic));
        const metadata: Record<string, unknown> = {
          thread_event: "handoff_to_human",
          handoff_tool_reason: message.reason,
        };
        if (topicEntry) {
          metadata.handoff_topic_entry_id = topicEntry.id;
          metadata.ai_sources = [
            { kind: "handoff", label: message.topic, groupLabel: message.topicGroup, id: topicEntry.id, groupId: topicEntry.groupId },
          ];
          metadata.ai_reasoning = `Handed off — ${message.reason}`;
        }
        if (isDryRunLine) {
          metadata.dry_run = true;
        }
        await pushMessage("assistant", "Human handoff", metadata, null);
        continue;
      }
    }

    // Two internal AI errors (operator-only events; the chat flips to human
    // handling, matching runtime behaviour) so Agent Logs and error UI show up.
    let errorHandoff = false;
    if (agentErrorsAdded < 2 && aiAllowed && !handledByHuman && !isDryRunLine) {
      await pushMessage("assistant", "AI error", { thread_event: "agent_error" }, null);
      agentErrorsAdded += 1;
      errorHandoff = true;
      await updateConversationHandlingMode(workspaceId, conversationId, "human");
    }

    // Two to five failed outbound sends (hidden from threads, counted in Reports).
    if (failedSendIndexes.has(index)) {
      await pushMessage(
        "assistant",
        "Your order is on its way! (J&T Express)",
        { source: "send_failure", send_error: "WhatsApp session unavailable (demo)" },
        "ai_agent",
        { status: "failed" },
      );
    }

    if (handledByHuman && !isDryRunLine) {
      const switched = await updateConversationHandlingMode(workspaceId, conversationId, "human");
      if (!switched.ok) {
        throw new Error(`[DemoSeed] handling mode update failed (conversation ${conversationId})`);
      }
      if (!scenario.handoff) {
        await pushMessage(
          "assistant",
          "Human handling",
          { thread_event: "manual_toggle_human", manual_toggle_reason: "Picked up from the inbox." },
          null,
        );
      }
      const replyTexts =
        scenario.humanReplies && scenario.humanReplies.length > 0
          ? scenario.humanReplies
          : Array.from(
              { length: intBetween(rng, 1, 2) },
              () => pickOne(rng, HUMAN_REPLIES) as string,
            );
      for (const text of replyTexts) {
        await pushMessage("assistant", text, {}, "human");
      }
    }

    const labelNames = scenario.labels.filter((name) => ctx.labelIds[name]);
    if (labelNames.length > 0) {
      await replaceAssignmentsForConversation({
        workspaceId,
        conversationId,
        labelIds: labelNames.map((name) => ctx.labelIds[name] as string),
        source: handledByHuman ? "user" : "ai",
      });
    }
    if (labelNames.includes("Complaint") || labelNames.includes("Refund")) {
      reportCandidates.push(conversationId);
    }

    // Agent logs for the first few real (non-draft) AI conversations.
    if (agentLogBudget > 0 && agentTranscript.length >= 4 && !isDryRunLine && aiAllowed) {
      agentLogBudget -= 1;
      await createAgentSession({
        workspaceId,
        sessionId: conversationId,
        metadata: { source: "demo-seed", conversationId },
      });
      await insertAgentMessages(
        agentTranscript.map((turn) => ({
          workspaceId,
          sessionId: conversationId,
          role: turn.role,
          content: asStorableAgentMessageContent(turn.role, turn.text),
        })),
      );
    }

    summary.conversations.push({
      id: conversationId,
      contactId: contact.id,
      scenarioKey: scenario.key,
      handledBy: handledByHuman || errorHandoff ? "human" : "ai",
      labels: labelNames,
    });
  }

  // --- Reported conversations ----------------------------------------------
  const reportReasons = [
    "Quoted the wrong price for the celebration box",
    "Promised a delivery date J&T could not meet",
    "Handed off too late on a complaint",
    "Refund amount was wrong",
    "Missed the nut-allergy check in the reply",
    "Tone was too casual for a complaint",
    "Sent the wrong FPX payment link",
    "Quoted West Malaysia timing for a Sabah delivery",
    "Did not mention the SST invoice option to a corporate buyer",
    "Confirmed a workshop slot that was already taken",
    "Used last year's price for the praline upgrade",
    "Forgot the gift-wrap add-on the customer asked for",
  ];
  const reportTargets = shuffle(rng, reportCandidates).slice(0, DEMO_COUNTS.reports);
  for (let i = 0; i < reportTargets.length; i += 1) {
    const report = await createConversationReport({
      workspaceId,
      conversationId: reportTargets[i] as string,
      reportedByUserId: ctx.demoUserId,
      reason: reportReasons[i % reportReasons.length] as string,
    });
    if (!report.ok) {
      throw new Error(`[DemoSeed] createConversationReport failed: ${report.message}`);
    }
  }

  return summary;
}
