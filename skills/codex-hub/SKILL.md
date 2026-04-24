---
name: codex-hub
description: Install, configure, or explain the Codex Hub HUD for Codex CLI TUI status.
---

# Codex Hub

Use this skill when the user wants to install, configure, debug, or explain the Codex Hub HUD.

The HUD is installed by applying `patches/codex-hub.patch` to a local Codex source checkout, building `codex-cli`, and installing the resulting binary next to the npm-managed Codex binary.

Default display:

```text
Context █████ 81% │ Usage █░░░░░░░░░ 5% (4h 41m / 5h) │ Weekly ████░░░░░░ 43% (5d 8h / 7d)
```

Install with npm:

```powershell
npm install -g codex-hub-cli
codex-hub install
```

Direct source install on Windows:

```powershell
.\scripts\install.ps1 -CodexSource <path-to-codex-source>
```

Direct source install on macOS:

```bash
bash ./scripts/install.sh --codex-source <path-to-codex-source>
```

After installation, configure Codex:

```toml
[tui]
status_line = ["codex-hud", "model-with-reasoning", "current-dir", "git-branch", "run-state"]
```
