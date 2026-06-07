import { convexApi } from '@/convex/api';
import { fromConvexMessage, type ConvexMessageRow } from '@/utils/chat/convex-message';
import { Icons } from '@onlook/ui/icons/index';
import { useQuery } from 'convex/react';
import { useMemo } from 'react';
import { ChatTabContent } from './chat-tab-content';

interface ChatTabProps {
    conversationId: string;
    projectId: string;
}

export const ChatTab = ({ conversationId, projectId }: ChatTabProps) => {
    const messageRows = useQuery(convexApi.messages.list, { conversationId }) as ConvexMessageRow[] | undefined;
    const initialMessages = useMemo(
        () => messageRows?.map(fromConvexMessage),
        [messageRows],
    );

    if (!initialMessages) {
        return (
            <div className="flex-1 flex items-center justify-center w-full h-full text-foreground-secondary" >
                <Icons.LoadingSpinner className="animate-spin mr-2" />
                <p>Loading messages...</p>
            </div >
        );
    }

    return (
        <ChatTabContent
            // Used to force re-render the use-chat hook when the conversationId changes
            key={conversationId}
            conversationId={conversationId}
            projectId={projectId}
            initialMessages={initialMessages}
        />
    );
};
