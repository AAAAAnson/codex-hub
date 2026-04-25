import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageRoot = path.resolve(__dirname, "..");

// Codex's plugin-only `status_line` accepts a fixed list of named items.
// Confirmed from Codex's compiled binary string table.
export const ALL_BUILTIN_ITEMS = [
  "context-used",
  "five-hour-limit",
  "weekly-limit",
  "model-with-reasoning",
  "current-dir",
  "run-state",
  "git-branch",
  "codex-version",
  "session-id",
  "fast-mode",
  "used-tokens",
  "total-input-tokens",
  "total-output-tokens",
];

// Plugin-only presets. Inspired by claude-hud's Full / Essential / Minimal.
// Codex renders these in a single line; ordering is preserved as written.
export const PRESETS = {
  full: [
    "context-used",
    "five-hour-limit",
    "weekly-limit",
    "model-with-reasoning",
    "codex-version",
    "current-dir",
    "git-branch",
    "run-state",
  ],
  essential: [
    "context-used",
    "five-hour-limit",
    "weekly-limit",
    "model-with-reasoning",
    "current-dir",
    "run-state",
  ],
  minimal: ["model-with-reasoning", "current-dir", "run-state"],
};

export const DEFAULT_PRESET = "essential";

// Legacy native HUD items. Only renders correctly when Codex was rebuilt with
// the codex-hub Rust patch. Kept for users who already opted into that path.
const NATIVE_STATUS_LINE_ITEMS = [
  "codex-hud",
  "model-with-reasoning",
  "current-dir",
  "git-branch",
  "run-state",
];

