import debounce from 'lodash.debounce';

import { ONLOOK_CACHE_DIRECTORY, ONLOOK_PRELOAD_SCRIPT_FILE } from '@onlook/constants';
import { RouterType } from '@onlook/models';
import {
    addOidsToAst,
    createTemplateNodeMap,
    formatContent,
    getAstFromContent,
    getContentFromAst,
    getContentFromTemplateNode,
    injectPreloadScript,
} from '@onlook/parser';
import { isRootLayoutFile, pathsEqual } from '@onlook/utility';

import type { JsxElementMetadata } from './index-cache';
import { FileSystem } from './fs';
import {
    clearIndexCache,
    getIndexFromCache,
    getOrLoadIndex,
    saveIndexToCache,
} from './index-cache';
import { RuntimeClient, type RuntimeFileEntry, type RuntimeFileEvent } from './runtime-client';
import type { FileChangeEvent, FileEntry } from './types';

export type { JsxElementMetadata } from './index-cache';

export interface CodeEditorOptions {
    routerType?: RouterType;
}

export type WriteState = 'dirty' | 'synced' | 'failed';

export class CodeFileSystem extends FileSystem {
    private projectId: string;
    private options: Required<CodeEditorOptions>;
    private runtime: RuntimeClient;
    private runtimeUnsubscribe: (() => void) | null = null;
    private operationIds = new Set<string>();
    private writeStates = new Map<string, WriteState>();
    private fileWatchers = new Map<string, Set<(event: FileChangeEvent) => void>>();
    private directoryWatchers = new Map<string, Set<(event: FileChangeEvent) => void>>();
    private indexPath = `${ONLOOK_CACHE_DIRECTORY}/index.json`;

    constructor(projectId: string, options: CodeEditorOptions = {}) {
        super(`/${projectId}`);
        this.projectId = projectId;
        this.runtime = new RuntimeClient(projectId);
        this.options = {
            routerType: options.routerType ?? RouterType.APP,
        };
    }

    async initialize(): Promise<void> {
        await super.initialize();
        await this.hydrateFromRuntime();
        this.runtimeUnsubscribe = this.runtime.subscribe((event) => {
            void this.applyRuntimeEvent(event);
        });
    }

    async readFile(path: string): Promise<string | Uint8Array> {
        try {
            return await super.readFile(path);
        } catch {
            const file = await this.runtime.readFile(path);
            await super.writeFile(path, file.content);
            return file.content;
        }
    }

    async writeFile(path: string, content: string | Uint8Array): Promise<void> {
        const operationId = this.createOperationId();
        let contentToWrite = content;
        if (this.isJsxFile(path) && typeof content === 'string') {
            contentToWrite = await this.processJsxFile(path, content);
        }

        this.operationIds.add(operationId);
        this.writeStates.set(path, 'dirty');
        await super.writeFile(path, contentToWrite);
        this.notifyWatchers({ type: 'update', path });

        try {
            await this.runtime.writeFile(path, contentToWrite, operationId);
            this.writeStates.set(path, 'synced');
        } catch (error) {
            this.writeStates.set(path, 'failed');
            throw error;
        } finally {
            this.operationIds.delete(operationId);
        }
    }

    async writeFiles(files: Array<{ path: string; content: string | Uint8Array }>): Promise<void> {
        // Write files sequentially to avoid race conditions to metadata file
        for (const { path, content } of files) {
            await this.writeFile(path, content);
        }
    }

    private async processJsxFile(path: string, content: string): Promise<string> {
        let processedContent = content;

        const ast = getAstFromContent(content);
        if (ast) {
            if (isRootLayoutFile(path, this.options.routerType)) {
                injectPreloadScript(ast);
            }

            const existingOids = await this.getFileOids(path);
            const { ast: processedAst } = addOidsToAst(ast, existingOids);

            processedContent = await getContentFromAst(processedAst, content);
        } else {
            console.warn(`Failed to parse ${path}, skipping OID injection but will still format`);
        }

        const formattedContent = await formatContent(path, processedContent);
        await this.updateMetadataForFile(path, formattedContent);

        return formattedContent;
    }

