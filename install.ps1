# Breadcrumb installer for Windows
# Usage: irm https://raw.githubusercontent.com/fuseboxhq/breadcrumb/main/install.ps1 | iex

$ErrorActionPreference = "Stop"

# Ensure TLS 1.2 for older systems
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$RepoUrl = if ($env:BREADCRUMB_REPO) { $env:BREADCRUMB_REPO } else { "https://github.com/fuseboxhq/breadcrumb.git" }
$RawUrl = if ($env:BREADCRUMB_RAW) { $env:BREADCRUMB_RAW } else { "https://raw.githubusercontent.com/fuseboxhq/breadcrumb/main" }
$SkillsDir = Join-Path $env:USERPROFILE ".claude\skills\breadcrumb"
$CommandsDir = Join-Path $env:USERPROFILE ".claude\commands\bc"
$AgentsDir = Join-Path $env:USERPROFILE ".claude\agents"
$BreadcrumbDir = Join-Path $env:USERPROFILE ".breadcrumb"
$ServerDir = Join-Path $BreadcrumbDir "server"

function Write-Status {
    param([string]$Message, [string]$Type = "INFO")
    switch ($Type) {
        "OK"    { Write-Host "[OK] $Message" -ForegroundColor Green }
        "WARN"  { Write-Host "[WARN] $Message" -ForegroundColor Yellow }
        "ERROR" { Write-Host "[ERROR] $Message" -ForegroundColor Red }
        default { Write-Host "[INFO] $Message" -ForegroundColor Cyan }
    }
}

function Download-File {
    param([string]$Url, [string]$OutFile)
    try {
        Invoke-WebRequest -Uri $Url -OutFile $OutFile -UseBasicParsing
    } catch {
        throw "Failed to download $Url : $_"
    }
}

Write-Host "Installing Breadcrumb..." -ForegroundColor White
Write-Host ""

# =========================================================================
# 1. Prerequisites
# =========================================================================

# Check for git
try {
    $gitPath = (Get-Command git -ErrorAction SilentlyContinue).Source
    if (-not $gitPath) { throw "not found" }
    Write-Status "git found: $gitPath" "OK"
} catch {
    Write-Status "git is required but not found. Install from https://git-scm.com" "ERROR"
    exit 1
}

# Check for Node.js
try {
    $nodePath = (Get-Command node -ErrorAction SilentlyContinue).Source
    if (-not $nodePath) { throw "not found" }
    $nodeVersion = (node -v).TrimStart('v').Split('.')[0]
    if ([int]$nodeVersion -lt 18) {
        Write-Status "Node.js v18+ required, found v$(node -v)" "ERROR"
        exit 1
    }
    Write-Status "Node.js $(node -v)" "OK"
} catch {
    Write-Status "Node.js is required but not found. Install from https://nodejs.org" "ERROR"
    exit 1
}

# Check for pnpm (install if missing)
try {
    $pnpmPath = (Get-Command pnpm -ErrorAction SilentlyContinue).Source
    if (-not $pnpmPath) { throw "not found" }
    Write-Status "pnpm found" "OK"
} catch {
    Write-Status "pnpm not found. Installing..." "INFO"
    try {
        npm install -g pnpm 2>$null
        Write-Status "pnpm installed" "OK"
    } catch {
        try {
            corepack enable 2>$null
            Write-Status "pnpm enabled via corepack" "OK"
        } catch {
            Write-Status "Could not install pnpm. Install manually: npm install -g pnpm" "ERROR"
            exit 1
        }
    }
}

# Check for Beads CLI
$beadsFound = $false
try {
    $bdPath = (Get-Command bd -ErrorAction SilentlyContinue).Source
    if ($bdPath) {
        Write-Status "Beads CLI found: $bdPath" "OK"
        $beadsFound = $true
    }
} catch {}

