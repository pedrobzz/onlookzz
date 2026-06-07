export const RUNTIME_EVENTS = [
  'file:changed',
  'file:deleted',
  'file:renamed',
  'tree:changed',
  'install:status',
  'install:output',
  'dev:status',
  'dev:output',
  'command:status',
  'command:output',
  'preview:ready',
  'error',
] as const;

export type RuntimeEventType = (typeof RUNTIME_EVENTS)[number];

export type RuntimeEvent = {
  type: RuntimeEventType;
  projectId: string;
  path?: string;
  oldPath?: string;
  operationId?: string;
  source: 'api' | 'watcher' | 'process';
  version?: number;
  modifiedTime?: number;
  hash?: string;
  message?: string;
  data?: unknown;
};

export type FileEntry = {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
  modifiedTime?: number;
  children?: FileEntry[];
};

export type RuntimeStatus = 'idle' | 'running' | 'ready' | 'failed' | 'stopped';

export type ProcessKind = 'install' | 'dev' | 'command' | 'build';

export type ProcessStatus = {
  kind: ProcessKind;
  status: RuntimeStatus;
  startedAt?: number;
  endedAt?: number;
  exitCode?: number | null;
  command?: string;
  previewPort?: number;
  error?: string;
};

export type StateFile = {
  install?: {
    hash: string;
    installedAt: number;
  };
  previewPort?: number;
};
