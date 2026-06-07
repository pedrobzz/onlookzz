import { mutationGeneric, queryGeneric } from 'convex/server';
import { v } from 'convex/values';

const scope = v.union(v.literal('global'), v.literal('project'));

async function getSetting(ctx: { db: any }, args: { scope: 'global' | 'project'; projectId?: string; key: string }) {
  return ctx.db
    .query('settings')
    .withIndex('by_scope_project_key', (q: any) => q
      .eq('scope', args.scope)
      .eq('projectId', args.projectId)
      .eq('key', args.key))
    .unique();
}

export const get = queryGeneric({
  args: {
    scope,
    projectId: v.optional(v.string()),
    key: v.string(),
  },
  handler: async (ctx, args) => getSetting(ctx, args),
});

export const list = queryGeneric({
  args: {
    projectId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!args.projectId) {
      return ctx.db
        .query('settings')
        .withIndex('by_scope_project_key', (q) => q.eq('scope', 'global'))
        .collect();
    }
    return ctx.db
      .query('settings')
      .withIndex('by_project_id', (q) => q.eq('projectId', args.projectId))
      .collect();
  },
});

export const upsert = mutationGeneric({
  args: {
    scope,
    projectId: v.optional(v.string()),
    key: v.string(),
    value: v.any(),
  },
  handler: async (ctx, args) => {
    const existing = await getSetting(ctx, args);
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        value: args.value,
        updatedAt: now,
      });
      return existing._id;
    }
    return ctx.db.insert('settings', {
      scope: args.scope,
      projectId: args.projectId,
      key: args.key,
      value: args.value,
      updatedAt: now,
    });
  },
});
