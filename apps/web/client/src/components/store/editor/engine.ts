import { makeAutoObservable } from 'mobx';

import { CodeFileSystem } from '@onlook/file-system';
import type { PostHog } from 'posthog-js/react';
import { ActionManager } from './action';
import { ApiManager } from './api';
import { AstManager } from './ast';
import { CanvasManager } from './canvas';
import { ChatManager } from './chat';
import { CodeManager } from './code';
import { CopyManager } from './copy';
import { ElementsManager } from './element';
import { FontManager } from './font';
import { FrameEventManager } from './frame-events';
import { FramesManager } from './frames';
import { GroupManager } from './group';
import { IdeManager } from './ide';
import { ImageManager } from './image';
import { InsertManager } from './insert';
import { MoveManager } from './move';
import { OverlayManager } from './overlay';
import { PagesManager } from './pages';
import { SandboxManager } from './sandbox';
import { SnapManager } from './snap';
import { StateManager } from './state';
import { StyleManager } from './style';
import { TextEditingManager } from './text';
import { ThemeManager } from './theme';
import { ErrorManager } from './error';
import { HistoryManager } from './history';

export class EditorEngine {
    readonly projectId: string;
    readonly projectName: string;
    readonly posthog: PostHog;
    readonly fileSystem: CodeFileSystem;
    readonly error: ErrorManager;
    readonly history: HistoryManager;
    readonly activeSandbox: SandboxManager;

    readonly state: StateManager = new StateManager();
    readonly canvas: CanvasManager = new CanvasManager(this);
    readonly text: TextEditingManager = new TextEditingManager(this);
    readonly elements: ElementsManager = new ElementsManager(this);
    readonly overlay: OverlayManager = new OverlayManager(this);
    readonly insert: InsertManager = new InsertManager(this);
    readonly move: MoveManager = new MoveManager(this);
    readonly copy: CopyManager = new CopyManager(this);
    readonly group: GroupManager = new GroupManager(this);
    readonly ast: AstManager = new AstManager(this);
    readonly action: ActionManager = new ActionManager(this);
    readonly style: StyleManager = new StyleManager(this);
    readonly code: CodeManager = new CodeManager(this);
    readonly chat: ChatManager = new ChatManager(this);
    readonly image: ImageManager = new ImageManager(this);
    readonly theme: ThemeManager = new ThemeManager(this);
    readonly font: FontManager = new FontManager(this);
    readonly pages: PagesManager = new PagesManager(this);
    readonly frames: FramesManager = new FramesManager(this);
    readonly frameEvent: FrameEventManager = new FrameEventManager(this);
    readonly snap: SnapManager = new SnapManager(this);
    readonly api: ApiManager = new ApiManager(this);
    readonly ide: IdeManager = new IdeManager(this);

    constructor(projectId: string, projectName: string, posthog: PostHog) {
        this.projectId = projectId;
        this.projectName = projectName;
        this.posthog = posthog;
        this.fileSystem = new CodeFileSystem(projectId);
        this.error = new ErrorManager(projectId);
        this.history = new HistoryManager(this);
        this.activeSandbox = new SandboxManager(projectId, this.error, this.fileSystem);
        makeAutoObservable(this);
    }

    async init() {
        this.overlay.init();
        this.image.init();
        this.frameEvent.init();
        this.chat.init();
        this.style.init();
    }

    async initProject() {
        await this.fileSystem.initialize();
        await this.activeSandbox.init();
    }

    clear() {
        this.elements.clear();
        this.frames.clear();
        this.action.clear();
        this.overlay.clear();
        this.ast.clear();
        this.text.clean();
        this.insert.clear();
        this.move.clear();
        this.style.clear();
        this.copy.clear();
        this.group.clear();
        this.canvas.clear();
        this.image.clear();
        this.theme.clear();
        this.font.clear();
        this.pages.clear();
        this.chat.clear();
        this.code.clear();
        this.error.clear();
        this.history.clear();
        void this.fileSystem.cleanup();
        this.activeSandbox.clear();
        this.frameEvent.clear();
        this.snap.hideSnapLines();
    }

    clearUI() {
        this.overlay.clearUI();
        this.elements.clear();
        this.frames.deselectAll();
        this.snap.hideSnapLines();
    }

    async refreshLayers() {
        for (const frame of this.frames.getAll()) {
            if (!frame.view) {
                console.error('No frame view found');
                continue;
            }
            await frame.view.processDom();
        }
    }
}
