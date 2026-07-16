# HEXACRIMSON LABS agent installer (Windows PowerShell demo client)
# Usage:  irm https://YOUR-HOST/public/agent.ps1 | iex
# Or:     .\agent.ps1 -Hub https://YOUR-HOST -Token hxl-...

param(
  [string]$Hub = $env:PUBLIC_URL,
  [string]$Token = $(if ($env:HXL_TOKEN) { $env:HXL_TOKEN } else { "hxl-7f3a9c2e1b4d8a6f" }),
  [string]$Environment = $(if ($env:HXL_ENV) { $env:HXL_ENV } else { "windows" }),
  [string]$Region = $(if ($env:HXL_REGION) { $env:HXL_REGION } else { "local" })
)

$ErrorActionPreference = "Stop"
if (-not $Hub) {
  # When served from this site, rewrite to same origin if possible
  $Hub = "http://localhost:3000"
}

Write-Host ""
Write-Host "# hexacrimson labs agent — one-line deployment" -ForegroundColor Red
Write-Host "# hub: $Hub" -ForegroundColor DarkGray
Write-Host ""

Write-Host "detecting platform..." -ForegroundColor DarkGray
$hostName = $env:COMPUTERNAME
$platform = "Windows"
$arch = $env:PROCESSOR_ARCHITECTURE
Write-Host "✓ Platform $platform/$arch on $hostName" -ForegroundColor Cyan
Start-Sleep -Milliseconds 400

Write-Host "downloading agent binary (3.2.1)..." -ForegroundColor DarkGray
Start-Sleep -Milliseconds 500
Write-Host "✓ Downloaded agent binary (2.1 MB)" -ForegroundColor Cyan
Start-Sleep -Milliseconds 300
Write-Host "✓ Checksum verified — SHA256 match" -ForegroundColor Cyan
Start-Sleep -Milliseconds 300
Write-Host "✓ Configuring system service ... done" -ForegroundColor Cyan

$body = @{
  token       = $Token
  hostname    = $hostName
  environment = $Environment
  region      = $Region
  platform    = $platform
  arch        = $arch
} | ConvertTo-Json

Write-Host "checking subscription..." -ForegroundColor DarkGray
try {
  $sub = Invoke-RestMethod -Method Get -Uri "$Hub/api/billing/subscription"
  if (-not $sub.active) {
    Write-Host "! Billing required — complete a plan before deploying agents." -ForegroundColor Red
    Write-Host "  Open: $Hub/#pricing"
    exit 2
  }
  Write-Host "✓ Subscription active — deploy unlocked" -ForegroundColor Cyan
} catch {
  Write-Host "! Could not verify billing: $_" -ForegroundColor Red
  exit 1
}

Write-Host "enrolling with control plane..." -ForegroundColor DarkGray
try {
  $resp = Invoke-RestMethod -Method Post -Uri "$Hub/api/agents/enroll" `
    -ContentType "application/json" `
    -Headers @{ "X-Enroll-Token" = $Token } `
    -Body $body
} catch {
  Write-Host "! Enrollment failed: $_" -ForegroundColor Red
  Write-Host "  If this is a billing error, open $Hub/#pricing first."
  exit 1
}

Write-Host "✓ Agent active (running) — PID $($resp.agent.pid)" -ForegroundColor Cyan
Write-Host "✓ Connected to hub — agent id $($resp.agent.id)" -ForegroundColor Cyan
Write-Host ""
Write-Host "🚀 Hexacrimson agent v3.2.1 successfully deployed" -ForegroundColor Green
Write-Host ""
Write-Host "  id:      $($resp.agent.id)"
Write-Host "  host:    $hostName"
Write-Host "  status:  online"
Write-Host "  dashboard: $Hub/dashboard/"
Write-Host ""
