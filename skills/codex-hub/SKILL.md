---
name: codex-hub
description: Configure, check, or explain the Codex Hub status line for Codex CLI TUI.
---

# Codex Hub

Use this skill when the user wants to configure, debug, or explain the Codex Hub status line.

Default mode is plugin-only: do not patch the Codex npm launcher, do not copy a custom `codex-hub` binary into the Codex package, and do not require users to build Codex from source. Configure Codex's built-in status-line items instead.

Default display:

```text
Context 81% used · 5h 95% · weekly 57% · model xhigh fast · ~/repo · Ready
```

Install with npm:

```powershell
npm install -g codex-hub-cli
codex-hub install
```

Configure Codex:

```toml
[tui]
status_line = ["context-used", "five-hour-limit", "weekly-limit", "model-with-reasoning", "current-dir", "run-state"]
```

Check setup:

```bash
codex-hub status
```

Legacy native HUD mode exists only as an explicit opt-in for users who accept that it rebuilds Codex and patches the npm launcher. It may be overwritten by Codex upgrades and can conflict with launch-constrained helpers such as Computer Use on macOS:

```bash
codex-hub install --patch-launcher
```
