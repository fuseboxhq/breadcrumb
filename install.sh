#!/bin/bash
set -e

# Breadcrumb installer
# Usage: curl -fsSL https://raw.githubusercontent.com/fuseboxhq/breadcrumb/main/install.sh | bash

# Detect WSL and inform Windows users
if grep -qEi "(microsoft|wsl)" /proc/version 2>/dev/null; then
    echo "[INFO] WSL detected. This installer works in WSL."
    echo "       For native Windows (PowerShell), use:"
    echo "       irm https://raw.githubusercontent.com/fuseboxhq/breadcrumb/main/install.ps1 | iex"
    echo ""
fi

REPO_URL="${BREADCRUMB_REPO:-https://github.com/fuseboxhq/breadcrumb.git}"
RAW_URL="${BREADCRUMB_RAW:-https://raw.githubusercontent.com/fuseboxhq/breadcrumb/main}"
SKILLS_DIR="$HOME/.claude/skills/breadcrumb"
DESIGN_SKILLS_DIR="$HOME/.claude/skills/frontend-design"
COMMANDS_DIR="$HOME/.claude/commands/bc"
AGENTS_DIR="$HOME/.claude/agents"
BREADCRUMB_DIR="$HOME/.breadcrumb"
SERVER_DIR="$BREADCRUMB_DIR/server"

echo "Installing Breadcrumb..."
echo ""

# =========================================================================
# 1. Prerequisites
# =========================================================================

# Check for git
if ! command -v git &> /dev/null; then
    echo "[ERROR] git is required but not found."
    echo "        Install git and try again."
    exit 1
fi

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js is required but not found."
    echo "        Install Node.js (v18+) from https://nodejs.org"
    exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "[ERROR] Node.js v18+ required, found v$(node -v)"
    exit 1
fi
echo "[OK] Node.js $(node -v)"

# Check for pnpm (install if missing)
if ! command -v pnpm &> /dev/null; then
    echo "[INFO] pnpm not found. Installing..."
    npm install -g pnpm 2>/dev/null || corepack enable 2>/dev/null || {
        echo "[ERROR] Could not install pnpm. Install manually: npm install -g pnpm"
        exit 1
    }
fi
echo "[OK] pnpm $(pnpm -v 2>/dev/null || echo 'installed')"

# Check for Beads CLI and install if missing
if command -v bd &> /dev/null; then
    echo "[OK] Beads CLI found: $(which bd)"
else
    echo "[INFO] Beads CLI not found. Installing..."
    curl -fsSL https://raw.githubusercontent.com/steveyegge/beads/main/scripts/install.sh | bash
    echo ""
    if command -v bd &> /dev/null; then
        echo "[OK] Beads CLI installed: $(which bd)"
    else
        echo "[WARN] Beads CLI installation may require a shell restart."
        echo "       Run 'source ~/.bashrc' or 'source ~/.zshrc' after installation."
    fi
fi

echo ""

# =========================================================================
# 2. Claude Code commands, agents, and skills
# =========================================================================

echo "Installing Claude Code commands..."
mkdir -p "$SKILLS_DIR"
mkdir -p "$DESIGN_SKILLS_DIR"
mkdir -p "$COMMANDS_DIR"
mkdir -p "$AGENTS_DIR"

# Download skill files (background context)
curl -fsSL "$RAW_URL/skills/breadcrumb/SKILL.md" -o "$SKILLS_DIR/SKILL.md"
curl -fsSL "$RAW_URL/skills/frontend-design/SKILL.md" -o "$DESIGN_SKILLS_DIR/SKILL.md"

# Download command files (user-invocable)
for cmd in init integrate new-phase plan discuss-task status research close-phase execute todo todos update quick doctor bug-fix view; do
    curl -fsSL "$RAW_URL/commands/bc/$cmd.md" -o "$COMMANDS_DIR/$cmd.md"
done

# Download agent
curl -fsSL "$RAW_URL/agents/bc-researcher.md" -o "$AGENTS_DIR/bc-researcher.md"

echo "[OK] Claude Code commands installed"

# =========================================================================
# 2.5. Hooks
# =========================================================================

echo ""
echo "Installing Breadcrumb hooks..."
HOOKS_DIR="$BREADCRUMB_DIR/hooks"
mkdir -p "$HOOKS_DIR"

for hook in bc-statusline bc-session-start bc-session-end bc-bash-guard; do
    curl -fsSL "$RAW_URL/hooks/$hook.cjs" -o "$HOOKS_DIR/$hook.cjs"
