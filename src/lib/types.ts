export interface ProjectStats {
  id: string;
  displayName: string;
  messageCount: number;
  inputTokens: number;
  outputTokens: number;
  firstDate: string;
  lastDate: string;
  activeDays: number;
}

export interface PromptEntry {
  id: string;
  projectId: string;
  projectName: string;
  timestamp: string;
  content: string;
  inputTokens: number;
  outputTokens: number;
}
