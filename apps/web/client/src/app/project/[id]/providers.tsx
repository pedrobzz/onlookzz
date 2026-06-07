'use client';

import { EditorEngineProvider } from '@/components/store/editor';
import { HostingProvider } from '@/components/store/hosting';
import type { Project } from '@onlook/models';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

export const ProjectProviders = ({
    children,
    project,
}: {
    children: React.ReactNode,
    project: Project,
}) => {
    return (
        <DndProvider backend={HTML5Backend}>
            <EditorEngineProvider project={project}>
                <HostingProvider>
                    {children}
                </HostingProvider>
            </EditorEngineProvider>
        </DndProvider>
    );
};
