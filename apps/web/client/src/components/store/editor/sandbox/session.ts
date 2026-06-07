import { RuntimeClient } from '@onlook/file-system';
import { makeAutoObservable } from 'mobx';
import type { ErrorManager } from '../error';

export class SessionManager {
    private readonly runtime: RuntimeClient;
    isConnecting = false;
    isReady = false;

    constructor(
        private readonly projectId: string,
        private readonly errorManager: ErrorManager,
    ) {
        this.runtime = new RuntimeClient(projectId);
        makeAutoObservable(this);
    }

    async start(): Promise<void> {
        if (this.isConnecting || this.isReady) {
            return;
        }

        this.isConnecting = true;
        try {
            this.isReady = await this.runtime.health();
        } finally {
            this.isConnecting = false;
        }
    }

    async restartDevServer(): Promise<boolean> {
        const status = await this.runtime.restartDev();
        return status.status === 'running' || status.status === 'ready';
    }

    async readDevServerLogs(): Promise<string> {
        return (await this.runtime.getDevLogs()).join('\n');
    }

    async reconnect(): Promise<void> {
        this.isReady = await this.runtime.health();
    }

    async ping(): Promise<boolean> {
        return this.runtime.health();
    }

    async runCommand(
        command: string,
        streamCallback?: (output: string) => void,
        ignoreError = false,
    ): Promise<{
        output: string;
        success: boolean;
        error: string | null;
    }> {
        const finalCommand = ignoreError ? `${command} 2>/dev/null || true` : command;
        streamCallback?.(`${finalCommand}\n`);

        await this.runtime.runCommand('sh', ['-lc', finalCommand]);
        const status = await this.waitForCommand();
        const output = (await this.runtime.getCommandLogs()).join('\n');
        streamCallback?.(output);
        this.errorManager.processMessage(output);

        const success = status.status !== 'failed';
        return {
            output,
            success,
            error: success ? null : output || status.error || 'Command failed',
        };
    }

    clear(): void {
        this.isReady = false;
        this.isConnecting = false;
    }

    private async waitForCommand() {
        for (let attempt = 0; attempt < 240; attempt++) {
            const status = await this.runtime.getCommandStatus();
            if (status.status !== 'running') {
                return status;
            }
            await new Promise((resolve) => setTimeout(resolve, 250));
        }

        return this.runtime.getCommandStatus();
    }
}
