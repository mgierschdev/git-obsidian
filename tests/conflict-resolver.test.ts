import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  ConflictResolutionError,
  ConflictResolver,
  rewriteConflictMarkers,
} from "../src/conflict-resolver";

const tempDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirectories.splice(0).map(async (directory) => {
      await fs.rm(directory, { recursive: true, force: true });
    }),
  );
});

describe("conflict resolver", () => {
  it("rewrites Git conflict markers into a preserve-both note block", () => {
    const rewritten = rewriteConflictMarkers(
      [
        "# Title",
        "<<<<<<< HEAD",
        "local line",
        "=======",
        "remote line",
        ">>>>>>> origin/main",
      ].join("\n"),
      "note.md",
      new Date(2026, 2, 31, 12, 34, 56),
    );

    expect(rewritten).toContain("Git Obsidian preserved both versions of a merge conflict.");
    expect(rewritten).toContain("```git-obsidian-local");
    expect(rewritten).toContain("local line");
    expect(rewritten).toContain("```git-obsidian-remote");
    expect(rewritten).toContain("remote line");
  });

  it("rejects unsupported file extensions", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "git-obsidian-conflict-"));
    tempDirectories.push(tempDir);
    await fs.writeFile(path.join(tempDir, "data.json"), "<<<<<<< HEAD\n1\n=======\n2\n>>>>>>> branch\n");

    const resolver = new ConflictResolver(tempDir);

    await expect(resolver.resolveFile("data.json", new Date())).rejects.toBeInstanceOf(ConflictResolutionError);
  });
});
