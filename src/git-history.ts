import type { GitCommitFileChange, GitHistoryEntry } from "./types";

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

export function parseCommitFileChanges(raw: string): GitCommitFileChange[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [status = "", ...rest] = line.split("\t");
      const path = decodeGitPath(rest.join("\t").trim());

      return {
        status,
        path,
      };
    })
    .filter((entry) => entry.path);
}

function decodeGitPath(path: string): string {
  if (!path.startsWith("\"") || !path.endsWith("\"")) {
    return path;
  }

  const inner = path.slice(1, -1);
  const bytes: number[] = [];
  let decoded = "";

  for (let index = 0; index < inner.length; index += 1) {
    const current = inner[index];
    if (current !== "\\") {
      flushBytes(bytes, (text) => {
        decoded += text;
      });
      decoded += current;
      continue;
    }

    const next = inner[index + 1];
    if (next === undefined) {
      decoded += "\\";
      continue;
    }

    if (isOctalDigit(next)) {
      const octal = inner.slice(index + 1, index + 4);
      if (/^[0-7]{3}$/.test(octal)) {
        bytes.push(Number.parseInt(octal, 8));
        index += 3;
        continue;
      }
    }

    flushBytes(bytes, (text) => {
      decoded += text;
    });

    if (next === "\"" || next === "\\" ) {
      decoded += next;
      index += 1;
      continue;
    }

    decoded += next;
    index += 1;
  }

  flushBytes(bytes, (text) => {
    decoded += text;
  });

  return decoded;
}

function flushBytes(bytes: number[], append: (decoded: string) => void): void {
  if (bytes.length === 0) {
    return;
  }

  append(Buffer.from(bytes).toString("utf8"));
  bytes.length = 0;
}

function isOctalDigit(character: string): boolean {
  return character >= "0" && character <= "7";
}
