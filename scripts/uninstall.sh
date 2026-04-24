#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: uninstall.sh [--codex-npm-root <path>] [--binary-name <name>]
EOF
}

codex_npm_root=""
binary_name="codex-hub"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --codex-npm-root)
      codex_npm_root="${2:-}"
      shift 2
      ;;
    --binary-name)
      binary_name="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if [[ -z "$codex_npm_root" ]]; then
  npm_root="$(npm root -g)"
  codex_npm_root="$npm_root/@openai/codex"
fi

if [[ ! -d "$codex_npm_root" ]]; then
  echo "Codex npm package not found: $codex_npm_root" >&2
  exit 1
fi
codex_npm_root="$(cd "$codex_npm_root" && pwd)"

hud_binary="$(find "$codex_npm_root" -type f -path "*/vendor/*/codex/$binary_name" -print -quit)"
if [[ -n "$hud_binary" ]]; then
  rm -f "$hud_binary"
  echo "Removed Codex Hub binary: $hud_binary"
fi

launcher_path="$codex_npm_root/bin/codex.js"
backup_path="$launcher_path.bak-codex-hub"
if [[ -f "$backup_path" ]]; then
  cp "$backup_path" "$launcher_path"
  echo "Restored Codex launcher backup."
fi

