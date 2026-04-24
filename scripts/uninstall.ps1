[CmdletBinding()]
param(
    [string]$CodexNpmRoot = (Join-Path $env:APPDATA "npm\node_modules\@openai\codex"),

    [string]$BinaryName = "codex-hub.exe"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $CodexNpmRoot)) {
    throw "Codex npm package not found: $CodexNpmRoot"
}

$vendorBinary = Get-ChildItem -LiteralPath $CodexNpmRoot -Recurse -File -Filter "codex.exe" |
    Where-Object { $_.FullName -like "*\vendor\*\codex\codex.exe" } |
    Select-Object -First 1

if ($vendorBinary) {
    $hudBinary = Join-Path $vendorBinary.Directory.FullName $BinaryName
    if (Test-Path -LiteralPath $hudBinary) {
        Remove-Item -LiteralPath $hudBinary
        Write-Host "Removed Codex Hub binary: $hudBinary"
    }
}

$launcherPath = Join-Path $CodexNpmRoot "bin\codex.js"
$backupPath = "$launcherPath.bak-codex-hub"
if (Test-Path -LiteralPath $backupPath) {
    Copy-Item -LiteralPath $backupPath -Destination $launcherPath -Force
    Write-Host "Restored Codex launcher backup."
}
