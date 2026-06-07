import { mutationGeneric, queryGeneric } from 'convex/server';
import { v } from 'convex/values';

const frameFields = {
  position: v.object({
    x: v.number(),
    y: v.number(),
  }),
  dimension: v.object({
    width: v.number(),
    height: v.number(),
  }),
  url: v.string(),
  metadata: v.optional(v.any()),
};

async function getFrameById(ctx: { db: any }, frameId: string) {
  return ctx.db
    .query('frames')
    .withIndex('by_frame_id', (q: any) => q.eq('frameId', frameId))
    .unique();
}

export const list = queryGeneric({
  args: {
    projectId: v.string(),
  },
  handler: async (ctx, args) => {
    return ctx.db
      .query('frames')
      .withIndex('by_project_id', (q) => q.eq('projectId', args.projectId))
      .collect();
  },
});

export const upsert = mutationGeneric({
  args: {
    frameId: v.string(),
    projectId: v.string(),
    ...frameFields,
  },
  handler: async (ctx, args) => {
    const existing = await getFrameById(ctx, args.frameId);
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        projectId: args.projectId,
        position: args.position,
        dimension: args.dimension,
        url: args.url,
        metadata: args.metadata,
        updatedAt: now,
      });
      return existing._id;
    }

    return ctx.db.insert('frames', {
      frameId: args.frameId,
      projectId: args.projectId,
      position: args.position,
      dimension: args.dimension,
      url: args.url,
      metadata: args.metadata,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const remove = mutationGeneric({
  args: {
    frameId: v.string(),
  },
  handler: async (ctx, args) => {
    const frame = await getFrameById(ctx, args.frameId);
    if (!frame) {
      return false;
    }
    await ctx.db.delete(frame._id);
    return true;
  },
});
