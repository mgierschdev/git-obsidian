import { App, FileSystemAdapter } from "obsidian";

export function getVaultBasePath(app: App): string {
  const adapter = app.vault.adapter;

  if (!(adapter instanceof FileSystemAdapter)) {
    throw new Error("Git Obsidian requires a desktop vault stored on the local filesystem.");
  }

  return adapter.getBasePath();
}
