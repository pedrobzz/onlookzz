import { Icons } from '@onlook/ui/icons';
import type { EditorEngine } from '@onlook/web-client/src/components/store/editor/engine';
import { z } from 'zod';
import { ClientTool } from '../models/client';
import { getProjectSandbox } from '../shared/helpers/files';
import { PROJECT_ID_SCHEMA } from '../shared/type';

export class TerminalCommandTool extends ClientTool {
    static readonly toolName = 'terminal_command';
    static readonly description = 'Run any generic Linux Bash command in the terminal';
    static readonly parameters = z.object({
        command: z.string().describe('The command to run'),
        projectId: PROJECT_ID_SCHEMA,
    });
    static readonly icon = Icons.Terminal;

    async handle(
        args: z.infer<typeof TerminalCommandTool.parameters>,
        editorEngine: EditorEngine,
    ): Promise<{
        output: string;
        success: boolean;
        error: string | null;
    }> {
        const sandbox = getProjectSandbox(args.projectId, editorEngine);
        return sandbox.session.runCommand(args.command);
    }

    static getLabel(input?: z.infer<typeof TerminalCommandTool.parameters>): string {
        return 'Terminal';
    }
}
