import type { CodeFileSystem, FileEntry } from '@onlook/file-system';
import type { RouterConfig } from '@onlook/models';
import { makeAutoObservable } from 'mobx';
import type { ErrorManager } from '../error';
import { GitManager } from '../git';
import { detectRouterConfig } from '../pages/helper';
import { copyPreloadScriptToPublic, getLayoutPath as detectLayoutPath } from './preload-script';
import { SessionManager } from './session';

export enum PreloadScriptState {
    NOT_INJECTED = 'not-injected',
    LOADING = 'loading',
    INJECTED = 'injected'
}

export class SandboxManager {
    readonly session: SessionManager;
    readonly gitManager: GitManager;
    preloadScriptState: PreloadScriptState = PreloadScriptState.NOT_INJECTED;
    routerConfig: RouterConfig | null = null;

    constructor(
        private readonly projectId: string,
        private readonly errorManager: ErrorManager,
        private readonly fs: CodeFileSystem,
    ) {
        this.session = new SessionManager(projectId, this.errorManager);
        this.gitManager = new GitManager(this);
        makeAutoObservable(this);
    }

    async init(): Promise<void> {
        await this.session.start();
        await this.ensurePreloadScriptExists();
        await this.fs.rebuildIndex();
        await this.gitManager.init();
    }

    async getRouterConfig(): Promise<RouterConfig | null> {
        if (this.routerConfig) {
            return this.routerConfig;
        }

        this.routerConfig = await detectRouterConfig(this);
        return this.routerConfig;
    }

    private async ensurePreloadScriptExists(): Promise<void> {
        try {
            if (this.preloadScriptState !== PreloadScriptState.NOT_INJECTED) {
                return;
            }

            this.preloadScriptState = PreloadScriptState.LOADING;
            const routerConfig = await this.getRouterConfig();
            if (!routerConfig) {
                throw new Error('No router config found for preload script injection');
            }

            await copyPreloadScriptToPublic(this, routerConfig);
            this.preloadScriptState = PreloadScriptState.INJECTED;
        } catch (error) {
            console.error('[SandboxManager] Failed to ensure preload script exists:', error);
            this.preloadScriptState = PreloadScriptState.NOT_INJECTED;
        }
    }

    async getLayoutPath(): Promise<string | null> {
        const routerConfig = await this.getRouterConfig();
        if (!routerConfig) {
            return null;
        }
        return detectLayoutPath(routerConfig, (path) => this.fileExists(path));
    }

    get errors() {
        return this.errorManager.errors;
    }

    get syncEngine() {
        return null;
    }

    async readFile(path: string): Promise<string | Uint8Array> {
        return this.fs.readFile(path);
    }

    async writeFile(path: string, content: string | Uint8Array): Promise<void> {
        return this.fs.writeFile(path, content);
    }

    listAllFiles() {
        return this.fs.listAll();
    }

    async readDir(dir: string): Promise<FileEntry[]> {
        return this.fs.readDirectory(dir);
    }

    async listFilesRecursively(dir: string): Promise<string[]> {
        return this.fs.listFiles(dir);
    }

    async fileExists(path: string): Promise<boolean> {
        return this.fs.exists(path);
    }

    async copyFile(path: string, targetPath: string): Promise<void> {
        return this.fs.copyFile(path, targetPath);
    }

    async copyDirectory(path: string, targetPath: string): Promise<void> {
        return this.fs.copyDirectory(path, targetPath);
    }

    async deleteFile(path: string): Promise<void> {
        return this.fs.deleteFile(path);
    }

    async deleteDirectory(path: string): Promise<void> {
        return this.fs.deleteDirectory(path);
    }

    async rename(oldPath: string, newPath: string): Promise<void> {
        return this.fs.moveFile(oldPath, newPath);
    }

    async downloadFiles(projectName?: string): Promise<{ downloadUrl: string; fileName: string } | null> {
        console.warn('Project zip downloads are not implemented for the local runtime yet.');
        return {
            downloadUrl: '',
            fileName: `${projectName ?? 'onlook-project'}-${Date.now()}.zip`,
        };
    }

    clear(): void {
        this.preloadScriptState = PreloadScriptState.NOT_INJECTED;
        this.session.clear();
    }
}
