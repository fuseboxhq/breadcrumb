#!/usr/bin/env node
// Breadcrumb Stop Hook
// Runs bd sync to flush beads state for git on session end

const { spawn } = require('child_process');

// Spawn bd sync in background and exit immediately
try {
  const child = spawn('bd', ['sync'], {
    detached: true,
    stdio: 'ignore',
    shell: process.platform === 'win32'
  });
  child.unref();
} catch {
  // bd not installed or not in a beads project — ignore
}
