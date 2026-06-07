'use client';

import { useEditorEngine } from '@/components/store/editor';
import { Icons } from '@onlook/ui/icons';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@onlook/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@onlook/ui/tooltip';
import { cn } from '@onlook/ui/utils';
import { observer } from 'mobx-react-lite';
import { motion } from 'motion/react';
import { useState } from 'react';
import type { TerminalSession } from '@/components/store/editor/sandbox/terminal';
import { RestartSandboxButton } from './restart-sandbox-button';
import { Terminal } from './terminal';

export const TerminalArea = observer(({ children }: { children: React.ReactNode }) => {
    const editorEngine = useEditorEngine();
    const sandbox = editorEngine.activeSandbox;
    const allTerminalSessions = new Map<string, { name: string; sessionId: string; session: TerminalSession }>();
    let activeSessionId: string | null = null;

    for (const [sessionId, session] of sandbox.session.terminalSessions) {
        const key = `${editorEngine.projectId}-${sessionId}`;
        allTerminalSessions.set(key, {
            name: session.name,
            sessionId,
            session,
        });

        if (sessionId === sandbox.session.activeTerminalSessionId) {
            activeSessionId = key;
        }
    }
    const selectedSessionId = activeSessionId ?? allTerminalSessions.keys().next().value ?? '';

    const [terminalHidden, setTerminalHidden] = useState(true);

    return (
        <>
            {terminalHidden ? (
                <motion.div layout className="flex items-center gap-1">
                    {children}
                    <RestartSandboxButton />
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button
                                onClick={() => setTerminalHidden(!terminalHidden)}
                                className="h-9 w-9 flex items-center justify-center hover:text-foreground-hover text-foreground-tertiary hover:bg-accent/50 rounded-md border border-transparent"
                            >
                                <Icons.Terminal />
                            </button>
                        </TooltipTrigger>
                        <TooltipContent sideOffset={5} hideArrow>Toggle Terminal</TooltipContent>
                    </Tooltip>
                </motion.div>
            ) : (
                <motion.div
                    layout
                    className="flex items-center justify-between w-full mb-1"
                >
                    <motion.span
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        transition={{ duration: 0.7 }}
                        className="text-small text-foreground-secondary ml-2 select-none"
                    >
                        Terminal
                    </motion.span>
                    <div className="flex items-center gap-1">
                        <motion.div layout>{/* <RunButton /> */}</motion.div>
                        <RestartSandboxButton />
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    onClick={() => setTerminalHidden(!terminalHidden)}
                                    className="h-9 w-9 flex items-center justify-center hover:text-foreground-hover text-foreground-tertiary hover:bg-accent/50 rounded-md border border-transparent"
                                >
                                    <Icons.ChevronDown />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent sideOffset={5} hideArrow>Toggle Terminal</TooltipContent>
                        </Tooltip>
                    </div>
                </motion.div>
            )}
            <div
                className={cn(
                    'bg-background rounded-lg transition-all duration-300 flex flex-col items-center justify-between h-full overflow-auto',
                    terminalHidden ? 'h-0 w-0 invisible' : 'h-[22rem] w-[37rem]',
                )}
            >
                {allTerminalSessions.size > 0 ? (
                    <Tabs defaultValue={selectedSessionId} value={selectedSessionId} onValueChange={(value) => {
                        const terminalData = allTerminalSessions.get(value);
                        if (terminalData) {
                            sandbox.session.activeTerminalSessionId = terminalData.sessionId;
                        }
                    }}
                        className="w-full h-full">
                        <TabsList className="w-full h-8 rounded-none border-b border-border overflow-x-auto justify-start">
                            {Array.from(allTerminalSessions).map(([key, terminalData]) => (
                                <TabsTrigger key={key} value={key} className="flex-1">
                                    <span className="truncate">
                                        {terminalData.name}
                                    </span>
                                </TabsTrigger>
                            ))}
                        </TabsList>
                        <div className="w-full h-full overflow-auto">
                            {Array.from(allTerminalSessions).map(([key, terminalData]) => (
                                <TabsContent key={key} forceMount value={key} className="h-full" hidden={activeSessionId !== key}>
                                    <Terminal hidden={terminalHidden} terminalSessionId={terminalData.sessionId} />
                                </TabsContent>
                            ))}
                        </div>
                    </Tabs>
                ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                        <span className="text-sm">No terminal sessions available</span>
                    </div>
                )}
            </div >
        </>
    );
});
