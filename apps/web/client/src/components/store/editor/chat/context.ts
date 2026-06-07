import { ChatType, type DomElement } from '@onlook/models';
import {
    MessageContextType,
    type AgentRuleMessageContext,
    type ErrorMessageContext,
    type FileMessageContext,
    type HighlightMessageContext,
    type MessageContext
} from '@onlook/models/chat';
import { assertNever } from '@onlook/utility';
import { makeAutoObservable, reaction } from 'mobx';
import { type EditorEngine } from '../engine';

export class ChatContext {
    private _context: MessageContext[] = [];
    private selectedReactionDisposer?: () => void;

    constructor(private editorEngine: EditorEngine) {
        makeAutoObservable(this);
    }

    init() {
        this.selectedReactionDisposer = reaction(
            () => ({
                elements: this.editorEngine.elements.selected,
                frames: this.editorEngine.frames.selected,
            }),
            (
                { elements, frames },
            ) => {
                this.generateContextFromReaction({ elements, frames }).then((context) => {
                    // Preserve some context when edited element changes
                    const allHighlights = this._context.filter(c => c.type === MessageContextType.HIGHLIGHT);
                    const manualCodeEditorHighlights = allHighlights.filter(c => c.oid === undefined);
                    const existingImages = this._context.filter(
                        (c) => c.type === MessageContextType.IMAGE
                    );
                    this.context = [...context, ...manualCodeEditorHighlights, ...existingImages];
                });
            },
        );
    }

    get context(): MessageContext[] {
        return this._context;
    }

    set context(context: MessageContext[]) {
        this._context = context;
    }

    addContexts(contexts: MessageContext[]) {
        const newContexts = [...this._context, ...contexts];

        // Deduplicate file contexts by path.
        const fileMap = new Map<string, FileMessageContext>();
        // Deduplicate highlight contexts by path, start, and end.
        const highlightMap = new Map<string, HighlightMessageContext>();
        const otherContexts: MessageContext[] = [];

        for (const context of newContexts) {
            if (context.type === MessageContextType.FILE) {
                const key = context.path;
                // Keep the most recent file context (last one wins)
                fileMap.set(key, context);
            } else if (context.type === MessageContextType.HIGHLIGHT) {
                const key = `${context.path}::${context.start}::${context.end}`;
                // Keep the most recent highlight context (last one wins)
                highlightMap.set(key, context);
            } else {
                otherContexts.push(context);
            }
        }

        this._context = [...Array.from(fileMap.values()), ...Array.from(highlightMap.values()), ...otherContexts];
    }

    addHighlightContext(path: string, content: string, start: number, end: number, projectId: string, displayName: string) {
        const highlightContext: HighlightMessageContext = {
            type: MessageContextType.HIGHLIGHT,
            path,
            content,
            displayName,
            start,
            end,
            projectId,
        };
        this.addContexts([highlightContext]);
    }

    async getContextByChatType(type: ChatType): Promise<MessageContext[]> {
        switch (type) {
            case ChatType.EDIT:
            case ChatType.CREATE:
            case ChatType.ASK:
                return await this.getChatEditContext();
            case ChatType.FIX:
                return this.getErrorContext();
            default:
                assertNever(type);
        }
    }

    async getChatEditContext(): Promise<MessageContext[]> {
        return [
            ...await this.getRefreshedContext(this.context),
            ...await this.getAgentRuleContext()
        ];
    }

    private async generateContextFromReaction({ elements }: { elements: DomElement[], frames: unknown[] }): Promise<MessageContext[]> {
        let highlightedContext: HighlightMessageContext[] = [];
        if (elements.length) {
            highlightedContext = await this.getHighlightedContext(elements);
        }

        // Derived from highlighted context - images are managed separately now
        const fileContext = await this.getFileContext(highlightedContext);
        const context = [...fileContext, ...highlightedContext];
        return context;
    }

    async getRefreshedContext(context: MessageContext[]): Promise<MessageContext[]> {
        // Refresh the context if possible. Files and highlight content may have changed since the last time they were added to the context.
        // Images are not refreshed as they are not editable.
        return (await Promise.all(
            context.map(async (c) => {
                if (c.type === MessageContextType.FILE && 'projectId' in c && c.projectId) {
                    const fileContent = await this.editorEngine.fileSystem.readFile(c.path);
                    if (fileContent instanceof Uint8Array) {
                        console.error('File is binary', c.path);
                        return c;
                    }
                    return { ...c, content: fileContent } satisfies FileMessageContext;
                } else if (c.type === MessageContextType.HIGHLIGHT && c.oid && 'projectId' in c && c.projectId) {
                    const metadata = await this.editorEngine.fileSystem.getJsxElementMetadata(c.oid);
                    if (!metadata?.code) {
                        console.error('No code block found for node', c.path);
                        return c;
                    }
                    return { ...c, content: metadata.code } satisfies HighlightMessageContext;
                }
                return c;
            }),
        )) satisfies MessageContext[];
    }

    private async getFileContext(highlightedContext: HighlightMessageContext[]): Promise<FileMessageContext[]> {
        const fileContext: FileMessageContext[] = [];
        const projectId = this.editorEngine.projectId;

        // Create a set of file paths from highlighted context.
        const filePaths = new Set<string>();
        highlightedContext.forEach(highlight => {
            filePaths.add(highlight.path);
        });

        for (const filePath of filePaths) {
            const content = await this.editorEngine.fileSystem.readFile(filePath);
            if (content instanceof Uint8Array) {
                console.error('File is binary', filePath);
                continue;
            }
            fileContext.push({
                type: MessageContextType.FILE,
                displayName: filePath,
                path: filePath,
                content,
                projectId: projectId,
            });
        }
        return fileContext;
    }

