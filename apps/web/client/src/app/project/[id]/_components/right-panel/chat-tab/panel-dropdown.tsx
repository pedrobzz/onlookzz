import { useChatSettings } from '@/hooks/use-convex-settings';
import { transKeys } from '@/i18n/keys';
import type { ChatSettings } from '@onlook/models';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@onlook/ui/dropdown-menu';
import { Icons } from '@onlook/ui/icons';
import { cn } from '@onlook/ui/utils';
import { observer } from 'mobx-react-lite';
import { useTranslations } from 'next-intl';
import { useCallback } from 'react';

export const ChatPanelDropdown = observer(({
    children,
    isChatHistoryOpen,
    setIsChatHistoryOpen,
}: {
    children: React.ReactNode;
    isChatHistoryOpen: boolean;
    setIsChatHistoryOpen: (isOpen: boolean) => void;
}) => {
    const t = useTranslations();
    const { settings: chatSettings, update: updateChatSettingsValue } = useChatSettings();

    const updateChatSettings = useCallback((e: React.MouseEvent, settings: Partial<ChatSettings>) => {
        e.preventDefault();
        void updateChatSettingsValue(settings);
    }, [updateChatSettingsValue]);

    return (
        <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
                <div className="flex items-center">{children}</div>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="min-w-[220px]">
                <DropdownMenuItem
                    className="flex items-center py-1.5"
                    onClick={(e) => {
                        updateChatSettings(e, {
                            showSuggestions: !chatSettings.showSuggestions,
                        });
                    }}
                >
                    <Icons.Check
                        className={cn(
                            'mr-2 h-4 w-4',
                            chatSettings.showSuggestions ? 'opacity-100' : 'opacity-0',
                        )}
                    />
                    {t(transKeys.editor.panels.edit.tabs.chat.settings.showSuggestions)}
                </DropdownMenuItem>

                <DropdownMenuItem
                    className="flex items-center py-1.5"
                    onClick={(e) => {
                        updateChatSettings(e, {
                            showMiniChat: !chatSettings.showMiniChat,
                        });
                    }}
                >
                    <Icons.Check
                        className={cn(
                            'mr-2 h-4 w-4',
                            chatSettings.showMiniChat ? 'opacity-100' : 'opacity-0',
                        )}
                    />
                    {t(transKeys.editor.panels.edit.tabs.chat.settings.showMiniChat)}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setIsChatHistoryOpen(!isChatHistoryOpen)}>
                    <Icons.CounterClockwiseClock className="mr-2 h-4 w-4" />
                    {t(transKeys.editor.panels.edit.tabs.chat.controls.history)}
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
});
