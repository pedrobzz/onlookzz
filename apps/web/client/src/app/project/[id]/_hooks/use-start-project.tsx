'use client';

import { useEditorEngine } from '@/components/store/editor';
import { convexApi } from '@/convex/api';
import {
    createDefaultLocalFrame,
    frameFromConvex,
    frameToConvexInput,
    type ConvexFrameRow,
} from '@/utils/project/default-frame';
import { AgentType, type ChatConversation } from '@onlook/models';
import { useMutation, useQuery } from 'convex/react';
import { useEffect, useMemo, useState } from 'react';
import { useTabActive } from '../_hooks/use-tab-active';

interface ProjectReadyState {
    frames: boolean;
    conversations: boolean;
    sandbox: boolean;
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

export const useStartProject = () => {
    const editorEngine = useEditorEngine();
    const sandbox = editorEngine.activeSandbox;
    const [error, setError] = useState<string | null>(null);
    const { tabState } = useTabActive();
    const frameRows = useQuery(convexApi.frames.list, { projectId: editorEngine.projectId }) as ConvexFrameRow[] | undefined;
    const conversationRows = useQuery(convexApi.conversations.list, { projectId: editorEngine.projectId }) as ConvexConversationRow[] | undefined;
    const upsertFrame = useMutation(convexApi.frames.upsert);
    const [projectReadyState, setProjectReadyState] = useState<ProjectReadyState>({
        frames: false,
        conversations: false,
        sandbox: false,
    });

    const conversations = useMemo(
        () => conversationRows?.map(toChatConversation),
        [conversationRows],
    );

    const updateProjectReadyState = (state: Partial<ProjectReadyState>) => {
        setProjectReadyState((prev) => ({ ...prev, ...state }));
    };

    useEffect(() => {
        if (!sandbox.session.isConnecting && sandbox.session.isReady) {
            updateProjectReadyState({ sandbox: true });
        }
    }, [sandbox.session.isConnecting, sandbox.session.isReady]);

    useEffect(() => {
        if (tabState === 'reactivated') {
            sandbox.session.reconnect();
        }
    }, [tabState, sandbox.session]);

    useEffect(() => {
        const applyFrames = async () => {
            if (!frameRows) {
                return;
            }

            if (frameRows.length === 0) {
                const frame = createDefaultLocalFrame(editorEngine.projectId);
                await upsertFrame(frameToConvexInput(frame, editorEngine.projectId));
                editorEngine.frames.applyFrames([frame]);
            } else {
                editorEngine.frames.applyFrames(frameRows.map(frameFromConvex));
            }
            updateProjectReadyState({ frames: true });
        }

        void applyFrames();
    }, [editorEngine.frames, editorEngine.projectId, frameRows, upsertFrame]);

    useEffect(() => {
        const applyConversations = async () => {
            if (conversations) {
                await editorEngine.chat.conversation.applyConversations(conversations);
                updateProjectReadyState({ conversations: true });
            }
        };
        void applyConversations();
    }, [editorEngine.chat.conversation, conversations]);

    useEffect(() => {
        setError(null);
    }, [frameRows, conversations]);

    return { isProjectReady: Object.values(projectReadyState).every((value) => value), error };
}
