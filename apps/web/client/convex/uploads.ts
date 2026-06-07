import { mutationGeneric, queryGeneric } from 'convex/server';
import { v } from 'convex/values';

export const generateUploadUrl = mutationGeneric({
  args: {},
  handler: async (ctx) => {
    return ctx.storage.generateUploadUrl();
  },
});

export const getUrl = queryGeneric({
  args: {
    storageId: v.id('_storage'),
  },
  handler: async (ctx, args) => {
    return ctx.storage.getUrl(args.storageId);
  },
});
