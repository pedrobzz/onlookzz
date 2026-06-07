import { mutationGeneric, queryGeneric } from 'convex/server';
import { v } from 'convex/values';

async function getMessageById(ctx: { db: any }, messageId: string) {
  return ctx.db
    .query('messages')
    .withIndex('by_message_id', (q: any) => q.eq('messageId', messageId))
    .unique();
}

export const list = queryGeneric({
  args: {
    conversationId: v.string(),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query('messages')
      .withIndex('by_conversation_id', (q) => q.eq('conversationId', args.conversationId))
      .collect();
    return rows.sort((a, b) => a.createdAt - b.createdAt);
  },
});

export const upsert = mutationGeneric({
  args: {
    messageId: v.string(),
    conversationId: v.string(),
    projectId: v.string(),
    role: v.string(),
    content: v.string(),
    contexts: v.optional(v.array(v.any())),
    checkpoints: v.optional(v.array(v.any())),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await getMessageById(ctx, args.messageId);
    if (existing) {
      await ctx.db.patch(existing._id, {
        conversationId: args.conversationId,
        projectId: args.projectId,
        role: args.role,
        content: args.content,
        contexts: args.contexts,
        checkpoints: args.checkpoints,
        updatedAt: now,
      });
      return existing._id;
    }

    return ctx.db.insert('messages', {
      messageId: args.messageId,
      conversationId: args.conversationId,
      projectId: args.projectId,
      role: args.role,
      content: args.content,
      contexts: args.contexts,
      checkpoints: args.checkpoints,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const replaceConversation = mutationGeneric({
  args: {
    conversationId: v.string(),
    messages: v.array(v.object({
      messageId: v.string(),
      projectId: v.string(),
      role: v.string(),
      content: v.string(),
      contexts: v.optional(v.array(v.any())),
      checkpoints: v.optional(v.array(v.any())),
      createdAt: v.optional(v.number()),
    })),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('messages')
      .withIndex('by_conversation_id', (q) => q.eq('conversationId', args.conversationId))
      .collect();
    await Promise.all(existing.map((message) => ctx.db.delete(message._id)));

    const now = Date.now();
    const inserted = await Promise.all(args.messages.map((message) => ctx.db.insert('messages', {
      ...message,
      conversationId: args.conversationId,
      createdAt: message.createdAt ?? now,
      updatedAt: now,
    })));

    const conversation = await ctx.db
      .query('conversations')
      .withIndex('by_conversation_id', (q) => q.eq('conversationId', args.conversationId))
      .unique();
    if (conversation) {
      await ctx.db.patch(conversation._id, { updatedAt: now });
    }

    return inserted;
  },
});

export const updateCheckpoints = mutationGeneric({
  args: {
    messageId: v.string(),
    checkpoints: v.array(v.any()),
  },
  handler: async (ctx, args) => {
    const message = await getMessageById(ctx, args.messageId);
    if (!message) {
      return false;
    }
    await ctx.db.patch(message._id, {
      checkpoints: args.checkpoints,
      updatedAt: Date.now(),
    });
    return true;
  },
});

export const remove = mutationGeneric({
  args: {
    messageId: v.string(),
  },
  handler: async (ctx, args) => {
    const message = await getMessageById(ctx, args.messageId);
    if (!message) {
      return false;
    }
    await ctx.db.delete(message._id);
    return true;
  },
});
