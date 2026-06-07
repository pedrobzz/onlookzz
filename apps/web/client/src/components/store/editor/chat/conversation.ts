import { convexApi } from '@/convex/api';
import { localConvexClient } from '@/convex/provider';
import { AgentType, type ChatConversation } from '@onlook/models';
import { makeAutoObservable } from 'mobx';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';
import type { EditorEngine } from '../engine';

interface CurrentConversation extends ChatConversation {
    messageCount: number;
}

type ConvexConversationRow = {
    conversationId: string;
    projectId: string;
    title: string;
    createdAt: number;
    updatedAt: number;
};

const toChatConversation = (row: ConvexConversationRow): ChatConversation => ({
    id: row.conversationId,
    agentType: AgentType.ROOT,
    title: row.title || null,
    projectId: row.projectId,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
    suggestions: [],
});

export class ConversationManager {
    current: CurrentConversation | null = null;
    conversations: ChatConversation[] = [];
    creatingConversation = false;

    constructor(private editorEngine: EditorEngine) {
        makeAutoObservable(this);
    }

    async applyConversations(conversations: ChatConversation[]) {
        this.conversations = conversations;
        if (conversations.length > 0 && conversations[0]) {
            const conversation = conversations[0];
            await this.selectConversation(conversation.id);
        } else {
            await this.startNewConversation();
        }
    }

    async getConversations(projectId: string): Promise<ChatConversation[]> {
        const res: ChatConversation[] | null = await this.getConversationsFromStorage(projectId);
        if (!res) {
            console.error('No conversations found');
            return [];
        }
        const conversations = res;

        const sorted = conversations.sort((a, b) => {
            return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        });
        return sorted || [];
    }

    setConversationLength(length: number) {
        if (this.current) {
            this.current = {
                ...this.current,
                messageCount: length,
            };
        }
    }

    async startNewConversation() {
        try {
            this.creatingConversation = true;
            if (this.current?.messageCount === 0 && !this.current?.title) {
                throw new Error('Current conversation is already empty.');
            }
            const newConversation = await localConvexClient.mutation(convexApi.conversations.upsert, {
                conversationId: uuidv4(),
                projectId: this.editorEngine.projectId,
                title: '',
            }) as ConvexConversationRow | null;
            if (!newConversation) {
                throw new Error('Conversation not created');
            }
            const conversation = toChatConversation(newConversation);
            this.current = {
                ...conversation,
                messageCount: 0,
            };
            this.conversations.push(conversation);
        } catch (error) {
            console.error('Error starting new conversation', error);
            toast.error('Error starting new conversation.', {
                description: error instanceof Error ? error.message : 'Unknown error',
            });
        } finally {
            this.creatingConversation = false;
        }
    }

    async selectConversation(id: string) {
        const match = this.conversations.find((c) => c.id === id);
        if (!match) {
            console.error('No conversation found with id', id);
            return;
        }

        this.current = {
            ...match,
            messageCount: 0,
        };
    }

    deleteConversation(id: string) {
        if (!this.current) {
            console.error('No conversation found');
            return;
        }

        const index = this.conversations.findIndex((c) => c.id === id);
        if (index === -1) {
            console.error('No conversation found with id', id);
            return;
        }
        this.conversations.splice(index, 1);
        void this.deleteConversationInStorage(id);
        if (this.current?.id === id) {
            if (this.conversations.length > 0 && !!this.conversations[0]) {
                void this.selectConversation(this.conversations[0].id);
            } else {
                void this.startNewConversation();
            }
        }
    }

    async generateTitle(content: string): Promise<void> {
        if (!this.current) {
            console.error('No conversation found');
            return;
        }
        const title = content
            .trim()
            .split(/\s+/)
            .slice(0, 4)
            .join(' ')
            .slice(0, 50) || 'New conversation';
        await localConvexClient.mutation(convexApi.conversations.update, {
            conversationId: this.current.id,
            title,
        });
        if (!title) {
            console.error('Error generating conversation title. No title returned.');
            return;
        }
        // Update local active conversation 
        this.current = {
            ...this.current,
            title,
        };
        // Update in local conversations list
        const index = this.conversations.findIndex((c) => c.id === this.current?.id);
        if (index !== -1 && this.conversations[index]) {
            this.conversations[index] = {
                ...this.conversations[index],
                title,
            };
        }
    }

    async getConversationsFromStorage(id: string): Promise<ChatConversation[] | null> {
        const rows = await localConvexClient.query(convexApi.conversations.list, { projectId: id }) as ConvexConversationRow[];
        return rows.map(toChatConversation);
    }

    async upsertConversationInStorage(conversation: Partial<ChatConversation>): Promise<ChatConversation> {
        const row = await localConvexClient.mutation(convexApi.conversations.upsert, {
            conversationId: conversation.id ?? uuidv4(),
            projectId: this.editorEngine.projectId,
            title: conversation.title ?? '',
        }) as ConvexConversationRow | null;
        if (!row) {
            throw new Error('Conversation not saved');
        }
        return toChatConversation(row);
    }

    async updateConversationInStorage(conversation: Partial<ChatConversation> & { id: string }) {
        await localConvexClient.mutation(convexApi.conversations.update, {
            conversationId: conversation.id,
            title: conversation.title ?? undefined,
        });
    }

    async deleteConversationInStorage(id: string) {
        await localConvexClient.mutation(convexApi.conversations.remove, { conversationId: id });
    }

    clear() {
        this.current = null;
        this.conversations = [];
    }
}
