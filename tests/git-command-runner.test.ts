import { execFileSync } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { GitCommandRunner } from "../src/git-command-runner";

const tempDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirectories.splice(0).map(async (directory) => {
      await fs.rm(directory, { recursive: true, force: true });
    }),
  );
});

describe("git command runner", () => {
  it("inspects the current repository branch and origin", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "git-obsidian-runner-"));
    tempDirectories.push(tempDir);

    execFileSync("git", ["init", "-b", "main"], { cwd: tempDir });
    execFileSync("git", ["remote", "add", "origin", "https://github.com/octocat/repo.git"], { cwd: tempDir });

    const runner = new GitCommandRunner(tempDir);
    const inspection = await runner.inspectRepository();

    expect(inspection.currentBranch).toBe("main");
    expect(inspection.detectedRemoteUrl).toBe("https://github.com/octocat/repo.git");
  });

  it("rejects non-repository directories", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "git-obsidian-runner-"));
    tempDirectories.push(tempDir);

    const runner = new GitCommandRunner(tempDir);
    await expect(runner.inspectRepository()).rejects.toThrow("not an existing Git repository");
  });
});
