import { renderCommitMessage } from "./template";
import {
  SettingsValidationError,
  validateSettingsForSync,
} from "./settings-store";
import { ConflictResolutionError } from "./conflict-resolver";
import { GitCommandError } from "./git-command-runner";
import type {
  ConflictResolverLike,
  GitCommandRunnerLike,
  GitObsidianSettings,
  PluginLogger,
  SyncResult,
} from "./types";

interface GitSyncServiceDependencies {
  runner: GitCommandRunnerLike;
  conflictResolver: ConflictResolverLike;
  getSettings: () => GitObsidianSettings;
  logger?: PluginLogger;
  now?: () => Date;
}

export class GitSyncService {
  private readonly now: () => Date;
  private readonly logger: PluginLogger;

  constructor(private readonly deps: GitSyncServiceDependencies) {
    this.now = deps.now ?? (() => new Date());
    this.logger = deps.logger ?? (() => undefined);
  }

  async sync(): Promise<SyncResult> {
    const settings = this.deps.getSettings();
    const validationErrors = validateSettingsForSync(settings);
    if (validationErrors.length > 0) {
      throw new SettingsValidationError(validationErrors);
    }

    const repository = await this.deps.runner.inspectRepository();
    if (!repository.currentBranch) {
      throw new Error("The vault repository is in a detached HEAD state. Check out the configured branch and retry.");
    }

    if (repository.currentBranch !== settings.branch) {
      throw new Error(
        `The current Git branch is "${repository.currentBranch}", but the plugin is configured for "${settings.branch}".`,
      );
    }

    const dirty = (await this.deps.runner.run(["status", "--porcelain"])).stdout.trim().length > 0;
    let commitCreated = false;

    if (dirty && !settings.autoCommit) {
      throw new Error("The repository has local changes, but auto-commit is disabled.");
    }

    if (dirty) {
      await this.deps.runner.run(["add", "-A"]);
      const commitMessage = renderCommitMessage(
        settings.commitMessageTemplate,
        settings.githubUsername,
        this.now(),
      );
      await this.deps.runner.run(["commit", "-m", commitMessage]);
      commitCreated = true;
      this.logger(`Created sync commit "${commitMessage}".`);
    }

    const mergeResolved = await this.fetchAndMerge(settings);
    await this.push(settings);

    const summaryParts = ["Git sync completed."];
    if (commitCreated) {
      summaryParts.push("Local changes were committed.");
    }
    if (mergeResolved) {
      summaryParts.push("Merge conflicts were preserved in note content.");
    }

    return {
      message: summaryParts.join(" "),
      commitCreated,
      mergeResolved,
    };
  }

  private async fetchAndMerge(settings: GitObsidianSettings): Promise<boolean> {
    try {
      await this.deps.runner.run(
        ["fetch", "--prune", settings.remoteUrl, settings.branch],
        {
          auth: {
            username: settings.githubUsername,
            token: settings.githubToken,
          },
        },
      );
    } catch (error) {
      throw mapNetworkGitError(error, "Git fetch failed. Check the configured GitHub HTTPS remote, username, token, and network connection.");
    }

    if (!settings.autoMerge) {
      try {
        await this.deps.runner.run(["merge", "--ff-only", "FETCH_HEAD"]);
        return false;
      } catch (error) {
        throw mapGitError(
          error,
          "Remote changes require a merge, but auto-merge is disabled.",
        );
      }
    }

    try {
      await this.deps.runner.run(["merge", "--no-edit", "FETCH_HEAD"]);
      return false;
    } catch (error) {
      const conflictedFiles = await this.getConflictedFiles();
      if (conflictedFiles.length === 0) {
        throw mapGitError(error, "Git merge failed before conflict resolution could begin.");
      }

      const timestamp = this.now();

      try {
        for (const conflictedFile of conflictedFiles) {
          await this.deps.conflictResolver.resolveFile(conflictedFile, timestamp);
          await this.deps.runner.run(["add", "--", conflictedFile]);
        }
      } catch (resolutionError) {
        await this.abortMergeSafely();
        if (resolutionError instanceof ConflictResolutionError) {
          throw resolutionError;
        }
        throw mapGitError(resolutionError, "Automatic merge conflict preservation failed.");
      }

      await this.deps.runner.run(["commit", "--no-edit"]);
      this.logger(`Resolved merge conflicts in ${conflictedFiles.join(", ")}.`);
      return true;
    }
  }

  private async push(settings: GitObsidianSettings): Promise<void> {
    try {
      await this.deps.runner.run(
        ["push", settings.remoteUrl, `HEAD:${settings.branch}`],
        {
          auth: {
            username: settings.githubUsername,
            token: settings.githubToken,
          },
        },
      );
    } catch (error) {
      throw mapNetworkGitError(error, "Git push failed. Check repository permissions, branch protection, token scopes, and network connectivity.");
    }
  }

  private async getConflictedFiles(): Promise<string[]> {
    const output = await this.deps.runner.run(["diff", "--name-only", "--diff-filter=U"]);
    return output.stdout
      .split("\n")
      .map((file) => file.trim())
      .filter(Boolean);
  }

  private async abortMergeSafely(): Promise<void> {
    try {
      await this.deps.runner.run(["merge", "--abort"]);
    } catch {
      this.logger("Git merge abort failed after a conflict resolution error.", "error");
    }
  }
}

function mapNetworkGitError(error: unknown, fallbackMessage: string): Error {
  if (error instanceof GitCommandError) {
    const detail = `${error.stderr}\n${error.stdout}`.trim();
    if (/authentication failed|invalid username or token|could not read username/i.test(detail)) {
      return new Error("GitHub authentication failed. Check the configured username and personal access token.");
    }

    if (/repository not found/i.test(detail)) {
      return new Error("The configured GitHub repository could not be found.");
    }

    if (/could not resolve host|failed to connect|network is unreachable/i.test(detail)) {
      return new Error("Git network access failed. Check the remote URL and your network connection.");
    }
  }

  return mapGitError(error, fallbackMessage);
}

function mapGitError(error: unknown, fallbackMessage: string): Error {
  if (error instanceof Error) {
    return new Error(error.message || fallbackMessage);
  }

  return new Error(fallbackMessage);
}
