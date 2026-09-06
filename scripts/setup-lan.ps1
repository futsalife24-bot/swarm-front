param([Parameter(Mandatory = $true)][string]$LanAddress)
$ErrorActionPreference = 'Stop'
if ($PSVersionTable.PSEdition -ne 'Core') { throw 'Use PowerShell 7 for local PEM certificate generation.' }
$lanIP = [System.Net.IPAddress]::Parse($LanAddress)
$lanBytes = $lanIP.GetAddressBytes()
if ($lanBytes.Length -ne 4 -or -not ($lanBytes[0] -eq 10 -or ($lanBytes[0] -eq 192 -and $lanBytes[1] -eq 168) -or ($lanBytes[0] -eq 172 -and $lanBytes[1] -ge 16 -and $lanBytes[1] -le 31))) { throw 'A private LAN IPv4 address is required.' }
$lanDirectory = Join-Path $PSScriptRoot '../dist-lan'
New-Item -ItemType Directory -Path $lanDirectory -Force | Out-Null
$lanCertPath = Join-Path $lanDirectory 'server-cert.pem'
$lanKeyPath = Join-Path $lanDirectory 'server-key.pem'
$lanConfigPath = Join-Path $lanDirectory 'config.json'
if ((Test-Path $lanCertPath) -or (Test-Path $lanKeyPath)) {
  if (-not ((Test-Path $lanCertPath) -and (Test-Path $lanKeyPath) -and (Test-Path $lanConfigPath))) { throw 'Incomplete certificate files; existing files were preserved.' }
  $lanExisting = Get-Content $lanConfigPath -Raw | ConvertFrom-Json
  if ($lanExisting.address -ne $LanAddress) { throw 'LAN address changed; existing certificate files were preserved.' }
} else {
  $lanRSA = [System.Security.Cryptography.RSA]::Create(2048)
  try {
    $lanRequest = [System.Security.Cryptography.X509Certificates.CertificateRequest]::new("CN=swarm-front LAN", $lanRSA, [System.Security.Cryptography.HashAlgorithmName]::SHA256, [System.Security.Cryptography.RSASignaturePadding]::Pkcs1)
    $lanSAN = [System.Security.Cryptography.X509Certificates.SubjectAlternativeNameBuilder]::new()
    $lanSAN.AddIpAddress($lanIP)
    $lanRequest.CertificateExtensions.Add($lanSAN.Build())
    $lanCertificate = $lanRequest.CreateSelfSigned([DateTimeOffset]::UtcNow.AddMinutes(-5), [DateTimeOffset]::UtcNow.AddDays(30))
    try {
      Set-Content -LiteralPath $lanCertPath -Value $lanCertificate.ExportCertificatePem() -Encoding utf8NoBOM
      Set-Content -LiteralPath $lanKeyPath -Value $lanRSA.ExportPkcs8PrivateKeyPem() -Encoding utf8NoBOM
    } finally { $lanCertificate.Dispose() }
  } finally { $lanRSA.Dispose() }
  @{ address = $LanAddress; port = 5443 } | ConvertTo-Json | Set-Content -LiteralPath $lanConfigPath -Encoding utf8NoBOM
}
Write-Output "LAN certificate ready for https://${LanAddress}:5443/ (no trust-store changes)."
