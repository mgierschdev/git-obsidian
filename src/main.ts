import { Notice, Plugin, WorkspaceLeaf } from "obsidian";

import { ConflictResolver } from "./conflict-resolver";
import { GitDiffView, GIT_DIFF_VIEW_TYPE } from "./diff-view";
import { GitCommandRunner } from "./git-command-runner";
import { GitHistoryView, GIT_HISTORY_VIEW_TYPE } from "./history-view";
import { GitSyncService } from "./git-sync-service";
import { normalizeSettings, SettingsStore, SettingsValidationError } from "./settings-store";
import { GitObsidianSettingTab } from "./settings-tab";
import { SyncScheduler } from "./sync-scheduler";
import { getVaultBasePath } from "./vault-path";
import {
  DEFAULT_SETTINGS,
  type GitCommitDetail,
  type GitCommitFileDiff,
  type GitHistoryEntry,
  type GitObsidianSettings,
  type SyncEvent,
  type SyncStatus,
} from "./types";

export default class GitObsidianPlugin extends Plugin {
  settings: GitObsidianSettings = DEFAULT_SETTINGS;

  private settingsStore!: SettingsStore;
  private gitRunner!: GitCommandRunner;
  private syncService!: GitSyncService;
  private scheduler!: SyncScheduler;
  private statusBarItemEl!: HTMLElement;
  private vaultBasePath: string | null = null;
  private repositorySummary = "Repository inspection has not run yet.";

  async onload(): Promise<void> {
    this.settingsStore = new SettingsStore(this);
    this.settings = await this.settingsStore.load();

    try {
      this.vaultBasePath = getVaultBasePath(this.app);
    } catch (error) {
      this.handleUserFacingError(error, true);
    }

    this.statusBarItemEl = this.addStatusBarItem();
    this.statusBarItemEl.addClass("git-obsidian-status");
    this.setStatus("idle", "Ready");

    this.registerView(
      GIT_HISTORY_VIEW_TYPE,
      (leaf) => new GitHistoryView(leaf, this),
    );
    this.registerView(
      GIT_DIFF_VIEW_TYPE,
      (leaf) => new GitDiffView(leaf),
    );

    if (this.vaultBasePath) {
      this.gitRunner = new GitCommandRunner(this.vaultBasePath);
      this.syncService = new GitSyncService({
        runner: this.gitRunner,
        conflictResolver: new ConflictResolver(this.vaultBasePath),
        getSettings: () => this.settings,
        logger: (message, level = "info") => this.log(message, level),
        onEvent: (event) => this.handleSyncEvent(event),
      });
      try {
        await this.detectRepositoryDefaults(false);
      } catch (error) {
        this.handleUserFacingError(error, true);
      }
    } else {
      this.repositorySummary = "Vault path detection failed. Git sync is unavailable.";
    }

    this.scheduler = new SyncScheduler({
      getIntervalMs: () => this.settings.syncIntervalMinutes * 60_000,
      runSync: async (source) => this.runSync(source),
    });
    if (this.syncService) {
      this.scheduler.start();
    }

    this.addCommand({
      id: "sync-now",
      name: "Sync notes with Git now",
      callback: () => {
        void this.triggerManualSync();
      },
    });

    this.addCommand({
      id: "toggle-auto-sync",
      name: "Pause or resume automatic Git sync",
      callback: () => {
        if (this.scheduler.isPaused()) {
          this.scheduler.resume();
          this.setStatus("idle", "Automatic sync resumed");
          this.notify("Git Obsidian automatic sync resumed.");
          return;
        }

        this.scheduler.pause();
        this.setStatus("paused", "Automatic sync paused");
        this.notify("Git Obsidian automatic sync paused.");
      },
    });

    this.addCommand({
      id: "open-git-history",
      name: "Open Git history",
      callback: () => {
        void this.activateHistoryView();
      },
    });

    this.addRibbonIcon(
      "git-commit-horizontal",
      "Open Git history",
      () => {
        void this.activateHistoryView();
      },
    );

    this.addSettingTab(new GitObsidianSettingTab(this.app, this));
  }

  onunload(): void {
    this.scheduler?.stop();
  }

  async updateSettings(
    partial: Partial<GitObsidianSettings>,
  ): Promise<GitObsidianSettings> {
    const nextSettings = normalizeSettings({
      ...this.settings,
      ...partial,
    });

    this.settings = await this.settingsStore.save(nextSettings);
    this.scheduler.reconfigure();
    return this.settings;
  }

  getRepositorySummary(): string {
    return this.repositorySummary;
  }

  async getGitHistory(limit = 30): Promise<GitHistoryEntry[]> {
    if (!this.gitRunner) {
      throw new Error("Git history is unavailable because the vault path could not be resolved.");
    }

    await this.gitRunner.inspectRepository();
    return this.gitRunner.readHistory(limit);
  }

  async getCommitDetail(hash: string): Promise<GitCommitDetail> {
    if (!this.gitRunner) {
      throw new Error("Git commit detail is unavailable because the vault path could not be resolved.");
    }

    await this.gitRunner.inspectRepository();
    return this.gitRunner.readCommitDetail(hash);
  }

