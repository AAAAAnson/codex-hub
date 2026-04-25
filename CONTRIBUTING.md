# Contributing to codex-hub

Thanks for your interest in helping improve codex-hub.

## Local development

```bash
git clone https://github.com/AAAAAnson/codex-hub
cd codex-hub
CODEX_HUB_SKIP_POSTINSTALL=1 npm install -g .   # don't touch your real Codex config
node ./bin/codex-hub.js configure --preset cockpit --dry-run
npm test
```

The `CODEX_HUB_SKIP_POSTINSTALL=1` env var prevents the postinstall step from rewriting your real `~/.codex/config.toml`. Use it whenever you run `npm install` against a development checkout.

## Don't commit your `~/.codex/` files

Your local `~/.codex/` directory contains sensitive data: API tokens in `auth.json`, your trusted project list and account metadata in `config.toml`, and full conversation transcripts under `sessions/*.jsonl`.

A normal `git add .` in a development checkout could accidentally include something from `~/.codex/` if you copied a file in for testing. The repo's `.gitignore` already excludes the obvious paths (`auth.json`, `sessions/`, `config.toml`, `.env`), but double-check `git status` before committing and never force-add an ignored file.

If you accidentally publish a token, **rotate it immediately** at https://platform.openai.com/api-keys (Codex auth) or your Anthropic console (any other tokens).

## Pull requests

- Run `npm test` before submitting (25+ unit tests).
- Don't ship code that mutates `~/.codex/config.toml` without a clear opt-in flag (`--force`, `--dry-run`, etc.).
- Match the existing CLI surface: `codex-hub configure`, `codex-hub status`, `codex-hub preview`, etc.
- Keep README translations (`README.zh.md`, `README.ja.md`, `README.ko.md`) in sync with `README.md` when changing user-facing behavior. Feature parity is more important than literal translation.

## Releasing

1. Bump `version` in `package.json` (semver: bug fix → patch, new flag → minor, breaking → major).
2. `npm test && npm pack --dry-run`.
3. Commit, tag `vX.Y.Z`, push main and tag.
4. `npm publish` (the package owner needs to authenticate; npm 2FA may require a browser flow).
5. Create a GitHub release with the changelog.
