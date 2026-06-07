'use client';

import type { Project } from '@onlook/models';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { EditorEngine } from './engine';

const EditorEngineContext = createContext<EditorEngine | null>(null);

export const useEditorEngine = () => {
    const ctx = useContext(EditorEngineContext);
    if (!ctx) throw new Error('useEditorEngine must be inside EditorEngineProvider');
    return ctx;
};

export const EditorEngineProvider = ({
    children,
    project,
}: {
    children: React.ReactNode,
    project: Project,
}) => {
    const currentProjectId = useRef(project.id);
    const engineRef = useRef<EditorEngine | null>(null);

    const [editorEngine, setEditorEngine] = useState(() => {
        const engine = new EditorEngine(project.id, project.name);
        void engine.initProject();
        engine.init();
        engineRef.current = engine;
        return engine;
    });

    // Initialize editor engine when project ID changes
    useEffect(() => {
        const initializeEngine = async () => {
            if (currentProjectId.current !== project.id) {
                // Clean up old engine with delay to avoid race conditions
                if (engineRef.current) {
                    setTimeout(() => engineRef.current?.clear(), 0);
                }

                // Create new engine for new project
                const newEngine = new EditorEngine(project.id, project.name);
                await newEngine.initProject();
                await newEngine.init();

                engineRef.current = newEngine;
                setEditorEngine(newEngine);
                currentProjectId.current = project.id;
            }
        };

        initializeEngine();
    }, [project.id, project.name]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            setTimeout(() => engineRef.current?.clear(), 0);
        };
    }, []);

    return (
        <EditorEngineContext.Provider value={editorEngine}>
            {children}
        </EditorEngineContext.Provider>
    );
};
