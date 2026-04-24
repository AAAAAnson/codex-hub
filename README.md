# codex-hub

Codex Hub is a Codex CLI TUI HUD installer by [AAAAAnson](https://github.com/AAAAAnson). It adds a compact status row below the input area, with context, rolling usage, weekly usage, and runtime status in one place.

```text
Context █████ 81% │ Usage █░░░░░░░░░ 5% (4h 41m / 5h) │ Weekly ████░░░░░░ 43% (5d 8h / 7d) · model xhigh fast · ~/repo · Ready
```

This repository ships an npm CLI, source patch, and installer scripts. It does not include built Codex binaries, local Codex configuration, session logs, account data, tokens, or machine-specific paths.

**What It Adds**
- `codex-hud` as a native TUI status-line item.
- Context usage bar from the active conversation token count.
- Rolling usage bar with remaining time in the short window.
- Weekly usage bar with remaining time in the weekly window.
- Background refresh of Codex account rate-limit data.
- Fallback rendering when usage data is not available yet.

**How It Works**
Codex Hub reads the same live runtime snapshots that Codex TUI receives from the Codex app server:

- `account/rateLimits/read` for account limit windows.
- Token count events for context-window usage.

It does not scrape local session logs to calculate quota. The installed TUI refreshes usage in the background and also updates when Codex emits fresh token or rate-limit events.

**Requirements**
- Windows PowerShell.
- Git.
- Rust and Cargo.
- Node and npm.
- Codex installed through npm.

Install Codex through npm if you do not already have it:

```powershell
npm install -g @openai/codex
```

**Install With npm**
Install Codex Hub from GitHub:

```powershell
npm install -g github:AAAAAnson/codex-hub
```

After the npm registry package is published, this will also work:

```powershell
npm install -g @mbluo/codex-hub
```

Run the installer:

```powershell
codex-hub install
```

By default, `codex-hub install` uses `C:\src\codex-source` as the Codex source checkout. If that path does not exist, it clones `https://github.com/openai/codex.git` there. A short path is used because the Codex source tree contains long snapshot filenames that can hit Windows path-length limits.

If you already have a Codex source checkout:

```powershell
codex-hub install --codex-source C:\src\codex-source
```

Optional release build:

```powershell
codex-hub install --release
```

The installer:

- Clones or reuses a Codex source checkout.
- Applies `patches/codex-hub.patch`.
- Builds `codex-cli`.
- Copies the built binary as `codex-hub.exe` next to the npm-managed Codex binary.
- Updates the npm launcher to prefer `codex-hub.exe` when present, and fall back to the bundled Codex binary otherwise.
- Adds `codex-hud` to your Codex TUI `status_line` config unless you pass `--no-configure`.

**Use**
Restart Codex:

```powershell
codex
```

The HUD appears below the input box. If `Usage` or `Weekly` initially shows `--%`, wait for the background refresh or send a message to trigger fresh runtime data.

Check the local install:

```powershell
codex-hub status
```

Check that Codex still starts:

```powershell
codex --help
```

**Manual Config**
If you installed with `--no-configure`, add this to your Codex config:

```toml
[tui]
status_line = ["codex-hud", "model-with-reasoning", "current-dir", "git-branch", "run-state"]
```

You can also run:

```powershell
codex-hub configure
```

**Uninstall**
Remove the installed HUD binary and restore the launcher backup:

```powershell
codex-hub uninstall
```

If you want to remove the source patch from a custom Codex source checkout:

```powershell
codex-hub uninstall --codex-source C:\src\codex-source
```

**Source Install**
You can still run the PowerShell installer directly from a cloned repository:

```powershell
git clone https://github.com/AAAAAnson/codex-hub.git
cd codex-hub
.\scripts\install.ps1 -CodexSource C:\src\codex-source
```

**Author**
[AAAAAnson](https://github.com/AAAAAnson)

**Privacy**
Codex Hub does not add telemetry. It only renders data already available inside the running Codex TUI. Keep your own Codex config, auth files, and session logs out of this repository.

**Notes**
- The patch targets the Codex TUI source layout used during development.
- The installer is Windows-first because the launcher patch and binary name are Windows-oriented.
- This is an unofficial community package, not an OpenAI project.
