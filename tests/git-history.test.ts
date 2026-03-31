import { describe, expect, it } from "vitest";

import { buildGitHistoryArgs, parseGitHistory } from "../src/git-history";

describe("git history helpers", () => {
  it("builds a git log command with the configured limit", () => {
    expect(buildGitHistoryArgs(15)).toEqual([
      "log",
      "--max-count=15",
      "--date=iso-strict",
      "--pretty=format:%H\u001f%h\u001f%an\u001f%ae\u001f%aI\u001f%s\u001f%b\u001e",
    ]);
  });

  it("parses git log output into typed entries", () => {
    const raw = [
      "1234567890abcdef\u001f1234567\u001fJane Doe\u001fjane@example.com\u001f2026-03-31T18:00:00+02:00\u001fAdd history panel\u001fBody line 1\nBody line 2\u001e",
      "abcdef1234567890\u001fabcdef1\u001fJohn Doe\u001fjohn@example.com\u001f2026-03-30T10:00:00+02:00\u001fInitial commit\u001f\u001e",
    ].join("");

    expect(parseGitHistory(raw)).toEqual([
      {
        hash: "1234567890abcdef",
        shortHash: "1234567",
        authorName: "Jane Doe",
        authorEmail: "jane@example.com",
        authoredAt: "2026-03-31T18:00:00+02:00",
        subject: "Add history panel",
        body: "Body line 1\nBody line 2",
      },
      {
        hash: "abcdef1234567890",
        shortHash: "abcdef1",
        authorName: "John Doe",
        authorEmail: "john@example.com",
        authoredAt: "2026-03-30T10:00:00+02:00",
        subject: "Initial commit",
        body: "",
      },
    ]);
  });
});
