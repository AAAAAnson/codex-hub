#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: install.sh --codex-source <path> [--codex-npm-root <path>] [--binary-name <name>] [--release]
EOF
}

codex_source=""
codex_npm_root=""
binary_name="codex-hub"
release=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --codex-source)
      codex_source="${2:-}"
      shift 2
      ;;
    --codex-npm-root)
      codex_npm_root="${2:-}"
      shift 2
      ;;
    --binary-name)
      binary_name="${2:-}"
      shift 2
      ;;
    --release)
      release=1
      shift
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

if [[ -z "$codex_source" ]]; then
  echo "--codex-source is required" >&2
  usage >&2
  exit 2
fi

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/.." && pwd)"
patch_path="$repo_root/patches/codex-hub.patch"

if [[ ! -f "$patch_path" ]]; then
  echo "Patch not found: $patch_path" >&2
  exit 1
fi

codex_source="$(cd "$codex_source" && pwd)"
if [[ ! -d "$codex_source/codex-rs" ]]; then
  echo "Codex source does not look like a Codex checkout: $codex_source" >&2
  exit 1
fi

if [[ -z "$codex_npm_root" ]]; then
  npm_root="$(npm root -g)"
  codex_npm_root="$npm_root/@openai/codex"
fi

if [[ ! -d "$codex_npm_root" ]]; then
  echo "Codex npm package not found: $codex_npm_root" >&2
  exit 1
fi
codex_npm_root="$(cd "$codex_npm_root" && pwd)"

if git -C "$codex_source" apply --whitespace=nowarn --check "$patch_path" >/dev/null 2>&1; then
  git -C "$codex_source" apply --whitespace=nowarn "$patch_path"
  echo "Applied Codex Hub patch."
elif git -C "$codex_source" apply --whitespace=nowarn --reverse --check "$patch_path" >/dev/null 2>&1; then
  echo "Codex Hub patch is already applied."
else
  echo "Patch cannot be applied cleanly. Check your Codex source tree and current local changes." >&2
  exit 1
fi

if [[ -f "$codex_source/Cargo.toml" ]]; then
  cargo_root="$codex_source"
elif [[ -f "$codex_source/codex-rs/Cargo.toml" ]]; then
  cargo_root="$codex_source/codex-rs"
else
  echo "Could not find Codex Cargo workspace under: $codex_source" >&2
  exit 1
fi

profile="debug"
build_args=(build -p codex-cli)
if [[ "$release" -eq 1 ]]; then
  profile="release"
  build_args+=(--release)
fi

(cd "$cargo_root" && cargo "${build_args[@]}")

built_binary="$cargo_root/target/$profile/codex"
if [[ ! -f "$built_binary" ]]; then
  echo "Built Codex binary not found: $built_binary" >&2
  exit 1
fi

launcher_path="$codex_npm_root/bin/codex.js"
if [[ ! -f "$launcher_path" ]]; then
  echo "Codex npm launcher not found: $launcher_path" >&2
  exit 1
fi

vendor_binary="$(find "$codex_npm_root" -type f -path '*/vendor/*/codex/codex' -print -quit)"
if [[ -z "$vendor_binary" ]]; then
  echo "Could not find npm-managed Codex native binary under: $codex_npm_root" >&2
  exit 1
fi

target_binary="$(dirname "$vendor_binary")/$binary_name"
cp "$built_binary" "$target_binary"
chmod +x "$target_binary"

node "$repo_root/lib/patch-launcher.js" "$launcher_path" "codex-hub.exe" "$binary_name"

echo "Installed Codex Hub binary: $target_binary"
echo "Restart Codex after adding codex-hud to your [tui].status_line config."

