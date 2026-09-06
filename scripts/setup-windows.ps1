param([string]$RuntimeDirectory = (Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\native\poppler\Library\bin'))
$ErrorActionPreference = 'Stop'
$destination = Join-Path $PSScriptRoot '..\node_modules\@cloudflare\workerd-windows-64\bin'
if (!(Test-Path -LiteralPath $destination)) { throw 'Run npm ci first.' }
$dlls = @('vcruntime140.dll','vcruntime140_1.dll','vcruntime140_threads.dll','msvcp140.dll','msvcp140_1.dll','msvcp140_2.dll','msvcp140_atomic_wait.dll')
foreach ($dll in $dlls) {
  $source = Join-Path $RuntimeDirectory $dll
  $info = Get-Item -LiteralPath $source
  if ([version]$info.VersionInfo.FileVersion -lt [version]'14.44.0.0') { throw 'A newer Microsoft runtime is required.' }
  Copy-Item -LiteralPath $source -Destination (Join-Path $destination $dll)
}
Write-Output 'App-local Microsoft runtime copied into this project only. No system files changed.'
