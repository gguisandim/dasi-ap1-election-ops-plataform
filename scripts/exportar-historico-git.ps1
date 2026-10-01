$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot
$dest = Join-Path $projectRoot "docs\git-history.txt"
$header = @"
Snapshot de rastreabilidade Git
Gerado em: $(Get-Date -Format o)
Repositorio: $(git remote get-url origin 2>$null)

"@
$header | Set-Content -Encoding UTF8 $dest
git log --date=iso-strict --pretty=format:"commit: %H%nshort: %h%nauthor: %an <%ae>%ndate: %ad%ntitle: %s%nbody:%n%b%n---" | Add-Content -Encoding UTF8 $dest
Write-Host "Historico salvo em $dest"
