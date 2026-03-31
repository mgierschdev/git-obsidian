import type { Plugin } from "obsidian";

import { validateCommitMessageTemplate } from "./template";
import { DEFAULT_SETTINGS, type GitObsidianSettings } from "./types";

const GITHUB_HTTPS_REPOSITORY_PATTERN =
  /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+(?:\.git)?$/i;
const GITHUB_USERNAME_PATTERN =
  /^[A-Za-z\d](?:[A-Za-z\d-]{0,37}[A-Za-z\d])?$/;

export class SettingsValidationError extends Error {
  readonly details: string[];

  constructor(details: string[]) {
    super(details.join(" "));
    this.name = "SettingsValidationError";
    this.details = details;
  }
}

export class SettingsStore {
  constructor(private readonly plugin: Plugin) {}

  async load(): Promise<GitObsidianSettings> {
    const loaded = await this.plugin.loadData() as Partial<GitObsidianSettings> | null;
    return normalizeSettings({
      ...DEFAULT_SETTINGS,
      ...loaded,
    });
  }

  async save(settings: GitObsidianSettings): Promise<GitObsidianSettings> {
    const normalized = normalizeSettings(settings);
    const errors = validateSettingsForPersistence(normalized);

    if (errors.length > 0) {
      throw new SettingsValidationError(errors);
    }

    await this.plugin.saveData(normalized);
    return normalized;
  }
}

export function normalizeSettings(
  settings: GitObsidianSettings,
): GitObsidianSettings {
  return {
    ...settings,
    syncIntervalMinutes: Number(settings.syncIntervalMinutes),
    commitMessageTemplate: settings.commitMessageTemplate.trim(),
    githubUsername: settings.githubUsername.trim(),
    githubToken: settings.githubToken.trim(),
    remoteUrl: settings.remoteUrl.trim(),
    branch: settings.branch.trim(),
  };
}

export function validateSettingsForPersistence(
  settings: GitObsidianSettings,
): string[] {
  const errors: string[] = [];

  if (!Number.isInteger(settings.syncIntervalMinutes) || settings.syncIntervalMinutes < 1) {
    errors.push("Sync interval must be an integer greater than or equal to 1 minute.");
  }

  if (typeof settings.autoCommit !== "boolean") {
    errors.push("Auto-commit must be a boolean value.");
  }

  if (typeof settings.autoMerge !== "boolean") {
    errors.push("Auto-merge must be a boolean value.");
  }

  if (typeof settings.notifyOnError !== "boolean") {
    errors.push("Error notifications must be a boolean value.");
  }

  if (typeof settings.notifyOnCommit !== "boolean") {
    errors.push("Commit notifications must be a boolean value.");
  }

  if (typeof settings.notifyOnMerge !== "boolean") {
    errors.push("Merge notifications must be a boolean value.");
  }

  if (typeof settings.notifyOnPush !== "boolean") {
    errors.push("Push notifications must be a boolean value.");
  }

  errors.push(...validateCommitMessageTemplate(settings.commitMessageTemplate));

  if (settings.githubUsername && !GITHUB_USERNAME_PATTERN.test(settings.githubUsername)) {
    errors.push("GitHub username is invalid.");
  }

  if (settings.remoteUrl && !isSupportedGitHubRemoteUrl(settings.remoteUrl)) {
    errors.push("Remote URL must be a GitHub HTTPS repository URL, for example https://github.com/owner/repo.git.");
  }

  if (settings.branch && !settings.branch.trim()) {
    errors.push("Branch cannot be blank.");
  }

  return errors;
}

export function validateSettingsForSync(
  settings: GitObsidianSettings,
): string[] {
  const errors = validateSettingsForPersistence(settings);

  if (!settings.githubUsername) {
    errors.push("GitHub username is required for sync.");
  }

  if (!settings.githubToken) {
    errors.push("GitHub token is required for sync.");
  }

  if (!settings.remoteUrl) {
    errors.push("Remote URL is required for sync.");
  }

  if (!settings.branch) {
    errors.push("Branch is required for sync.");
  }

  return errors;
}

export function isSupportedGitHubRemoteUrl(remoteUrl: string): boolean {
  if (!GITHUB_HTTPS_REPOSITORY_PATTERN.test(remoteUrl)) {
    return false;
  }

  try {
    const parsed = new URL(remoteUrl);
    return !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}
