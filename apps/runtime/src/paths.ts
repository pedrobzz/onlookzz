import path from 'node:path';

export const SANDBOX_ROOT = path.resolve(
  process.env.ONLOOK_SANDBOX_ROOT ?? '.onlook/sandboxes',
);

export const EXCLUDED_DIRS = new Set([
  'node_modules',
  '.next',
  '.turbo',
  '.git',
  '.onlook',
  'dist',
  'build',
  'coverage',
]);

export function projectRoot(projectId: string): string {
  if (!/^[a-zA-Z0-9._-]+$/.test(projectId)) {
    throw new Error('Invalid project id');
  }
  return path.join(SANDBOX_ROOT, projectId);
}

export function resolveProjectPath(projectId: string, inputPath = '.'): string {
  const root = projectRoot(projectId);
  const normalizedInput = normalizeProjectInput(inputPath);
  const resolved = path.resolve(root, normalizedInput);

  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error('Path escapes project root');
  }

  return resolved;
}

function normalizeProjectInput(inputPath: string): string {
  const trimmed = inputPath.trim();
  if (trimmed === '' || trimmed === '/' || trimmed === '.') {
    return '.';
  }
  return trimmed.replace(/^\/+/, '');
}

export function toProjectRelative(projectId: string, absolutePath: string): string {
  const relative = path.relative(projectRoot(projectId), absolutePath);
  return relative === '' ? '.' : relative.split(path.sep).join('/');
}

export function shouldIgnorePath(absolutePath: string): boolean {
  return absolutePath
    .split(path.sep)
    .some((part) => EXCLUDED_DIRS.has(part));
}
