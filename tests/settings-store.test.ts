import { describe, expect, it } from "vitest";

import {
  isSupportedGitHubRemoteUrl,
  normalizeSettings,
  validateSettingsForPersistence,
  validateSettingsForSync,
} from "../src/settings-store";
import { DEFAULT_SETTINGS } from "../src/types";

describe("settings validation", () => {
  it("normalizes trimmed string fields", () => {
    const normalized = normalizeSettings({
      ...DEFAULT_SETTINGS,
      githubUsername: " octocat ",
      remoteUrl: " https://github.com/octocat/repo.git ",
      branch: " main ",
    });

    expect(normalized.githubUsername).toBe("octocat");
    expect(normalized.remoteUrl).toBe("https://github.com/octocat/repo.git");
    expect(normalized.branch).toBe("main");
  });

  it("accepts a valid GitHub HTTPS remote", () => {
    expect(isSupportedGitHubRemoteUrl("https://github.com/octocat/repo.git")).toBe(true);
  });

  it("rejects embedded credentials in the remote", () => {
    expect(isSupportedGitHubRemoteUrl("https://octocat:secret@github.com/octocat/repo.git")).toBe(false);
  });

  it("rejects malformed persistence settings", () => {
    const errors = validateSettingsForPersistence({
      ...DEFAULT_SETTINGS,
      syncIntervalMinutes: 0,
      notifyOnPush: "yes" as unknown as boolean,
      commitMessageTemplate: "{{bad}}",
      remoteUrl: "git@github.com:octocat/repo.git",
    });

    expect(errors).toContain("Sync interval must be an integer greater than or equal to 1 minute.");
    expect(errors).toContain("Push notifications must be a boolean value.");
    expect(errors).toContain('Unsupported commit message placeholder "{{bad}}". Supported placeholders are {{datetime}}, {{gitUser}}, {{userName}}, {{fileName}}, {{filename}}.');
    expect(errors).toContain("Remote URL must be a GitHub HTTPS repository URL, for example https://github.com/owner/repo.git.");
  });

  it("requires all sync settings to be present", () => {
    const errors = validateSettingsForSync(DEFAULT_SETTINGS);

    expect(errors).toContain("GitHub username is required for sync.");
    expect(errors).toContain("GitHub token is required for sync.");
    expect(errors).toContain("Remote URL is required for sync.");
    expect(errors).toContain("Branch is required for sync.");
  });
});
