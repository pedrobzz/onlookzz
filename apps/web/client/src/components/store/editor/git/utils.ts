import type { GitMessageCheckpoint } from '@onlook/models';
import { toast } from '@onlook/ui/sonner';

import type { EditorEngine } from '../engine';

export const BACKUP_COMMIT_MESSAGE = 'Save before restoring backup';

export interface RestoreResult {
    success: boolean;
    error?: string;
}

/**
 * Restore the current project to a specific checkpoint.
 */
export async function restoreCheckpoint(
    checkpoint: GitMessageCheckpoint,
    editorEngine: EditorEngine,
): Promise<RestoreResult> {
    try {
        // Save current state before restoring
        const saveResult = await editorEngine.activeSandbox.gitManager.createCommit(BACKUP_COMMIT_MESSAGE);
        if (!saveResult.success) {
            toast.warning('Failed to save before restoring backup');
        }

        // Restore to the specified commit
        const restoreResult = await editorEngine.activeSandbox.gitManager.restoreToCommit(checkpoint.oid);

        if (!restoreResult.success) {
            throw new Error(restoreResult.error || 'Failed to restore commit');
        }

        await editorEngine.activeSandbox.gitManager.listCommits();

        toast.success('Restored to backup!', {
            description: `Project "${editorEngine.projectName}" has been restored`,
        });

        return { success: true };
    } catch (error) {
        console.error('Failed to restore checkpoint:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        toast.error('Failed to restore checkpoint', {
            description: errorMessage,
        });
        return { success: false, error: errorMessage };
    }
}
