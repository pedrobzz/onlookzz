import type { RuntimeEvent } from './contracts';

type Listener = (event: RuntimeEvent) => void;

export class RuntimeEventBus {
  private listeners = new Map<string, Set<Listener>>();
  private versions = new Map<string, number>();

  subscribe(projectId: string, listener: Listener): () => void {
    const listeners = this.listeners.get(projectId) ?? new Set<Listener>();
    listeners.add(listener);
    this.listeners.set(projectId, listeners);

    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) {
        this.listeners.delete(projectId);
      }
    };
  }

  publish(event: Omit<RuntimeEvent, 'version'>): RuntimeEvent {
    const version = (this.versions.get(event.projectId) ?? 0) + 1;
    this.versions.set(event.projectId, version);

    const runtimeEvent: RuntimeEvent = {
      ...event,
      version,
      modifiedTime: event.modifiedTime ?? Date.now(),
    };

    for (const listener of this.listeners.get(event.projectId) ?? []) {
      listener(runtimeEvent);
    }

    return runtimeEvent;
  }
}

export const eventBus = new RuntimeEventBus();

export function encodeSse(event: RuntimeEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}
