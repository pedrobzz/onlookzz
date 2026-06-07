'use client';

import { convexApi } from '@/convex/api';
import { createDefaultLocalFrame, frameToConvexInput } from '@/utils/project/default-frame';
import { Button } from '@onlook/ui/button';
import { Icons } from '@onlook/ui/icons';
import { Input } from '@onlook/ui/input';
import { useMutation, useQuery } from 'convex/react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

type LocalProject = {
    projectId: string;
    name: string;
    description?: string | null;
    createdAt: number;
    updatedAt: number;
};

export default function ProjectsPage() {
    const projects = (useQuery(convexApi.projects.list, {}) as LocalProject[] | undefined) ?? [];
    const createProject = useMutation(convexApi.projects.create);
    const createFrame = useMutation(convexApi.frames.upsert);
    const removeProject = useMutation(convexApi.projects.remove);
    const [search, setSearch] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    const filteredProjects = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) {
            return projects;
        }
        return projects.filter((project) =>
            [project.name, project.description ?? '', project.projectId]
                .some((value) => value.toLowerCase().includes(query)),
        );
    }, [projects, search]);

    const handleCreateProject = async () => {
        setIsCreating(true);
        try {
            const projectId = crypto.randomUUID();
            await createProject({
                projectId,
                name: 'Untitled project',
                description: 'Local project',
            });
            const frame = createDefaultLocalFrame(projectId);
            await createFrame(frameToConvexInput(frame, projectId));
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <main className="flex h-screen w-screen flex-col bg-background text-foreground">
            <header className="flex h-14 items-center justify-between border-b border-border px-5">
                <div className="flex items-center gap-3">
                    <Icons.OnlookTextLogo className="w-24" viewBox="0 0 139 17" />
                    <span className="text-sm text-foreground-secondary">Local projects</span>
                </div>
                <Button onClick={handleCreateProject} disabled={isCreating}>
                    {isCreating ? (
                        <Icons.LoadingSpinner className="h-4 w-4 animate-spin" />
                    ) : (
                        <Icons.Plus className="h-4 w-4" />
                    )}
                    New project
                </Button>
            </header>

            <section className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5 overflow-auto px-6 py-7">
                <div className="flex items-center justify-between gap-4">
                    <h1 className="text-2xl font-medium">Projects</h1>
                    <div className="relative w-full max-w-xs">
                        <Icons.MagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-tertiary" />
                        <Input
                            value={search}
                            onChange={(event) => setSearch(event.currentTarget.value)}
                            placeholder="Search projects"
                            className="pl-9"
                        />
                    </div>
                </div>

                {filteredProjects.length === 0 ? (
                    <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-background-secondary/40">
                        <div className="text-lg text-foreground-secondary">No local projects</div>
                        <Button onClick={handleCreateProject} disabled={isCreating}>
                            <Icons.Plus className="h-4 w-4" />
                            Create project
                        </Button>
                    </div>
                ) : (
                    <div className="grid gap-3">
                        {filteredProjects.map((project) => (
                            <div
                                key={project.projectId}
                                className="grid grid-cols-[1fr_auto] items-center gap-4 rounded-lg border border-border bg-background-secondary/40 p-4"
                            >
                                <Link href={`/project/${project.projectId}`} className="min-w-0">
                                    <div className="truncate text-base font-medium">{project.name}</div>
                                    <div className="truncate text-sm text-foreground-secondary">
                                        {project.description || project.projectId}
                                    </div>
                                </Link>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label="Delete project"
                                    onClick={() => removeProject({ projectId: project.projectId })}
                                >
                                    <Icons.Trash className="h-4 w-4" />
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </main>
    );
}
