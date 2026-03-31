import { ItemView, Notice, WorkspaceLeaf } from "obsidian";

import type GitObsidianPlugin from "./main";
import type { GitCommitDetail, GitHistoryEntry } from "./types";

export const GIT_HISTORY_VIEW_TYPE = "git-obsidian-history";

export class GitHistoryView extends ItemView {
  private history: GitHistoryEntry[] = [];
  private selectedCommit: GitCommitDetail | null = null;

  constructor(leaf: WorkspaceLeaf, private readonly plugin: GitObsidianPlugin) {
    super(leaf);
  }

  getViewType(): string {
    return GIT_HISTORY_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "Git history";
  }

  getIcon(): string {
    return "git-commit-horizontal";
  }

  async onOpen(): Promise<void> {
    this.contentEl.addClass("git-obsidian-history-view");
    this.addAction("refresh-cw", "Refresh history", () => {
      void this.reloadHistory(true);
    });
    await this.reloadHistory(false);
  }

  async reloadHistory(showNotice: boolean): Promise<void> {
    this.contentEl.empty();
    this.contentEl.createEl("div", {
      cls: "git-obsidian-history-empty",
      text: "Loading Git history...",
    });

    try {
      this.history = await this.plugin.getGitHistory();
      this.render();

      if (showNotice) {
        new Notice("Git history refreshed.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load Git history.";
      this.plugin.handleUserFacingError(error, showNotice);
      this.renderError(message);
    }
  }

  private render(): void {
    const { contentEl } = this;
    contentEl.empty();

    const header = contentEl.createDiv({ cls: "git-obsidian-history-header" });
    header.createEl("h3", { text: "Git history" });
    header.createEl("p", {
      text: `${this.history.length} recent commit${this.history.length === 1 ? "" : "s"}`,
      cls: "git-obsidian-history-summary",
    });

    if (this.selectedCommit) {
      this.renderCommitDetail(this.selectedCommit);
      return;
    }

    if (this.history.length === 0) {
      this.renderError("No commits found in the current vault repository.");
      return;
    }

    const list = contentEl.createDiv({ cls: "git-obsidian-history-list" });
    for (const entry of this.history) {
      const item = list.createDiv({ cls: "git-obsidian-history-item" });
      item.addClass("git-obsidian-history-item-clickable");
      item.addEventListener("click", () => {
        void this.openCommitDetail(entry.hash);
      });

      const topRow = item.createDiv({ cls: "git-obsidian-history-top-row" });
      topRow.createEl("code", {
        text: entry.shortHash,
        cls: "git-obsidian-history-hash",
      });
      topRow.createEl("span", {
        text: formatHistoryDate(entry.authoredAt),
        cls: "git-obsidian-history-date",
      });

      item.createEl("div", {
        text: entry.subject,
        cls: "git-obsidian-history-subject",
      });
      item.createEl("div", {
        text: `${entry.authorName} <${entry.authorEmail}>`,
        cls: "git-obsidian-history-author",
      });

    }
  }

  private renderError(message: string): void {
    const { contentEl } = this;
    contentEl.empty();

    const state = contentEl.createDiv({ cls: "git-obsidian-history-empty" });
    state.createEl("strong", { text: "Git history unavailable" });
    state.createEl("p", { text: message });
  }

  private async openCommitDetail(hash: string): Promise<void> {
    this.contentEl.empty();
    this.contentEl.createEl("div", {
      cls: "git-obsidian-history-empty",
      text: "Loading commit details...",
    });

    try {
      this.selectedCommit = await this.plugin.getCommitDetail(hash);
      this.render();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load commit details.";
      this.plugin.handleUserFacingError(error, true);
      this.renderError(message);
    }
  }

  private renderCommitDetail(detail: GitCommitDetail): void {
    const wrapper = this.contentEl.createDiv({ cls: "git-obsidian-commit-detail" });
    const topRow = wrapper.createDiv({ cls: "git-obsidian-history-top-row" });

    const backButton = topRow.createEl("button", { text: "Back to history" });
    backButton.addEventListener("click", () => {
      this.selectedCommit = null;
      this.render();
    });

    topRow.createEl("code", {
      text: detail.hash,
      cls: "git-obsidian-history-hash",
    });

    const fileSection = wrapper.createDiv({ cls: "git-obsidian-commit-files" });
    fileSection.createEl("h4", { text: "Files changed" });

    const fileList = fileSection.createDiv({ cls: "git-obsidian-history-list" });
    for (const file of detail.files) {
      const item = fileList.createDiv({ cls: "git-obsidian-history-item git-obsidian-history-item-clickable" });
      item.addEventListener("click", () => {
        void this.openCommittedFile(detail.hash, file.path);
      });
      const row = item.createDiv({ cls: "git-obsidian-history-top-row" });
      row.createEl("code", {
        text: file.status,
        cls: "git-obsidian-history-hash",
      });
      item.createEl("div", {
        text: file.path,
        cls: "git-obsidian-history-subject",
      });
    }
  }

  private async openCommittedFile(hash: string, filePath: string): Promise<void> {
    try {
      await this.plugin.openCommitFileDiff(hash, filePath);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to open diff.";
      this.plugin.handleUserFacingError(error, true);
      this.renderError(message);
    }
  }
}

function formatHistoryDate(isoString: string): string {
  const parsed = new Date(isoString);
  if (Number.isNaN(parsed.getTime())) {
    return isoString;
  }

  return parsed.toLocaleString();
}
