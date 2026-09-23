export type ReportsDateRange = {
  from: string;
  to: string;
};

export type AgentPerformanceRow = {
  id: string;
  name: string;
  conversationsHandled: number;
  aiReplies: number;
  handoffs: number;
  inHumanMode: number;
};

export type AgentPerformanceSummary = {
  totalConversations: number;
  conversationsHandled: number;
  totalMessages: number;
  aiReplies: number;
  handoffs: number;
  inHumanMode: number;
  technicalErrors: number;
  reportedErrors: number;
};

export type HandoffTopicPerformanceRow = {
  id: string;
  topicName: string;
  groupName: string;
  /** Present for real topics; null for the unmatched bucket. */
  groupId: string | null;
  handoffs: number;
};

/** Synthetic topic id for handoffs without a valid topicEntryId. */
export const REPORTS_OTHER_TOPIC_ID = "other";

/** Display label for handoffs that did not match a configured topic. */
export const REPORTS_NO_TOPIC_LABEL = "No topic";

/** One "reported as wrong" entry shown in the Reports → Reported conversations tab. */
export type ConversationReportRow = {
  id: string;
  conversationId: string;
  conversationName: string;
  contactName: string | null;
  reason: string;
  reportedByName: string;
  agentId: string | null;
  agentName: string | null;
  createdAt: string;
};

/** Report history entry shown inside the conversation report dialog. */
export type ConversationReportEntry = {
  id: string;
  reason: string;
  reportedByName: string;
  createdAt: string;
};