export async function main(argv) {
  const { command, options } = parseArgs(argv.slice(2));

  if (options.listItems) {
    console.log(ALL_BUILTIN_ITEMS.join("\n"));
    return;
  }

  if (options.listPresets) {
    for (const [name, items] of Object.entries(PRESETS)) {
      console.log(`${name}: ${items.join(", ")}`);
    }
    return;
  }

  if (options.help || command === "help") {
    printHelp();
    return;
  }

  switch (command) {
    case "install":
      install(options);
      return;
    case "postinstall":
      postinstall();
      return;
    case "configure":
      configure(options);
      return;
    case "preview":
      preview(options);
      return;
    case "status":
    case "doctor":
      status(options);
      return;
    case "uninstall":
      uninstall(options);
      return;
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

function parseArgs(args) {
  let command = "help";
  const options = {
    configure: true,
  };

  if (args[0] && !args[0].startsWith("-")) {
    command = args.shift();
  }

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    switch (arg) {
      case "--help":
      case "-h":
        options.help = true;
        break;
      case "--codex-source":
        options.codexSource = requireValue(args, ++i, arg);
        break;
      case "--npm-root":
        options.npmRoot = requireValue(args, ++i, arg);
        break;
      case "--release":
        options.release = true;
        break;
      case "--no-configure":
        options.configure = false;
        break;
      case "--configure":
        options.configure = true;
        break;
      case "--patch-launcher":
        options.patchLauncher = true;
        break;
      case "--no-patch-launcher":
        options.patchLauncher = false;
        break;
      case "--safe-status-line":
        // Legacy alias for the default plugin-only preset.
        options.safeStatusLine = true;
        break;
      case "--native-status-line":
        // Legacy alias: only renders correctly with --patch-launcher.
        options.safeStatusLine = false;
        break;
      case "--preset":
        options.preset = requireValue(args, ++i, arg);
        break;
      case "--items":
        options.items = parseItemsList(requireValue(args, ++i, arg));
        break;
      case "--add":
        options.add = parseItemsList(requireValue(args, ++i, arg));
        break;
      case "--remove":
        options.remove = parseItemsList(requireValue(args, ++i, arg));
        break;
      case "--dry-run":
      case "--preview":
        options.dryRun = true;
        break;
      case "--force":
        options.force = true;
        break;
      case "--list-items":
        options.listItems = true;
        break;
      case "--list-presets":
        options.listPresets = true;
        break;
      case "--json":
        options.json = true;
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }

  return { command, options };
}

function parseItemsList(raw) {
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function requireValue(args, index, option) {
  const value = args[index];
  if (!value || value.startsWith("-")) {
    throw new Error(`${option} requires a value`);
  }
  return value;
}

function printHelp() {
  const presetSummary = Object.entries(PRESETS)
    .map(([name, items]) => `    ${name.padEnd(10)} ${items.join(", ")}`)
    .join("\n");

  console.log(`codex-hub
Codex CLI status-line helper.

Usage:
  codex-hub install [--no-configure] [--patch-launcher] [--codex-source <path>] [--npm-root <path>] [--release]
  codex-hub configure [--preset full|essential|minimal] [--items a,b,c] [--add a,b] [--remove c] [--dry-run] [--force]
  codex-hub preview [--preset ...]
  codex-hub status [--npm-root <path>] [--json]
  codex-hub uninstall [--codex-source <path>] [--npm-root <path>]
  codex-hub --list-items
  codex-hub --list-presets

Plugin-only presets (single-line, applied to ~/.codex/config.toml [tui].status_line):
${presetSummary}

Configure flags:
  --preset NAME       Replace status_line with one of the named presets above.
  --items a,b,c       Replace status_line with the exact list (comma-separated).
  --add a,b           Append items to the existing status_line, preserving order.
  --remove a,b        Remove items from the existing status_line.
  --dry-run           Print the resulting [tui].status_line without writing.
  --force             Overwrite an existing custom status_line. Default is to
                      leave a non-empty existing list untouched.

Legacy native HUD (rebuild Codex from source, conflicts with macOS Computer Use):
  codex-hub install --patch-launcher
  codex-hub configure --native-status-line

Environment:
  CODEX_HUB_SKIP_POSTINSTALL=1   Skip the postinstall configure step.
`);
}

function install(options) {
  const patchLauncher = shouldPatchLauncher(options);

  if (patchLauncher) {
    requireCommand("git", ["--version"]);
    requireCommand("cargo", ["--version"]);

    const codexSource = path.resolve(
      options.codexSource || process.env.CODEX_HUB_CODEX_SOURCE || defaultCodexSourcePath(),
    );
    ensureCodexSource(codexSource);

    runPlatformInstaller(codexSource, { ...options, patchLauncher });
  } else {
    console.log(
      "Leaving the OpenAI-signed Codex launcher untouched. Plugin-only mode survives Codex upgrades and avoids launch-constrained helper conflicts.",
    );
    console.log("Pass --patch-launcher to build and install the legacy native HUD binary.");
  }

  if (options.configure) {
    configure({
      ...options,
      safeStatusLine: options.safeStatusLine ?? !patchLauncher,
    });
  }
}

function postinstall() {
  if (isTruthyEnv(process.env.CODEX_HUB_SKIP_POSTINSTALL)) {
    console.log("codex-hub postinstall skipped by CODEX_HUB_SKIP_POSTINSTALL.");
    return;
  }

  if (!isGlobalPackageInstall()) {
    console.log("codex-hub postinstall skipped for local install.");
    return;
  }

  // Safety: do not silently overwrite a user's existing custom status_line.
  // Only auto-configure when the user has no [tui].status_line yet.
  const configPath = codexConfigPath();
  if (fs.existsSync(configPath)) {
    const content = fs.readFileSync(configPath, "utf8");
    const existing = parseStatusLine(content);
    if (existing && existing.length > 0) {
      console.log(
        `codex-hub: detected existing [tui].status_line in ${configPath}:`,
      );
      console.log(`  status_line = ${formatTomlStringArray(existing)}`);
      console.log(
        "Leaving it alone. Run `codex-hub configure --preset essential --force` to replace it,",
      );
      console.log(
        "or `codex-hub configure --add ...` / `--remove ...` to adjust it.",
      );
      return;
    }
  }

  try {
    configure({ preset: DEFAULT_PRESET });
    console.log("Codex Hub is ready. Restart Codex to see the status line.");
  } catch (error) {
    console.warn(`codex-hub postinstall could not configure Codex: ${error.message}`);
    console.warn("Run `codex-hub configure` after fixing the issue.");
    if (isTruthyEnv(process.env.CODEX_HUB_POSTINSTALL_REQUIRED)) {
      throw error;
    }
  }
}

function shouldPatchLauncher(options) {
  if (typeof options.patchLauncher === "boolean") {
    return options.patchLauncher;
  }
  return false;
}

function runPlatformInstaller(codexSource, options) {
  if (process.platform === "win32") {
    const psArgs = [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      path.join(packageRoot, "scripts", "install.ps1"),
      "-CodexSource",
      codexSource,
    ];

    if (options.npmRoot) {
      psArgs.push("-CodexNpmRoot", path.resolve(options.npmRoot));
    }
    if (options.release) {
      psArgs.push("-Release");
    }
    if (options.patchLauncher) {
      psArgs.push("-PatchLauncher");
    }

    run("powershell.exe", psArgs);
    return;
  }

  if (process.platform === "darwin") {
    const shArgs = [
      path.join(packageRoot, "scripts", "install.sh"),
      "--codex-source",
      codexSource,
    ];

    if (options.npmRoot) {
      shArgs.push("--codex-npm-root", path.resolve(options.npmRoot));
    }
    if (options.release) {
      shArgs.push("--release");
    }
    if (options.patchLauncher) {
      shArgs.push("--patch-launcher");
    } else {
      shArgs.push("--no-patch-launcher");
    }

    run("bash", shArgs);
    return;
  }

  throw new Error(`install is not supported on ${process.platform} yet`);
}

// Resolve the desired status_line from CLI options, possibly composed against
// the existing config. Returns { items, action, label } or null if no change.
export function resolveDesiredItems(options, existing) {
  // Explicit native HUD path (legacy patch).
  if (options.safeStatusLine === false) {
    return {
      items: NATIVE_STATUS_LINE_ITEMS,
      action: "replace",
      label: "Codex HUD (legacy native)",
    };
  }

  if (options.items) {
    validateItems(options.items, { allowCodexHud: false });
    return { items: options.items, action: "replace", label: "custom items" };
  }

  if (options.preset) {
    const items = PRESETS[options.preset];
    if (!items) {
      throw new Error(
        `Unknown preset "${options.preset}". Valid: ${Object.keys(PRESETS).join(", ")}`,
      );
    }
    return { items, action: "replace", label: `preset "${options.preset}"` };
  }

  if (options.add || options.remove) {
    const base = existing && existing.length > 0 ? [...existing] : [...PRESETS[DEFAULT_PRESET]];
    let next = base;
    if (options.add) {
      validateItems(options.add, { allowCodexHud: false });
      next = appendUnique(next, options.add);
    }
    if (options.remove) {
      next = next.filter((item) => !options.remove.includes(item));
    }
    return { items: next, action: "patch", label: "incremental update" };
  }

  // Backward-compat: --safe-status-line with no preset/items applies the
  // default preset, but only replaces an existing list when --force is set.
  if (options.safeStatusLine !== undefined) {
    return {
      items: PRESETS[DEFAULT_PRESET],
      action: "replace",
      label: `preset "${DEFAULT_PRESET}"`,
    };
  }

  return null;
}

function validateItems(items, { allowCodexHud }) {
  const allowed = new Set(ALL_BUILTIN_ITEMS);
  if (allowCodexHud) {
    allowed.add("codex-hud");
  }
  const unknown = items.filter((item) => !allowed.has(item));
  if (unknown.length > 0) {
    throw new Error(
      `Unknown status_line item(s): ${unknown.join(", ")}. ` +
        `Run \`codex-hub --list-items\` to see the supported set.`,
    );
  }
}

function appendUnique(base, additions) {
  const result = [...base];
  for (const item of additions) {
    if (!result.includes(item)) {
      result.push(item);
    }
  }
  return result;
}

function configure(options = {}) {
  const configPath = codexConfigPath();
  const existing = fs.existsSync(configPath) ? parseStatusLine(fs.readFileSync(configPath, "utf8")) : null;

  const resolved = resolveDesiredItems(options, existing) ?? {
    items: PRESETS[DEFAULT_PRESET],
    action: "replace",
    label: `preset "${DEFAULT_PRESET}"`,
  };

  if (options.dryRun) {
    console.log(`# dry run — would write to ${configPath}`);
    console.log(`[tui]`);
    console.log(statusLineAssignment(resolved.items));
    return;
  }

  // Refuse to overwrite a non-empty existing list on a "replace" action unless
  // the resolved list already matches it, the caller passed --force, or the
  // existing list is the legacy codex-hud one (which we know how to migrate).
  if (
    resolved.action === "replace" &&
    existing &&
    existing.length > 0 &&
    !options.force &&
    !arraysEqual(existing, resolved.items) &&
    !existing.includes("codex-hud")
  ) {
    console.log(
      `codex-hub: ${configPath} already has a custom status_line:`,
    );
    console.log(`  status_line = ${formatTomlStringArray(existing)}`);
    console.log(`Refusing to replace. Pass --force to overwrite, or use --add / --remove.`);
    return;
  }

  writeStatusLine(configPath, resolved.items);
  console.log(`Configured ${resolved.label}: ${configPath}`);
  console.log(`  status_line = ${formatTomlStringArray(resolved.items)}`);
}

function preview(options = {}) {
  const configPath = codexConfigPath();
  const existing = fs.existsSync(configPath) ? parseStatusLine(fs.readFileSync(configPath, "utf8")) : null;
  const resolved = resolveDesiredItems(options, existing) ?? {
    items: existing && existing.length > 0 ? existing : PRESETS[DEFAULT_PRESET],
    action: "preview",
    label: existing ? "current" : `preset "${DEFAULT_PRESET}"`,
  };

  console.log(`# preview — ${resolved.label}`);
  console.log(`[tui]`);
  console.log(statusLineAssignment(resolved.items));
}

function writeStatusLine(configPath, items) {
  const configDir = path.dirname(configPath);
  fs.mkdirSync(configDir, { recursive: true });

  if (!fs.existsSync(configPath)) {
    fs.writeFileSync(configPath, `[tui]\n${statusLineAssignment(items)}\n`);
    return;
  }

  const original = fs.readFileSync(configPath, "utf8");
  const updated = setStatusLine(original, items);
  if (updated === original) {
    return;
  }

  const backupPath = `${configPath}.bak-codex-hub`;
  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(configPath, backupPath);
  }
  fs.writeFileSync(configPath, updated);
}

function statusLineAssignment(items) {
  return `status_line = ${formatTomlStringArray(items)}`;
}

function formatTomlStringArray(items) {
  return `[${items.map((item) => JSON.stringify(item)).join(", ")}]`;
}

// Replace the [tui].status_line in `content` with `items`. Adds the section /
// key if missing. Preserves all other content and trailing newlines.
export function setStatusLine(content, items) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const tuiStart = lines.findIndex((line) => line.trim() === "[tui]");

  if (tuiStart === -1) {
    const suffix = content.endsWith("\n") ? "" : "\n";
    return `${content}${suffix}\n[tui]\n${statusLineAssignment(items)}\n`;
  }

  let sectionEnd = lines.length;
  for (let i = tuiStart + 1; i < lines.length; i += 1) {
    if (/^\s*\[[^\]]+\]\s*$/.test(lines[i])) {
      sectionEnd = i;
      break;
    }
  }

  for (let i = tuiStart + 1; i < sectionEnd; i += 1) {
    if (/^\s*status_line\s*=/.test(lines[i])) {
      const match = lines[i].match(/^(\s*status_line\s*=\s*)\[(.*)\]\s*$/);
      if (!match) {
        return content;
      }
      lines[i] = `${match[1]}${formatTomlStringArray(items)}`;
      return `${lines.join("\n").replace(/\n*$/, "")}\n`;
    }
  }

  lines.splice(tuiStart + 1, 0, statusLineAssignment(items));
  return `${lines.join("\n").replace(/\n*$/, "")}\n`;
}

