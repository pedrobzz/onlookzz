import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import type { FileEntry } from './contracts';
import { eventBus } from './events';
import { EXCLUDED_DIRS, resolveProjectPath, shouldIgnorePath, toProjectRelative } from './paths';

export async function ensureProjectRoot(projectId: string): Promise<string> {
  const root = resolveProjectPath(projectId);
  await fs.mkdir(root, { recursive: true });
  return root;
}

export async function hashFile(absolutePath: string): Promise<string | undefined> {
  try {
    const content = await fs.readFile(absolutePath);
    return createHash('sha256').update(content).digest('hex');
  } catch {
    return undefined;
  }
}

export async function readTree(projectId: string, inputPath = '.'): Promise<FileEntry[]> {
  const root = await ensureProjectRoot(projectId);
  const start = resolveProjectPath(projectId, inputPath);

  async function readDir(dir: string): Promise<FileEntry[]> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const result: FileEntry[] = [];

    for (const entry of entries) {
      if (EXCLUDED_DIRS.has(entry.name)) {
        continue;
      }

      const absolutePath = path.join(dir, entry.name);
      if (shouldIgnorePath(absolutePath)) {
        continue;
      }

      const stats = await fs.stat(absolutePath);
      const fileEntry: FileEntry = {
        name: entry.name,
        path: toProjectRelative(projectId, absolutePath),
        isDirectory: entry.isDirectory(),
        size: stats.size,
        modifiedTime: stats.mtimeMs,
      };

      if (entry.isDirectory()) {
        fileEntry.children = await readDir(absolutePath);
      }

      result.push(fileEntry);
    }

    result.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) {
        return a.isDirectory ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    return result;
  }

  if (!start.startsWith(root)) {
    throw new Error('Invalid tree path');
  }

  return readDir(start);
}

export async function listAll(projectId: string): Promise<Array<{ path: string; type: 'file' | 'directory' }>> {
  const root = await ensureProjectRoot(projectId);
  const paths: Array<{ path: string; type: 'file' | 'directory' }> = [];

  async function walk(dir: string): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (EXCLUDED_DIRS.has(entry.name)) {
        continue;
      }

      const absolutePath = path.join(dir, entry.name);
      const relativePath = toProjectRelative(projectId, absolutePath);
      if (entry.isDirectory()) {
        paths.push({ path: relativePath, type: 'directory' });
        await walk(absolutePath);
      } else if (entry.isFile()) {
        paths.push({ path: relativePath, type: 'file' });
      }
    }
  }

  await walk(root);
  return paths;
}

export async function readFile(projectId: string, inputPath: string): Promise<{ content: string; hash?: string; modifiedTime: number }> {
  const absolutePath = resolveProjectPath(projectId, inputPath);
  const [content, stats] = await Promise.all([
    fs.readFile(absolutePath, 'utf8'),
    fs.stat(absolutePath),
  ]);
  return {
    content,
    hash: createHash('sha256').update(content).digest('hex'),
    modifiedTime: stats.mtimeMs,
  };
}

export async function writeFile(projectId: string, inputPath: string, content: string, operationId?: string): Promise<void> {
  const absolutePath = resolveProjectPath(projectId, inputPath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, content);
  const [stats, hash] = await Promise.all([fs.stat(absolutePath), hashFile(absolutePath)]);

  eventBus.publish({
    type: 'file:changed',
    projectId,
    path: toProjectRelative(projectId, absolutePath),
    operationId,
    source: 'api',
    modifiedTime: stats.mtimeMs,
    hash,
  });
  eventBus.publish({
    type: 'tree:changed',
    projectId,
    path: '.',
    operationId,
    source: 'api',
  });
}

export async function renamePath(projectId: string, oldPath: string, newPath: string, operationId?: string): Promise<void> {
  const oldAbsolutePath = resolveProjectPath(projectId, oldPath);
  const newAbsolutePath = resolveProjectPath(projectId, newPath);
  await fs.mkdir(path.dirname(newAbsolutePath), { recursive: true });
  await fs.rename(oldAbsolutePath, newAbsolutePath);

  eventBus.publish({
    type: 'file:renamed',
    projectId,
    path: toProjectRelative(projectId, newAbsolutePath),
    oldPath: toProjectRelative(projectId, oldAbsolutePath),
    operationId,
    source: 'api',
  });
  eventBus.publish({
    type: 'tree:changed',
    projectId,
    path: '.',
    operationId,
    source: 'api',
  });
}

export async function deletePath(projectId: string, inputPath: string, operationId?: string): Promise<void> {
  const absolutePath = resolveProjectPath(projectId, inputPath);
  await fs.rm(absolutePath, { recursive: true, force: true });

  eventBus.publish({
    type: 'file:deleted',
    projectId,
    path: toProjectRelative(projectId, absolutePath),
    operationId,
    source: 'api',
  });
  eventBus.publish({
    type: 'tree:changed',
    projectId,
    path: '.',
    operationId,
    source: 'api',
  });
}
