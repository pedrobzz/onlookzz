import { Icons } from '@onlook/ui/icons';
import type { EditorEngine } from '@onlook/web-client/src/components/store/editor/engine';
import { z } from 'zod';
import { ClientTool } from '../models/client';
import { getProjectSandbox } from '../shared/helpers/files';
import { PROJECT_ID_SCHEMA } from '../shared/type';

export class TypecheckTool extends ClientTool {
    static readonly toolName = 'typecheck';
    static readonly description = 'Run TypeScript type checking. use to check after code edits, when type changes are suspected.';
    static readonly parameters = z.object({
        projectId: PROJECT_ID_SCHEMA,
    });
    static readonly icon = Icons.MagnifyingGlass;

    async handle(
        args: z.infer<typeof TypecheckTool.parameters>,
        editorEngine: EditorEngine,
    ): Promise<{
        success: boolean;
        error?: string;
    }> {
        try {
            const sandbox = getProjectSandbox(args.projectId, editorEngine);

            // Run Next.js typecheck command
            const result = await sandbox.session.runCommand('bunx tsc --noEmit');

            if (result.success) {
                return {
                    success: true
                };
            } else {
                return {
                    success: false,
                    error: result.error || result.output || 'Typecheck failed with unknown error'
                };
            }
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
    static getLabel(input?: z.infer<typeof TypecheckTool.parameters>): string {
        return 'Checking types';
    }
}
