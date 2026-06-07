import { mutationGeneric, queryGeneric } from 'convex/server';
import { v } from 'convex/values';

async function getConversationById(ctx: { db: any }, conversationId: string) {
  return ctx.db
    .query('conversations')
    .withIndex('by_conversation_id', (q: any) => q.eq('conversationId', conversationId))
    .unique();
}

export const list = queryGeneric({
  args: {
    projectId: v.string(),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query('conversations')
      .withIndex('by_project_id', (q) => q.eq('projectId', args.projectId))
      .collect();
    return rows.sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

export const upsert = mutationGeneric({
  args: {
    conversationId: v.string(),
    projectId: v.string(),
    title: v.string(),
    type: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await getConversationById(ctx, args.conversationId);
    if (existing) {
      await ctx.db.patch(existing._id, {
        projectId: args.projectId,
        title: args.title,
        type: args.type,
        updatedAt: now,
      });
      return existing._id;
    }

    return ctx.db.insert('conversations', {
      conversationId: args.conversationId,
      projectId: args.projectId,
      title: args.title,
      type: args.type,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const remove = mutationGeneric({
  args: {
    conversationId: v.string(),
  },
  handler: async (ctx, args) => {
    const conversation = await getConversationById(ctx, args.conversationId);
    if (!conversation) {
      return false;
    }

    const messages = await ctx.db
      .query('messages')
      .withIndex('by_conversation_id', (q) => q.eq('conversationId', args.conversationId))
      .collect();
    await Promise.all(messages.map((message) => ctx.db.delete(message._id)));
    await ctx.db.delete(conversation._id);
    return true;
  },
});
