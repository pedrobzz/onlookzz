import type { EditorEngine } from '@/components/store/editor/engine';
import { type ChatMessage, type GitMessageCheckpoint, type MessageContext, MessageCheckpointType } from "@onlook/models";
import { v4 as uuidv4 } from 'uuid';

export const prepareMessagesForSuggestions = (messages: ChatMessage[]) => {
    return messages.slice(-5).map((message) => ({
        role: message.role,
        content: message.parts.map((p) => {
            if (p.type === 'text') {
                return p.text;
            }
            return '';
        }).join(''),
    }));
};

export const getUserChatMessageFromString = (
    content: string,
    context: MessageContext[],
    conversationId: string,
    id?: string,
): ChatMessage => {
    return {
        id: id ?? uuidv4(),
        role: 'user',
        parts: [{ type: 'text', text: content }],
        metadata: {
            context,
            checkpoints: [],
            createdAt: new Date(),
            conversationId,
        },
    }
}

export async function createProjectCheckpoint(
    editorEngine: EditorEngine,
    commitMessage: string,
): Promise<GitMessageCheckpoint | null> {
    const result = await editorEngine.activeSandbox.gitManager.createCommit(commitMessage);

    if (!result.success) {
        return null;
    }

    const latestCommit = editorEngine.activeSandbox.gitManager.commits?.[0];
    if (!latestCommit) {
        return null;
    }

    return {
        type: MessageCheckpointType.GIT,
        oid: latestCommit.oid,
        projectId: editorEngine.projectId,
        createdAt: new Date(),
    };
}
