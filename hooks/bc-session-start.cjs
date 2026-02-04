#!/usr/bin/env node
// Breadcrumb SessionStart Hook
// Warms cache, checks daemon health, checks for updates

const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const { spawn } = require('child_process');

const HOME = os.homedir();
const BREADCRUMB_DIR = path.join(HOME, '.breadcrumb');
const CACHE_DIR = path.join(BREADCRUMB_DIR, 'cache');
const SERVER_DIR = path.join(BREADCRUMB_DIR, 'server');

function ensureDir(dir) {
  try { fs.mkdirSync(dir, { recursive: true }); } catch {}
}

function httpGet(urlPath) {
  return new Promise((resolve) => {
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

async function checkDaemonHealth() {
  const health = await httpGet('/__daemon/health');
  if (health) return; // Daemon is running

  // Try to start daemon
  const installPath = path.join(BREADCRUMB_DIR, 'install-path');
  let serverDir = SERVER_DIR;
  try {
    const saved = fs.readFileSync(installPath, 'utf8').trim();
    if (saved) serverDir = saved;
  } catch {}

  if (!fs.existsSync(path.join(serverDir, 'package.json'))) return;

  const child = spawn('pnpm', ['daemon:start'], {
    cwd: serverDir,
    detached: true,
    stdio: 'ignore'
  });
  child.unref();
}

async function warmCache(projectDir) {
  ensureDir(CACHE_DIR);
  const cacheFile = path.join(CACHE_DIR, 'phase-status.json');

  const [state, issues] = await Promise.all([
    httpGet('/api/state?project=' + encodeURIComponent(projectDir)),
    httpGet('/api/issues?project=' + encodeURIComponent(projectDir))
  ]);

  let phase = null, done = 0, total = 0, ready = 0;
  if (state && state.currentPhase) phase = state.currentPhase;
  if (issues && Array.isArray(issues)) {
    const tasks = issues.filter(i => i.parent_id != null);
    total = tasks.length;
    done = tasks.filter(i => i.status === 'closed').length;
    ready = tasks.filter(i => i.status !== 'closed' && i.status !== 'in_progress').length;
  }

  const cache = { project: projectDir, phase, done, total, ready, checkedAt: Date.now() };
  try { fs.writeFileSync(cacheFile, JSON.stringify(cache)); } catch {}
}

function checkForUpdates() {
  // Spawn background process to check for updates
  const script = `
    const https = require('https');
    const fs = require('fs');
    const path = require('path');

    const cacheFile = ${JSON.stringify(path.join(CACHE_DIR, 'update-check.json'))};
    const serverPkg = ${JSON.stringify(path.join(SERVER_DIR, 'package.json'))};

    let currentVersion = '0.0.0';
    try {
      const pkg = JSON.parse(fs.readFileSync(serverPkg, 'utf8'));
      currentVersion = pkg.version || '0.0.0';
    } catch {}

    const req = https.get('https://api.github.com/repos/fuseboxhq/breadcrumb/commits/main', {
      headers: { 'User-Agent': 'breadcrumb-update-check' },
      timeout: 5000
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const commit = JSON.parse(data);
          const latestSha = commit.sha ? commit.sha.slice(0, 7) : null;

          // Read stored sha
          let storedSha = null;
          try {
            const cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
            storedSha = cache.installed_sha;
          } catch {}

          // If we don't have a stored sha, store current and don't flag update
          if (!storedSha) {
            fs.writeFileSync(cacheFile, JSON.stringify({
              installed_sha: latestSha,
              latest_sha: latestSha,
              update_available: false,
              checkedAt: Date.now()
            }));
          } else {
            fs.writeFileSync(cacheFile, JSON.stringify({
              installed_sha: storedSha,
              latest_sha: latestSha,
              update_available: storedSha !== latestSha,
              checkedAt: Date.now()
            }));
          }
        } catch {}
      });
    });
    req.on('error', () => {});
    req.on('timeout', () => req.destroy());
  `;

  const child = spawn(process.execPath, ['-e', script], {
    detached: true,
    stdio: 'ignore'
  });
  child.unref();
}

// Main
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', async () => {
  try {
    const data = JSON.parse(input);
    const projectDir = data.cwd || data.workspace?.current_dir || process.cwd();

    ensureDir(CACHE_DIR);

    // Run all three operations concurrently
    await Promise.all([
      checkDaemonHealth(),
      warmCache(projectDir)
    ]);

    // Update check runs fully detached
    checkForUpdates();
  } catch {
    // Silent fail
  }
});
