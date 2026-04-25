# codex-hub

Codex Hub is a Codex CLI status-line helper plugin by [AAAAAnson](https://github.com/AAAAAnson). It configures a compact status row below the input area with context, rolling usage, weekly usage, model, directory, and runtime state.

```text
Context 81% used | 5h 95% | weekly 57% | model xhigh fast | ~/repo | Ready
```

The default path is plugin-only: no Codex rebuild, no npm launcher patch, and no replacement binary copied into `@openai/codex`. That makes it survive Codex upgrades and avoids conflicts with launch-constrained helper apps such as Computer Use on macOS.

**What It Adds**
- A Codex plugin manifest and skill.
- A small npm CLI for configuring Codex's built-in TUI `status_line`.
- Context, short-window usage, weekly usage, model, directory, and run-state fields.
- A status check that warns when an old launcher patch is still installed.

**How It Works**
Codex Hub configures Codex's built-in status-line items:

```toml
[tui]
status_line = ["context-used", "five-hour-limit", "weekly-limit", "model-with-reasoning", "current-dir", "run-state"]
```

It does not scrape session logs. It uses the values Codex already exposes in the TUI.

**Requirements**
- Windows PowerShell or macOS Terminal.
- Node and npm.
- Codex installed through npm.

Install Codex through npm if you do not already have it:

```powershell
npm install -g @openai/codex
```

**Install With npm**
Install Codex Hub from npm:

```powershell
npm install -g codex-hub-cli
```

You can also install the latest GitHub source directly:

```powershell
npm install -g github:AAAAAnson/codex-hub
```

Configure the status line:

```powershell
codex-hub install
```

This command leaves the OpenAI-signed Codex launcher untouched and only updates your Codex config.

**Use**
Restart Codex:

```powershell
codex
```

The status line appears below the input box. If usage data is not available yet, wait for Codex to refresh account limit data or send a message to trigger fresh runtime data.

Check the local setup:

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
status_line = ["context-used", "five-hour-limit", "weekly-limit", "model-with-reasoning", "current-dir", "run-state"]
```

You can also run:

```powershell
codex-hub configure --safe-status-line
```

**Legacy Native HUD**
The old native HUD is still available as an explicit opt-in:

```bash
codex-hub install --patch-launcher --codex-source ~/src/codex-source
```

Legacy mode:

- Clones or reuses a Codex source checkout.
- Applies `patches/codex-hub.patch`.
- Builds `codex-cli`.
- Copies the built binary next to the npm-managed Codex binary as `codex-hub.exe` on Windows or `codex-hub` on macOS.
- Patches the npm launcher to prefer the Codex Hub binary.

This mode may be overwritten by Codex upgrades. On macOS it can conflict with launch-constrained helper apps such as Computer Use because those helpers require an OpenAI-signed parent process.

**Uninstall**
If you only used plugin-only mode, remove the configured status line manually or edit it with `/statusline` in Codex.

If you previously used legacy native mode, restore the launcher backup:

```powershell
codex-hub uninstall
```

If you want to remove the source patch from a custom Codex source checkout:

```powershell
codex-hub uninstall --codex-source C:\src\codex-source
```

**Validation**
Every push runs package checks on Windows and macOS. The safe path verifies the package and CLI without requiring a Codex source build.

**Author**
[AAAAAnson](https://github.com/AAAAAnson)

**Privacy**
Codex Hub does not add telemetry. Keep your own Codex config, auth files, and session logs out of this repository.

**Notes**
- Plugin-only mode is the supported default.
- Legacy native mode is an escape hatch for users who explicitly want `codex-hud`.
- This is an unofficial community package, not an OpenAI project.