// Returns the items currently configured in [tui].status_line, or null if
// the section/key is missing.
export function parseStatusLine(content) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const tuiStart = lines.findIndex((line) => line.trim() === "[tui]");
  if (tuiStart === -1) {
    return null;
  }

  let sectionEnd = lines.length;
  for (let i = tuiStart + 1; i < lines.length; i += 1) {
    if (/^\s*\[[^\]]+\]\s*$/.test(lines[i])) {
      sectionEnd = i;
      break;
    }
  }

  for (let i = tuiStart + 1; i < sectionEnd; i += 1) {
    const match = lines[i].match(/^\s*status_line\s*=\s*\[(.*)\]\s*$/);
    if (match) {
      return parseTomlStringArrayItems(match[1]);
    }
  }

  return null;
}

function parseTomlStringArrayItems(inner) {
  const items = [];
  const stringPattern = /"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)'/g;
  let match;
  while ((match = stringPattern.exec(inner)) != null) {
    items.push(JSON.parse(`"${(match[1] ?? match[2]).replace(/"/g, '\\"')}"`));
  }
  return items;
}

function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

function detectPreset(items) {
  if (!items) return null;
  for (const [name, presetItems] of Object.entries(PRESETS)) {
    if (arraysEqual(items, presetItems)) {
      return name;
    }
  }
  return null;
}

