'use client';

import { convexApi } from '@/convex/api';
import type { Project } from '@onlook/models';
import { Icons } from '@onlook/ui/icons';
import { useQuery } from 'convex/react';
import { Main } from './_components/main';
import { ProjectProviders } from './providers';

type LocalProject = {
    projectId: string;
    name: string;
    description?: string | null;
    tags?: string[];
    createdAt: number;
    updatedAt: number;
    previewStorageId?: string;
    previewUrl?: string;
    previewUpdatedAt?: number;
};

export default function Page({ params }: { params: { id: string } }) {
    const projectRow = useQuery(convexApi.projects.get, { projectId: params.id }) as LocalProject | null | undefined;

    if (projectRow === undefined) {
        return (
            <div className="flex h-screen w-screen items-center justify-center gap-2">
                <Icons.LoadingSpinner className="h-4 w-4 animate-spin" />
                Loading project...
            </div>
        );
    }

    if (!projectRow) {
        return <div className="flex h-screen w-screen items-center justify-center">Project not found</div>;
    }

    const project: Project = {
        id: projectRow.projectId,
        name: projectRow.name,
        metadata: {
            createdAt: new Date(projectRow.createdAt),
            updatedAt: new Date(projectRow.updatedAt),
            previewImg: projectRow.previewUrl
                ? {
                    type: 'url',
                    url: projectRow.previewUrl,
                    updatedAt: projectRow.previewUpdatedAt ? new Date(projectRow.previewUpdatedAt) : null,
                }
                : null,
            description: projectRow.description ?? null,
            tags: projectRow.tags ?? [],
        },
    };

    return (
        <ProjectProviders project={project}>
            <Main />
        </ProjectProviders>
    );
}
