# codex-hub

Codex CLI status-line helper plugin by [AAAAAnson](https://github.com/AAAAAnson). It configures Codex's built-in `[tui].status_line` with curated presets (Full / Essential / Minimal) so you get a useful row below the input area without rebuilding Codex.

```text
Context 81% used | 5h 95% | weekly 57% | model xhigh fast | ~/repo | Ready
```

The default path is plugin-only: no Codex rebuild, no npm launcher patch, and no replacement binary copied into `@openai/codex`. That makes it survive Codex upgrades and avoids conflicts with launch-constrained helper apps such as Computer Use on macOS.

## How Codex's status_line differs from Claude Code's

If you're coming from [claude-hud](https://github.com/jarrodwatts/claude-hud), the API model is different and worth understanding up front:

| | Claude Code (`statusLine`) | Codex (`status_line`) |
|---|---|---|
| Interface | calls an external command, pipes JSON to stdin, renders stdout as ANSI | takes a list of named built-in items |
| Multi-line layout | yes, any ANSI | no, single line |
| Visual progress bars | yes (you draw them) | no |
| Tools / agents / todos lines | yes (parses transcript) | no |
| Color / threshold customization | yes | no |
| Path levels, time format, etc. | yes | no |

**Codex's plugin-only `status_line` is a fixed list of named items.** codex-hub helps you pick and order those items and keeps them stable across upgrades. It cannot draw a multi-line HUD or progress bars — that would require patching and rebuilding Codex (see *Legacy Native HUD* at the bottom).

## Built-in items codex-hub recognizes

```
context-used        five-hour-limit     weekly-limit
model-with-reasoning  current-dir       run-state
git-branch          codex-version       session-id
fast-mode           used-tokens         total-input-tokens
total-output-tokens
```

Run `codex-hub --list-items` to see the same list at the terminal.

## Presets

Pick by how much information you want to see at once. Each preset is a strict superset of the lighter one above it, so you can step up gradually.

| Preset | Items | Sample render |
|---|---|---|
| **minimal** | `model-with-reasoning, current-dir, run-state` | `gpt-5.5 xhigh fast · ~ · Ready` |
| **essential** *(default)* | + `context-used, five-hour-limit, weekly-limit` | `Context 41% used · 5h 79% · weekly 38% · gpt-5.5 xhigh fast · ~ · Ready` |
| **cockpit** | + `total-input-tokens, total-output-tokens, git-branch` | `Context 41% used · 27.2M in · 83K out · 5h 79% · weekly 38% · gpt-5.5 xhigh fast · main · ~ · Ready` |
| **full** | + `codex-version` | `Context 41% used · 27.2M in · 83K out · 5h 79% · weekly 38% · gpt-5.5 xhigh fast · v0.125.0 · main · ~ · Ready` |

Layout principle: budget axis (context + token counts + limits) → identity (model) → place (branch + cwd) → state. Items that overlap with `model-with-reasoning` (which already encodes fast-mode as a `fast` suffix) are deliberately omitted to avoid duplication.

Run `codex-hub --list-presets` to see the same listing.

Codex's rate-limit segments (`5h`, `weekly`) only render once Codex has fetched usage data, which happens on the first model response in a session. Until then those segments are blank by design.

## Install

Install Codex through npm if you do not already have it:

```bash
npm install -g @openai/codex
```

Then install codex-hub:

```bash
npm install -g codex-hub-cli
```

That single command installs the `codex-hub` CLI and, when no `[tui].status_line` exists yet in your `~/.codex/config.toml`, applies the **essential** preset. If you already have a custom `status_line`, codex-hub leaves it alone and tells you how to change it.

You can also install the latest GitHub source directly:

```bash
npm install -g github:AAAAAnson/codex-hub
```

To skip the postinstall step entirely, set `CODEX_HUB_SKIP_POSTINSTALL=1` during npm install and run `codex-hub configure` later.

## Use

Restart Codex:

```bash
codex
```

The status line appears below the input box. If usage data is not available yet, wait for Codex to refresh account limit data or send a message to trigger fresh runtime data.

## Configure

Pick a preset:

```bash
codex-hub configure --preset full
codex-hub configure --preset essential
codex-hub configure --preset minimal
```

Replace with an exact list:

```bash
codex-hub configure --items "context-used,model-with-reasoning,current-dir,run-state"
```

Adjust an existing list (preserves order):

```bash
codex-hub configure --add git-branch,codex-version
codex-hub configure --remove run-state
```

Preview without writing:

```bash
codex-hub configure --preset full --dry-run
codex-hub preview --preset full
```

By default codex-hub refuses to overwrite a non-empty existing `status_line`. Pass `--force` if you really want to replace it:

```bash
codex-hub configure --preset essential --force
```

## Status

Check the local setup:

```bash
codex-hub status
codex-hub status --json
```

The status output reports the current `status_line`, which preset (if any) it matches, whether the legacy launcher is patched, and whether old codex-hub processes are still running.

## Local development

When iterating on this repo locally, use the env var to skip postinstall touching your real config:

```bash
CODEX_HUB_SKIP_POSTINSTALL=1 npm install -g .
```

Or run the CLI directly without installing:

```bash
node ./bin/codex-hub.js status
node ./bin/codex-hub.js configure --preset full --dry-run
```

Run the unit tests:

```bash
npm test
```

## Legacy Native HUD

Before plugin-only mode existed, codex-hub patched Codex's Rust source to add a custom `codex-hud` status item, then rebuilt Codex and replaced the npm-bundled binary. That mode is still available as an explicit opt-in:

```bash
codex-hub install --patch-launcher --codex-source ~/src/codex-source
```

This mode:

- Clones or reuses a Codex source checkout.
- Applies `patches/codex-hub.patch`.
- Builds `codex-cli` (full Rust workspace, large download and build time).
- Copies the built binary next to the npm-managed Codex binary as `codex-hub.exe` on Windows or `codex-hub` on macOS.
- Patches the npm launcher to prefer the Codex Hub binary.

**On macOS this conflicts with launch-constrained helper apps such as Computer Use** — those helpers require an OpenAI-signed parent process and refuse to launch from the rebuilt binary. Every Codex upgrade also resets the npm launcher and the bundled binary, so legacy mode needs to be re-applied after each upgrade.

If you used legacy mode and want to undo it:

```bash
codex-hub uninstall                                # restore the npm launcher backup
codex-hub uninstall --codex-source ~/src/codex-source   # also reverse the source patch
```

## Validation

Every push runs package checks on Windows and macOS. The plugin-only path verifies the package and CLI without requiring a Codex source build. Unit tests run via `node --test`.

## Author

[AAAAAnson](https://github.com/AAAAAnson)

## Privacy

codex-hub does not add telemetry. Keep your own Codex config, auth files, and session logs out of this repository.

## Notes

- Plugin-only mode is the supported default.
- Legacy native mode is an escape hatch and is incompatible with macOS Computer Use.
- This is an unofficial community package, not an OpenAI project.
