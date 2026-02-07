import { createHash } from 'crypto';
import { hostname, platform, arch, userInfo } from 'os';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const TELEMETRY_URL = 'https://breadcrumb-six.vercel.app';
const BREADCRUMB_DIR = join(homedir(), '.breadcrumb');
const CONFIG_PATH = join(BREADCRUMB_DIR, 'config.json');

interface TelemetryConfig {
  telemetry?: boolean;
}

function readConfig(): TelemetryConfig {
  try {
    if (existsSync(CONFIG_PATH)) {
      return JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
    }
  } catch {}
  return {};
}

export function isTelemetryEnabled(): boolean {
  // Environment variable override
  if (process.env.BREADCRUMB_TELEMETRY === 'false') return false;

  const config = readConfig();
  // Config file opt-out (telemetry: false means opt out)
  if (config.telemetry === false) return false;

  return true;
}

export function getMachineId(): string {
  const raw = `${hostname()}:${userInfo().username}`;
  return createHash('sha256').update(raw).digest('hex').slice(0, 16);
}

function getProjectCount(): number {
  try {
    const registryPath = join(BREADCRUMB_DIR, 'projects.json');
    if (existsSync(registryPath)) {
      const data = JSON.parse(readFileSync(registryPath, 'utf-8'));
      return Array.isArray(data) ? data.length : 0;
    }
  } catch {}
  return 0;
}

function getVersion(): string {
  try {
    const pkgPath = join(BREADCRUMB_DIR, 'server', 'package.json');
    if (existsSync(pkgPath)) {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      return pkg.version || '0.0.0';
    }
  } catch {}
  return '0.0.0';
}

// --- Command usage tracking ---

const commandBuffer = new Map<string, { count: number; firstSeen: string }>();
let flushTimer: ReturnType<typeof setInterval> | null = null;

const FLUSH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Track a command execution. Buffers in memory and flushes periodically.
 */
export function trackCommand(commandName: string): void {
  if (!isTelemetryEnabled()) return;

  const existing = commandBuffer.get(commandName);
  if (existing) {
    existing.count++;
  } else {
    commandBuffer.set(commandName, { count: 1, firstSeen: new Date().toISOString() });
  }
}

/**
 * Flush buffered command events to the telemetry endpoint.
 */
export function flushCommands(): void {
  if (!isTelemetryEnabled() || commandBuffer.size === 0) return;

  const commands = Array.from(commandBuffer.entries()).map(([name, data]) => ({
    name,
    count: data.count,
    timestamp: data.firstSeen,
  }));

  commandBuffer.clear();

  const payload = {
    machineId: getMachineId(),
    commands,
  };

  fetch(`${TELEMETRY_URL}/api/telemetry/commands`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(5000),
  }).catch(() => {
    // Silently ignore
  });
}

/**
 * Start periodic command flush timer.
 */
export function startCommandTracking(): void {
  if (!isTelemetryEnabled()) return;
  flushTimer = setInterval(flushCommands, FLUSH_INTERVAL_MS);
  flushTimer.unref(); // Don't keep the process alive
}

/**
 * Stop tracking and flush remaining events.
 */
export function stopCommandTracking(): void {
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
  flushCommands();
}

/**
 * Send a heartbeat ping on daemon startup.
 * Fire-and-forget — never blocks the daemon.
 */
export function sendHeartbeat(): void {
  if (!isTelemetryEnabled()) return;

  const payload = {
    machineId: getMachineId(),
    version: getVersion(),
    os: platform(),
    platform: platform(),
    arch: arch(),
    projectCount: getProjectCount(),
  };

  // Fire-and-forget with setTimeout to not block startup
  setTimeout(() => {
    fetch(`${TELEMETRY_URL}/api/telemetry/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    }).catch(() => {
      // Silently ignore telemetry failures
    });
  }, 1000);
}
