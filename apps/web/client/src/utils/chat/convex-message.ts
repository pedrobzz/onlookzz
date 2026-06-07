import type { ChatMessage, GitMessageCheckpoint, MessageContext } from '@onlook/models';

export type ConvexMessageRow = {
    messageId: string;
    conversationId: string;
    projectId: string;
    role: string;
    content: string;
    contexts?: MessageContext[];
    checkpoints?: GitMessageCheckpoint[];
    createdAt: number;
    updatedAt?: number;
};

export type ConvexMessageInput = {
    messageId: string;
    conversationId: string;
    projectId: string;
    role: string;
    content: string;
    contexts?: MessageContext[];
    checkpoints?: GitMessageCheckpoint[];
    createdAt?: number;
};

const toTimestamp = (value: Date | string | number | undefined): number | undefined => {
    if (value === undefined) {
        return undefined;
    }
    if (value instanceof Date) {
        return value.getTime();
    }
    if (typeof value === 'number') {
        return value;
    }
    return new Date(value).getTime();
};

const normalizeCheckpoint = (checkpoint: GitMessageCheckpoint): GitMessageCheckpoint => ({
    ...checkpoint,
    createdAt: checkpoint.createdAt instanceof Date
        ? checkpoint.createdAt
        : new Date(checkpoint.createdAt),
});

export function toConvexMessageInput(
    message: ChatMessage,
    conversationId: string,
    projectId: string,
): ConvexMessageInput {
    return {
        messageId: message.id,
        conversationId,
        projectId,
        role: message.role,
        content: JSON.stringify(message.parts),
        contexts: message.metadata?.context ?? [],
        checkpoints: message.metadata?.checkpoints ?? [],
        createdAt: toTimestamp(message.metadata?.createdAt),
    };
}

export function fromConvexMessage(row: ConvexMessageRow): ChatMessage {
    let parts: ChatMessage['parts'];
    try {
        parts = JSON.parse(row.content) as ChatMessage['parts'];
    } catch {
        parts = [{ type: 'text', text: row.content }];
    }

    return {
        id: row.messageId,
        role: row.role as ChatMessage['role'],
        parts,
        metadata: {
            conversationId: row.conversationId,
            createdAt: new Date(row.createdAt),
            context: row.contexts ?? [],
            checkpoints: (row.checkpoints ?? []).map(normalizeCheckpoint),
        },
    };
}