    private async getFileOids(path: string): Promise<Set<string>> {
        const index = await this.loadIndex();

        const oids = new Set<string>();
        for (const [oid, metadata] of Object.entries(index)) {
            if (pathsEqual(metadata.path, path)) {
                oids.add(oid);
            }
        }
        return oids;
    }

    private async updateMetadataForFile(path: string, content: string): Promise<void> {
        const index = await this.loadIndex();

        for (const [oid, metadata] of Object.entries(index)) {
            if (pathsEqual(metadata.path, path)) {
                delete index[oid];
            }
        }

        const ast = getAstFromContent(content);
        if (!ast) return;

        const templateNodeMap = createTemplateNodeMap({
            ast,
            filename: path,
            branchId: this.projectId,
        });

        for (const [oid, node] of templateNodeMap.entries()) {
            const code = await getContentFromTemplateNode(node, content);
            const metadata: JsxElementMetadata = {
                ...node,
                oid,
                code: code || '',
            };
            index[oid] = metadata;
        }

        await this.saveIndex(index);
    }

    async getJsxElementMetadata(oid: string): Promise<JsxElementMetadata | undefined> {
        const index = await this.loadIndex();
        const metadata = index[oid];
        if (!metadata) {
            console.warn(
                `[CodeEditorApi] No metadata found for OID: ${oid}. Total index size: ${Object.keys(index).length}`,
            );
        }
        return metadata;
    }

    async rebuildIndex(): Promise<void> {
        const startTime = Date.now();
        const index: Record<string, JsxElementMetadata> = {};

        const entries = await this.listAll();
        const jsxFiles = entries.filter(
            (entry) => entry.type === 'file' && this.isJsxFile(entry.path),
        );

        const BATCH_SIZE = 10;
        let processedCount = 0;

        for (let i = 0; i < jsxFiles.length; i += BATCH_SIZE) {
            const batch = jsxFiles.slice(i, i + BATCH_SIZE);
            await Promise.all(
                batch.map(async (entry) => {
                    try {
                        const content = await this.readFile(entry.path);
                        if (typeof content === 'string') {
                            const ast = getAstFromContent(content);
                            if (!ast) return;

                            const templateNodeMap = createTemplateNodeMap({
                                ast,
                                filename: entry.path,
                                branchId: this.projectId,
                            });

                            for (const [oid, node] of templateNodeMap.entries()) {
                                const code = await getContentFromTemplateNode(node, content);
                                index[oid] = {
                                    ...node,
                                    oid,
                                    code: code || '',
                                };
                            }

                            processedCount++;
                        }
                    } catch (error) {
                        console.error(`Error indexing ${entry.path}:`, error);
                    }
                }),
            );
        }

        await this.saveIndex(index);

        const duration = Date.now() - startTime;
        console.log(
            `[CodeEditorApi] Index built: ${Object.keys(index).length} elements from ${processedCount} files in ${duration}ms`,
        );
    }

    async deleteFile(path: string): Promise<void> {
        const operationId = this.createOperationId();
        this.operationIds.add(operationId);
        await super.deleteFile(path);
        this.notifyWatchers({ type: 'delete', path });

        if (this.isJsxFile(path)) {
            const index = await this.loadIndex();
            let hasChanges = false;

            for (const [oid, metadata] of Object.entries(index)) {
                if (pathsEqual(metadata.path, path)) {
                    delete index[oid];
                    hasChanges = true;
                }
            }

            if (hasChanges) {
                await this.saveIndex(index);
            }
        }

        try {
            await this.runtime.delete(path, operationId);
        } finally {
            this.operationIds.delete(operationId);
        }
    }