function status(options) {
  const npmRoot = path.resolve(options.npmRoot || defaultCodexNpmRoot());
  const launcherPath = path.join(npmRoot, "bin", "codex.js");
  const configPath = codexConfigPath();
  const hudBinary = findHudBinary(npmRoot);
  const runningLegacyHudProcesses = findRunningLegacyHudProcesses();

  const configContent = fs.existsSync(configPath) ? fs.readFileSync(configPath, "utf8") : null;
  const items = configContent != null ? parseStatusLine(configContent) : null;
  const preset = detectPreset(items);
  const unknownItems =
    items != null
      ? items.filter((item) => !ALL_BUILTIN_ITEMS.includes(item) && item !== "codex-hud")
      : [];

  const info = {
    packageRoot,
    npmRoot,
    launcherPath,
    launcherFound: fs.existsSync(launcherPath),
    launcherPatched:
      fs.existsSync(launcherPath) &&
      fs.readFileSync(launcherPath, "utf8").includes("codexHubBinaryPath"),
    hudBinary,
    hudBinaryFound: Boolean(hudBinary && fs.existsSync(hudBinary)),
    runningLegacyHudProcesses,
    configPath,
    configFound: configContent != null,
    statusLineItems: items,
    statusLinePreset: preset,
    statusLineHasCodexHud: items != null && items.includes("codex-hud"),
    unknownStatusLineItems: unknownItems,
  };
  info.restartRequired = runningLegacyHudProcesses.length > 0;
  info.macosLaunchConstraintRisk =
    process.platform === "darwin" && (info.launcherPatched || info.restartRequired);

  if (options.json) {
    console.log(JSON.stringify(info, null, 2));
    return;
  }

  console.log("Codex Hub status");
  console.log(`  package: ${info.packageRoot}`);
  console.log(`  Codex npm root: ${info.npmRoot}`);
  console.log(`  launcher: ${info.launcherFound ? "found" : "missing"}`);
  console.log(`  launcher patched: ${info.launcherPatched ? "yes" : "no"}`);
  console.log(`  HUD binary: ${info.hudBinaryFound ? info.hudBinary : "missing"}`);
  console.log(
    `  running legacy HUD processes: ${
      info.runningLegacyHudProcesses.length > 0
        ? info.runningLegacyHudProcesses.map((processInfo) => processInfo.pid).join(", ")
        : "none"
    }`,
  );
  console.log(`  config: ${info.configFound ? info.configPath : "missing"}`);
  if (info.statusLineItems != null) {
    console.log(`  status_line: ${formatTomlStringArray(info.statusLineItems)}`);
    console.log(`  status_line preset: ${info.statusLinePreset ?? "(custom)"}`);
  } else {
    console.log(`  status_line: (not configured)`);
  }
  if (info.statusLineHasCodexHud && !info.launcherPatched) {
    console.log(
      "  warning: status_line includes \"codex-hud\" but the launcher is not patched; Codex will warn about an unknown item",
    );
  }
  if (info.unknownStatusLineItems.length > 0) {
    console.log(
      `  warning: unknown status_line item(s): ${info.unknownStatusLineItems.join(", ")}`,
    );
  }
  if (info.launcherPatched) {
    console.log(
      "  warning: patched launcher can break launch-constrained macOS helpers such as Computer Use",
    );
  }
  if (info.restartRequired) {
    console.log(
      "  warning: old codex-hub sessions can still break Computer Use; exit them and start `codex` again",
    );
  }
}