if (-not $beadsFound) {
    Write-Status "Beads CLI not found. Attempting to install..." "INFO"

    # Try npm first
    $npmInstalled = $false
    try {
        $npmPath = (Get-Command npm -ErrorAction SilentlyContinue).Source
        if ($npmPath) {
            Write-Status "Found npm, installing Beads via npm..." "INFO"
            npm install -g @anthropics/beads 2>$null
            if ($LASTEXITCODE -eq 0) {
                Write-Status "Beads CLI installed via npm" "OK"
                $npmInstalled = $true
            }
        }
    } catch {}

    # Try go if npm failed
    if (-not $npmInstalled) {
        try {
            $goPath = (Get-Command go -ErrorAction SilentlyContinue).Source
            if ($goPath) {
                Write-Status "Found go, installing Beads via go..." "INFO"
                go install github.com/steveyegge/beads/cmd/bd@latest 2>$null
                if ($LASTEXITCODE -eq 0) {
                    Write-Status "Beads CLI installed via go" "OK"
                }
            }
        } catch {}
    }

    # Check if installation succeeded
    try {
        $bdPath = (Get-Command bd -ErrorAction SilentlyContinue).Source
        if ($bdPath) {
            Write-Status "Beads CLI now available: $bdPath" "OK"
        } else {
            Write-Status "Beads CLI not installed. Install manually with: npm install -g @anthropics/beads" "WARN"
            Write-Status "Breadcrumb will work without Beads, but task tracking won't be available." "WARN"
        }
    } catch {
        Write-Status "Beads CLI not installed. Install manually with: npm install -g @anthropics/beads" "WARN"
        Write-Status "Breadcrumb will work without Beads, but task tracking won't be available." "WARN"
    }
}

Write-Host ""

# =========================================================================
# 2. Claude Code commands, agents, and skills
# =========================================================================

Write-Host "Installing Claude Code commands..." -ForegroundColor White
New-Item -ItemType Directory -Force -Path $SkillsDir | Out-Null
New-Item -ItemType Directory -Force -Path $CommandsDir | Out-Null
New-Item -ItemType Directory -Force -Path $AgentsDir | Out-Null

# Download skill file
Download-File "$RawUrl/skills/breadcrumb/SKILL.md" (Join-Path $SkillsDir "SKILL.md")

# Download command files
$commands = @(
    "init", "integrate", "new-phase", "plan", "discuss-task",
    "status", "research", "close-phase", "execute",
    "todo", "todos", "update", "quick", "doctor"
)
foreach ($cmd in $commands) {
    Download-File "$RawUrl/commands/bc/$cmd.md" (Join-Path $CommandsDir "$cmd.md")
}

# Download agent
Download-File "$RawUrl/agents/bc-researcher.md" (Join-Path $AgentsDir "bc-researcher.md")

Write-Status "Claude Code commands installed" "OK"

# =========================================================================
# 3. Server installation
# =========================================================================

Write-Host ""
Write-Host "Installing Breadcrumb server..." -ForegroundColor White
New-Item -ItemType Directory -Force -Path $BreadcrumbDir | Out-Null

if (Test-Path (Join-Path $ServerDir ".git")) {
    Write-Host "Updating existing server installation..." -ForegroundColor White
    Push-Location $ServerDir
    try {
        git pull --ff-only 2>$null
    } catch {
        Write-Status "Could not fast-forward. Resetting to latest..." "WARN"
        git fetch origin
        git reset --hard origin/main
    }
    Pop-Location
} else {
    if (Test-Path $ServerDir) {
        Write-Host "Removing stale server directory..." -ForegroundColor White
        Remove-Item -Recurse -Force $ServerDir
    }
    Write-Host "Cloning Breadcrumb server..." -ForegroundColor White
    git clone --depth 1 $RepoUrl $ServerDir
}

Write-Status "Server source downloaded" "OK"

# Install dependencies
Write-Host "Installing server dependencies..." -ForegroundColor White
Push-Location $ServerDir
try {
    pnpm install --frozen-lockfile 2>$null
} catch {
    pnpm install
}

# Build frontend
Write-Host "Building frontend..." -ForegroundColor White
pnpm build

Pop-Location

Write-Status "Server built" "OK"

# Save install path
Set-Content -Path (Join-Path $BreadcrumbDir "install-path") -Value $ServerDir

Write-Host ""

# =========================================================================
# 4. Hostname setup (optional)
# =========================================================================

