import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, unlinkSync, openSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { createConnection } from 'node:net';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = dirname(__dirname);

const BREADCRUMB_DIR = join(homedir(), '.breadcrumb');
const PID_FILE = join(BREADCRUMB_DIR, 'daemon.pid');
const OUT_LOG = join(BREADCRUMB_DIR, 'daemon.out.log');
const ERR_LOG = join(BREADCRUMB_DIR, 'daemon.err.log');
const PORT = 9999;

function ensureDir(): void {
  if (!existsSync(BREADCRUMB_DIR)) {
    mkdirSync(BREADCRUMB_DIR, { recursive: true });
  }
}

function readPid(): number | null {
  try {
    const content = readFileSync(PID_FILE, 'utf-8').trim();
    const pid = parseInt(content, 10);
    return Number.isNaN(pid) ? null : pid;
  } catch {
    return null;
  }
}

function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err: any) {
    return err.code === 'EPERM';
  }
}

function removePid(): void {
  try {
    unlinkSync(PID_FILE);
  } catch {
    // ignore
  }
}

function getDaemonPid(): number | null {
  const pid = readPid();
  if (pid === null) return null;
  if (isProcessRunning(pid)) return pid;
  removePid();
  return null;
}

function isPortInUse(port: number, host = '127.0.0.1'): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ port, host });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => {
      socket.destroy();
      resolve(false);
    });
    socket.setTimeout(1000);
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
  });
}

function waitForPort(port: number, timeout = 10_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeout;
    const check = async () => {
      if (await isPortInUse(port)) {
        resolve();
      } else if (Date.now() > deadline) {
        reject(new Error(`Port ${port} not reachable after ${timeout}ms`));
      } else {
        setTimeout(check, 300);
      }
    };
    check();
  });
}

// Resolve tsx binary — check local node_modules, then PATH
// Returns { command, prefixArgs } so we can handle Windows correctly.
// On Windows, .bin/ contains .cmd shims that can't be spawned directly
// without shell:true (which pops up a console window). Instead, we find
// the tsx package's JS entry point and run it with node.
function findTsx(): { command: string; prefixArgs: string[] } {
  if (process.platform === 'win32') {
    // Try tsx's JS entry point directly (avoids .cmd shim issues)
    const tsxCli = join(PROJECT_ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');
    if (existsSync(tsxCli)) {
      return { command: process.execPath, prefixArgs: [tsxCli] };
    }
  }

  const localTsx = join(PROJECT_ROOT, 'node_modules', '.bin', 'tsx');
  if (existsSync(localTsx)) return { command: localTsx, prefixArgs: [] };

  // Fall back to global tsx (if installed globally)
  return { command: 'tsx', prefixArgs: [] };
}

async function handleStart(): Promise<void> {
  const existingPid = getDaemonPid();
  if (existingPid && await isPortInUse(PORT)) {
    console.log(`Breadcrumb daemon already running (PID: ${existingPid}) on port ${PORT}`);
    console.log(`  UI: http://localhost:${PORT}`);
    return;
  }

  if (existingPid) {
    removePid();
  }

  if (await isPortInUse(PORT)) {
    console.error(`Error: Port ${PORT} is already in use by another process`);
    process.exit(1);
  }

  ensureDir();
  const out = openSync(OUT_LOG, 'a');
  const err = openSync(ERR_LOG, 'a');

  const tsx = findTsx();
  const serverEntry = join(__dirname, 'index.ts');

  const child = spawn(tsx.command, [...tsx.prefixArgs, serverEntry], {
    detached: true,
    windowsHide: true,
    stdio: ['ignore', out, err],
    cwd: PROJECT_ROOT,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      DAEMON_MODE: 'true',
    },
  });

  writeFileSync(PID_FILE, String(child.pid), 'utf-8');
  child.unref();

  console.log(`Starting Breadcrumb daemon (PID: ${child.pid})...`);

  try {
    await waitForPort(PORT);
    console.log(`Breadcrumb daemon ready at http://localhost:${PORT}`);
  } catch {
    console.error('Daemon failed to start. Check logs at:', ERR_LOG);
    process.exit(1);
  }
}

