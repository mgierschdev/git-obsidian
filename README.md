# Git Obsidian

Obsidian desktop plugin for syncing a vault with GitHub over HTTPS using scheduled commits, merges, and pushes.

## Features

- Scheduled sync every `N` minutes
- Automatic commit before sync when local changes exist
- Automatic fetch, merge, and push
- GitHub token authentication over HTTPS
- Configurable commit message template
- Git history sidebar
- Commit detail view with changed files

## Requirements

- Obsidian desktop
- `git` installed and available on the system path
- A vault whose root folder is already a Git repository
- A GitHub personal access token with repository write access

## Build

```bash
npm install
npm run build
```

This produces the plugin bundle in:

- `main.js`
- `manifest.json`
- `styles.css`

## Install In An Obsidian Vault

Create this folder inside your vault:

```bash
<VaultPath>/.obsidian/plugins/git-obsidian
```

Then copy the built plugin files into it:

```bash
mkdir -p "<VaultPath>/.obsidian/plugins/git-obsidian"
cp manifest.json "<VaultPath>/.obsidian/plugins/git-obsidian/"
cp main.js "<VaultPath>/.obsidian/plugins/git-obsidian/"
cp styles.css "<VaultPath>/.obsidian/plugins/git-obsidian/"
```

After copying:

1. Open `Settings -> Community plugins`
2. Reload plugins, or restart Obsidian
3. Enable `Git Obsidian`

## Install In An iCloud Vault On macOS

If your vault lives in iCloud Drive, the path is usually under:

```bash
$HOME/Library/Mobile Documents/iCloud~md~obsidian/Documents/<VaultName>
```

Example:

```bash
mkdir -p "$HOME/Library/Mobile Documents/iCloud~md~obsidian/Documents/Notes/.obsidian/plugins/git-obsidian"
cp manifest.json "$HOME/Library/Mobile Documents/iCloud~md~obsidian/Documents/Notes/.obsidian/plugins/git-obsidian/"
cp main.js "$HOME/Library/Mobile Documents/iCloud~md~obsidian/Documents/Notes/.obsidian/plugins/git-obsidian/"
cp styles.css "$HOME/Library/Mobile Documents/iCloud~md~obsidian/Documents/Notes/.obsidian/plugins/git-obsidian/"
```

Then reload community plugins or restart Obsidian.

## Development Install

For local development, symlink the repo into the vault plugin directory so new builds can be picked up without manual copying:

```bash
ln -s "/absolute/path/to/git-obsidian" "<VaultPath>/.obsidian/plugins/git-obsidian"
```

Then rebuild after source changes:

```bash
npm run build
```

Reload community plugins or restart Obsidian after each rebuild.

## Configuration

The plugin settings include:

- `syncIntervalMinutes`
- `autoCommit`
- `autoMerge`
- `commitMessageTemplate`
- `githubUsername`
- `githubToken`
- `remoteUrl`
- `branch`

Supported commit template placeholders:

- `{{datetime}}`
- `{{gitUser}}`
- `{{userName}}`
- `{{fileName}}`
- `{{filename}}`

## Notes

- The plugin is desktop-only.
- The vault root must be the Git repository root.
- The plugin does not initialize or clone repositories.
- Copying new plugin files into `.obsidian/plugins` does not reload the running plugin automatically. Reload community plugins or restart Obsidian after updating the installed files.
- The plugin operates on saved files on disk. If a note has unsaved editor changes, Git will not see them yet.
