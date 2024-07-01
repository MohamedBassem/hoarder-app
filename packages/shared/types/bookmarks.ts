import { z } from "zod";

import { zBookmarkTagSchema } from "./tags";

const MAX_TITLE_LENGTH = 100;

export const enum BookmarkTypes {
  LINK = "link",
  TEXT = "text",
  ASSET = "asset",
  UNKNOWN = "unknown",
}

export const zBookmarkedLinkSchema = z.object({
  type: z.literal(BookmarkTypes.LINK),
  url: z.string().url(),
  title: z.string().nullish(),
  description: z.string().nullish(),
  imageUrl: z.string().url().nullish(),
  imageAssetId: z.string().nullish(),
  screenshotAssetId: z.string().nullish(),
  fullPageArchiveAssetId: z.string().nullish(),
  videoAssetId: z.string().nullish(),
  favicon: z.string().url().nullish(),
  htmlContent: z.string().nullish(),
  crawledAt: z.date().nullish(),
});
export type ZBookmarkedLink = z.infer<typeof zBookmarkedLinkSchema>;

export const zBookmarkedTextSchema = z.object({
  type: z.literal(BookmarkTypes.TEXT),
  text: z.string(),
});
export type ZBookmarkedText = z.infer<typeof zBookmarkedTextSchema>;

export const zBookmarkedAssetSchema = z.object({
  type: z.literal(BookmarkTypes.ASSET),
  assetType: z.enum(["image", "pdf"]),
  assetId: z.string(),
  fileName: z.string().nullish(),
  sourceUrl: z.string().nullish(),
});
export type ZBookmarkedAsset = z.infer<typeof zBookmarkedAssetSchema>;

export const zBookmarkContentSchema = z.discriminatedUnion("type", [
  zBookmarkedLinkSchema,
  zBookmarkedTextSchema,
  zBookmarkedAssetSchema,
  z.object({ type: z.literal(BookmarkTypes.UNKNOWN) }),
]);
export type ZBookmarkContent = z.infer<typeof zBookmarkContentSchema>;

export const zBareBookmarkSchema = z.object({
  id: z.string(),
  createdAt: z.date(),
  title: z.string().max(MAX_TITLE_LENGTH).nullish(),
  archived: z.boolean(),
  favourited: z.boolean(),
  taggingStatus: z.enum(["success", "failure", "pending"]).nullable(),
  note: z.string().nullish(),
});

export const zBookmarkSchema = zBareBookmarkSchema.merge(
  z.object({
    tags: z.array(zBookmarkTagSchema),
    content: zBookmarkContentSchema,
  }),
);
export type ZBookmark = z.infer<typeof zBookmarkSchema>;

const zBookmarkTypeLinkSchema = zBareBookmarkSchema.merge(
  z.object({
    tags: z.array(zBookmarkTagSchema),
    content: zBookmarkedLinkSchema,
  }),
);
export type ZBookmarkTypeLink = z.infer<typeof zBookmarkTypeLinkSchema>;

const zBookmarkTypeTextSchema = zBareBookmarkSchema.merge(
  z.object({
    tags: z.array(zBookmarkTagSchema),
    content: zBookmarkedTextSchema,
  }),
);
export type ZBookmarkTypeText = z.infer<typeof zBookmarkTypeTextSchema>;

const zBookmarkTypeAssetSchema = zBareBookmarkSchema.merge(
  z.object({
    tags: z.array(zBookmarkTagSchema),
    content: zBookmarkedAssetSchema,
  }),
);
export type ZBookmarkTypeAsset = z.infer<typeof zBookmarkTypeAssetSchema>;

// POST /v1/bookmarks
export const zNewBookmarkRequestSchema = zBookmarkContentSchema;
export type ZNewBookmarkRequest = z.infer<typeof zNewBookmarkRequestSchema>;

// GET /v1/bookmarks

export const DEFAULT_NUM_BOOKMARKS_PER_PAGE = 20;
export const MAX_NUM_BOOKMARKS_PER_PAGE = 100;

const zCursorV2 = z.object({
  createdAt: z.date(),
  id: z.string(),
});

export const zGetBookmarksRequestSchema = z.object({
  ids: z.array(z.string()).optional(),
  archived: z.boolean().optional(),
  favourited: z.boolean().optional(),
  tagId: z.string().optional(),
  listId: z.string().optional(),
  limit: z.number().max(MAX_NUM_BOOKMARKS_PER_PAGE).optional(),
  cursor: zCursorV2.or(z.date()).nullish(),
  // TODO: Remove this field once all clients are updated to use the new cursor structure.
  // This is done for backward comptability. If a client doesn't send this field, we'll assume it's an old client
  // and repsond with the old cursor structure. Once all clients are updated, we can remove this field and drop the old cursor structure.
  useCursorV2: z.boolean().optional(),
});
export type ZGetBookmarksRequest = z.infer<typeof zGetBookmarksRequestSchema>;

export const zGetBookmarksResponseSchema = z.object({
  bookmarks: z.array(zBookmarkSchema),
  nextCursor: zCursorV2.or(z.date()).nullable(),
});
export type ZGetBookmarksResponse = z.infer<typeof zGetBookmarksResponseSchema>;

// PATCH /v1/bookmarks/[bookmarkId]
export const zUpdateBookmarksRequestSchema = z.object({
  bookmarkId: z.string(),
  archived: z.boolean().optional(),
  favourited: z.boolean().optional(),
  note: z.string().optional(),
  title: z.string().max(MAX_TITLE_LENGTH).nullish(),
});
export type ZUpdateBookmarksRequest = z.infer<
  typeof zUpdateBookmarksRequestSchema
>;
