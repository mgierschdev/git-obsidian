export interface GitObsidianSettings {
  syncIntervalMinutes: number;
  autoCommit: boolean;
  autoMerge: boolean;
  notifyOnError: boolean;
  notifyOnCommit: boolean;
  notifyOnMerge: boolean;
  notifyOnPush: boolean;
  commitMessageTemplate: string;
  githubUsername: string;
  githubToken: string;
  remoteUrl: string;
  branch: string;
}

export const DEFAULT_SETTINGS: GitObsidianSettings = {
  syncIntervalMinutes: 2,
  autoCommit: true,
  autoMerge: true,
  notifyOnError: true,
  notifyOnCommit: true,
  notifyOnMerge: true,
  notifyOnPush: true,
  commitMessageTemplate: "{{datetime}}-{{gitUser}}",
  githubUsername: "",
  githubToken: "",
  remoteUrl: "",
  branch: "",
};

export type SyncStatus = "idle" | "syncing" | "success" | "error" | "paused";

export interface GitHubAuth {
  username: string;
  token: string;
}

export interface GitCommandResult {
  stdout: string;
  stderr: string;
}

export interface GitRunOptions {
  auth?: GitHubAuth;
}

export interface RepositoryInspection {
  rootPath: string;
  currentBranch: string | null;
  detectedRemoteUrl: string | null;
}

export interface SyncResult {
  message: string;
  commitCreated: boolean;
  mergeResolved: boolean;
  pushed: boolean;
}

export interface GitHistoryEntry {
  hash: string;
  shortHash: string;
  authorName: string;
  authorEmail: string;
  authoredAt: string;
  subject: string;
  body: string;
}

export interface ConflictResolverLike {
  resolveFile(relativeFilePath: string, timestamp: Date): Promise<void>;
}

export interface GitCommandRunnerLike {
  inspectRepository(): Promise<RepositoryInspection>;
  run(args: string[], options?: GitRunOptions): Promise<GitCommandResult>;
}

export interface PluginLogger {
  (message: string, level?: "info" | "error"): void;
}

export type SyncEventType = "commit" | "merge" | "push";

export interface SyncEvent {
  type: SyncEventType;
  message: string;
}

export interface SyncEventReporter {
  (event: SyncEvent): void;
}
