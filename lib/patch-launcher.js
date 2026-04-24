#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function patchLauncher(launcherPath, windowsBinaryName, posixBinaryName) {
  let content = fs.readFileSync(launcherPath, "utf8");

  if (!/import\s+\{\s*existsSync\s*\}\s+from\s+["'](?:node:)?fs["'];/.test(content)) {
    content = content.replace(
      'import { spawn } from "node:child_process";',
      'import { spawn } from "node:child_process";\nimport { existsSync } from "fs";',
    );
  }

  if (content.includes("codexHubBinaryPath")) {
    return false;
  }

  const replacement = `const bundledBinaryPath = path.join(archRoot, "codex", codexBinaryName);
const codexHubBinaryName =
  process.platform === "win32" ? "${windowsBinaryName}" : "${posixBinaryName}";
const codexHubBinaryPath = path.join(archRoot, "codex", codexHubBinaryName);
const binaryPath = existsSync(codexHubBinaryPath)
  ? codexHubBinaryPath
  : bundledBinaryPath;`;

  const normalized = content.replace(/\r\n/g, "\n");
  const directTarget = 'const binaryPath = path.join(archRoot, "codex", codexBinaryName);';
  const oldTarget =
    'const bundledBinaryPath = path.join(archRoot, "codex", codexBinaryName);\nconst binaryPath = bundledBinaryPath;';
  const startMarker = 'const bundledBinaryPath = path.join(archRoot, "codex", codexBinaryName);';
  const endMarker = "// Use an asynchronous spawn instead of spawnSync";

  let updated = null;
  if (normalized.includes(oldTarget)) {
    updated = normalized.replace(oldTarget, replacement);
  } else if (normalized.includes(directTarget)) {
    updated = normalized.replace(directTarget, replacement);
  } else {
    const start = normalized.indexOf(startMarker);
    const end = start >= 0 ? normalized.indexOf(endMarker, start) : -1;
    if (start >= 0 && end > start) {
      updated = `${normalized.slice(0, start)}${replacement}\n${normalized.slice(end)}`;
    }
  }

  if (updated == null) {
    throw new Error(`Codex launcher shape was not recognized: ${launcherPath}`);
  }

  const backupPath = `${launcherPath}.bak-codex-hub`;
  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(launcherPath, backupPath);
  }
  fs.writeFileSync(launcherPath, updated);
  return true;
}

if (path.resolve(process.argv[1] || "") === fileURLToPath(import.meta.url)) {
  const [, , launcherPath, windowsBinaryName = "codex-hub.exe", posixBinaryName = "codex-hub"] =
    process.argv;

  if (!launcherPath) {
    console.error("Usage: patch-launcher.js <launcherPath> [windowsBinaryName] [posixBinaryName]");
    process.exit(2);
  }

  patchLauncher(launcherPath, windowsBinaryName, posixBinaryName);
}