async function handleStop(): Promise<void> {
  const pid = getDaemonPid();
  if (!pid) {
    console.log('Breadcrumb daemon is not running');
    return;
  }

  try {
    const res = await fetch(`http://localhost:${PORT}/__daemon/shutdown`, {
      method: 'POST',
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      console.log('Shutdown signal sent, waiting...');
      const deadline = Date.now() + 10_000;
      while (Date.now() < deadline) {
        if (!(await isPortInUse(PORT))) {
          console.log('Breadcrumb daemon stopped');
          return;
        }
        await new Promise(r => setTimeout(r, 500));
      }
    }
  } catch {
    // HTTP failed, fall back to signal
  }

  try {
    process.kill(pid, 'SIGTERM');
    console.log(`Sent SIGTERM to PID ${pid}`);
  } catch {
    console.log('Process already gone');
  }
  removePid();
}

async function handleStatus(): Promise<void> {
  const pid = getDaemonPid();
  const portUp = await isPortInUse(PORT);

  if (pid && portUp) {
    try {
      const res = await fetch(`http://localhost:${PORT}/__daemon/health`);
      const data = await res.json() as { pid: number; uptime: number };
      console.log(`Breadcrumb daemon running`);
      console.log(`  PID:    ${data.pid}`);
      console.log(`  Uptime: ${Math.floor(data.uptime)}s`);
      console.log(`  UI:     http://localhost:${PORT}`);
    } catch {
      console.log(`Daemon running (PID: ${pid}) but health check failed`);
    }
  } else if (pid && !portUp) {
    console.log(`Stale PID file (PID: ${pid}), port ${PORT} not in use`);
    removePid();
  } else if (!pid && portUp) {
    console.log(`Port ${PORT} is in use by an unknown process (no PID file)`);
  } else {
    console.log('Breadcrumb daemon is not running');
  }
}

async function handleRegister(projectPath: string, projectName: string): Promise<void> {
  // Register locally in the file-based registry
  const registryFile = join(BREADCRUMB_DIR, 'projects.json');
  ensureDir();

  let projects: Array<{ path: string; name: string; registeredAt: string }> = [];
  try {
    projects = JSON.parse(readFileSync(registryFile, 'utf-8'));
  } catch {
    // empty or missing
  }

  const existing = projects.find(p => p.path === projectPath);
  if (existing) {
    existing.name = projectName;
  } else {
    projects.push({ path: projectPath, name: projectName, registeredAt: new Date().toISOString() });
  }
  writeFileSync(registryFile, JSON.stringify(projects, null, 2));

  // If the daemon is running, also register via HTTP so it picks up the watcher
  if (await isPortInUse(PORT)) {
    try {
      await fetch(`http://localhost:${PORT}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: projectPath, name: projectName }),
        signal: AbortSignal.timeout(3000),
      });
    } catch {
      // Daemon might not be responding, file registry is still updated
    }
  }

  console.log(`Registered project: ${projectName} (${projectPath})`);
}

// CLI entry point
const command = process.argv[2];

switch (command) {
  case 'start':
    handleStart();
    break;
  case 'stop':
    handleStop();
    break;
  case 'status':
    handleStatus();
    break;
  case 'register': {
    const projectPath = process.argv[3];
    const projectName = process.argv[4] || dirname(projectPath || '').split('/').pop() || 'unknown';
    if (!projectPath) {
      console.error('Usage: breadcrumb register <project-path> [project-name]');
      process.exit(1);
    }
    handleRegister(projectPath, projectName);
    break;
  }
  default:
    console.log('Usage: breadcrumb <start|stop|status|register>');
    console.log('');
    console.log('Commands:');
    console.log('  start                         Start the Breadcrumb daemon');
    console.log('  stop                          Stop the Breadcrumb daemon');
    console.log('  status                        Show daemon status');
    console.log('  register <path> [name]        Register a project');
    break;
}
