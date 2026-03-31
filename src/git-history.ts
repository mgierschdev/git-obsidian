import type { GitHistoryEntry } from "./types";

const FIELD_SEPARATOR = "\u001f";
const RECORD_SEPARATOR = "\u001e";

export function buildGitHistoryArgs(limit = 30): string[] {
  return [
    "log",
    `--max-count=${limit}`,
    "--date=iso-strict",
    `--pretty=format:%H${FIELD_SEPARATOR}%h${FIELD_SEPARATOR}%an${FIELD_SEPARATOR}%ae${FIELD_SEPARATOR}%aI${FIELD_SEPARATOR}%s${FIELD_SEPARATOR}%b${RECORD_SEPARATOR}`,
  ];
}

export function parseGitHistory(raw: string): GitHistoryEntry[] {
  return raw
    .split(RECORD_SEPARATOR)
    .map((record) => record.trim())
    .filter(Boolean)
    .map((record) => {
      const [
        hash = "",
        shortHash = "",
        authorName = "",
        authorEmail = "",
        authoredAt = "",
        subject = "",
        body = "",
      ] = record.split(FIELD_SEPARATOR);

      return {
        hash,
        shortHash,
        authorName,
        authorEmail,
        authoredAt,
        subject,
        body: body.trim(),
      };
    })
    .filter((entry) => entry.hash && entry.subject);
}
