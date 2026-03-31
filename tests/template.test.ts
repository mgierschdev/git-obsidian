import { describe, expect, it } from "vitest";

import {
  formatLocalDateTime,
  renderCommitMessage,
  validateCommitMessageTemplate,
} from "../src/template";

describe("template helpers", () => {
  it("formats a local ISO-like timestamp", () => {
    const formatted = formatLocalDateTime(new Date(2026, 2, 31, 12, 34, 56));

    expect(formatted).toMatch(/^2026-03-31T12:34:56[+-]\d{2}:\d{2}$/);
  });

  it("renders the commit message placeholders", () => {
    const rendered = renderCommitMessage(
      "{{filename}}-{{datetime}}-{{userName}}",
      {
        datetime: formatLocalDateTime(new Date(2026, 2, 31, 12, 34, 56)),
        gitUser: "octocat",
        userName: "octocat",
        fileName: "Life Admin",
      },
      new Date(2026, 2, 31, 12, 34, 56),
    );

    expect(rendered).toBe("Life Admin-2026-03-31T12:34:56+02:00-octocat");
  });

  it("rejects unsupported placeholders", () => {
    expect(validateCommitMessageTemplate("{{datetime}}-{{unknown}}")).toEqual([
      'Unsupported commit message placeholder "{{unknown}}". Supported placeholders are {{datetime}}, {{gitUser}}, {{userName}}, {{fileName}}, {{filename}}.',
    ]);
  });
});
