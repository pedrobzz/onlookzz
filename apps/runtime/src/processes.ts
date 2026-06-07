import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import type { ProcessKind, ProcessStatus, RuntimeStatus, StateFile } from './contracts';
import { eventBus } from './events';
import { ensureProjectRoot } from './files';
import { resolveProjectPath } from './paths';

const INSTALL_HASH_FILES = [
  'package.json',
  'bun.lock',
  'bun.lockb',
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
];

const LOG_LIMIT = 500;

type RuntimeProcess = {
  status: ProcessStatus;
  proc?: Bun.Subprocess<'ignore', 'pipe', 'pipe'>;
  logs: string[];
};

const state = new Map<string, Map<ProcessKind, RuntimeProcess>>();

function getRuntimeProcess(projectId: string, kind: ProcessKind): RuntimeProcess {
  let projectState = state.get(projectId);
  if (!projectState) {
    projectState = new Map();
    state.set(projectId, projectState);
  }

  let processState = projectState.get(kind);
  if (!processState) {
    processState = {
      status: {
        kind,
        status: 'idle',
      },
      logs: [],
    };
    projectState.set(kind, processState);
  }

  return processState;
}

function appendLog(projectId: string, kind: ProcessKind, chunk: string): void {
  const processState = getRuntimeProcess(projectId, kind);
  for (const line of chunk.split(/\r?\n/)) {
    if (line.length === 0) {
      continue;
    }
    processState.logs.push(line);
  }
  if (processState.logs.length > LOG_LIMIT) {
    processState.logs.splice(0, processState.logs.length - LOG_LIMIT);
  }

  eventBus.publish({
    type: kind === 'install' ? 'install:output' : kind === 'dev' ? 'dev:output' : 'command:output',
    projectId,
    source: 'process',
    data: chunk,
  });
}

function publishStatus(projectId: string, status: ProcessStatus): void {
  eventBus.publish({
    type: status.kind === 'install' ? 'install:status' : status.kind === 'dev' ? 'dev:status' : 'command:status',
    projectId,
    source: 'process',
    data: status,
  });
}

async function consumeOutput(projectId: string, kind: ProcessKind, stream: ReadableStream<Uint8Array> | null): Promise<void> {
  if (!stream) {
    return;
  }

  const decoder = new TextDecoder();
  const reader = stream.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      const text = decoder.decode(value);
      appendLog(projectId, kind, text);
      if (kind === 'dev') {
        detectPreviewReady(projectId, text);
      }
    }
  } finally {
    reader.releaseLock();
  }
}

function startProcess(projectId: string, kind: ProcessKind, command: string[], cwd: string): ProcessStatus {
  const processState = getRuntimeProcess(projectId, kind);
  if (processState.proc && processState.status.status === 'running') {
    return processState.status;
  }

  const proc = Bun.spawn(command, {
    cwd,
    stdout: 'pipe',
    stderr: 'pipe',
  });

  processState.proc = proc;
  processState.logs = [];
  processState.status = {
    kind,
    status: 'running',
    startedAt: Date.now(),
    command: command.join(' '),
  };
  publishStatus(projectId, processState.status);

  void consumeOutput(projectId, kind, proc.stdout);
  void consumeOutput(projectId, kind, proc.stderr);
  void proc.exited.then((exitCode) => {
    const status: RuntimeStatus = exitCode === 0 ? kind === 'dev' ? 'stopped' : 'ready' : 'failed';
    processState.status = {
      ...processState.status,
      status,
      exitCode,
      endedAt: Date.now(),
    };
    processState.proc = undefined;
    publishStatus(projectId, processState.status);
  });

  return processState.status;
}

async function installHash(projectId: string): Promise<string> {
  const root = await ensureProjectRoot(projectId);
  const hash = createHash('sha256');

  for (const file of INSTALL_HASH_FILES) {
    try {
      const content = await fs.readFile(path.join(root, file));
      hash.update(file);
      hash.update(content);
    } catch {
      continue;
    }
  }

  return hash.digest('hex');
}

async function readState(projectId: string): Promise<StateFile> {
  try {
    const stateFile = resolveProjectPath(projectId, '.onlook/state.json');
    return JSON.parse(await fs.readFile(stateFile, 'utf8')) as StateFile;
  } catch {
    return {};
  }
}

async function writeState(projectId: string, nextState: StateFile): Promise<void> {
  const stateFile = resolveProjectPath(projectId, '.onlook/state.json');
  await fs.mkdir(path.dirname(stateFile), { recursive: true });
  await fs.writeFile(stateFile, JSON.stringify(nextState, null, 2));
}

