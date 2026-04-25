import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageRoot = path.resolve(__dirname, "..");

const NATIVE_STATUS_LINE_ITEMS = [
  "codex-hud",
  "model-with-reasoning",
  "current-dir",
  "git-branch",
  "run-state",
];
const SIGNED_CODEX_STATUS_LINE_ITEMS = [
  "context-used",
  "five-hour-limit",
  "weekly-limit",
  "model-with-reasoning",
  "current-dir",
  "run-state",
];

export async function main(argv) {
  const { command, options } = parseArgs(argv.slice(2));

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
        options.safeStatusLine = true;
        break;
      case "--native-status-line":
        options.safeStatusLine = false;
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

function requireValue(args, index, option) {
  const value = args[index];
  if (!value || value.startsWith("-")) {
    throw new Error(`${option} requires a value`);
  }
  return value;
}

function printHelp() {
  console.log(`codex-hub

Usage:
  codex-hub install [--no-configure] [--patch-launcher] [--codex-source <path>] [--npm-root <path>] [--release]
  codex-hub configure [--safe-status-line|--native-status-line]
  codex-hub status [--npm-root <path>] [--json]
  codex-hub uninstall [--codex-source <path>] [--npm-root <path>]

Commands:
  install     Configure the plugin-only status line, or build the legacy native HUD with --patch-launcher.
  configure   Add Codex Hub or signed-Codex-safe items to the Codex TUI status_line config.
  status      Show local Codex Hub installation status.
  uninstall   Remove the Codex Hub binary and restore the Codex npm launcher backup.

Npm:
  npm install -g codex-hub-cli automatically runs the safe status-line configuration.
  Run codex-hub install later only to repair or reapply the configuration.

Default Codex source path:
  Windows: C:\\src\\codex-source
  macOS:   ~/src/codex-source
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

  try {
    configure({ safeStatusLine: true });
    console.log("Codex Hub is ready. Restart Codex to see the status line.");
  } catch (error) {
    console.warn(`codex-hub postinstall could not configure Codex: ${error.message}`);
    console.warn("Run `codex-hub install` after fixing the issue.");
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

function configure(options = {}) {
  const safeStatusLine = options.safeStatusLine ?? true;
  const statusLineItems = safeStatusLine
    ? SIGNED_CODEX_STATUS_LINE_ITEMS
    : NATIVE_STATUS_LINE_ITEMS;
  const statusLine = statusLineAssignment(statusLineItems);
  const label = safeStatusLine ? "signed-Codex status line" : "Codex HUD";
  const configPath = codexConfigPath();
  const configDir = path.dirname(configPath);
  fs.mkdirSync(configDir, { recursive: true });

  if (!fs.existsSync(configPath)) {
    fs.writeFileSync(configPath, `[tui]\n${statusLine}\n`);
    console.log(`Configured ${label}: ${configPath}`);
    return;
  }

  const original = fs.readFileSync(configPath, "utf8");
  if (statusLineConfigured(original, statusLineItems, safeStatusLine)) {
    console.log(`${label} is already configured: ${configPath}`);
    return;
  }

  const updated = addStatusLine(original, statusLineItems, safeStatusLine);
  if (updated === original) {
    throw new Error(`Could not update ${configPath}. Add this manually:\n[tui]\n${statusLine}`);
  }

  const backupPath = `${configPath}.bak-codex-hub`;
  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(configPath, backupPath);
  }
  fs.writeFileSync(configPath, updated);
  console.log(`Configured ${label}: ${configPath}`);
}

function statusLineAssignment(items) {
  return `status_line = ${formatTomlStringArray(items)}`;
}

function formatTomlStringArray(items) {
  return `[${items.map((item) => JSON.stringify(item)).join(", ")}]`;
}

function statusLineConfigured(content, statusLineItems, safeStatusLine = false) {
  const hasAllItems = statusLineItems.every((item) => content.includes(JSON.stringify(item)));
  if (!hasAllItems) {
    return false;
  }
  return !safeStatusLine || !content.includes("codex-hud");
}

function addStatusLine(content, statusLineItems, safeStatusLine = false) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const tuiStart = lines.findIndex((line) => line.trim() === "[tui]");

  if (tuiStart === -1) {
    const suffix = content.endsWith("\n") ? "" : "\n";
    return `${content}${suffix}\n[tui]\n${statusLineAssignment(statusLineItems)}\n`;
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
      const existingItems = parseTomlStringArrayItems(match[2]);
      if (existingItems == null) {
        return content;
      }
      const retainedItems = safeStatusLine
        ? existingItems.filter((item) => item !== "codex-hud")
        : existingItems;
      const mergedItems = [
        ...statusLineItems,
        ...retainedItems.filter((item) => !statusLineItems.includes(item)),
      ];
      lines[i] = `${match[1]}${formatTomlStringArray(mergedItems)}`;
      return `${lines.join("\n").replace(/\n*$/, "")}\n`;
    }
  }

  lines.splice(tuiStart + 1, 0, statusLineAssignment(statusLineItems));
  return `${lines.join("\n").replace(/\n*$/, "")}\n`;
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

function status(options) {
  const npmRoot = path.resolve(options.npmRoot || defaultCodexNpmRoot());
  const launcherPath = path.join(npmRoot, "bin", "codex.js");
  const configPath = codexConfigPath();
  const hudBinary = findHudBinary(npmRoot);
  const runningLegacyHudProcesses = findRunningLegacyHudProcesses();

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
    configFound: fs.existsSync(configPath),
    configHasHud:
      fs.existsSync(configPath) && fs.readFileSync(configPath, "utf8").includes("codex-hud"),
    configHasSignedCodexStatusLine:
      fs.existsSync(configPath) &&
      statusLineConfigured(
        fs.readFileSync(configPath, "utf8"),
        SIGNED_CODEX_STATUS_LINE_ITEMS,
        true,
      ),
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
  console.log(`  config has codex-hud: ${info.configHasHud ? "yes" : "no"}`);
  console.log(
    `  config has signed-Codex status line: ${info.configHasSignedCodexStatusLine ? "yes" : "no"}`,
  );
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
