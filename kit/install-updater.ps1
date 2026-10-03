# =====================================================================
#  Lab notebook kit: one-time install of the Lab Kit plugin (updater)
# ---------------------------------------------------------------------
#  Copies the 3 plugin files from this kit folder into your vault's
#  .obsidian\plugins\lab-calc\ folder (replacing the old ones).
#  Nothing else in your vault is touched.
#
#  Run: right-click this file → "Run with PowerShell"
#  or in PowerShell:  powershell -ExecutionPolicy Bypass -File .\install-updater.ps1
# =====================================================================

$ErrorActionPreference = "Stop"
$kitDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$src    = Join-Path $kitDir ".obsidian\plugins\lab-kit"
$files  = @("main.js", "manifest.json", "styles.css")

Write-Host "Lab notebook kit: install the updater" -ForegroundColor Cyan
Write-Host "-------------------------------------"

foreach ($f in $files) {
    if (-not (Test-Path (Join-Path $src $f))) {
        Write-Host "Can't find $src\$f. Run this script from inside the kit folder." -ForegroundColor Red
        Read-Host "Press Enter to close"; exit 1
    }
}

while ($true) {
    $vault = (Read-Host "Vault folder (the one that contains .obsidian)").Trim().Trim('"')
    if ($vault -and (Test-Path (Join-Path $vault ".obsidian") -PathType Container)) { break }
    Write-Host "  No .obsidian folder in: $vault" -ForegroundColor Yellow
    Write-Host "  Pick the vault's top folder: the one you chose when you opened the vault in Obsidian."
}

$dest = Join-Path $vault ".obsidian\plugins\lab-calc"
Write-Host ""
Write-Host "Will copy $($files -join ', ')"
Write-Host "  from: $src"
Write-Host "  to:   $dest"
$ok = Read-Host "Go ahead? [y/N]"
if ($ok -notmatch '^(y|yes)$') { Write-Host "Cancelled, nothing changed."; Read-Host "Press Enter to close"; exit 0 }

New-Item -ItemType Directory -Force -Path $dest | Out-Null
foreach ($f in $files) { Copy-Item -Force (Join-Path $src $f) (Join-Path $dest $f) }

Write-Host ""
Write-Host "Done. Now in Obsidian:" -ForegroundColor Green
Write-Host "  1. Settings > Community plugins > turn Lab Calc off and on (it's now 'Lab Kit')"
Write-Host "  2. Settings > Lab Kit > Check now > review the locations > Install v0.3.0"
Read-Host "Press Enter to close"
