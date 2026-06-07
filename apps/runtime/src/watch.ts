import chokidar, { type FSWatcher } from 'chokidar';

import { eventBus } from './events';
import { hashFile } from './files';
import { projectRoot, shouldIgnorePath, toProjectRelative } from './paths';

const watchers = new Map<string, FSWatcher>();
const pending = new Map<string, NodeJS.Timeout>();

export function watchProject(projectId: string): void {
  if (watchers.has(projectId)) {
    return;
  }

  const root = projectRoot(projectId);
  const watcher = chokidar.watch(root, {
    ignoreInitial: true,
    ignored: (watchPath) => shouldIgnorePath(watchPath),
    awaitWriteFinish: {
      stabilityThreshold: 80,
      pollInterval: 20,
    },
  });

  const coalesce = (
    key: string,
    callback: () => void | Promise<void>,
  ) => {
    const previous = pending.get(key);
    if (previous) {
      clearTimeout(previous);
    }

    pending.set(
      key,
      setTimeout(() => {
        pending.delete(key);
        void callback();
      }, 50),
    );
  };

  watcher
    .on('add', (filePath) => {
      const path = toProjectRelative(projectId, filePath);
      coalesce(`change:${path}`, async () => {
        eventBus.publish({
          type: 'file:changed',
          projectId,
          path,
          source: 'watcher',
          hash: await hashFile(filePath),
        });
        eventBus.publish({ type: 'tree:changed', projectId, path: '.', source: 'watcher' });
      });
    })
    .on('change', (filePath) => {
      const path = toProjectRelative(projectId, filePath);
      coalesce(`change:${path}`, async () => {
        eventBus.publish({
          type: 'file:changed',
          projectId,
          path,
          source: 'watcher',
          hash: await hashFile(filePath),
        });
      });
    })
    .on('unlink', (filePath) => {
      const path = toProjectRelative(projectId, filePath);
      coalesce(`delete:${path}`, () => {
        eventBus.publish({ type: 'file:deleted', projectId, path, source: 'watcher' });
        eventBus.publish({ type: 'tree:changed', projectId, path: '.', source: 'watcher' });
      });
    })
    .on('addDir', (dirPath) => {
      const path = toProjectRelative(projectId, dirPath);
      coalesce(`tree:${path}`, () => {
        eventBus.publish({ type: 'tree:changed', projectId, path, source: 'watcher' });
      });
    })
    .on('unlinkDir', (dirPath) => {
      const path = toProjectRelative(projectId, dirPath);
      coalesce(`tree:${path}`, () => {
        eventBus.publish({ type: 'tree:changed', projectId, path, source: 'watcher' });
      });
    })
    .on('error', (error) => {
      eventBus.publish({
        type: 'error',
        projectId,
        source: 'watcher',
        message: error instanceof Error ? error.message : String(error),
      });
    });

  watchers.set(projectId, watcher);
}

export async function unwatchProject(projectId: string): Promise<void> {
  const watcher = watchers.get(projectId);
  if (!watcher) {
    return;
  }
  watchers.delete(projectId);
  await watcher.close();
}
