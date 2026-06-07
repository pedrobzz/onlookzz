import { penpalParent } from "..";

export function setFrameId(frameId: string) {
    (window as any)._onlookFrameId = frameId;
}

export function getFrameId(): string {
    const frameId = (window as any)._onlookFrameId;
    if (!frameId) {
        console.warn('Frame id not found');
        penpalParent?.getFrameId().then((id) => {
            setFrameId(id);
        });
        return '';
    }
    return frameId;
}

export function setProjectId(projectId: string) {
    (window as any)._onlookProjectId = projectId;
}

export function getProjectId(): string {
    const projectId = (window as any)._onlookProjectId;
    if (!projectId) {
        console.warn('Project id not found');
        penpalParent?.getProjectId().then((id) => {
            setProjectId(id);
        });
        return '';
    }
    return projectId;
}