Write-Host "Optional: Set up breadcrumb.local hostname" -ForegroundColor White
Write-Host "  This allows you to access the UI at http://breadcrumb.local" -ForegroundColor White
Write-Host "  instead of http://localhost:9999" -ForegroundColor White
Write-Host "  Requires running as Administrator." -ForegroundColor Yellow
Write-Host ""

$setupHostname = Read-Host "Set up breadcrumb.local? [y/N]"
if ($setupHostname -match "^[Yy]$") {
    # Check if running as admin
    $isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    if ($isAdmin) {
        & (Join-Path $ServerDir "scripts\setup-hostname.ps1")
    } else {
        Write-Status "Hostname setup requires Administrator. Run this in an admin PowerShell:" "WARN"
        Write-Host "  & `"$(Join-Path $ServerDir 'scripts\setup-hostname.ps1')`"" -ForegroundColor Cyan
    }
    Write-Host ""
}

# =========================================================================
# 5. Start the daemon
# =========================================================================

Write-Host "Starting Breadcrumb daemon..." -ForegroundColor White

# Check if already running
$daemonRunning = $false
try {
    $health = Invoke-WebRequest -Uri "http://localhost:9999/__daemon/health" -UseBasicParsing -TimeoutSec 2 -ErrorAction SilentlyContinue
    if ($health.StatusCode -eq 200) {
        $daemonRunning = $true
    }
} catch {}

if ($daemonRunning) {
    Write-Status "Breadcrumb daemon already running" "OK"
} else {
    Push-Location $ServerDir
    pnpm daemon:start
    Pop-Location
}

Write-Host ""

# =========================================================================
# 6. Summary
# =========================================================================

Write-Host "=============================================" -ForegroundColor Green
Write-Host "  Breadcrumb installed successfully!" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Installed to:" -ForegroundColor White
Write-Host "  $SkillsDir\SKILL.md          (background context)"
Write-Host "  $CommandsDir\                  (commands)"
Write-Host "  $AgentsDir\bc-researcher.md   (agent)"
Write-Host "  $ServerDir\                   (server)"
Write-Host ""
Write-Host "Web UI:" -ForegroundColor White

$daemonUp = $false
try {
    $health = Invoke-WebRequest -Uri "http://localhost:9999/__daemon/health" -UseBasicParsing -TimeoutSec 2 -ErrorAction SilentlyContinue
    if ($health.StatusCode -eq 200) { $daemonUp = $true }
} catch {}

if ($daemonUp) {
    Write-Host "  http://localhost:9999 (running)" -ForegroundColor Cyan
    $hostsFile = Get-Content "C:\Windows\System32\drivers\etc\hosts" -Raw -ErrorAction SilentlyContinue
    if ($hostsFile -match "breadcrumb\.local") {
        Write-Host "  http://breadcrumb.local (configured)" -ForegroundColor Cyan
    }
} else {
    Write-Host "  Not running. Start with:" -ForegroundColor Yellow
    Write-Host "    cd $ServerDir; pnpm daemon:start" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "Available commands:" -ForegroundColor White
Write-Host "  /bc:init                   Initialize Breadcrumb in a project"
Write-Host "  /bc:integrate              Explore codebase and create CODEBASE.md"
Write-Host "  /bc:new-phase <title>      Create a new phase"
Write-Host "  /bc:plan PHASE-XX          Clarify, research, and plan a phase"
Write-Host "  /bc:execute <id|PHASE-XX>  Execute a task or all tasks in a phase"
Write-Host "  /bc:discuss-task <task-id>  Clarify a task through discussion"
Write-Host "  /bc:research <task-id>     Deep research on a specific task"
Write-Host "  /bc:status                 Show phase progress and ready tasks"
Write-Host "  /bc:close-phase PHASE-XX   Mark a phase complete"
Write-Host "  /bc:todo <description>     Add item to todo list"
Write-Host "  /bc:todos                  View and manage todo list"
Write-Host "  /bc:update                 Update Breadcrumb to latest version"
Write-Host "  /bc:quick <description>    Quick task execution without planning"
Write-Host ""
Write-Host "To get started in a new project:" -ForegroundColor White
Write-Host "  1. cd your-project"
Write-Host "  2. Open Claude Code"
Write-Host "  3. Run /bc:init"