  async detectRepositoryDefaults(force: boolean): Promise<void> {
    if (!this.gitRunner) {
      this.repositorySummary = "Git runner is unavailable because the vault path could not be resolved.";
      return;
    }

    try {
      const inspection = await this.gitRunner.inspectRepository();
      const remoteSummary = inspection.detectedRemoteUrl ?? "No origin remote detected";
      const branchSummary = inspection.currentBranch ?? "No checked-out branch detected";
      this.repositorySummary = `Vault root: ${inspection.rootPath}. Branch: ${branchSummary}. Origin: ${remoteSummary}.`;

      const nextSettings: GitObsidianSettings = {
        ...this.settings,
      };

      let changed = false;
      if ((force || !nextSettings.remoteUrl) && inspection.detectedRemoteUrl) {
        nextSettings.remoteUrl = inspection.detectedRemoteUrl;
        changed = true;
      }

      if ((force || !nextSettings.branch) && inspection.currentBranch) {
        nextSettings.branch = inspection.currentBranch;
        changed = true;
      }

      if (changed) {
        this.settings = await this.settingsStore.save(nextSettings);
        this.scheduler?.reconfigure();
      }
    } catch (error) {
      this.repositorySummary = error instanceof Error
        ? error.message
        : "Repository inspection failed.";
      throw error;
    }
  }

  async triggerManualSync(): Promise<void> {
    const started = await this.scheduler.triggerManual();
    if (!started) {
      this.notify("Git sync is already running.");
    }
  }

  async pushPendingChanges(): Promise<void> {
    if (!this.syncService) {
      this.handleUserFacingError(new Error("Git sync is unavailable because the vault path could not be resolved."), true);
      return;
    }

    this.setStatus("syncing", "Pushing pending changes");

    try {
      await this.syncService.pushOnly();
      this.setStatus("success", "Pending commits pushed.");
      void this.refreshHistoryView();
    } catch (error) {
      this.handleUserFacingError(error, true);
    }
  }

  async openCommitFileDiff(hash: string, filePath: string): Promise<void> {
    if (!this.gitRunner) {
      throw new Error("Git commit diff is unavailable because the vault path could not be resolved.");
    }

    await this.gitRunner.inspectRepository();
    const diff = await this.gitRunner.readCommitFileDiff(hash, filePath);
    await this.openDiffView(diff);
  }

  handleUserFacingError(error: unknown, showNotice: boolean): void {
    const message = error instanceof SettingsValidationError
      ? error.details.join(" ")
      : error instanceof Error
        ? error.message
        : "An unknown Git Obsidian error occurred.";

    this.log(message, "error");
    this.setStatus("error", message);
    void this.refreshHistoryView();

    if (showNotice && this.settings.notifyOnError) {
      this.notify(message, 8000);
    }
  }

  private async runSync(source: "automatic" | "manual"): Promise<void> {
    if (!this.syncService) {
      this.handleUserFacingError(new Error("Git sync is unavailable because the vault path could not be resolved."), true);
      return;
    }

    this.setStatus("syncing", source === "manual" ? "Manual sync in progress" : "Automatic sync in progress");

    try {
      const result = await this.syncService.sync();
      this.setStatus("success", result.message);
      this.log(result.message);
      void this.refreshHistoryView();

      if (source === "manual") {
        this.notify(result.message, 5000);
      }
    } catch (error) {
      this.handleUserFacingError(error, source === "manual");
    }
  }

  private log(message: string, level: "info" | "error" = "info"): void {
    const prefix = "[Git Obsidian]";

    if (level === "error") {
      console.error(prefix, message);
      return;
    }

    console.debug(prefix, message);
  }

  private setStatus(status: SyncStatus, detail: string): void {
    if (!this.statusBarItemEl) {
      return;
    }

    this.statusBarItemEl.dataset.syncStatus = status;
    this.statusBarItemEl.setText(`Git Sync: ${status}`);
    this.statusBarItemEl.setAttribute("aria-label", detail);
    this.statusBarItemEl.title = detail;
  }

  private handleSyncEvent(event: SyncEvent): void {
    void this.refreshHistoryView();

    if (event.type === "push" || !this.shouldNotifyForEvent(event.type)) {
      return;
    }

    this.notify(event.message, 5000);
  }

  private shouldNotifyForEvent(eventType: SyncEvent["type"]): boolean {
    switch (eventType) {
      case "commit":
        return this.settings.notifyOnCommit;
      case "merge":
        return this.settings.notifyOnMerge;
      case "push":
        return this.settings.notifyOnPush;
    }
  }

  private notify(message: string, timeout = 4000): void {
    new Notice(message, timeout);
  }

  private async activateHistoryView(): Promise<void> {
    const leaf = await this.app.workspace.ensureSideLeaf(
      GIT_HISTORY_VIEW_TYPE,
      "right",
      {
        active: true,
        reveal: true,
      },
    );

    await leaf.setViewState({
      type: GIT_HISTORY_VIEW_TYPE,
      active: true,
    });
    await leaf.loadIfDeferred();
    await this.app.workspace.revealLeaf(leaf);

    const view = leaf.view;
    if (view instanceof GitHistoryView) {
      await view.reloadHistory(false);
    }
  }

  private async openDiffView(diff: GitCommitFileDiff): Promise<void> {
    const leaf = this.app.workspace.getLeaf(true);
    await leaf.setViewState({
      type: GIT_DIFF_VIEW_TYPE,
      active: true,
    });
    await leaf.loadIfDeferred();

    const view = leaf.view;
    if (!(view instanceof GitDiffView)) {
      throw new Error("Failed to open the Git diff view.");
    }

    view.setDiff(diff);
    this.app.workspace.setActiveLeaf(leaf, { focus: true });
  }

  private async refreshHistoryView(): Promise<void> {
    const leaves = this.app.workspace.getLeavesOfType(GIT_HISTORY_VIEW_TYPE);
    await Promise.all(leaves.map(async (leaf: WorkspaceLeaf) => {
      await leaf.loadIfDeferred();
      if (leaf.view instanceof GitHistoryView) {
        await leaf.view.reloadHistory(false);
      }
    }));
  }
}
