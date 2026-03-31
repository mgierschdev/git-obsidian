import { ItemView, WorkspaceLeaf } from "obsidian";

import type { GitCommitFileDiff } from "./types";

export const GIT_DIFF_VIEW_TYPE = "git-obsidian-diff";

export class GitDiffView extends ItemView {
  private diff: GitCommitFileDiff | null = null;

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }

  getViewType(): string {
    return GIT_DIFF_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "Git diff";
  }

  getIcon(): string {
    return "file-diff";
  }

  setDiff(diff: GitCommitFileDiff): void {
    this.diff = diff;
    this.render();
  }

  onOpen(): Promise<void> {
    this.contentEl.addClass("git-obsidian-diff-view");
    this.render();
    return Promise.resolve();
  }

  private render(): void {
    const { contentEl } = this;
    contentEl.empty();

    if (!this.diff) {
      contentEl.createEl("div", {
        cls: "git-obsidian-history-empty",
        text: "No diff selected.",
      });
      return;
    }

    const header = contentEl.createDiv({ cls: "git-obsidian-history-header" });
    header.createEl("h3", { text: this.diff.path });
    header.createEl("p", {
      text: `Commit ${this.diff.hash}`,
      cls: "git-obsidian-history-summary",
    });

    contentEl.createEl("pre", {
      text: this.diff.text || "No patch output for this file.",
      cls: "git-obsidian-commit-detail-body",
    });
  }
}
