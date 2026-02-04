import { watch, type FSWatcher } from 'chokidar';
import { join } from 'path';

export type WatchCallback = (event: string, path: string) => void;

const watchers = new Map<string, FSWatcher>();

export function watchProject(projectPath: string, callback: WatchCallback): void {
  if (watchers.has(projectPath)) return;

  const planningDir = join(projectPath, '.planning');
  const beadsDir = join(projectPath, '.beads');

  const watcher = watch([planningDir, beadsDir], {
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 300,
      pollInterval: 100,
    },
  });

  watcher
    .on('add', (path) => callback('add', path))
    .on('change', (path) => callback('change', path))
    .on('unlink', (path) => callback('unlink', path));

  watchers.set(projectPath, watcher);
}

export function unwatchProject(projectPath: string): void {
  const watcher = watchers.get(projectPath);
  if (watcher) {
    watcher.close();
    watchers.delete(projectPath);
  }
}

export function unwatchAll(): void {
  for (const [path, watcher] of watchers) {
    watcher.close();
  }
  watchers.clear();
}
