import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

const rectPosition = v.object({
  x: v.number(),
  y: v.number(),
});

const rectDimension = v.object({
  width: v.number(),
  height: v.number(),
});

const timestampFields = {
  createdAt: v.number(),
  updatedAt: v.number(),
};

export default defineSchema({
  projects: defineTable({
    projectId: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    tags: v.array(v.string()),
    previewStorageId: v.optional(v.id('_storage')),
    previewUrl: v.optional(v.string()),
    previewUpdatedAt: v.optional(v.number()),
    previewPort: v.optional(v.number()),
    ...timestampFields,
  })
    .index('by_project_id', ['projectId'])
    .index('by_updated_at', ['updatedAt']),

  frames: defineTable({
    frameId: v.string(),
    projectId: v.string(),
    position: rectPosition,
    dimension: rectDimension,
    url: v.string(),
    metadata: v.optional(v.any()),
    ...timestampFields,
  })
    .index('by_project_id', ['projectId'])
    .index('by_frame_id', ['frameId']),

  conversations: defineTable({
    conversationId: v.string(),
    projectId: v.string(),
    title: v.string(),
    type: v.optional(v.string()),
    ...timestampFields,
  })
    .index('by_project_id', ['projectId'])
    .index('by_conversation_id', ['conversationId']),

  messages: defineTable({
    messageId: v.string(),
    conversationId: v.string(),
    projectId: v.string(),
    role: v.string(),
    content: v.string(),
    contexts: v.optional(v.array(v.any())),
    checkpoints: v.optional(v.array(v.any())),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_conversation_id', ['conversationId'])
    .index('by_project_id', ['projectId'])
    .index('by_message_id', ['messageId']),

  settings: defineTable({
    scope: v.union(v.literal('global'), v.literal('project')),
    projectId: v.optional(v.string()),
    key: v.string(),
    value: v.any(),
    updatedAt: v.number(),
  })
    .index('by_scope_project_key', ['scope', 'projectId', 'key'])
    .index('by_project_id', ['projectId']),

  checkpoints: defineTable({
    checkpointId: v.string(),
    projectId: v.string(),
    messageId: v.optional(v.string()),
    label: v.string(),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
  })
    .index('by_project_id', ['projectId'])
    .index('by_checkpoint_id', ['checkpointId']),
});
