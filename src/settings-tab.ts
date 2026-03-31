import { App, PluginSettingTab, Setting } from "obsidian";

import type GitObsidianPlugin from "./main";
import type { GitObsidianSettings } from "./types";

export class GitObsidianSettingTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: GitObsidianPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl).setName("Repository sync").setHeading();
    containerEl.createEl("p", {
      text: this.plugin.getRepositorySummary(),
    });

    new Setting(containerEl)
      .setName("Detect repository settings")
      .setDesc("Prefill the branch and GitHub HTTPS remote from the vault repository if available.")
      .addButton((button) =>
        button
          .setButtonText("Detect")
          .onClick(() => {
            void this.plugin.detectRepositoryDefaults(true)
              .then(() => this.display())
              .catch((error: unknown) => this.plugin.handleUserFacingError(error, true));
          }));

    this.addIntervalSetting(containerEl);
    this.addToggleSetting(containerEl, "Auto-commit", "Create a commit automatically whenever local changes are detected before sync.", "autoCommit");
    this.addToggleSetting(containerEl, "Auto-merge", "Merge remote changes automatically. When a note conflict remains, preserve both versions inside the note.", "autoMerge");
    this.addTextSetting(
      containerEl,
      "Commit message template",
      "Use {{datetime}} and {{gitUser}}. Invalid placeholders are rejected.",
      "commitMessageTemplate",
      { placeholder: "{{datetime}}-{{gitUser}}" },
    );
    this.addTextSetting(
      containerEl,
      "GitHub username",
      "Used for HTTPS authentication and the {{gitUser}} commit message placeholder.",
      "githubUsername",
      { placeholder: "mgierschdev" },
    );
    this.addTextSetting(
      containerEl,
      "GitHub token",
      "Stored locally in plugin settings so unattended sync can run. Use a token with repository access.",
      "githubToken",
      { placeholder: "ghp_...", type: "password" },
    );
    this.addTextSetting(
      containerEl,
      "Remote URL",
      "Must be a GitHub HTTPS repository URL. Embedded credentials are not allowed.",
      "remoteUrl",
      { placeholder: "https://github.com/owner/repo.git" },
    );
    this.addTextSetting(
      containerEl,
      "Branch",
      "The checked-out branch that the plugin will sync against.",
      "branch",
      { placeholder: "main" },
    );
  }

  private addIntervalSetting(containerEl: HTMLElement): void {
    new Setting(containerEl)
      .setName("Sync interval (minutes)")
      .setDesc("Automatic sync runs on this schedule.")
      .addText((text) => {
        text.inputEl.type = "number";
        text.inputEl.min = "1";
        text.setValue(`${this.plugin.settings.syncIntervalMinutes}`);

        text.inputEl.addEventListener("change", () => {
          const parsed = Number.parseInt(text.getValue(), 10);
          void this.plugin.updateSettings({
            syncIntervalMinutes: parsed,
          })
            .then(() => this.display())
            .catch((error: unknown) => {
              text.setValue(`${this.plugin.settings.syncIntervalMinutes}`);
              this.plugin.handleUserFacingError(error, true);
            });
        });
      });
  }

  private addToggleSetting<K extends keyof Pick<GitObsidianSettings, "autoCommit" | "autoMerge">>(
    containerEl: HTMLElement,
    name: string,
    description: string,
    key: K,
  ): void {
    new Setting(containerEl)
      .setName(name)
      .setDesc(description)
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings[key])
          .onChange((value) => {
            void this.plugin.updateSettings({
              [key]: value,
            } as Pick<GitObsidianSettings, K>)
              .then(() => this.display())
              .catch((error: unknown) => this.plugin.handleUserFacingError(error, true));
          }));
  }

  private addTextSetting<K extends keyof Pick<
    GitObsidianSettings,
    "commitMessageTemplate" | "githubUsername" | "githubToken" | "remoteUrl" | "branch"
  >>(
    containerEl: HTMLElement,
    name: string,
    description: string,
    key: K,
    options: {
      placeholder: string;
      type?: string;
    },
  ): void {
    new Setting(containerEl)
      .setName(name)
      .setDesc(description)
      .addText((text) => {
        text.setPlaceholder(options.placeholder);
        text.setValue(this.plugin.settings[key]);
        if (options.type) {
          text.inputEl.type = options.type;
        }

        text.inputEl.addEventListener("change", () => {
          void this.plugin.updateSettings({
            [key]: text.getValue(),
          } as Pick<GitObsidianSettings, K>)
            .then(() => this.display())
            .catch((error: unknown) => {
              text.setValue(this.plugin.settings[key]);
              this.plugin.handleUserFacingError(error, true);
            });
        });
      });
  }
}
