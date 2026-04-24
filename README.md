# codex-hub

Codex Hub is a small Codex CLI TUI HUD package. It adds a compact status row below the input area, with context, rolling usage, weekly usage, and the usual runtime status fields in one place.

```text
Context █████ 81% │ Usage █░░░░░░░░░ 5% (4h 41m / 5h) │ Weekly ████░░░░░░ 43% (5d 8h / 7d) · model xhigh fast · ~/repo · Ready
```

This repository intentionally ships source patches and installer scripts only. It does not include built Codex binaries, local Codex configuration, session logs, account data, tokens, or machine-specific paths.

**What It Adds**
- `codex-hud` as a native TUI status-line item.
- Context usage bar from the active conversation token count.
- Rolling usage bar with remaining time in the short window.
- Weekly usage bar with remaining time in the weekly window.
- Background refresh of Codex account rate-limit data.
- Fallback rendering when usage data is not available yet.

**Data Source**
Codex Hub reads the same live runtime snapshots that Codex TUI receives from the Codex app server:

- `account/rateLimits/read` for account limit windows.
- Token count events for context-window usage.

It does not scrape local session logs to calculate quota. The installed TUI refreshes usage in the background and also updates when Codex emits fresh token or rate-limit events.

**Install**
Requirements:

- A local checkout of the Codex source tree.
- Rust and Cargo available in your shell.
- Codex installed through npm so the native binary location exists.
- PowerShell on Windows.

From this repository:

```powershell
.\scripts\install.ps1 -CodexSource <path-to-codex-source>
```

Optional release build:

```powershell
.\scripts\install.ps1 -CodexSource <path-to-codex-source> -Release
```

The script:

- Applies `patches/codex-hub.patch` to the Codex source checkout.
- Builds `codex-cli`.
- Copies the built binary as `codex-hub.exe` next to the npm-managed Codex binary.
- Updates the npm launcher to prefer `codex-hub.exe` when present, and fall back to the bundled Codex binary otherwise.

**Configure**
Add `codex-hud` to your Codex TUI status line:

```toml
[tui]
status_line = ["codex-hud", "model-with-reasoning", "current-dir", "git-branch", "run-state"]
```

Restart Codex after changing the config.

**Privacy**
Codex Hub does not add telemetry. It only renders data already available inside the running Codex TUI. Keep your own Codex config, auth files, and session logs out of this repository.

**Notes**
- The patch targets the current Codex TUI source layout used during development.
- The installer is Windows-first because the launcher patch and binary name are Windows-oriented.
- This is an unofficial community patch, not an OpenAI project.