    private async getHighlightedContext(
        selected: DomElement[],
    ): Promise<HighlightMessageContext[]> {
        const highlightedContext: HighlightMessageContext[] = [];
        for (const node of selected) {
            const oid = node.oid;
            const instanceId = node.instanceId;

            if (oid) {
                const context = await this.getHighlightContextById(oid, node.tagName, false);
                if (context) highlightedContext.push(context);
            }

            if (instanceId) {
                const context = await this.getHighlightContextById(instanceId, node.tagName, true);
                if (context) highlightedContext.push(context);
            }

            if (!oid && !instanceId) {
                console.error('No oid or instanceId found for node', node);
            }
        }

        return highlightedContext;
    }

    private async getHighlightContextById(
        id: string,
        tagName: string,
        isInstance: boolean,
    ): Promise<HighlightMessageContext | null> {
        const metadata = await this.editorEngine.fileSystem.getJsxElementMetadata(id);
        if (!metadata) {
            console.error('No metadata found for id', id, 'tagName:', tagName);
            return null;
        }

        const highlight: HighlightMessageContext = {
            type: MessageContextType.HIGHLIGHT,
            displayName:
                isInstance && metadata.component ? metadata.component : tagName.toLowerCase(),
            path: metadata.path,
            content: metadata.code,
            start: metadata.startTag.start.line,
            end: metadata.endTag?.end.line || metadata.startTag.end.line,
            oid: id,
            projectId: this.editorEngine.projectId,
        };

        return highlight;
    }

    private async getAgentRuleContext(): Promise<AgentRuleMessageContext[]> {
        try {
            const agentRuleFileNames = ['agents.md', 'claude.md', 'AGENTS.md', 'CLAUDE.md'];
            const sandbox = this.editorEngine.activeSandbox;
            const agentRuleContexts: AgentRuleMessageContext[] = (await Promise.all(
                agentRuleFileNames.map(async (fileName) => {
                    const filePath = `./${fileName}`;
                    if (!sandbox.fileExists(filePath)) {
                        return null;
                    }
                    const fileContent = await this.editorEngine.activeSandbox.readFile(filePath);
                    if (fileContent === null || fileContent instanceof Uint8Array) {
                        return null;
                    }
                    if (fileContent.trim().length === 0) {
                        return null;
                    }
                    return {
                        type: MessageContextType.AGENT_RULE,
                        content: fileContent,
                        displayName: fileName,
                        path: filePath,
                    } satisfies AgentRuleMessageContext;
                })
            )).filter((context) => context !== null);
            return agentRuleContexts
        } catch (error) {
            console.error('Error getting agent rule context', error);
            return [];
        }
    }

    getErrorContext(): ErrorMessageContext[] {
        const errors = this.editorEngine.error.errors;
        if (errors.length === 0) {
            return [];
        }

        return [{
            type: MessageContextType.ERROR,
            content: errors
                .map((e) => `Source: ${e.sourceId}\nContent: ${e.content}\n`)
                .join('\n'),
            displayName: `Errors - ${this.editorEngine.projectName}`,
            projectId: this.editorEngine.projectId,
        }];
    }

    async getCreateContext() {
        try {
            const createContext: MessageContext[] = [];
            const pageContext = await this.getDefaultPageContext();
            const styleGuideContext = await this.getDefaultStyleGuideContext();
            if (pageContext) {
                createContext.push(pageContext);
            }
            if (styleGuideContext) {
                createContext.push(...styleGuideContext);
            }
            return createContext;
        } catch (error) {
            console.error('Error getting create context', error);
            return [];
        }
    }

    async getDefaultPageContext(): Promise<FileMessageContext | null> {
        try {
            const pagePaths = ['./app/page.tsx', './src/app/page.tsx'];
            for (const pagePath of pagePaths) {
                let fileContent: string | Uint8Array | null = null;
                try {
                    fileContent = await this.editorEngine.fileSystem.readFile(pagePath);
                } catch (error) {
                    console.error('Error getting default page context', error);
                    continue;
                }

                if (fileContent && typeof fileContent === 'string') {
                    const defaultPageContext: FileMessageContext = {
                        type: MessageContextType.FILE,
                        path: pagePath,
                        content: fileContent,
                        displayName: pagePath.split('/').pop() || 'page.tsx',
                        projectId: this.editorEngine.projectId,
                    };
                    return defaultPageContext;
                }
            }
            return null;
        } catch (error) {
            console.error('Error getting default page context', error);
            return null;
        }
    }

    async getDefaultStyleGuideContext(): Promise<FileMessageContext[] | null> {
        try {
            const styleGuide = await this.editorEngine.theme.initializeTailwindColorContent();
            if (!styleGuide) {
                throw new Error('No style guide found');
            }
            const tailwindConfigContext: FileMessageContext = {
                type: MessageContextType.FILE,
                path: styleGuide.configPath,
                content: styleGuide.configContent,
                displayName: styleGuide.configPath.split('/').pop() || 'tailwind.config.ts',
                projectId: this.editorEngine.projectId,
            };

            const cssContext: FileMessageContext = {
                type: MessageContextType.FILE,
                path: styleGuide.cssPath,
                content: styleGuide.cssContent,
                displayName: styleGuide.cssPath.split('/').pop() || 'globals.css',
                projectId: this.editorEngine.projectId,
            };

            return [tailwindConfigContext, cssContext];
        } catch (error) {
            console.error('Error getting default style guide context', error);
            return null;
        }
    }

    clearImagesFromContext() {
        this.context = this.context.filter(
            (c) => c.type !== MessageContextType.IMAGE
        );
    }

    clear() {
        this.selectedReactionDisposer?.();
        this.selectedReactionDisposer = undefined;
        this.context = [];
    }
}
