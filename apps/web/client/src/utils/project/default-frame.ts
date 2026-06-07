import type { Frame } from '@onlook/models';
import { v4 as uuidv4 } from 'uuid';

export const DEFAULT_LOCAL_PREVIEW_URL = 'http://localhost:3000';

export function createDefaultLocalFrame(projectId: string, url = DEFAULT_LOCAL_PREVIEW_URL): Frame {
    return {
        id: uuidv4(),
        projectId: projectId,
        canvasId: projectId,
        position: {
            x: 150,
            y: 40,
        },
        dimension: {
            width: 1536,
            height: 960,
        },
        url,
    };
}

export type ConvexFrameRow = {
    frameId: string;
    projectId: string;
    position: Frame['position'];
    dimension: Frame['dimension'];
    url: string;
};

export function frameToConvexInput(frame: Frame, projectId: string) {
    return {
        frameId: frame.id,
        projectId,
        position: frame.position,
        dimension: frame.dimension,
        url: frame.url,
    };
}

export function frameFromConvex(row: ConvexFrameRow): Frame {
    return {
        id: row.frameId,
        projectId: row.projectId,
        canvasId: row.projectId,
        position: row.position,
        dimension: row.dimension,
        url: row.url,
    };
}
