import { describe, expect, it, vi } from "vitest";

import { ConflictResolutionError } from "../src/conflict-resolver";
import { GitCommandError } from "../src/git-command-runner";
import { GitSyncService } from "../src/git-sync-service";
import { DEFAULT_SETTINGS, type GitRunOptions, type RepositoryInspection } from "../src/types";

class FakeRunner {
  history: Array<{ args: string[]; options?: GitRunOptions }> = [];
  inspection: RepositoryInspection = {
    rootPath: "/vault",
    currentBranch: "main",
    detectedRemoteUrl: "https://github.com/octocat/repo.git",
  };

  constructor(
    private readonly handler: (
      args: string[],
      options?: GitRunOptions,
    ) => Promise<{ stdout?: string; stderr?: string }> | { stdout?: string; stderr?: string },
  ) {}

  inspectRepository(): Promise<RepositoryInspection> {
    return Promise.resolve(this.inspection);
  }

  async run(args: string[], options?: GitRunOptions): Promise<{ stdout: string; stderr: string }> {
    this.history.push({ args, options });
    const result = await this.handler(args, options);
    return {
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
    };
  }
}

describe("git sync service", () => {
  it("commits local changes before fetch, merge, and push", async () => {
    const runner = new FakeRunner((args) => {
      if (args[0] === "status") {
        return { stdout: " M note.md\n" };
      }
      return {};
    });

    const service = new GitSyncService({
      runner,
      conflictResolver: {
        resolveFile: vi.fn(() => Promise.resolve()),
      },
      getSettings: () => ({
        ...DEFAULT_SETTINGS,
        githubUsername: "octocat",
        githubToken: "token",
        remoteUrl: "https://github.com/octocat/repo.git",
        branch: "main",
      }),
      now: () => new Date(2026, 2, 31, 12, 34, 56),
    });

    const result = await service.sync();

    expect(result.commitCreated).toBe(true);
    expect(result.mergeResolved).toBe(false);
    expect(runner.history.map((entry) => entry.args[0])).toEqual([
      "status",
      "add",
      "commit",
      "fetch",
      "merge",
      "push",
    ]);
    expect(runner.history[2]?.args[2]).toMatch(/^2026-03-31T12:34:56[+-]\d{2}:\d{2}-octocat$/);
  });

  it("resolves Markdown conflicts and completes the merge commit", async () => {
    const resolver = {
      resolveFile: vi.fn(() => Promise.resolve()),
    };
    const runner = new FakeRunner((args) => {
      if (args[0] === "status") {
        return { stdout: "" };
      }
      if (args[0] === "merge" && args[1] === "--no-edit") {
        throw new Error("conflict");
      }
      if (args[0] === "diff") {
        return { stdout: "note.md\n" };
      }
      return {};
    });

    const service = new GitSyncService({
      runner,
      conflictResolver: resolver,
      getSettings: () => ({
        ...DEFAULT_SETTINGS,
        githubUsername: "octocat",
        githubToken: "token",
        remoteUrl: "https://github.com/octocat/repo.git",
        branch: "main",
      }),
    });

    const result = await service.sync();

    expect(result.mergeResolved).toBe(true);
    expect(resolver.resolveFile).toHaveBeenCalledWith("note.md", expect.any(Date));
    expect(runner.history.map((entry) => entry.args.join(" "))).toContain("commit --no-edit");
  });

  it("fails when auto-commit is disabled and the repo is dirty", async () => {
    const runner = new FakeRunner((args) => {
      if (args[0] === "status") {
        return { stdout: " M note.md\n" };
      }
      return {};
    });

    const service = new GitSyncService({
      runner,
      conflictResolver: {
        resolveFile: vi.fn(() => Promise.resolve()),
      },
      getSettings: () => ({
        ...DEFAULT_SETTINGS,
        autoCommit: false,
        githubUsername: "octocat",
        githubToken: "token",
        remoteUrl: "https://github.com/octocat/repo.git",
        branch: "main",
      }),
    });

    await expect(service.sync()).rejects.toThrow("auto-commit is disabled");
  });

  it("aborts when a conflict cannot be preserved automatically", async () => {
    const resolver = {
      resolveFile: vi.fn(() => Promise.reject(new ConflictResolutionError("Unsupported file: canvas.canvas"))),
    };
    const runner = new FakeRunner((args) => {
      if (args[0] === "status") {
        return { stdout: "" };
      }
      if (args[0] === "merge" && args[1] === "--no-edit") {
        throw new Error("conflict");
      }
      if (args[0] === "diff") {
        return { stdout: "canvas.canvas\n" };
      }
      return {};
    });

    const service = new GitSyncService({
      runner,
      conflictResolver: resolver,
      getSettings: () => ({
        ...DEFAULT_SETTINGS,
        githubUsername: "octocat",
        githubToken: "token",
        remoteUrl: "https://github.com/octocat/repo.git",
        branch: "main",
      }),
    });

    await expect(service.sync()).rejects.toThrow("Unsupported file: canvas.canvas");
    expect(runner.history.map((entry) => entry.args.join(" "))).toContain("merge --abort");
  });

  it("surfaces authentication failures with an actionable message", async () => {
    const runner = new FakeRunner((args) => {
      if (args[0] === "status") {
        return { stdout: "" };
      }
      if (args[0] === "fetch") {
        throw new GitCommandError(args, "", "remote: Authentication failed", 128, "remote: Authentication failed");
      }
      return {};
    });

    const service = new GitSyncService({
      runner,
      conflictResolver: {
        resolveFile: vi.fn(() => Promise.resolve()),
      },
      getSettings: () => ({
        ...DEFAULT_SETTINGS,
        githubUsername: "octocat",
        githubToken: "token",
        remoteUrl: "https://github.com/octocat/repo.git",
        branch: "main",
      }),
    });

    await expect(service.sync()).rejects.toThrow("GitHub authentication failed");
  });
});
