[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$CodexSource,

    [string]$CodexNpmRoot = (Join-Path $env:APPDATA "npm\node_modules\@openai\codex"),

    [string]$BinaryName = "codex-hub.exe",

    [switch]$Release
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Resolve-ExistingPath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,

        [Parameter(Mandatory = $true)]
        [string]$Label
    )

    if (-not (Test-Path -LiteralPath $Path)) {
        throw "$Label not found: $Path"
    }

    return (Resolve-Path -LiteralPath $Path).Path
}

function Invoke-Checked {
    param(
        [Parameter(Mandatory = $true)]
        [string]$FilePath,

        [Parameter(Mandatory = $true)]
        [string[]]$Arguments
    )

    & $FilePath @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Command failed: $FilePath $($Arguments -join ' ')"
    }
}

function Test-GitApply {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Arguments
    )

    try {
        & git @Arguments > $null 2> $null
    } catch {
        return $false
    }

    return $LASTEXITCODE -eq 0
}

function Ensure-LauncherUsesCodexHub {
    param(
        [Parameter(Mandatory = $true)]
        [string]$LauncherPath,

        [Parameter(Mandatory = $true)]
        [string]$WindowsBinaryName
    )

    $content = Get-Content -LiteralPath $LauncherPath -Raw

    if ($content -notmatch 'import\s+\{\s*existsSync\s*\}\s+from\s+["''](?:node:)?fs["''];') {
        $content = $content -replace 'import \{ spawn \} from "node:child_process";', "import { spawn } from `"node:child_process`";`nimport { existsSync } from `"fs`";"
    }

    if ($content -match 'codexHubBinaryPath') {
        return
    }

    $nonWindowsBinaryName = [System.IO.Path]::GetFileNameWithoutExtension($WindowsBinaryName)
    $replacement = @"
const bundledBinaryPath = path.join(archRoot, "codex", codexBinaryName);
const codexHubBinaryName =
  process.platform === "win32" ? "$WindowsBinaryName" : "$nonWindowsBinaryName";
const codexHubBinaryPath = path.join(archRoot, "codex", codexHubBinaryName);
const binaryPath = existsSync(codexHubBinaryPath)
  ? codexHubBinaryPath
  : bundledBinaryPath;
"@

    $startMarker = "const bundledBinaryPath = path.join(archRoot, `"codex`", codexBinaryName);"
    $target = "$startMarker`nconst binaryPath = bundledBinaryPath;"
    $normalized = $content -replace "`r`n", "`n"

    if (-not (Test-Path -LiteralPath "$LauncherPath.bak-codex-hub")) {
        Copy-Item -LiteralPath $LauncherPath -Destination "$LauncherPath.bak-codex-hub"
    }

    if ($normalized.Contains($target)) {
        $normalized = $normalized.Replace($target, $replacement)
        Set-Content -LiteralPath $LauncherPath -Value $normalized -NoNewline
        return
    }

    $directTarget = "const binaryPath = path.join(archRoot, `"codex`", codexBinaryName);"
    if ($normalized.Contains($directTarget)) {
        $normalized = $normalized.Replace($directTarget, $replacement)
        Set-Content -LiteralPath $LauncherPath -Value $normalized -NoNewline
        return
    }

    $start = $normalized.IndexOf($startMarker)
    $endMarker = "// Use an asynchronous spawn instead of spawnSync"
    $end = if ($start -ge 0) { $normalized.IndexOf($endMarker, $start) } else { -1 }
    if ($start -ge 0 -and $end -gt $start) {
        $normalized =
            $normalized.Substring(0, $start) +
            $replacement +
            "`n" +
            $normalized.Substring($end)
        Set-Content -LiteralPath $LauncherPath -Value $normalized -NoNewline
        return
    }

    throw "Codex launcher shape was not recognized. Patch $LauncherPath manually to prefer $WindowsBinaryName."
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$patchPath = Join-Path $repoRoot "patches\codex-hub.patch"
if (-not (Test-Path -LiteralPath $patchPath)) {
    throw "Patch not found: $patchPath"
}

$CodexSource = Resolve-ExistingPath -Path $CodexSource -Label "Codex source"
$CodexNpmRoot = Resolve-ExistingPath -Path $CodexNpmRoot -Label "Codex npm package"

if (-not (Test-Path -LiteralPath (Join-Path $CodexSource "codex-rs"))) {
    throw "Codex source does not look like a Codex checkout: $CodexSource"
}

$cargoRoot = if (Test-Path -LiteralPath (Join-Path $CodexSource "Cargo.toml")) {
    $CodexSource
} elseif (Test-Path -LiteralPath (Join-Path $CodexSource "codex-rs\Cargo.toml")) {
    Join-Path $CodexSource "codex-rs"
} else {
    throw "Could not find Codex Cargo workspace under: $CodexSource"
}

Push-Location $CodexSource
try {
    if (Test-GitApply -Arguments @("apply", "--whitespace=nowarn", "--check", $patchPath)) {
        Invoke-Checked -FilePath "git" -Arguments @("apply", "--whitespace=nowarn", $patchPath)
        Write-Host "Applied Codex Hub patch."
    } elseif (Test-GitApply -Arguments @("apply", "--whitespace=nowarn", "--reverse", "--check", $patchPath)) {
        Write-Host "Codex Hub patch is already applied."
    } else {
        throw "Patch cannot be applied cleanly. Check your Codex source tree and current local changes."
    }

    $profile = if ($Release) { "release" } else { "debug" }
    $buildArgs = @("build", "-p", "codex-cli")
    if ($Release) {
        $buildArgs += "--release"
    }

    Push-Location $cargoRoot
    try {
        Invoke-Checked -FilePath "cargo" -Arguments $buildArgs
    } finally {
        Pop-Location
    }

    $builtBinary = Join-Path $cargoRoot "target\$profile\codex.exe"
    if (-not (Test-Path -LiteralPath $builtBinary)) {
        throw "Built Codex binary not found: $builtBinary"
    }
} finally {
    Pop-Location
}

$launcherPath = Join-Path $CodexNpmRoot "bin\codex.js"
if (-not (Test-Path -LiteralPath $launcherPath)) {
    throw "Codex npm launcher not found: $launcherPath"
}

$vendorBinary = Get-ChildItem -LiteralPath $CodexNpmRoot -Recurse -File -Filter "codex.exe" |
    Where-Object { $_.FullName -like "*\vendor\*\codex\codex.exe" } |
    Select-Object -First 1

if (-not $vendorBinary) {
    throw "Could not find npm-managed Codex native binary under: $CodexNpmRoot"
}

$targetBinary = Join-Path $vendorBinary.Directory.FullName $BinaryName
Copy-Item -LiteralPath $builtBinary -Destination $targetBinary -Force
Ensure-LauncherUsesCodexHub -LauncherPath $launcherPath -WindowsBinaryName $BinaryName

Write-Host "Installed Codex Hub binary: $targetBinary"
Write-Host "Restart Codex after adding codex-hud to your [tui].status_line config."
