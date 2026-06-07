import { mutationGeneric, queryGeneric } from 'convex/server';
import { v } from 'convex/values';

const projectPatch = {
  name: v.optional(v.string()),
  description: v.optional(v.string()),
  tags: v.optional(v.array(v.string())),
  previewStorageId: v.optional(v.id('_storage')),
  previewUrl: v.optional(v.string()),
  previewUpdatedAt: v.optional(v.number()),
  previewPort: v.optional(v.number()),
};

async function getProjectById(ctx: { db: any }, projectId: string) {
  return ctx.db
    .query('projects')
    .withIndex('by_project_id', (q: any) => q.eq('projectId', projectId))
    .unique();
}

export const list = queryGeneric({
  args: {},
  handler: async (ctx) => {
    const projects = await ctx.db.query('projects').withIndex('by_updated_at').collect();
    return projects.sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

export const get = queryGeneric({
  args: {
    projectId: v.string(),
  },
  handler: async (ctx, args) => getProjectById(ctx, args.projectId),
});

export const create = mutationGeneric({
  args: {
    projectId: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await getProjectById(ctx, args.projectId);
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name,
        description: args.description,
        updatedAt: now,
      });
      return existing._id;
    }

    return ctx.db.insert('projects', {
      projectId: args.projectId,
      name: args.name,
      description: args.description,
      tags: [],
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutationGeneric({
  args: {
    projectId: v.string(),
    ...projectPatch,
  },
  handler: async (ctx, args) => {
    const project = await getProjectById(ctx, args.projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    const patch: Record<string, unknown> = {
      updatedAt: Date.now(),
    };

    for (const key of Object.keys(projectPatch)) {
      const value = args[key as keyof typeof args];
      if (value !== undefined) {
        patch[key] = value;
      }
    }

    await ctx.db.patch(project._id, patch);
    return project._id;
  },
});

export const remove = mutationGeneric({
  args: {
    projectId: v.string(),
  },
  handler: async (ctx, args) => {
    const project = await getProjectById(ctx, args.projectId);
    if (!project) {
      return false;
    }

    for (const table of ['frames', 'conversations', 'messages', 'settings', 'checkpoints']) {
      const rows = await ctx.db
        .query(table)
        .withIndex('by_project_id', (q: any) => q.eq('projectId', args.projectId))
        .collect();
      await Promise.all(rows.map((row) => ctx.db.delete(row._id)));
    }

    await ctx.db.delete(project._id);
    return true;
  },
});