    async moveFile(oldPath: string, newPath: string): Promise<void> {
        const operationId = this.createOperationId();
        this.operationIds.add(operationId);
        await super.moveFile(oldPath, newPath);
        this.notifyWatchers({ type: 'rename', path: newPath, oldPath });

        if (this.isJsxFile(oldPath) && this.isJsxFile(newPath)) {
            const index = await this.loadIndex();
            let hasChanges = false;

            for (const metadata of Object.values(index)) {
                if (pathsEqual(metadata.path, oldPath)) {
                    metadata.path = newPath;
                    hasChanges = true;
                }
            }

            if (hasChanges) {
                await this.saveIndex(index);
            }
        }

        try {
            await this.runtime.rename(oldPath, newPath, operationId);
        } finally {
            this.operationIds.delete(operationId);
        }
    }

    async createDirectory(path: string): Promise<void> {
        const operationId = this.createOperationId();
        this.operationIds.add(operationId);
        await super.createDirectory(path);
        this.notifyWatchers({ type: 'create', path });

        try {
            await this.runtime.createDirectory(path, operationId);
        } finally {
            this.operationIds.delete(operationId);
        }
    }

    async readDirectory(path = '/'): Promise<FileEntry[]> {
        const entries = await this.runtime.readTree(path);
        return entries.map(normalizeRuntimeEntry);
    }

    async listAll(): Promise<Array<{ path: string; type: 'file' | 'directory' }>> {
        return this.runtime.listAll();
    }

    async listFiles(pattern = '**/*'): Promise<string[]> {
        const files = (await this.listAll())
            .filter((entry) => entry.type === 'file')
            .map((entry) => normalizePath(entry.path));
        const normalizedPattern = normalizePath(pattern);

        if (normalizedPattern === '**/*') {
            return files;
        }

        if (normalizedPattern.endsWith('/**/*')) {
            const directory = normalizedPattern.slice(0, -'/**/*'.length);
            return files.filter((file) => isPathInside(directory, file));
        }

        if (!normalizedPattern.includes('*')) {
            return files.filter((file) => file === normalizedPattern || isPathInside(normalizedPattern, file));
        }

        const regex = new RegExp(`^${patternToRegex(normalizedPattern)}$`);
        return files.filter((file) => regex.test(file));
    }

    async deleteDirectory(path: string): Promise<void> {
        await this.deleteFile(path);
    }

    async moveDirectory(from: string, to: string): Promise<void> {
        await this.moveFile(from, to);
    }

    async copyDirectory(from: string, to: string): Promise<void> {
        const normalizedFrom = normalizePath(from);
        const normalizedTo = normalizePath(to);
        const files = await this.listFiles(normalizedFrom === '.' ? '**/*' : `${normalizedFrom}/**/*`);

        await Promise.all(files.map(async (filePath) => {
            const content = await this.readFile(filePath);
            const targetPath = normalizedFrom === '.'
                ? `${normalizedTo}/${filePath}`
                : filePath.replace(normalizedFrom, normalizedTo);
            await this.writeFile(targetPath, content);
        }));
    }

    watchFile(path: string, callback: (event: FileChangeEvent) => void) {
        const watchers = this.fileWatchers.get(path) ?? new Set();
        watchers.add(callback);
        this.fileWatchers.set(path, watchers);
        return () => {
            watchers.delete(callback);
            if (watchers.size === 0) {
                this.fileWatchers.delete(path);
            }
        };
    }

    watchDirectory(path: string, callback: (event: FileChangeEvent) => void) {
        const watchers = this.directoryWatchers.get(path) ?? new Set();
        watchers.add(callback);
        this.directoryWatchers.set(path, watchers);
        return () => {
            watchers.delete(callback);
            if (watchers.size === 0) {
                this.directoryWatchers.delete(path);
            }
        };
    }

    getWriteState(path: string): WriteState | undefined {
        return this.writeStates.get(path);
    }

    private async hydrateFromRuntime(): Promise<void> {
        await this.runtime.health();
    }

