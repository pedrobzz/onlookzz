import { makeFunctionReference, type FunctionReference } from 'convex/server';

type QueryRef<Args, Return> = FunctionReference<'query', 'public', Args, Return>;
type MutationRef<Args, Return> = FunctionReference<'mutation', 'public', Args, Return>;

const queryRef = <Args, Return>(name: string) =>
  makeFunctionReference<'query', Args, Return>(name) as QueryRef<Args, Return>;

const mutationRef = <Args, Return>(name: string) =>
  makeFunctionReference<'mutation', Args, Return>(name) as MutationRef<Args, Return>;

export const convexApi = {
  projects: {
    list: queryRef<Record<string, never>, unknown[]>('projects:list'),
    get: queryRef<{ projectId: string }, unknown | null>('projects:get'),
    create: mutationRef<{ projectId: string; name: string; description?: string }, string>('projects:create'),
    update: mutationRef<Record<string, unknown> & { projectId: string }, string>('projects:update'),
    remove: mutationRef<{ projectId: string }, boolean>('projects:remove'),
  },
  frames: {
    list: queryRef<{ projectId: string }, unknown[]>('frames:list'),
    upsert: mutationRef<Record<string, unknown> & { frameId: string; projectId: string }, string>('frames:upsert'),
    remove: mutationRef<{ frameId: string }, boolean>('frames:remove'),
  },
  conversations: {
    list: queryRef<{ projectId: string }, unknown[]>('conversations:list'),
    upsert: mutationRef<{ conversationId: string; projectId: string; title: string; type?: string }, string>('conversations:upsert'),
    remove: mutationRef<{ conversationId: string }, boolean>('conversations:remove'),
  },
  messages: {
    list: queryRef<{ conversationId: string }, unknown[]>('messages:list'),
    upsert: mutationRef<Record<string, unknown> & { messageId: string; conversationId: string; projectId: string }, string>('messages:upsert'),
    replaceConversation: mutationRef<{ conversationId: string; messages: unknown[] }, string[]>('messages:replaceConversation'),
    remove: mutationRef<{ messageId: string }, boolean>('messages:remove'),
  },
  settings: {
    get: queryRef<{ scope: 'global' | 'project'; projectId?: string; key: string }, unknown | null>('settings:get'),
    list: queryRef<{ projectId?: string }, unknown[]>('settings:list'),
    upsert: mutationRef<{ scope: 'global' | 'project'; projectId?: string; key: string; value: unknown }, string>('settings:upsert'),
  },
  checkpoints: {
    list: queryRef<{ projectId: string }, unknown[]>('checkpoints:list'),
    upsert: mutationRef<Record<string, unknown> & { checkpointId: string; projectId: string; label: string }, string>('checkpoints:upsert'),
    remove: mutationRef<{ checkpointId: string }, boolean>('checkpoints:remove'),
  },
  uploads: {
    generateUploadUrl: mutationRef<Record<string, never>, string>('uploads:generateUploadUrl'),
    getUrl: queryRef<{ storageId: string }, string | null>('uploads:getUrl'),
  },
};
