import { execFile } from "node:child_process";
import { realpathSync } from "node:fs";
import { promisify } from "node:util";

import type {
  GitCommitDetail,
  GitCommitFileDiff,
  GitCommandResult,
  GitHistoryEntry,
  GitRunOptions,
  RepositoryInspection,
} from "./types";
import { buildGitHistoryArgs, parseCommitFileChanges, parseGitHistory } from "./git-history";

const execFileAsync = promisify(execFile);

export class GitCommandError extends Error {
  readonly args: string[];
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number | null;

  constructor(
    args: string[],
    stdout: string,
    stderr: string,
    exitCode: number | null,
    message: string,
  ) {
    super(message);
    this.name = "GitCommandError";
    this.args = args;
    this.stdout = stdout;
    this.stderr = stderr;
    this.exitCode = exitCode;
  }
}

export class GitCommandRunner {
  constructor(private readonly cwd: string) {}

  async inspectRepository(): Promise<RepositoryInspection> {
    await this.run(["--version"]);

    let topLevel: string;
    try {
      topLevel = (await this.run(["rev-parse", "--show-toplevel"])).stdout.trim();
    } catch (error) {
      throw this.rethrowAsUserError(
        error,
        "The vault root is not an existing Git repository.",
      );
    }

    const resolvedTopLevel = realpathSync.native(topLevel);
    const resolvedCwd = realpathSync.native(this.cwd);

    if (resolvedTopLevel !== resolvedCwd) {
      throw new Error(
        `The Git repository root (${topLevel}) does not match the vault root (${this.cwd}).`,
      );
    }

    const currentBranch = await this.tryReadSingleLine(["branch", "--show-current"]);
    const detectedRemoteUrl = await this.tryReadSingleLine(["remote", "get-url", "origin"]);

    return {
      rootPath: topLevel,
      currentBranch,
      detectedRemoteUrl,
    };
  }

  async run(args: string[], options?: GitRunOptions): Promise<GitCommandResult> {
    const fullArgs = buildGitArgs(args, options);

    try {
      const { stdout, stderr } = await execFileAsync("git", fullArgs, {
        cwd: this.cwd,
        env: {
          ...process.env,
          GIT_TERMINAL_PROMPT: "0",
          GCM_INTERACTIVE: "Never",
        },
        maxBuffer: 10 * 1024 * 1024,
      });

      return {
        stdout: normalizeExecOutput(stdout),
        stderr: normalizeExecOutput(stderr),
      };
    } catch (error) {
      const gitError = error as NodeJS.ErrnoException & {
        stdout?: string | Buffer;
        stderr?: string | Buffer;
        code?: number | string;
      };

      if (gitError.code === "ENOENT") {
        throw new GitCommandError(
          fullArgs,
          "",
          "",
          null,
          "System git is not installed or not available in the Obsidian desktop environment.",
        );
      }

      const stdout = normalizeExecOutput(gitError.stdout);
      const stderr = normalizeExecOutput(gitError.stderr);
      const exitCode = typeof gitError.code === "number" ? gitError.code : null;
      const detail = stderr.trim() || stdout.trim() || "Git command failed.";

      throw new GitCommandError(fullArgs, stdout, stderr, exitCode, detail);
    }
  }

  async readHistory(limit = 30): Promise<GitHistoryEntry[]> {
    const output = await this.run(buildGitHistoryArgs(limit));
    return parseGitHistory(output.stdout);
  }

  async readCommitDetail(hash: string): Promise<GitCommitDetail> {
    const fileOutput = await this.run([
      "show",
      "--format=",
      "--name-status",
      hash,
    ]);

    return {
      hash,
      files: parseCommitFileChanges(fileOutput.stdout),
    };
  }

  async readCommitFileDiff(hash: string, filePath: string): Promise<GitCommitFileDiff> {
    const output = await this.run([
      "show",
      "--format=",
      "--patch",
      hash,
      "--",
      filePath,
    ]);

    return {
      hash,
      path: filePath,
      text: output.stdout.trim(),
    };
  }

  private async tryReadSingleLine(args: string[]): Promise<string | null> {
    try {
      const output = (await this.run(args)).stdout.trim();
      return output || null;
    } catch {
      return null;
    }
  }
  private rethrowAsUserError(error: unknown, message: string): Error {
    if (error instanceof GitCommandError) {
      return new GitCommandError(error.args, error.stdout, error.stderr, error.exitCode, message);
    }

    return new Error(message);
  }
}

function buildGitArgs(args: string[], options?: GitRunOptions): string[] {
  const baseArgs = [
    "-c",
    "core.quotePath=false",
  ];

  if (!options?.auth) {
    return [
      ...baseArgs,
      ...args,
    ];
  }

  const authHeader = Buffer.from(
    `${options.auth.username}:${options.auth.token}`,
    "utf8",
  ).toString("base64");

  return [
    ...baseArgs,
    "-c",
    "credential.helper=",
    "-c",
    "credential.interactive=never",
    "-c",
    `http.extraheader=AUTHORIZATION: basic ${authHeader}`,
    ...args,
  ];
}

function normalizeExecOutput(output: string | Buffer | undefined): string {
  if (typeof output === "string") {
    return output;
  }

  if (output instanceof Buffer) {
    return output.toString("utf8");
  }

  return "";
}
