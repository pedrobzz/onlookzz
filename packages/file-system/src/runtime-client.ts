import type { FileChangeEvent, FileEntry } from './types';

export type RuntimeEncoding = 'utf8' | 'base64';

export type RuntimeFile = {
    content: string | Uint8Array;
    hash?: string;
    modifiedTime: number;
};

export type RuntimeFileEntry = Omit<FileEntry, 'modifiedTime' | 'children'> & {
    modifiedTime?: number;
    children?: RuntimeFileEntry[];
};

export type RuntimeFileEvent = FileChangeEvent & {
    operationId?: string;
    source: 'api' | 'watcher' | 'process';
};

export type RuntimeStatus = 'idle' | 'running' | 'ready' | 'failed' | 'stopped';

export type RuntimeProcessStatus = {
    kind: 'install' | 'dev' | 'command' | 'build';
    status: RuntimeStatus;
    startedAt?: number;
    endedAt?: number;
    exitCode?: number | null;
    command?: string;
    previewPort?: number;
    error?: string;
};

type RuntimeEventPayload = {
    type: string;
    path?: string;
    oldPath?: string;
    operationId?: string;
    source: 'api' | 'watcher' | 'process';
};

export class RuntimeClient {
    private eventSource: EventSource | null = null;

    constructor(
        private readonly projectId: string,
        private readonly baseUrl = getRuntimeBaseUrl(),
    ) { }

    async health(): Promise<boolean> {
        const response = await fetch(`${this.baseUrl}/health`);
        return response.ok;
    }

    async readTree(path = '.'): Promise<RuntimeFileEntry[]> {
        return this.request<RuntimeFileEntry[]>(`/projects/${this.projectId}/tree?path=${encodeURIComponent(path)}`);
    }

    async listAll(): Promise<Array<{ path: string; type: 'file' | 'directory' }>> {
        return this.request<Array<{ path: string; type: 'file' | 'directory' }>>(`/projects/${this.projectId}/files/list`);
    }

    async readFile(path: string): Promise<RuntimeFile> {
        const response = await this.request<{
            content: string;
            encoding: RuntimeEncoding;
            hash?: string;
            modifiedTime: number;
        }>(`/projects/${this.projectId}/files/read?path=${encodeURIComponent(path)}`);

        return {
            content: response.encoding === 'base64'
                ? base64ToBytes(response.content)
                : response.content,
            hash: response.hash,
            modifiedTime: response.modifiedTime,
        };
    }

    async writeFile(path: string, content: string | Uint8Array, operationId: string): Promise<void> {
        const isBinary = content instanceof Uint8Array;
        await this.request(`/projects/${this.projectId}/files/write`, {
            method: 'POST',
            body: JSON.stringify({
                path,
                content: isBinary ? bytesToBase64(content) : content,
                encoding: isBinary ? 'base64' : 'utf8',
                operationId,
            }),
        });
    }

    async rename(oldPath: string, newPath: string, operationId: string): Promise<void> {
        await this.request(`/projects/${this.projectId}/files/rename`, {
            method: 'POST',
            body: JSON.stringify({
                oldPath,
                newPath,
                operationId,
            }),
        });
    }

    async createDirectory(path: string, operationId: string): Promise<void> {
        await this.request(`/projects/${this.projectId}/files/directory`, {
            method: 'POST',
            body: JSON.stringify({
                path,
                operationId,
            }),
        });
    }

    async delete(path: string, operationId: string): Promise<void> {
        await this.request(`/projects/${this.projectId}/files/delete`, {
            method: 'POST',
            body: JSON.stringify({
                path,
                operationId,
            }),
        });
    }

    async restartDev(): Promise<RuntimeProcessStatus> {
        return this.request<RuntimeProcessStatus>(`/projects/${this.projectId}/dev/restart`, {
            method: 'POST',
        });
    }

    async getDevStatus(): Promise<RuntimeProcessStatus> {
        return this.request<RuntimeProcessStatus>(`/projects/${this.projectId}/dev/status`);
    }

    async getDevLogs(): Promise<string[]> {
        return this.request<string[]>(`/projects/${this.projectId}/dev/logs`);
    }

    async runCommand(command: string, args: string[] = [], cwd = '.'): Promise<RuntimeProcessStatus> {
        return this.request<RuntimeProcessStatus>(`/projects/${this.projectId}/commands/run`, {
            method: 'POST',
            body: JSON.stringify({ command, args, cwd }),
        });
    }

    async getCommandStatus(): Promise<RuntimeProcessStatus> {
        return this.request<RuntimeProcessStatus>(`/projects/${this.projectId}/commands/status`);
    }

    async getCommandLogs(): Promise<string[]> {
        return this.request<string[]>(`/projects/${this.projectId}/commands/logs`);
    }

    subscribe(onEvent: (event: RuntimeFileEvent) => void): () => void {
        this.eventSource?.close();
        this.eventSource = new EventSource(`${this.baseUrl}/projects/${this.projectId}/events`);

        const handleEvent = (message: MessageEvent<string>) => {
            const payload = JSON.parse(message.data) as RuntimeEventPayload;
            if (payload.type === 'file:changed' && payload.path) {
                onEvent({
                    type: 'update',
                    path: payload.path,
                    operationId: payload.operationId,
                    source: payload.source,
                });
            } else if (payload.type === 'file:deleted' && payload.path) {
                onEvent({
                    type: 'delete',
                    path: payload.path,
                    operationId: payload.operationId,
                    source: payload.source,
                });
            } else if (payload.type === 'file:renamed' && payload.path) {
                onEvent({
                    type: 'rename',
                    path: payload.path,
                    oldPath: payload.oldPath,
                    operationId: payload.operationId,
                    source: payload.source,
                });
            } else if (payload.type === 'tree:changed') {
                onEvent({
                    type: 'update',
                    path: payload.path ?? '.',
                    operationId: payload.operationId,
                    source: payload.source,
                });
            }
        };

        for (const eventName of ['file:changed', 'file:deleted', 'file:renamed', 'tree:changed']) {
            this.eventSource.addEventListener(eventName, handleEvent);
        }

        return () => {
            for (const eventName of ['file:changed', 'file:deleted', 'file:renamed', 'tree:changed']) {
                this.eventSource?.removeEventListener(eventName, handleEvent);
            }
            this.eventSource?.close();
            this.eventSource = null;
        };
    }

    private async request<T = unknown>(pathname: string, init: RequestInit = {}): Promise<T> {
        const response = await fetch(`${this.baseUrl}${pathname}`, {
            ...init,
            headers: {
                'content-type': 'application/json',
                ...init.headers,
            },
        });

        if (!response.ok) {
            throw new Error(await response.text());
        }

        return response.json() as Promise<T>;
    }
}

function getRuntimeBaseUrl(): string {
    if (typeof window === 'undefined') {
        return process.env.ONLOOK_RUNTIME_URL ?? 'http://localhost:4317';
    }
    return 'http://localhost:4317';
}

function bytesToBase64(bytes: Uint8Array): string {
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, i + chunkSize);
        binary += String.fromCharCode(...chunk);
    }
    return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}
