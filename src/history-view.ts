import { ItemView, Notice, WorkspaceLeaf } from "obsidian";

import type GitObsidianPlugin from "./main";
import type { GitHistoryEntry } from "./types";

export const GIT_HISTORY_VIEW_TYPE = "git-obsidian-history";

export class GitHistoryView extends ItemView {
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
      const history = await this.plugin.getGitHistory();
      this.render(history);

      if (showNotice) {
        new Notice("Git history refreshed.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load Git history.";
      this.plugin.handleUserFacingError(error, showNotice);
      this.renderError(message);
    }
  }

  private render(history: GitHistoryEntry[]): void {
    const { contentEl } = this;
    contentEl.empty();

    const header = contentEl.createDiv({ cls: "git-obsidian-history-header" });
    header.createEl("h3", { text: "Git history" });
    header.createEl("p", {
      text: `${history.length} recent commit${history.length === 1 ? "" : "s"}`,
      cls: "git-obsidian-history-summary",
    });

    if (history.length === 0) {
      this.renderError("No commits found in the current vault repository.");
      return;
    }

    const list = contentEl.createDiv({ cls: "git-obsidian-history-list" });
    for (const entry of history) {
      const item = list.createDiv({ cls: "git-obsidian-history-item" });
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

      if (entry.body) {
        item.createEl("pre", {
          text: entry.body,
          cls: "git-obsidian-history-body",
        });
      }
    }
  }

  private renderError(message: string): void {
    const { contentEl } = this;
    contentEl.empty();

    const state = contentEl.createDiv({ cls: "git-obsidian-history-empty" });
    state.createEl("strong", { text: "Git history unavailable" });
    state.createEl("p", { text: message });
  }
}

function formatHistoryDate(isoString: string): string {
  const parsed = new Date(isoString);
  if (Number.isNaN(parsed.getTime())) {
    return isoString;
  }

  return parsed.toLocaleString();
}
