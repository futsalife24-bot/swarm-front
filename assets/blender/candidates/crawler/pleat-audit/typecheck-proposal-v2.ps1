$ErrorActionPreference = 'Stop'
# Run from game/. A dedicated copy preserves every original source file.
$checkRoot = 'assets/blender/candidates/crawler/pleat-audit/integration-v2-typecheck'
New-Item -ItemType Directory -Path $checkRoot -Force | Out-Null
# Copy each source tree's contents, so repeated checks do not nest src/src.
foreach ($tree in @('src','server')) {
  $destination = Join-Path $checkRoot $tree
  New-Item -ItemType Directory -Path $destination -Force | Out-Null
  Get-ChildItem -LiteralPath $tree | ForEach-Object {
    Copy-Item -LiteralPath $_.FullName -Destination $destination -Recurse -Force
  }
}
Copy-Item -LiteralPath tsconfig.json,tsconfig.worker.json -Destination $checkRoot -Force
Copy-Item -LiteralPath assets/blender/candidates/crawler/pleat-audit/integration-v2/game.ts.proposed.txt -Destination "$checkRoot/src/shared/game.ts" -Force
Copy-Item -LiteralPath assets/blender/candidates/crawler/pleat-audit/integration-v2/render.ts.proposed.txt -Destination "$checkRoot/src/client/render.ts" -Force
foreach ($config in @('tsconfig.json','tsconfig.worker.json')) {
  & node node_modules/typescript/bin/tsc -p "$checkRoot/$config"
  if ($LASTEXITCODE -ne 0) { throw "Typecheck failed: $config" }
}
'PASS: copied proposal snapshot, client/worker CLI checks; original source unchanged.' |
  Set-Content -LiteralPath assets/blender/candidates/crawler/pleat-audit/integration-v2-typecheck.log -Encoding utf8
