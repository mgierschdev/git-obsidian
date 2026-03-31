import { describe, expect, it } from "vitest";

import { parseCommitFileChanges } from "../src/git-history";

describe("git commit file parsing", () => {
  it("parses git show --name-status output", () => {
    expect(parseCommitFileChanges("M\tNotes/file.md\nA\tNew.md\nR100\tOld.md\tNew.md\n")).toEqual([
      { status: "M", path: "Notes/file.md" },
      { status: "A", path: "New.md" },
      { status: "R100", path: "Old.md\tNew.md" },
    ]);
  });

  it("decodes quoted unicode file names from git output", () => {
    expect(parseCommitFileChanges('M\t"\\360\\237\\217\\236\\357\\270\\217 Life Admin.md"\n')).toEqual([
      { status: "M", path: "🏞️ Life Admin.md" },
    ]);
  });
});
