# Sets up breadcrumb.local hostname and port 80 → 9999 forwarding on Windows
# Must be run as Administrator (one-time setup)

$ErrorActionPreference = "Stop"

$Hostname = "breadcrumb.local"
$TargetPort = 9999
$HostsFile = "C:\Windows\System32\drivers\etc\hosts"

Write-Host "Setting up $Hostname -> localhost:$TargetPort" -ForegroundColor White
Write-Host "This requires Administrator privileges." -ForegroundColor Yellow
Write-Host ""

# Check admin
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "[ERROR] Please run this script as Administrator." -ForegroundColor Red
    Write-Host "        Right-click PowerShell → Run as administrator" -ForegroundColor Red
    exit 1
}

# --- 1. Hosts file entry ---

$hostsContent = Get-Content $HostsFile -Raw
if ($hostsContent -match [regex]::Escape($Hostname)) {
    Write-Host "[OK] $Hostname already in hosts file" -ForegroundColor Green
} else {
    Add-Content -Path $HostsFile -Value "`n127.0.0.1 $Hostname"
    Write-Host "[OK] Added $Hostname to hosts file" -ForegroundColor Green
}

# --- 2. Port forwarding ---

Write-Host "Setting up port forwarding (port 80 → $TargetPort)..." -ForegroundColor White

# Remove existing rule if present (idempotent)
try {
    netsh interface portproxy delete v4tov4 listenport=80 listenaddress=127.0.0.1 2>$null | Out-Null
} catch {}

# Add port forwarding rule
netsh interface portproxy add v4tov4 listenport=80 listenaddress=127.0.0.1 connectport=$TargetPort connectaddress=127.0.0.1

Write-Host "[OK] Port forwarding configured (80 → $TargetPort)" -ForegroundColor Green

# Verify
Write-Host ""
Write-Host "Verifying setup..." -ForegroundColor White
netsh interface portproxy show v4tov4

Write-Host ""
Write-Host "Setup complete! After starting the Breadcrumb daemon, browse to:" -ForegroundColor Green
Write-Host "  http://$Hostname" -ForegroundColor Cyan
