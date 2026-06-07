import { mutationGeneric, queryGeneric } from 'convex/server';
import { v } from 'convex/values';

async function getConversationById(ctx: { db: any }, conversationId: string) {
  return ctx.db
    .query('conversations')
    .withIndex('by_conversation_id', (q: any) => q.eq('conversationId', conversationId))
    .unique();
}

function toClientConversation(row: any) {
  return {
    conversationId: row.conversationId,
    projectId: row.projectId,
    title: row.title,
    type: row.type,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
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
    return rows.sort((a, b) => b.updatedAt - a.updatedAt).map(toClientConversation);
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
      const updated = await getConversationById(ctx, args.conversationId);
      return updated ? toClientConversation(updated) : null;
    }

    await ctx.db.insert('conversations', {
      conversationId: args.conversationId,
      projectId: args.projectId,
      title: args.title,
      type: args.type,
      createdAt: now,
      updatedAt: now,
    });
    const created = await getConversationById(ctx, args.conversationId);
    return created ? toClientConversation(created) : null;
  },
});

export const update = mutationGeneric({
  args: {
    conversationId: v.string(),
    title: v.optional(v.string()),
    type: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const conversation = await getConversationById(ctx, args.conversationId);
    if (!conversation) {
      throw new Error('Conversation not found');
    }

    const patch: Record<string, unknown> = {
      updatedAt: Date.now(),
    };
    if (args.title !== undefined) {
      patch.title = args.title;
    }
    if (args.type !== undefined) {
      patch.type = args.type;
    }

    await ctx.db.patch(conversation._id, patch);
    const updated = await getConversationById(ctx, args.conversationId);
    return updated ? toClientConversation(updated) : null;
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