function findRunningLegacyHudProcesses() {
  if (process.platform === "win32") {
    return [];
  }

  const result = spawnSync("ps", ["-axo", "pid=,ppid=,args="], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  if (result.error || result.status !== 0) {
    return [];
  }

  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(\d+)\s+(\d+)\s+(.+)$/);
      if (!match) {
        return null;
      }
      return {
        pid: Number(match[1]),
        ppid: Number(match[2]),
        command: match[3],
      };
    })
    .filter(Boolean)
    .filter((processInfo) => {
      const executable = processInfo.command.split(/\s+/)[0];
      return /(^|\/)codex-hub(?:\.exe)?$/.test(executable);
    });
}

function uninstall(options) {
  runPlatformUninstaller(options);

  const codexSource = options.codexSource
    ? path.resolve(options.codexSource)
    : defaultCodexSourcePath();
  const patchPath = path.join(packageRoot, "patches", "codex-hub.patch");

  if (fs.existsSync(path.join(codexSource, ".git"))) {
    const reverseCheck = spawnSync("git", [
      "-C",
      codexSource,
      "apply",
      "--whitespace=nowarn",
      "--reverse",
      "--check",
      patchPath,
    ]);
    if (reverseCheck.status === 0) {
      run("git", [
        "-C",
        codexSource,
        "apply",
        "--whitespace=nowarn",
        "--reverse",
        patchPath,
      ]);
      console.log(`Removed Codex Hub source patch: ${codexSource}`);
    }
  }
}