export async function startInstall(projectId: string): Promise<ProcessStatus> {
  const root = await ensureProjectRoot(projectId);
  const [hash, runtimeState] = await Promise.all([installHash(projectId), readState(projectId)]);
  const nodeModulesExists = await fs.stat(path.join(root, 'node_modules')).then((stats) => stats.isDirectory()).catch(() => false);

  if (runtimeState.install?.hash === hash && nodeModulesExists) {
    const processState = getRuntimeProcess(projectId, 'install');
    processState.status = {
      kind: 'install',
      status: 'ready',
      startedAt: runtimeState.install.installedAt,
      endedAt: runtimeState.install.installedAt,
      command: 'bun install',
    };
    publishStatus(projectId, processState.status);
    return processState.status;
  }

  const status = startProcess(projectId, 'install', ['bun', 'install'], root);
  const processState = getRuntimeProcess(projectId, 'install');
  void processState.proc?.exited.then(async (exitCode) => {
    if (exitCode === 0) {
      await writeState(projectId, {
        ...(await readState(projectId)),
        install: {
          hash,
          installedAt: Date.now(),
        },
      });
    }
  });
  return status;
}

export async function startDev(projectId: string): Promise<ProcessStatus> {
  const root = await ensureProjectRoot(projectId);
  const runtimeState = await readState(projectId);
  const previewPort = runtimeState.previewPort ?? await reservePreviewPort(projectId);
  await writeState(projectId, {
    ...runtimeState,
    previewPort,
  });

  const status = startProcess(projectId, 'dev', ['bun', 'run', 'dev', '--port', String(previewPort)], root);
  status.previewPort = previewPort;
  publishStatus(projectId, status);
  void probePreview(projectId, previewPort);
  return status;
}

export async function restartDev(projectId: string): Promise<ProcessStatus> {
  await stopProcess(projectId, 'dev');
  return startDev(projectId);
}

export async function stopProcess(projectId: string, kind: ProcessKind): Promise<ProcessStatus> {
  const processState = getRuntimeProcess(projectId, kind);
  processState.proc?.kill();
  processState.proc = undefined;
  processState.status = {
    ...processState.status,
    status: 'stopped',
    endedAt: Date.now(),
  };
  publishStatus(projectId, processState.status);
  return processState.status;
}

export async function runCommand(projectId: string, command: string, args: string[] = [], cwd = '.'): Promise<ProcessStatus> {
  const root = await ensureProjectRoot(projectId);
  const commandCwd = resolveProjectPath(projectId, cwd);
  if (!commandCwd.startsWith(root)) {
    throw new Error('Command cwd escapes project root');
  }
  return startProcess(projectId, 'command', [command, ...args], commandCwd);
}

export function getStatus(projectId: string, kind: ProcessKind): ProcessStatus {
  return getRuntimeProcess(projectId, kind).status;
}

export function getLogs(projectId: string, kind: ProcessKind): string[] {
  return [...getRuntimeProcess(projectId, kind).logs];
}

async function reservePreviewPort(projectId: string): Promise<number> {
  const hash = createHash('sha256').update(projectId).digest();
  const start = 4200 + (hash[0] ?? 0);
  for (let port = start; port < start + 200; port++) {
    if (await canBind(port)) {
      return port;
    }
  }
  return 4321;
}

async function canBind(port: number): Promise<boolean> {
  try {
    const server = Bun.serve({
      port,
      fetch: () => new Response('ok'),
    });
    server.stop(true);
    return true;
  } catch {
    return false;
  }
}

function detectPreviewReady(projectId: string, output: string): void {
  const urlMatch = output.match(/https?:\/\/(?:localhost|127\.0\.0\.1):(\d+)/);
  if (!urlMatch?.[1]) {
    return;
  }
  eventBus.publish({
    type: 'preview:ready',
    projectId,
    source: 'process',
    data: {
      port: Number(urlMatch[1]),
      url: `http://localhost:${urlMatch[1]}`,
    },
  });
}

async function probePreview(projectId: string, port: number): Promise<void> {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const response = await fetch(`http://localhost:${port}`, { method: 'HEAD' });
      if (response.ok || response.status < 500) {
        eventBus.publish({
          type: 'preview:ready',
          projectId,
          source: 'process',
          data: {
            port,
            url: `http://localhost:${port}`,
          },
        });
        return;
      }
    } catch {
      await Bun.sleep(500);
    }
  }
}
