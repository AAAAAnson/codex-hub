# codex-hub

[English](README.md) · [简体中文](https://github.com/AAAAAnson/codex-hub/blob/main/README.zh.md) · [日本語](https://github.com/AAAAAnson/codex-hub/blob/main/README.ja.md) · [한국어](https://github.com/AAAAAnson/codex-hub/blob/main/README.ko.md)

A status-line preset manager for OpenAI's Codex CLI. Pick a curated `[tui].status_line` layout, switch between presets, and survive Codex upgrades.

```text
Context 41% used · 27.2M in · 83K out · 5h 79% · weekly 38% · gpt-5.5 xhigh fast · main · ~ · Ready
```

## Why

Codex configures its TUI status row through `[tui].status_line` in `~/.codex/config.toml` — a list of named built-in items that Codex renders on a single line. It works, but choosing the right items in the right order is fiddly, and `npm install -g codex-hub-cli` should just give you a sensible default.

codex-hub does three things:

1. Ships four curated presets (`minimal`, `essential`, `cockpit`, `full`) with a layout designed for at-a-glance scanning.
2. Adds CLI commands to switch, preview, merge, and list status-line items.
3. Keeps a postinstall safety net so it never overwrites a custom `status_line` you already set up.

## How does it differ from claude-hud?

Codex's `status_line` accepts a **fixed list of named items**, not an external command (which is what Claude Code's `statusLine` API takes). That has hard consequences:

| | claude-hud (Claude Code) | codex-hub (Codex) |
|---|---|---|
| Interface | external command, ANSI stdout | named-item list |
| Multi-line layout | yes | no, single line |
| Visual progress bars `████░░` | yes | no — glyphs aren't shipped in Codex |
| Tools / agents / todos lines | yes (parses transcript) | no |
| Color / threshold customization | yes | no |

For progress bars and richer rendering, Codex would need to be rebuilt from source — see [Legacy native HUD](#legacy-native-hud). For everyone else, the four presets cover the useful range.

## Install

You need [Codex](https://github.com/openai/codex):

```bash
npm install -g @openai/codex
```

Then install codex-hub:

```bash
npm install -g codex-hub-cli
```

The postinstall step applies the **essential** preset to your `~/.codex/config.toml` *only* if you don't already have a `[tui].status_line`. Custom layouts you already wrote are left alone.

Restart Codex:

```bash
codex
```

The status row appears below the input box. Rate-limit segments (`5h`, `weekly`) only render after Codex has fetched usage data, which happens on the first model response in a session.

## Presets

Each preset is a strict superset of the lighter one above it, so you can step up gradually.

| Preset | Sample render |
|---|---|
| **minimal** | `gpt-5.5 xhigh fast · ~ · Ready` |
| **essential** *(default)* | `Context 41% · 5h 79% · weekly 38% · gpt-5.5 xhigh fast · ~ · Ready` |
| **cockpit** | `Context 41% · 27.2M in · 83K out · 5h 79% · weekly 38% · gpt-5.5 xhigh fast · main · ~ · Ready` |
| **full** | `Context 41% · 27.2M in · 83K out · 5h 79% · weekly 38% · gpt-5.5 xhigh fast · v0.125.0 · main · ~ · Ready` |

Layout principle: budget (context + tokens + limits) → identity (model) → place (branch + cwd) → state. `fast-mode` is intentionally absent from every preset because `model-with-reasoning` already encodes it as a `fast` suffix.

```bash
codex-hub configure --preset cockpit
codex-hub configure --preset full --force      # replace an existing custom layout
codex-hub configure --preset full --dry-run    # preview without writing
codex-hub --list-presets                       # print all presets
```

## Custom layouts

If none of the presets fit, compose your own from the supported items:

```bash
codex-hub --list-items
# context-used  five-hour-limit  weekly-limit  model-with-reasoning
# current-dir   run-state        git-branch    codex-version
# session-id    fast-mode        used-tokens   total-input-tokens
# total-output-tokens

codex-hub configure --items "context-used,run-state"
codex-hub configure --add git-branch,codex-version    # append to existing
codex-hub configure --remove run-state                # remove from existing
```

By default codex-hub refuses to overwrite a non-empty existing `status_line`. Pass `--force` when you want to.

## Status

```bash
codex-hub status
codex-hub status --json
```

Reports the current `status_line`, which preset (if any) it matches, whether the legacy launcher is patched, and whether stale codex-hub processes are still running.

## All commands

```
codex-hub configure [--preset NAME] [--items a,b,c] [--add a,b] [--remove c] [--dry-run] [--force]
codex-hub preview [--preset NAME]
codex-hub status [--json]
codex-hub uninstall
codex-hub --list-presets
codex-hub --list-items
```

## Local development

```bash
git clone https://github.com/AAAAAnson/codex-hub
cd codex-hub
CODEX_HUB_SKIP_POSTINSTALL=1 npm install -g .    # don't touch your real config

node ./bin/codex-hub.js configure --preset cockpit --dry-run
npm test
```

## Legacy native HUD

Before plugin-only mode existed, codex-hub patched Codex's Rust source to add a custom `codex-hud` item, then rebuilt Codex and replaced the npm-bundled binary. That mode is still available as an explicit opt-in but **breaks macOS Computer Use** (the helper requires an OpenAI-signed parent process) and is overwritten by every Codex upgrade:

```bash
codex-hub install --patch-launcher --codex-source ~/src/codex-source
```

To undo:

```bash
codex-hub uninstall                                       # restore launcher backup
codex-hub uninstall --codex-source ~/src/codex-source     # also reverse the source patch
```

## License

MIT — see [LICENSE](LICENSE).

## Privacy

codex-hub does not add telemetry. Keep your own Codex config, auth files, and session logs out of this repository.

## Notes

- This is an unofficial community package, not an OpenAI project.
- `Codex` and `OpenAI` are trademarks of OpenAI.
