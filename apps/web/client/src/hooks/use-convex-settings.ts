'use client';

import { convexApi } from '@/convex/api';
import { DefaultSettings } from '@onlook/constants';
import type { ChatSettings, ProjectSettings } from '@onlook/models';
import { useMutation, useQuery } from 'convex/react';
import { useCallback, useMemo } from 'react';

const DEFAULT_CHAT_SETTINGS: ChatSettings = {
    showSuggestions: DefaultSettings.CHAT_SETTINGS.showSuggestions,
    autoApplyCode: DefaultSettings.CHAT_SETTINGS.autoApplyCode,
    expandCodeBlocks: DefaultSettings.CHAT_SETTINGS.expandCodeBlocks,
    showMiniChat: DefaultSettings.CHAT_SETTINGS.showMiniChat,
};

const DEFAULT_PROJECT_COMMANDS: Required<ProjectSettings['commands']> = {
    install: DefaultSettings.COMMANDS.install,
    run: DefaultSettings.COMMANDS.run,
    build: DefaultSettings.COMMANDS.build,
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function settingValue(row: unknown): unknown {
    return isRecord(row) ? row.value : undefined;
}

function boolOrDefault(value: unknown, fallback: boolean) {
    return typeof value === 'boolean' ? value : fallback;
}

function stringOrDefault(value: unknown, fallback: string) {
    return typeof value === 'string' ? value : fallback;
}

function readChatSettings(value: unknown): ChatSettings {
    const settings = isRecord(value) ? value : {};

    return {
        showSuggestions: boolOrDefault(settings.showSuggestions, DEFAULT_CHAT_SETTINGS.showSuggestions),
        autoApplyCode: boolOrDefault(settings.autoApplyCode, DEFAULT_CHAT_SETTINGS.autoApplyCode),
        expandCodeBlocks: boolOrDefault(settings.expandCodeBlocks, DEFAULT_CHAT_SETTINGS.expandCodeBlocks),
        showMiniChat: boolOrDefault(settings.showMiniChat, DEFAULT_CHAT_SETTINGS.showMiniChat),
    };
}

function readProjectSettings(value: unknown): ProjectSettings {
    const settings = isRecord(value) ? value : {};
    const commands = isRecord(settings.commands) ? settings.commands : {};

    return {
        commands: {
            install: stringOrDefault(commands.install, DEFAULT_PROJECT_COMMANDS.install),
            run: stringOrDefault(commands.run, DEFAULT_PROJECT_COMMANDS.run),
            build: stringOrDefault(commands.build, DEFAULT_PROJECT_COMMANDS.build),
        },
    };
}

export function useChatSettings() {
    const row = useQuery(convexApi.settings.get, {
        scope: 'global',
        key: 'chat',
    });
    const upsert = useMutation(convexApi.settings.upsert);
    const settings = useMemo(() => readChatSettings(settingValue(row)), [row]);

    const update = useCallback(
        async (patch: Partial<ChatSettings>) => {
            await upsert({
                scope: 'global',
                key: 'chat',
                value: {
                    ...settings,
                    ...patch,
                },
            });
        },
        [settings, upsert],
    );

    return {
        settings,
        update,
        isLoading: row === undefined,
    };
}

export function useProjectSettings(projectId: string) {
    const row = useQuery(convexApi.settings.get, {
        scope: 'project',
        projectId,
        key: 'project',
    });
    const upsert = useMutation(convexApi.settings.upsert);
    const settings = useMemo(() => readProjectSettings(settingValue(row)), [row]);

    const save = useCallback(
        async (nextSettings: ProjectSettings) => {
            await upsert({
                scope: 'project',
                projectId,
                key: 'project',
                value: nextSettings,
            });
        },
        [projectId, upsert],
    );

    return {
        settings,
        save,
        isLoading: row === undefined,
    };
}
