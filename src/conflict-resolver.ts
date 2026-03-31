import { promises as fs } from "node:fs";
import path from "node:path";

import { formatLocalDateTime } from "./template";

const MARKDOWN_SAFE_EXTENSIONS = new Set([".md", ".markdown", ".txt"]);

export class ConflictResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConflictResolutionError";
  }
}

export class ConflictResolver {
  constructor(private readonly repositoryRoot: string) {}

  async resolveFile(relativeFilePath: string, timestamp: Date): Promise<void> {
    const extension = path.extname(relativeFilePath).toLowerCase();
    if (!MARKDOWN_SAFE_EXTENSIONS.has(extension)) {
      throw new ConflictResolutionError(
        `Automatic conflict preservation only supports Markdown and text notes. Unsupported file: ${relativeFilePath}.`,
      );
    }

    const absolutePath = path.join(this.repositoryRoot, relativeFilePath);
    const raw = await fs.readFile(absolutePath);

    if (raw.includes(0)) {
      throw new ConflictResolutionError(
        `Automatic conflict preservation does not support binary files. Unsupported file: ${relativeFilePath}.`,
      );
    }

    const source = raw.toString("utf8");
    const resolved = rewriteConflictMarkers(source, relativeFilePath, timestamp);
    await fs.writeFile(absolutePath, resolved, "utf8");
  }
}

export function rewriteConflictMarkers(
  source: string,
  relativeFilePath: string,
  timestamp: Date,
): string {
  const lines = source.split("\n");
  const trailingNewline = source.endsWith("\n");
  const output: string[] = [];

  let foundConflict = false;
  let index = 0;

  while (index < lines.length) {
    const currentLine = lines[index];
    if (currentLine === undefined) {
      break;
    }

    if (!currentLine.startsWith("<<<<<<< ")) {
      output.push(currentLine);
      index += 1;
      continue;
    }

    foundConflict = true;
    index += 1;

    const localLines: string[] = [];
    while (index < lines.length && lines[index] !== "=======") {
      const localLine = lines[index];
      if (localLine === undefined) {
        break;
      }

      if (localLine.startsWith("<<<<<<< ")) {
        throw new ConflictResolutionError(
          `Nested conflict markers are not supported in ${relativeFilePath}.`,
        );
      }
      localLines.push(localLine);
      index += 1;
    }

    if (index >= lines.length) {
      throw new ConflictResolutionError(
        `Malformed conflict marker block in ${relativeFilePath}.`,
      );
    }

    index += 1;
    const remoteLines: string[] = [];
    while (index < lines.length) {
      const remoteLine = lines[index];
      if (remoteLine === undefined || remoteLine.startsWith(">>>>>>> ")) {
        break;
      }

      if (remoteLine.startsWith("<<<<<<< ")) {
        throw new ConflictResolutionError(
          `Nested conflict markers are not supported in ${relativeFilePath}.`,
        );
      }
      remoteLines.push(remoteLine);
      index += 1;
    }

    const remoteMarker = lines[index];
    if (remoteMarker === undefined || !remoteMarker.startsWith(">>>>>>> ")) {
      throw new ConflictResolutionError(
        `Malformed conflict marker block in ${relativeFilePath}.`,
      );
    }

    index += 1;
    output.push(...buildConflictBlock(relativeFilePath, timestamp, localLines, remoteLines));
  }

  if (!foundConflict) {
    throw new ConflictResolutionError(
      `Expected Git conflict markers in ${relativeFilePath}, but none were found.`,
    );
  }

  const rewritten = output.join("\n");
  return trailingNewline ? `${rewritten}\n` : rewritten;
}

function buildConflictBlock(
  relativeFilePath: string,
  timestamp: Date,
  localLines: string[],
  remoteLines: string[],
): string[] {
  return [
    "> [!warning] Git Obsidian preserved both versions of a merge conflict.",
    `> File: ${relativeFilePath}`,
    `> Time: ${formatLocalDateTime(timestamp)}`,
    "> Review both blocks below, reconcile the content, and then remove this warning.",
    "",
    "```git-obsidian-local",
    ...localLines,
    "```",
    "",
    "```git-obsidian-remote",
    ...remoteLines,
    "```",
  ];
}
