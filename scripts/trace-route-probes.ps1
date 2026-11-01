param([int]$Seconds = 180)
$ErrorActionPreference = 'Stop'
# 接続先のアドレス/SSIDは記録せず、既存default gatewayと公開DNSのICMPだけを測る。
$route = Get-NetRoute -AddressFamily IPv4 -DestinationPrefix '0.0.0.0/0' |
  Where-Object { $_.NextHop -ne '0.0.0.0' } | Sort-Object RouteMetric | Select-Object -First 1
if (-not $route) { throw 'No default route' }
$outputDirectory = Join-Path 'dist-validation/lag-live-20261101' ('route-' + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())
New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
$rows = [System.Collections.Generic.List[object]]::new()
$ping = [System.Net.NetworkInformation.Ping]::new()
$until = [DateTime]::UtcNow.AddSeconds([Math]::Min(300, [Math]::Max(10, $Seconds)))
try {
  while ([DateTime]::UtcNow -lt $until) {
    foreach ($role in @('gateway', 'internet')) {
      $address = if ($role -eq 'gateway') { $route.NextHop } else { '1.1.1.1' }
      $at = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
      try {
        $reply = $ping.Send($address, 500)
        $endAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
        $rows.Add([pscustomobject]@{at=$at;endAt=$endAt;role=$role;status=[string]$reply.Status;ms=$reply.RoundtripTime})
      } catch {
        $endAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
        $rows.Add([pscustomobject]@{at=$at;endAt=$endAt;role=$role;status='Error';ms=-1})
      }
    }
    Start-Sleep -Milliseconds 250
  }
} finally {
  $ping.Dispose()
  $rows | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $outputDirectory 'probes.json') -Encoding utf8
  Write-Output $outputDirectory
}
