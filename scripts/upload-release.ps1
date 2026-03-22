# Upload SafeKey-Setup-x64.exe and latest.yml to GitHub Release (requires: gh auth login)
param(
  [string]$Tag = "v1.2.2",
  [string]$Repo = "Actoric/SafeKey"
)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$exe = Join-Path $root "release\SafeKey-Setup-x64.exe"
$yml = Join-Path $root "release\latest.yml"
if (-not (Test-Path $exe)) { throw "No installer. Run: npm run build:win" }
if (-not (Test-Path $yml)) { throw "No latest.yml. Run: npm run build:win" }

gh auth status 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
  Write-Host "Run first: gh auth login"
  exit 1
}

$exists = $false
gh release view $Tag --repo $Repo 2>$null | Out-Null
if ($LASTEXITCODE -eq 0) { $exists = $true }

if (-not $exists) {
  gh release create $Tag $exe $yml --repo $Repo --title "SafeKey $Tag" --notes "Windows x64 installer + latest.yml for auto-update."
} else {
  gh release upload $Tag $exe $yml --repo $Repo --clobber
}
Write-Host "Done: https://github.com/$Repo/releases/tag/$Tag"
