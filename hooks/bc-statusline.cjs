#!/usr/bin/env node
// Breadcrumb Statusline for Claude Code
// Shows: phase ▸ progress │ current task │ project │ context bar

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const HOME = os.homedir();
const CACHE_DIR = path.join(HOME, '.breadcrumb', 'cache');
const CACHE_FILE = path.join(CACHE_DIR, 'phase-status.json');
const CACHE_MAX_AGE_MS = 15000;

// ANSI helpers
const RESET = '\x1b[0m';
const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const ORANGE = '\x1b[38;5;208m';
const BLINK_RED = '\x1b[5;31m';

function readFileSafe(filePath) {
  try { return fs.readFileSync(filePath, 'utf8'); } catch { return null; }
}

function readJsonSafe(filePath) {
  const content = readFileSafe(filePath);
  if (!content) return null;
  try { return JSON.parse(content); } catch { return null; }
}

// Extract current phase from STATE.md
function getCurrentPhase(projectDir) {
  const stateFile = path.join(projectDir, '.planning', 'STATE.md');
  const content = readFileSafe(stateFile);
  if (!content) return null;
  const match = content.match(/\*\*Current Phase:\*\*\s*(PHASE-\d+)/);
  return match ? match[1] : null;
}

// Read cached phase progress
function getPhaseProgress(projectDir) {
  const cache = readJsonSafe(CACHE_FILE);
  if (!cache) return null;
  // Only use cache if it matches current project
  if (cache.project && cache.project !== projectDir) return null;
  return cache;
}

// Trigger background cache refresh if stale
function maybeRefreshCache(projectDir) {
  const cache = readJsonSafe(CACHE_FILE);
  const now = Date.now();
  if (cache && cache.checkedAt && (now - cache.checkedAt) < CACHE_MAX_AGE_MS) return;

  // Ensure cache directory exists
  try { fs.mkdirSync(CACHE_DIR, { recursive: true }); } catch {}

  // Spawn background process to query daemon and write cache
  const script = `
    const http = require('http');
    const fs = require('fs');
    const projectDir = ${JSON.stringify(projectDir)};
    const cacheFile = ${JSON.stringify(CACHE_FILE)};

    function httpGet(urlPath) {
      return new Promise((resolve, reject) => {
        const req = http.get('http://localhost:9999' + urlPath, { timeout: 3000 }, res => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            try { resolve(JSON.parse(data)); } catch { resolve(null); }
          });
        });
        req.on('error', () => resolve(null));
        req.on('timeout', () => { req.destroy(); resolve(null); });
      });
    }

    async function main() {
      const [state, issues] = await Promise.all([
        httpGet('/api/state?project=' + encodeURIComponent(projectDir)),
        httpGet('/api/issues?project=' + encodeURIComponent(projectDir))
      ]);

      let phase = null, done = 0, total = 0, ready = 0;
      if (state && state.currentPhase) phase = state.currentPhase;
      if (issues && Array.isArray(issues)) {
        // Find subtasks (non-epic issues)
        const tasks = issues.filter(i => i.parent_id != null);
        total = tasks.length;
        done = tasks.filter(i => i.status === 'closed').length;
        ready = tasks.filter(i => i.status !== 'closed' && i.status !== 'in_progress').length;
      }

      const cache = { project: projectDir, phase, done, total, ready, checkedAt: Date.now() };
      fs.writeFileSync(cacheFile, JSON.stringify(cache));
    }
    main().catch(() => {});
  `;

  const child = spawn(process.execPath, ['-e', script], {
    detached: true,
    windowsHide: true,
    stdio: 'ignore'
  });
  child.unref();
}

// Find current in-progress task from Claude todos
function getCurrentTask(sessionId) {
  if (!sessionId) return null;
  const todosDir = path.join(HOME, '.claude', 'todos');
  try {
    const files = fs.readdirSync(todosDir)
      .filter(f => f.startsWith(sessionId) && f.includes('-agent-') && f.endsWith('.json'))
      .map(f => ({ name: f, mtime: fs.statSync(path.join(todosDir, f)).mtime }))
      .sort((a, b) => b.mtime - a.mtime);

    if (files.length > 0) {
      const todos = JSON.parse(fs.readFileSync(path.join(todosDir, files[0].name), 'utf8'));
      const inProgress = todos.find(t => t.status === 'in_progress');
      if (inProgress) {
        const text = inProgress.activeForm || inProgress.subject || '';
        return text.length > 30 ? text.slice(0, 28) + '..' : text;
      }
    }
  } catch {}
  return null;
}

// Render context bar (battery-style: full = good)
function renderContextBar(remainingPct) {
  if (remainingPct == null) return '';

  const pct = Math.round(remainingPct);
  const filled = Math.round(pct / 10);
  const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(10 - filled);

  let color;
  if (pct > 60) color = GREEN;
  else if (pct > 30) color = YELLOW;
  else if (pct > 15) color = ORANGE;
  else color = BLINK_RED;

  return ` ${color}${bar} ${pct}%${RESET}`;
}

// Check for breadcrumb update
function getUpdateNotice() {
  const cacheFile = path.join(CACHE_DIR, 'update-check.json');
  const cache = readJsonSafe(cacheFile);
  if (cache && cache.update_available) {
    return `${YELLOW}\u2B06 /bc:update${RESET} \u2502 `;
  }
  return '';
}

// Main
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const dir = data.workspace?.current_dir || process.cwd();
    const sessionId = data.session_id || '';
    const remaining = data.context_window?.remaining_percentage;
    const dirname = path.basename(dir);

    // Get phase and progress
    const phase = getCurrentPhase(dir);
    const progress = getPhaseProgress(dir);

    // Trigger background refresh
    maybeRefreshCache(dir);

    // Get current task
    const task = getCurrentTask(sessionId);

    // Build segments
    const update = getUpdateNotice();
    const ctx = renderContextBar(remaining);

    let segments = [];

    // Phase + progress
    if (phase) {
      if (progress && progress.total > 0) {
        segments.push(`${BOLD}${phase}${RESET} \u25B8 ${progress.done}/${progress.total}`);
      } else {
        segments.push(`${BOLD}${phase}${RESET}`);
      }
    }

    // Current task
    if (task) {
      segments.push(`${BOLD}${task}${RESET}`);
    }

    // Project name
    segments.push(`${DIM}${dirname}${RESET}`);

    const line = update + segments.join(` ${DIM}\u2502${RESET} `) + ctx;
    process.stdout.write(line);
  } catch {
    // Silent fail — never break the statusline
  }
});
