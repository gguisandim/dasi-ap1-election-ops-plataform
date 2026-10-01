$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$errors = @()
if (-not (Test-Path "SPEC")) { $errors += "SPEC/ ausente" }
if (-not (Test-Path "prompts/sessoes")) { $errors += "prompts/sessoes/ ausente" }
if (Test-Path "test-results") { $errors += "test-results/ presente" }
if (Get-ChildItem -Directory -Filter "backup-security-runtime-*" -ErrorAction SilentlyContinue) { $errors += "backup de runtime presente" }
$trackedEnv = git ls-files ".env" ".env.*" 2>$null
if ($trackedEnv -match '(^|\n)\.env($|\n)') { $errors += ".env real versionado" }
Write-Host "Specs: $((Get-ChildItem SPEC -File -Filter '*.md').Count)"
Write-Host "Sessoes: $((Get-ChildItem prompts/sessoes -File -Recurse).Count)"
if ($errors.Count -gt 0) { Write-Host "Problemas:"; $errors | ForEach-Object { Write-Host "- $_" }; exit 1 }
Write-Host "Estrutura formal basica da AP1: OK"