done
chmod +x "$HOOKS_DIR"/*.cjs

echo "[OK] Hooks installed"

# =========================================================================
# 3. Server installation
# =========================================================================

echo ""
echo "Installing Breadcrumb server..."
mkdir -p "$BREADCRUMB_DIR"

if [ -d "$SERVER_DIR/.git" ]; then
    echo "Updating existing server installation..."
    cd "$SERVER_DIR"
    git pull --ff-only 2>/dev/null || {
        echo "[WARN] Could not fast-forward. Resetting to latest..."
        git fetch origin
        git reset --hard origin/main
    }
    cd - > /dev/null
else
    if [ -d "$SERVER_DIR" ]; then
        echo "Removing stale server directory..."
        rm -rf "$SERVER_DIR"
    fi
    echo "Cloning Breadcrumb server..."
    git clone --depth 1 "$REPO_URL" "$SERVER_DIR"
fi

echo "[OK] Server source downloaded"

# Install dependencies
echo "Installing server dependencies..."
cd "$SERVER_DIR"
pnpm install --frozen-lockfile 2>/dev/null || pnpm install
echo "[OK] Dependencies installed"

# Build frontend
echo "Building frontend..."
pnpm build
echo "[OK] Frontend built"

cd - > /dev/null

# Save install path for bc:init to find
echo "$SERVER_DIR" > "$BREADCRUMB_DIR/install-path"

# Refresh update-check cache so statusline doesn't show stale "update available"
CACHE_DIR="$BREADCRUMB_DIR/cache"
mkdir -p "$CACHE_DIR"
CURRENT_SHA=$(cd "$SERVER_DIR" && git rev-parse --short=7 HEAD 2>/dev/null || echo "unknown")
echo "{\"installed_sha\":\"$CURRENT_SHA\",\"latest_sha\":\"$CURRENT_SHA\",\"update_available\":false,\"checkedAt\":$(date +%s)000}" > "$CACHE_DIR/update-check.json"

echo ""

# =========================================================================
# 4. Hostname setup (optional)
# =========================================================================

echo "Optional: Set up bread.crumb hostname (requires sudo)"
echo "  This allows you to access the UI at http://bread.crumb"
echo "  instead of http://localhost:9999"
echo ""

# Only prompt if running interactively (not piped)
if [ -t 0 ]; then
    read -p "Set up bread.crumb? [y/N] " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        bash "$SERVER_DIR/scripts/setup-hostname.sh"
        echo ""
    fi
else
    echo "  To set up later, run:"
    echo "    sudo bash $SERVER_DIR/scripts/setup-hostname.sh"
    echo ""
fi

# =========================================================================
# 5. Start the daemon
# =========================================================================

echo "Starting Breadcrumb daemon..."

# Check if already running
if curl -s --max-time 2 http://localhost:9999/__daemon/health > /dev/null 2>&1; then
    echo "[OK] Breadcrumb daemon already running"
else
    cd "$SERVER_DIR"
    pnpm daemon:start
    cd - > /dev/null
fi

echo ""

# =========================================================================
# 6. Summary
# =========================================================================

echo "============================================="
echo "  Breadcrumb installed successfully!"
echo "============================================="
echo ""
echo "Installed to:"
echo "  $SKILLS_DIR/SKILL.md         (background context)"
echo "  $DESIGN_SKILLS_DIR/SKILL.md  (frontend design skill)"
echo "  $COMMANDS_DIR/                (commands)"
echo "  $AGENTS_DIR/bc-researcher.md  (agent)"
echo "  $SERVER_DIR/                  (server)"
echo ""
echo "Web UI:"
if curl -s --max-time 2 http://localhost:9999/__daemon/health > /dev/null 2>&1; then
    echo "  http://localhost:9999 (running)"
    if grep -q "bread.crumb" /etc/hosts 2>/dev/null; then
        echo "  http://bread.crumb (configured)"
    fi
else
    echo "  Not running. Start with: cd $SERVER_DIR && pnpm daemon:start"
fi
echo ""
echo "Available commands:"
echo "  /bc:init                   Initialize Breadcrumb in a project"
echo "  /bc:integrate              Explore codebase and create CODEBASE.md"
echo "  /bc:new-phase <title>      Create a new phase"
echo "  /bc:plan PHASE-XX          Clarify, research, and plan a phase"
echo "  /bc:execute <id|PHASE-XX>  Execute a task or all tasks in a phase"
echo "  /bc:discuss-task <task-id>  Clarify a task through discussion"
echo "  /bc:research <task-id>     Deep research on a specific task"
echo "  /bc:status                 Show phase progress and ready tasks"
echo "  /bc:close-phase PHASE-XX   Mark a phase complete"
echo "  /bc:todo <description>     Add item to todo list"
echo "  /bc:todos                  View and manage todo list"
echo "  /bc:update                 Update Breadcrumb to latest version"
echo "  /bc:quick <description>    Quick task execution without planning"
echo "  /bc:bug-fix <description>  Investigate and fix a bug with diagnosis"
echo "  /bc:view                   Open web dashboard in browser"
echo ""
echo "To get started in a new project:"
echo "  1. cd your-project"
echo "  2. Open Claude Code"
echo "  3. Run /bc:init"
