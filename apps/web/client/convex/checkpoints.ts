import { mutationGeneric, queryGeneric } from 'convex/server';
import { v } from 'convex/values';

async function getCheckpointById(ctx: { db: any }, checkpointId: string) {
  return ctx.db
    .query('checkpoints')
    .withIndex('by_checkpoint_id', (q: any) => q.eq('checkpointId', checkpointId))
    .unique();
}

export const list = queryGeneric({
  args: {
    projectId: v.string(),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query('checkpoints')
      .withIndex('by_project_id', (q) => q.eq('projectId', args.projectId))
      .collect();
    return rows.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const upsert = mutationGeneric({
  args: {
    checkpointId: v.string(),
    projectId: v.string(),
    messageId: v.optional(v.string()),
    label: v.string(),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const existing = await getCheckpointById(ctx, args.checkpointId);
    if (existing) {
      await ctx.db.patch(existing._id, {
        projectId: args.projectId,
        messageId: args.messageId,
        label: args.label,
        metadata: args.metadata,
      });
      return existing._id;
    }
    return ctx.db.insert('checkpoints', {
      checkpointId: args.checkpointId,
      projectId: args.projectId,
      messageId: args.messageId,
      label: args.label,
      metadata: args.metadata,
      createdAt: Date.now(),
    });
  },
});

export const remove = mutationGeneric({
  args: {
    checkpointId: v.string(),
  },
  handler: async (ctx, args) => {
    const checkpoint = await getCheckpointById(ctx, args.checkpointId);
    if (!checkpoint) {
      return false;
    }
    await ctx.db.delete(checkpoint._id);
    return true;
  },
});
