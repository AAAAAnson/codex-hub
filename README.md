# codex-hub

Codex Hub is a Codex CLI TUI HUD patch by [AAAAAnson](https://github.com/AAAAAnson). It adds a compact status row below the input area, with context, rolling usage, weekly usage, and runtime status in one place.

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

**How It Works**
Codex Hub reads the same live runtime snapshots that Codex TUI receives from the Codex app server:

- `account/rateLimits/read` for account limit windows.
- Token count events for context-window usage.

It does not scrape local session logs to calculate quota. The installed TUI refreshes usage in the background and also updates when Codex emits fresh token or rate-limit events.

**Requirements**
- Windows PowerShell.
- Git.
- Rust and Cargo.
- Codex installed through npm.
- A local checkout of the Codex source tree.

Install Codex through npm if you do not already have it:

```powershell
npm install -g @openai/codex
```

Use a short working path on Windows. The Codex source tree contains long snapshot filenames, so deeply nested directories can hit Windows path-length limits.

Clone the Codex source tree and this repository:

```powershell
mkdir C:\src
cd C:\src
git clone https://github.com/openai/codex.git codex-source
git clone https://github.com/AAAAAnson/codex-hub.git
cd codex-hub
```

If you already have a local Codex source checkout, use that path instead of cloning another one.

**Install**
Run the installer from the `codex-hub` directory:

```powershell
.\scripts\install.ps1 -CodexSource ..\codex-source
```

Optional release build:

```powershell
.\scripts\install.ps1 -CodexSource ..\codex-source -Release
```

The script:

- Applies `patches/codex-hub.patch` to the Codex source checkout.
- Builds `codex-cli`.
- Copies the built binary as `codex-hub.exe` next to the npm-managed Codex binary.
- Updates the npm launcher to prefer `codex-hub.exe` when present, and fall back to the bundled Codex binary otherwise.

**Configure**
Open your Codex config:

```powershell
notepad $env:USERPROFILE\.codex\config.toml
```

Add `codex-hud` to the TUI status line:

```toml
[tui]
status_line = ["codex-hud", "model-with-reasoning", "current-dir", "git-branch", "run-state"]
```

Restart Codex:

```powershell
codex
```

The HUD appears below the input box. If `Usage` or `Weekly` initially shows `--%`, wait for the background refresh or send a message to trigger fresh runtime data.

**Verify**
Check that the Codex launcher still starts:

```powershell
codex --help
```

Inside the TUI, the expected shape is:

```text
Context █████ 81% │ Usage █░░░░░░░░░ 5% (4h 41m / 5h) │ Weekly ████░░░░░░ 43% (5d 8h / 7d)
```

**Uninstall**
Remove the installed HUD binary and restore the launcher backup:

```powershell
.\scripts\uninstall.ps1
```

To remove the source patch from your Codex source checkout:

```powershell
git -C ..\codex-source apply --whitespace=nowarn --reverse .\patches\codex-hub.patch
```

**Author**
[AAAAAnson](https://github.com/AAAAAnson)

**Privacy**
Codex Hub does not add telemetry. It only renders data already available inside the running Codex TUI. Keep your own Codex config, auth files, and session logs out of this repository.

**Notes**
- The patch targets the Codex TUI source layout used during development.
- The installer is Windows-first because the launcher patch and binary name are Windows-oriented.
- This is an unofficial community patch, not an OpenAI project.