function runPlatformUninstaller(options) {
  if (process.platform === "win32") {
    const psArgs = [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      path.join(packageRoot, "scripts", "uninstall.ps1"),
    ];

    if (options.npmRoot) {
      psArgs.push("-CodexNpmRoot", path.resolve(options.npmRoot));
    }

    run("powershell.exe", psArgs);
    return;
  }

  if (process.platform === "darwin") {
    const shArgs = [path.join(packageRoot, "scripts", "uninstall.sh")];

    if (options.npmRoot) {
      shArgs.push("--codex-npm-root", path.resolve(options.npmRoot));
    }

    run("bash", shArgs);
    return;
  }

  throw new Error(`uninstall is not supported on ${process.platform} yet`);
}

function ensureCodexSource(codexSource) {
  if (fs.existsSync(path.join(codexSource, ".git"))) {
    console.log(`Using Codex source: ${codexSource}`);
    return;
  }

  if (fs.existsSync(codexSource)) {
    throw new Error(`Codex source exists but is not a git checkout: ${codexSource}`);
  }

  fs.mkdirSync(path.dirname(codexSource), { recursive: true });
  console.log(`Cloning Codex source into ${codexSource}`);
  run("git", [
    "-c",
    "core.longpaths=true",
    "clone",
    "https://github.com/openai/codex.git",
    codexSource,
  ]);
}

function defaultCodexSourcePath() {
  if (process.platform === "win32") {
    const drive = process.env.SystemDrive || "C:";
    return path.join(`${drive}\\`, "src", "codex-source");
  }
  return path.join(os.homedir(), "src", "codex-source");
}

function defaultCodexNpmRoot() {
  const npmRoot = npmGlobalRoot();
  if (npmRoot) {
    return path.join(npmRoot, "@openai", "codex");
  }

  if (process.platform === "win32") {
    if (!process.env.APPDATA) {
      throw new Error("APPDATA is not set; pass --npm-root");
    }
    return path.join(process.env.APPDATA, "npm", "node_modules", "@openai", "codex");
  }
  return path.join(os.homedir(), ".npm-global", "lib", "node_modules", "@openai", "codex");
}

function npmGlobalRoot() {
  const result = spawnSync("npm", ["root", "-g"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });

  if (result.error || result.status !== 0) {
    return null;
  }

  const root = result.stdout.trim();
  return root || null;
}

function isGlobalPackageInstall() {
  if (isTruthyEnv(process.env.npm_config_global)) {
    return true;
  }

  const globalRoot = npmGlobalRoot();
  return Boolean(globalRoot && isSubpath(packageRoot, globalRoot));
}

function isSubpath(childPath, parentPath) {
  const child = normalizePathForComparison(childPath);
  const parent = normalizePathForComparison(parentPath);
  const relative = path.relative(parent, child);
  return (
    relative === "" ||
    (relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative))
  );
}

function normalizePathForComparison(value) {
  const resolved = path.resolve(value);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

function isTruthyEnv(value) {
  return /^(1|true|yes)$/i.test(value || "");
}

function codexConfigPath() {
  return path.join(os.homedir(), ".codex", "config.toml");
}

function findHudBinary(npmRoot) {
  if (!fs.existsSync(npmRoot)) {
    return null;
  }

  const stack = [npmRoot];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (entry.name === "codex-hub.exe" || entry.name === "codex-hub") {
        return fullPath;
      }
    }
  }
  return null;
}

function requireCommand(command, args) {
  const result = spawnSync(command, args, { stdio: "ignore" });
  if (result.error || result.status !== 0) {
    throw new Error(`${command} is required but was not found in PATH`);
  }
}

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: false,
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(" ")}`);
  }
}
