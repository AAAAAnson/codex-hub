import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageRoot = path.resolve(__dirname, "..");

const STATUS_LINE =
  'status_line = ["codex-hud", "model-with-reasoning", "current-dir", "git-branch", "run-state"]';

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
  codex-hub install [--codex-source <path>] [--npm-root <path>] [--release] [--no-configure]
  codex-hub configure
  codex-hub status [--npm-root <path>] [--json]
  codex-hub uninstall [--codex-source <path>] [--npm-root <path>]

Commands:
  install     Clone or reuse Codex source, apply the HUD patch, build, install, and configure.
  configure   Add codex-hud to the Codex TUI status_line config.
  status      Show local Codex Hub installation status.
  uninstall   Remove the Codex Hub binary and restore the Codex npm launcher backup.

Default Codex source path:
  Windows: C:\\src\\codex-source
  macOS:   ~/src/codex-source
`);
}

function install(options) {
  requireCommand("git", ["--version"]);
  requireCommand("cargo", ["--version"]);

  const codexSource = path.resolve(
    options.codexSource || process.env.CODEX_HUB_CODEX_SOURCE || defaultCodexSourcePath(),
  );
  ensureCodexSource(codexSource);

  runPlatformInstaller(codexSource, options);

  if (options.configure) {
    configure(options);
  }
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

    run("bash", shArgs);
    return;
  }

  throw new Error(`install is not supported on ${process.platform} yet`);
}

function configure() {
  const configPath = codexConfigPath();
  const configDir = path.dirname(configPath);
  fs.mkdirSync(configDir, { recursive: true });

  if (!fs.existsSync(configPath)) {
    fs.writeFileSync(configPath, `[tui]\n${STATUS_LINE}\n`);
    console.log(`Configured Codex HUD: ${configPath}`);
    return;
  }

  const original = fs.readFileSync(configPath, "utf8");
  if (original.includes("codex-hud")) {
    console.log(`Codex HUD is already configured: ${configPath}`);
    return;
  }

  const updated = addStatusLine(original);
  if (updated === original) {
    throw new Error(`Could not update ${configPath}. Add this manually:\n[tui]\n${STATUS_LINE}`);
  }

  const backupPath = `${configPath}.bak-codex-hub`;
  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(configPath, backupPath);
  }
  fs.writeFileSync(configPath, updated);
  console.log(`Configured Codex HUD: ${configPath}`);
}

function addStatusLine(content) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const tuiStart = lines.findIndex((line) => line.trim() === "[tui]");

  if (tuiStart === -1) {
    const suffix = content.endsWith("\n") ? "" : "\n";
    return `${content}${suffix}\n[tui]\n${STATUS_LINE}\n`;
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
      const inner = match[2].trim();
      lines[i] = inner
        ? `${match[1]}["codex-hud", ${inner}]`
        : `${match[1]}["codex-hud"]`;
      return `${lines.join("\n").replace(/\n*$/, "")}\n`;
    }
  }

  lines.splice(tuiStart + 1, 0, STATUS_LINE);
  return `${lines.join("\n").replace(/\n*$/, "")}\n`;
}

function status(options) {
  const npmRoot = path.resolve(options.npmRoot || defaultCodexNpmRoot());
  const launcherPath = path.join(npmRoot, "bin", "codex.js");
  const configPath = codexConfigPath();
  const hudBinary = findHudBinary(npmRoot);

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
    configPath,
    configFound: fs.existsSync(configPath),
    configHasHud:
      fs.existsSync(configPath) && fs.readFileSync(configPath, "utf8").includes("codex-hud"),
  };

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
  console.log(`  config: ${info.configFound ? info.configPath : "missing"}`);
  console.log(`  config has codex-hud: ${info.configHasHud ? "yes" : "no"}`);
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
