export type AgentPerformanceRow = {
  id: string;
  name: string;
  conversationsHandled: number;
  aiReplies: number;
  handoffs: number;
  inHumanMode: number;
};

export type AgentPerformanceSummary = {
  conversationsHandled: number;
  aiReplies: number;
  handoffs: number;
  inHumanMode: number;
};

export type HandoffTopicPerformanceRow = {
  id: string;
  topicName: string;
  groupName: string;
  /** Present for real topics; null for the unmatched bucket. */
  groupId: string | null;
  handoffs: number;
};

export type AgentPerformanceReport = {
  agents: AgentPerformanceRow[];
  topics: HandoffTopicPerformanceRow[];
  summary: AgentPerformanceSummary;
};

/** Synthetic topic id for handoffs without a valid topicEntryId. */
export const REPORTS_OTHER_TOPIC_ID = "other";

/** Display label for handoffs that did not match a configured topic. */
export const REPORTS_NO_TOPIC_LABEL = "No topic";
