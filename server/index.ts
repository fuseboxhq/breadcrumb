import express from 'express';
import cors from 'cors';
import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import phaseRoutes from './routes/phases.js';
import issueRoutes from './routes/issues.js';
import projectRoutes from './routes/projects.js';
import watchRoutes, { broadcastUpdate } from './routes/watch.js';
import { watchProject, unwatchAll } from './services/fileWatcher.js';
import { getRegisteredProjects } from './services/registryService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Resolve version at startup from package.json + git
const PKG_VERSION = (() => {
  try {
    const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));
    return pkg.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
})();

const GIT_SHA = (() => {
  try {
    return execSync('git rev-parse --short=7 HEAD', { cwd: __dirname, encoding: 'utf-8' }).trim();
  } catch {
    return 'unknown';
  }
})();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 9999;
const API_PORT = process.env.API_PORT ? parseInt(process.env.API_PORT) : 9998;
const isProduction = process.env.NODE_ENV === 'production';

app.use(cors());
app.use(express.json());

// API routes
app.use('/api', phaseRoutes);
app.use('/api', issueRoutes);
app.use('/api', projectRoutes);
app.use('/api', watchRoutes);

// Health/version endpoint for daemon management and UI
app.get('/__daemon/health', (_req, res) => {
  res.json({ pid: process.pid, uptime: process.uptime(), version: PKG_VERSION, sha: GIT_SHA });
});

// Shutdown endpoint for daemon management
app.post('/__daemon/shutdown', (_req, res) => {
  res.json({ status: 'shutting_down' });
  setTimeout(() => shutdown('HTTP'), 100);
});

// In production, serve the built frontend
if (isProduction) {
  const distPath = join(__dirname, '../dist');
  app.use(express.static(distPath));

  app.get('*', (req, res) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/__daemon')) return;
    res.sendFile(join(distPath, 'index.html'));
  });
}

const listenPort = isProduction ? PORT : API_PORT;

const server = app.listen(listenPort, '0.0.0.0', () => {
  console.log(`Breadcrumb server running on http://localhost:${listenPort}`);
});

// Graceful shutdown
let isShuttingDown = false;

function shutdown(signal: string): void {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`Received ${signal}, shutting down gracefully...`);

  server.close(() => {
    console.log('HTTP server closed');
    cleanup();
    process.exit(0);
  });

  setTimeout(() => {
    console.error('Graceful shutdown timed out, forcing exit');
    cleanup();
    process.exit(1);
  }, 10_000).unref();
}

function cleanup(): void {
  unwatchAll();
  // PID file cleanup will be added with daemon lifecycle task
}

// Start file watchers for all registered projects
function startWatchers(): void {
  try {
    const projects = getRegisteredProjects();
    for (const project of projects) {
      watchProject(project.path, (event, filePath) => {
        broadcastUpdate(event, filePath, project.path);
      });
    }
    if (projects.length > 0) {
      console.log(`Watching ${projects.length} project(s) for changes`);
    }
  } catch {
    // Registry may not exist yet
  }
}

startWatchers();

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
