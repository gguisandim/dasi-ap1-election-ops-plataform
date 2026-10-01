$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$source = Join-Path $env:USERPROFILE ".codex\sessions"
$dest = Join-Path $projectRoot "prompts\sessoes\codex-export"

if (-not (Test-Path $source)) {
  Write-Host "Diretorio do Codex nao encontrado: $source"
  exit 1
}

New-Item -ItemType Directory -Force -Path $dest | Out-Null
$patterns = @("election-ops-platform", "dasi-ap1-election-ops-plataform", "dsai-ap1-election-ops-platform")
$count = 0
Get-ChildItem $source -File -Recurse | ForEach-Object {
  $path = $_.FullName
  $matched = $false
  foreach ($pattern in $patterns) {
    if (Select-String -Path $path -Pattern $pattern -SimpleMatch -Quiet -ErrorAction SilentlyContinue) { $matched = $true; break }
  }
  if ($matched) {
    $safe = ($_.DirectoryName.Substring($source.Length).TrimStart('\\') -replace '[\\/:*?"<>| ]','_')
    if (-not $safe) { $safe = "root" }
    $target = Join-Path $dest ("{0}__{1}" -f $safe, $_.Name)
    Copy-Item $path $target -Force
    $count++
  }
}
Write-Host "Sessoes copiadas: $count"
Write-Host "Revise $dest e remova qualquer segredo antes de commitar."
