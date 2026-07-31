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
  conversationsHandled: number;
  aiReplies: number;
  handoffs: number;
  inHumanMode: number;
};

export type HandoffTopicPerformanceRow = {
  id: string;
  topicName: string;
  groupName: string;
  handoffs: number;
};
