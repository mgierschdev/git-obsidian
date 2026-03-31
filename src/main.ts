import { Notice, Plugin } from "obsidian";

import { ConflictResolver } from "./conflict-resolver";
import { GitCommandRunner } from "./git-command-runner";
import { GitSyncService } from "./git-sync-service";
import { normalizeSettings, SettingsStore, SettingsValidationError } from "./settings-store";
import { GitObsidianSettingTab } from "./settings-tab";
import { SyncScheduler } from "./sync-scheduler";
import { getVaultBasePath } from "./vault-path";
import { DEFAULT_SETTINGS, type GitObsidianSettings, type SyncStatus } from "./types";

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

    if (this.vaultBasePath) {
      this.gitRunner = new GitCommandRunner(this.vaultBasePath);
      this.syncService = new GitSyncService({
        runner: this.gitRunner,
        conflictResolver: new ConflictResolver(this.vaultBasePath),
        getSettings: () => this.settings,
        logger: (message, level = "info") => this.log(message, level),
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
          new Notice("Git Obsidian automatic sync resumed.");
          return;
        }

        this.scheduler.pause();
        this.setStatus("paused", "Automatic sync paused");
        new Notice("Git Obsidian automatic sync paused.");
      },
    });

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
      new Notice("Git sync is already running.");
    }
  }

  handleUserFacingError(error: unknown, showNotice: boolean): void {
    const message = error instanceof SettingsValidationError
      ? error.details.join(" ")
      : error instanceof Error
        ? error.message
        : "An unknown Git Obsidian error occurred.";

    this.log(message, "error");
    this.setStatus("error", message);

    if (showNotice) {
      new Notice(message, 8000);
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

      if (source === "manual") {
        new Notice(result.message, 5000);
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
}