    private async applyRuntimeEvent(event: RuntimeFileEvent): Promise<void> {
        if (event.operationId && this.operationIds.has(event.operationId)) {
            return;
        }

        if (event.type === 'delete') {
            try {
                await super.deleteFile(event.path);
            } catch {
                // Local cache may not have loaded this path yet.
            }
            this.notifyWatchers(event);
            return;
        }

        if (event.type === 'rename' && event.oldPath) {
            try {
                await super.moveFile(event.oldPath, event.path);
            } catch {
                await this.syncPathFromRuntime(event.path);
            }
            this.notifyWatchers(event);
            return;
        }

        if (event.path !== '.') {
            await this.syncPathFromRuntime(event.path);
        }
        this.notifyWatchers(event);
    }

    private async syncPathFromRuntime(path: string): Promise<void> {
        try {
            const file = await this.runtime.readFile(path);
            await super.writeFile(path, file.content);
            this.writeStates.set(path, 'synced');
        } catch {
            // Directory-level events do not map to readable files.
        }
    }

    private notifyWatchers(event: FileChangeEvent): void {
        this.fileWatchers.get(event.path)?.forEach((callback) => callback(event));

        for (const [directory, callbacks] of this.directoryWatchers.entries()) {
            if (isPathInside(directory, event.path) || (event.oldPath && isPathInside(directory, event.oldPath))) {
                callbacks.forEach((callback) => callback(event));
            }
        }
    }

    private createOperationId(): string {
        return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
    }

    private async loadIndex(): Promise<Record<string, JsxElementMetadata>> {
        return getOrLoadIndex(this.getCacheKey(), this.indexPath, (path) => this.readFile(path));
    }

    private async saveIndex(index: Record<string, JsxElementMetadata>): Promise<void> {
        saveIndexToCache(this.getCacheKey(), index);
        void this.debouncedSaveIndexToFile();
    }

    private async undobounceSaveIndexToFile(): Promise<void> {
        try {
            await this.createDirectory(ONLOOK_CACHE_DIRECTORY);
        } catch {
            console.warn(`[CodeEditorApi] Failed to create ${ONLOOK_CACHE_DIRECTORY} directory`);
        }
        const index = getIndexFromCache(this.getCacheKey());
        if (index) {
            await super.writeFile(this.indexPath, JSON.stringify(index));
        }
    }

    private debouncedSaveIndexToFile = debounce(() => void this.undobounceSaveIndexToFile(), 1000);

    private isJsxFile(path: string): boolean {
        // Exclude the onlook preload script from JSX processing
        if (path.endsWith(ONLOOK_PRELOAD_SCRIPT_FILE)) {
            return false;
        }
        return /\.(jsx?|tsx?)$/i.test(path);
    }

    async cleanup(): Promise<void> {
        const cacheKey = this.getCacheKey();
        if (getIndexFromCache(cacheKey)) {
            await this.undobounceSaveIndexToFile();
        }

        this.runtimeUnsubscribe?.();
        this.runtimeUnsubscribe = null;
        this.fileWatchers.clear();
        this.directoryWatchers.clear();
        super.cleanup();
        clearIndexCache(cacheKey);
    }

    private getCacheKey(): string {
        return this.projectId;
    }
}

function normalizeRuntimeEntry(entry: RuntimeFileEntry): FileEntry {
    return {
        ...entry,
        modifiedTime: typeof entry.modifiedTime === 'number' ? new Date(entry.modifiedTime) : undefined,
        children: entry.children?.map(normalizeRuntimeEntry),
    };
}

function isPathInside(directory: string, filePath: string): boolean {
    const normalizedDirectory = normalizePath(directory);
    const normalizedFilePath = normalizePath(filePath);

    if (normalizedDirectory === '.' || normalizedDirectory === '') {
        return true;
    }
    return normalizedFilePath === normalizedDirectory || normalizedFilePath.startsWith(`${normalizedDirectory}/`);
}

function normalizePath(path: string): string {
    return path.replace(/^\/+/, '').replace(/\/+$/, '') || '.';
}

function patternToRegex(pattern: string): string {
    return pattern
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\*\*/g, '__DOUBLE_STAR__')
        .replace(/\*/g, '[^/]*')
        .replace(/__DOUBLE_STAR__/g, '.*');
}
