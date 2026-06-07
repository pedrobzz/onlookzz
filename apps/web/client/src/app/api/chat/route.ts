import { convexApi } from '@/convex/api';
import { toConvexMessageInput } from '@/utils/chat/convex-message';
import { createRootAgentStream } from '@onlook/ai';
import { ChatType, type ChatMessage, type ChatMetadata } from '@onlook/models';
import { ConvexHttpClient } from 'convex/browser';
import { type NextRequest } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { errorHandler } from './helpers';

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL ?? 'http://127.0.0.1:3210';
const convex = new ConvexHttpClient(convexUrl);

export async function POST(req: NextRequest) {
    try {
        return streamResponse(req, 'local-user');
    } catch (error: unknown) {
        console.error('Error in chat', error);
        return new Response(JSON.stringify({
            error: error instanceof Error ? error.message : String(error),
            code: 500,
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

export const streamResponse = async (req: NextRequest, userId: string) => {
    const body = await req.json();
    const { messages, chatType, conversationId, projectId } = body as {
        messages: ChatMessage[],
        chatType: ChatType,
        conversationId: string,
        projectId: string,
    };

    try {
        const lastUserMessage = messages.findLast((message) => message.role === 'user');
        const traceId = lastUserMessage?.id ?? uuidv4();

        const stream = createRootAgentStream({
            chatType,
            conversationId,
            projectId,
            userId,
            traceId,
            messages,
        });
        return stream.toUIMessageStreamResponse<ChatMessage>(
            {
                originalMessages: messages,
                generateMessageId: () => uuidv4(),
                messageMetadata: ({ part }) => {
                    return {
                        createdAt: new Date(),
                        conversationId,
                        context: [],
                        checkpoints: [],
                        finishReason: part.type === 'finish-step' ? part.finishReason : undefined,
                        usage: part.type === 'finish-step' ? part.usage : undefined,
                    } satisfies ChatMetadata;
                },
                onFinish: async ({ messages: finalMessages }) => {
                    const messagesToStore = finalMessages
                        .filter(msg =>
                            (msg.role === 'user' || msg.role === 'assistant')
                        )
                        .map(msg => toConvexMessageInput(msg, conversationId, projectId));

                    await convex.mutation(convexApi.messages.replaceConversation, {
                        conversationId,
                        messages: messagesToStore,
                    });
                },
                onError: errorHandler,
            }
        );
    } catch (error) {
        console.error('Error in streamResponse setup', error);
        throw error;
    }
}
