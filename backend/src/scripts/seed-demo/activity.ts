/**
 * Demo seed — leads, scheduled tasks, evals, secrets, API keys,
 * handoff phone registration, and error-alert subscriptions.
 */

import { randomUUID } from "node:crypto";

import { DEMO_COUNTS, DEMO_EVALS, DEMO_WORKSPACE_TIMEZONE } from "./dataset.js";
import type { DemoSeedContext } from "./knowledge.js";
import { knowledgeKey } from "./knowledge.js";
import type { DemoChatSummary } from "./chatter.js";

export type DemoActivitySummary = {
  leads: number;
  tasks: number;
  evalCases: number;
  evalRuns: number;
  secrets: number;
  apiKeys: number;
};

export async function seedActivity(params: {
  ctx: DemoSeedContext;
  chats: DemoChatSummary;
  nowMs: number;
}): Promise<DemoActivitySummary> {
  const { ctx, chats, nowMs } = params;
  const { workspaceId } = ctx;
  const warnings = ctx.warnings;

  const { findOrCreateLeadForContact, updateLeadStatus } = await import("../../repositories/leads.js");
  const { createTask, recordTaskRun, cancelTaskById } = await import("../../repositories/tasks.js");
  const { createEvalCaseFromDraft, createEvalRun } = await import("../../repositories/evals.js");
  const { createEvalSchedule } = await import("../../repositories/eval-schedules.js");
  const { createWorkspaceSecret } = await import("../../repositories/workspace-secrets.js");
  const { createApiKey } = await import("../../repositories/api-keys.js");
  const { upsertHandoffPhonePending, markHandoffPhoneVerified } = await import(
    "../../repositories/handoff-phones.js"
  );
  const { setErrorAlertSubscriber } = await import("../../repositories/error-alert-subscribers.js");

  // --- Leads ----------------------------------------------------------------
  const leadStatuses = ["new", "contacted", "qualified", "won", "lost"] as const;
  let leads = 0;
  for (let i = 0; i < DEMO_COUNTS.leads; i += 1) {
    const contact = chats.contacts[(i * 3 + 1) % chats.contacts.length];
    if (!contact) continue;
    const lead = await findOrCreateLeadForContact(workspaceId, contact.id);
    if (!lead) {
      warnings.push(`Skipped lead for ${contact.firstName} ${contact.lastName}`);
      continue;
    }
    await updateLeadStatus(workspaceId, lead.id, leadStatuses[i % leadStatuses.length] as (typeof leadStatuses)[number]);
    leads += 1;
  }

  // --- Scheduled tasks ------------------------------------------------------
  const dayMs = 24 * 60 * 60 * 1000;
  const futureIso = (days: number) => new Date(nowMs + days * dayMs).toISOString();
  const corporateContact = chats.contacts[4];
  const weddingContact = chats.contacts[17];
  const taskSpecs: {
    agent: "sales" | "support" | "wholesale";
    connection: "main" | "sales" | "support" | "wholesale";
    prompt: string;
    scheduleType: "recurring" | "one_time";
    cronExpression?: string;
    oneTimeAt?: string;
    cancel?: boolean;
    leadId?: string;
  }[] = [
    {
      agent: "sales",
      connection: "main",
      prompt: "Send the Monday restock update to the VIP list on WhatsApp.",
      scheduleType: "recurring",
      cronExpression: "0 9 * * 1",
    },
    {
      agent: "sales",
      connection: "main",
      prompt: "Follow up with the corporate lead about the December 300-box quote.",
      scheduleType: "one_time",
      oneTimeAt: futureIso(2),
      leadId: corporateContact?.id,
    },
    {
      agent: "support",
      connection: "support",
      prompt: "Check yesterday's undelivered J&T parcels and update affected customers.",
      scheduleType: "recurring",
      cronExpression: "30 8 * * *",
    },
    {
      agent: "sales",
      connection: "sales",
      prompt: "Send the 11.11 anniversary offer to repeat customers from the last two years.",
      scheduleType: "one_time",
      oneTimeAt: futureIso(5),
    },
    {
      agent: "sales",
      connection: "main",
      prompt: "Send the monthly stock summary to wholesale partners.",
      scheduleType: "recurring",
      cronExpression: "0 10 1 * *",
    },
    {
      agent: "support",
      connection: "support",
      prompt: "Reminder: quiet-hour promo blast.",
      scheduleType: "one_time",
      oneTimeAt: futureIso(9),
      cancel: true,
    },
    {
      agent: "support",
      connection: "support",
      prompt: "Collect reviews from last week's delivered orders.",
      scheduleType: "one_time",
      oneTimeAt: futureIso(1),
    },
    {
      agent: "sales",
      connection: "main",
      prompt: "Follow up on unpaid B2B invoices with 30-day terms.",
      scheduleType: "recurring",
      cronExpression: "0 11 * * 5",
    },
    {
      agent: "sales",
      connection: "sales",
      prompt: "Hari Raya pre-orders announcement draft.",
      scheduleType: "one_time",
      oneTimeAt: futureIso(20),
      cancel: true,
    },
    {
      agent: "wholesale",
      connection: "wholesale",
      prompt: "Send approved accounts the weekly wholesale availability sheet.",
      scheduleType: "recurring",
      cronExpression: "30 9 * * 1",
    },
    {
      agent: "wholesale",
      connection: "wholesale",
      prompt: "Prepare onboarding email for the new cafe account in Penang.",
      scheduleType: "one_time",
      oneTimeAt: futureIso(3),
    },
    {
      agent: "sales",
      connection: "main",
      prompt: "Message the wedding planner about 120 door gifts.",
      scheduleType: "one_time",
      oneTimeAt: futureIso(12),
      leadId: weddingContact?.id,
    },
    {
      agent: "support",
      connection: "support",
      prompt: "Send a daily summary of handoffs to the support team.",
      scheduleType: "recurring",
      cronExpression: "0 18 * * *",
    },
    {
      agent: "wholesale",
      connection: "wholesale",
      prompt: "Check in with the Cyberjaya corporate account on their first order.",
      scheduleType: "one_time",
      oneTimeAt: futureIso(7),
    },
  ];

  const taskIds: string[] = [];
  for (const spec of taskSpecs) {
    const created = await createTask({
      id: randomUUID(),
      workspaceId,
      agentConfigId: ctx.agentIds[spec.agent],
      whatsappConnectionId: ctx.connectionIds[spec.connection],
      leadId: spec.leadId ?? null,
      prompt: spec.prompt,
      scheduleType: spec.scheduleType,
      cronExpression: spec.cronExpression ?? null,
      oneTimeAt: spec.oneTimeAt ?? null,
      timezone: DEMO_WORKSPACE_TIMEZONE,
      jobPayload: { demo: true },
      source: "user",
    });
    if (!created.ok || !created.id) {
      warnings.push(`Skipped task "${spec.prompt}": ${created.message}`);
      continue;
    }
    taskIds.push(created.id);
    if (spec.cancel) {
      await cancelTaskById(workspaceId, created.id);
    }
  }

  // A little run history for the recurring tasks.
  const runPlan: { taskIndex: number; status: "success" | "fail"; error?: string }[] = [
    { taskIndex: 0, status: "success" },
    { taskIndex: 0, status: "success" },
    { taskIndex: 2, status: "success" },
    { taskIndex: 2, status: "fail", error: "WhatsApp send failed for 2 of 24 recipients (demo)" },
    { taskIndex: 4, status: "success" },
    { taskIndex: 4, status: "success" },
    { taskIndex: 7, status: "success" },
    { taskIndex: 9, status: "success" },
    { taskIndex: 9, status: "success" },
    { taskIndex: 12, status: "success" },
    { taskIndex: 12, status: "fail", error: "Support line session unavailable (demo)" },
  ];
  for (const run of runPlan) {
    const taskId = taskIds[run.taskIndex];
    if (!taskId) continue;
    await recordTaskRun({
      workspaceId,
      taskId,
      status: run.status,
      errorMessage: run.error ?? null,
    });
  }

  // --- Evals ----------------------------------------------------------------
  let evalCases = 0;
  let evalRuns = 0;

  for (const spec of DEMO_EVALS) {
    const topicEntry = spec.expectedTopic
      ? ctx.knowledge.handoff.get(knowledgeKey(spec.expectedTopic.group, spec.expectedTopic.topic))
      : undefined;
    const linkedConversation = spec.scenarioKey
      ? chats.conversations.find((conversation) => conversation.scenarioKey === spec.scenarioKey)
      : undefined;

    const created = await createEvalCaseFromDraft({
      workspaceId,
      agentConfigId: ctx.agentIds[spec.agent],
      title: spec.title,
      source: spec.source,
      status: spec.status ?? "ready",
      turns: spec.turns.map((turn) => ({
        role: turn.role,
        content: turn.content,
        whyReply: turn.whyReply ?? null,
        sources: (turn.sources ?? []).map((source) => ({ kind: source.kind, label: source.label })),
      })),
      expectedReply: spec.expectedReply,
      expectedAction: spec.expectedAction ?? "reply",
      expectedTopicEntryId: topicEntry?.id ?? null,
      answerAnalysis: null,
      answerCorrect: null,
      sourceConversationId: linkedConversation?.id ?? null,
    });
    if (!created.ok) {
      warnings.push(`Skipped eval case "${spec.title}"`);
      continue;
    }
    evalCases += 1;

    for (const run of spec.runs) {
      const createdRun = await createEvalRun({
        workspaceId,
        evalCaseId: created.id,
        status: run.status,
        actualReply: run.actualReply,
        answerAnalysis: run.analysis,
        reasoningForOperators: run.reasoning ?? null,
        handoffCalled: run.handoffCalled ?? false,
        handoffTopicEntryId: run.handoffCalled ? (topicEntry?.id ?? null) : null,
        errorMessage: run.errorMessage ?? null,
        subjectSessionId: null,
      });
      if (createdRun.ok) evalRuns += 1;
    }

    if (spec.schedule) {
      const scheduled = await createEvalSchedule({
        workspaceId,
        evalCaseId: created.id,
        repeat: spec.schedule.repeat,
        weekdays: spec.schedule.weekdays,
        monthDay: spec.schedule.monthDay,
        hour: spec.schedule.hour,
        minute: spec.schedule.minute,
        timezone: DEMO_WORKSPACE_TIMEZONE,
        notifyUserId: ctx.demoUserId,
      });
      if (!scheduled.ok) {
        warnings.push(`Skipped eval schedule for "${spec.title}"`);
      }
    }
  }

  // --- Secrets --------------------------------------------------------------
  const secretSpecs = [
    { name: "CRM_API_KEY", description: "Demo CRM key used by custom tools.", value: `demo-${randomUUID()}` },
    { name: "SHOPIFY_ADMIN_TOKEN", description: "Demo store token for order lookups.", value: `demo-${randomUUID()}` },
    { name: "COURIER_API_KEY", description: "Demo courier API key for tracking checks.", value: `demo-${randomUUID()}` },
  ];
  let secrets = 0;
  for (const spec of secretSpecs) {
    const created = await createWorkspaceSecret({
      workspaceId,
      name: spec.name,
      description: spec.description,
      value: spec.value,
    });
    if (created.ok) {
      secrets += 1;
    } else {
      warnings.push(`Skipped secret ${spec.name}: ${created.message}`);
    }
  }

  // --- API keys -------------------------------------------------------------
  const keySpecs = [
    { label: "Zapier integration", expiresAt: null as string | null },
    {
      label: "Reporting export (expired)",
      expiresAt: new Date(nowMs - 7 * dayMs).toISOString(),
    },
  ];
  let apiKeys = 0;
  for (const spec of keySpecs) {
    const created = await createApiKey({
      workspaceId,
      label: spec.label,
      keyHash: `demo-hash-${randomUUID()}`,
      keyPrefix: "snq_demo",
      createdByUserId: ctx.demoUserId,
      expiresAt: spec.expiresAt,
    });
    if (created.ok) {
      apiKeys += 1;
    } else {
      warnings.push(`Skipped API key ${spec.label}: ${created.message ?? "unknown error"}`);
    }
  }

  // --- Handoff phones + AI error alerts -------------------------------------
  const handoffPhone = "+60 12-345 0999";
  for (const connectionKey of ["main", "wholesale"] as const) {
    const pending = await upsertHandoffPhonePending(
      workspaceId,
      ctx.demoUserId,
      ctx.connectionIds[connectionKey],
      handoffPhone,
    );
    if (pending.ok) {
      await markHandoffPhoneVerified(
        workspaceId,
        ctx.demoUserId,
        ctx.connectionIds[connectionKey],
        handoffPhone,
      );
    } else {
      warnings.push(`Skipped handoff phone (${connectionKey}): ${pending.message}`);
    }
  }
  await setErrorAlertSubscriber(workspaceId, ctx.demoUserId, true);

  return { leads, tasks: taskIds.length, evalCases, evalRuns, secrets, apiKeys };
}
