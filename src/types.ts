export interface GitObsidianSettings {
  syncIntervalMinutes: number;
  autoCommit: boolean;
  autoMerge: boolean;
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
