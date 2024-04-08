import { experimental_trpcMiddleware, TRPCError } from "@trpc/server";
import { and, desc, eq, exists, inArray, lte } from "drizzle-orm";
import invariant from "tiny-invariant";
import { z } from "zod";

import { db as DONT_USE_db } from "@hoarder/db";
import {
  bookmarkAssets,
  bookmarkLinks,
  bookmarks,
  bookmarksInLists,
  bookmarkTags,
  bookmarkTexts,
  tagsOnBookmarks,
} from "@hoarder/db/schema";
import { deleteAsset } from "@hoarder/shared/assetdb";
import {
  LinkCrawlerQueue,
  OpenAIQueue,
  SearchIndexingQueue,
} from "@hoarder/shared/queues";
import { getSearchIdxClient } from "@hoarder/shared/search";

import type { Context } from "../index";
import type { ZBookmark, ZBookmarkContent } from "../types/bookmarks";
import type { ZBookmarkTags } from "../types/tags";
import { authedProcedure, router } from "../index";
import {
  DEFAULT_NUM_BOOKMARKS_PER_PAGE,
  zBareBookmarkSchema,
  zBookmarkSchema,
  zGetBookmarksRequestSchema,
  zGetBookmarksResponseSchema,
  zNewBookmarkRequestSchema,
  zUpdateBookmarksRequestSchema,
} from "../types/bookmarks";

export const ensureBookmarkOwnership = experimental_trpcMiddleware<{
  ctx: Context;
  input: { bookmarkId: string };
}>().create(async (opts) => {
  const bookmark = await opts.ctx.db.query.bookmarks.findFirst({
    where: eq(bookmarks.id, opts.input.bookmarkId),
    columns: {
      userId: true,
    },
  });
  if (!opts.ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "User is not authorized",
    });
  }
  if (!bookmark) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Bookmark not found",
    });
  }
  if (bookmark.userId != opts.ctx.user.id) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "User is not allowed to access resource",
    });
  }

  return opts.next();
});

async function dummyDrizzleReturnType() {
  const x = await DONT_USE_db.query.bookmarks.findFirst({
    with: {
      tagsOnBookmarks: {
        with: {
          tag: true,
        },
      },
      link: true,
      text: true,
      asset: true,
    },
  });
  if (!x) {
    throw new Error();
  }
  return x;
}

type BookmarkQueryReturnType = Awaited<
  ReturnType<typeof dummyDrizzleReturnType>
>;

function toZodSchema(bookmark: BookmarkQueryReturnType): ZBookmark {
  const { tagsOnBookmarks, link, text, asset, ...rest } = bookmark;

  let content: ZBookmarkContent;
  if (link) {
    content = { type: "link", ...link };
  } else if (text) {
    content = { type: "text", text: text.text ?? "" };
  } else if (asset) {
    content = {
      type: "asset",
      assetType: asset.assetType,
      assetId: asset.assetId,
    };
  } else {
    content = { type: "unknown" };
  }

  return {
    tags: tagsOnBookmarks.map((t) => ({
      attachedBy: t.attachedBy,
      ...t.tag,
    })),
    content,
    ...rest,
  };
}

export const bookmarksAppRouter = router({
  createBookmark: authedProcedure
    .input(zNewBookmarkRequestSchema)
    .output(zBookmarkSchema)
    .mutation(async ({ input, ctx }) => {
      const bookmark = await ctx.db.transaction(
        async (tx): Promise<ZBookmark> => {
          const bookmark = (
            await tx
              .insert(bookmarks)
              .values({
                userId: ctx.user.id,
              })
              .returning()
          )[0];

          let content: ZBookmarkContent;

          switch (input.type) {
            case "link": {
              const link = (
                await tx
                  .insert(bookmarkLinks)
                  .values({
                    id: bookmark.id,
                    url: input.url.trim(),
                  })
                  .returning()
              )[0];
              content = {
                type: "link",
                ...link,
              };
              break;
            }
            case "text": {
              const text = (
                await tx
                  .insert(bookmarkTexts)
                  .values({ id: bookmark.id, text: input.text })
                  .returning()
              )[0];
              content = {
                type: "text",
                text: text.text ?? "",
              };
              break;
            }
            case "asset": {
              const [asset] = await tx
                .insert(bookmarkAssets)
                .values({
                  id: bookmark.id,
                  assetType: input.assetType,
                  assetId: input.assetId,
                  content: null,
                  info: null,
                  metadata: null,
                })
                .returning();
              content = {
                type: "asset",
                assetType: asset.assetType,
                assetId: asset.assetId,
              };
              break;
            }
            case "unknown": {
              throw new TRPCError({ code: "BAD_REQUEST" });
            }
          }

          return {
            tags: [] as ZBookmarkTags[],
            content,
            ...bookmark,
          };
        },
      );

      // Enqueue crawling request
      switch (bookmark.content.type) {
        case "link": {
          // The crawling job triggers openai when it's done
          await LinkCrawlerQueue.add("crawl", {
            bookmarkId: bookmark.id,
          });
          break;
        }
        case "text":
        case "asset": {
          await OpenAIQueue.add("openai", {
            bookmarkId: bookmark.id,
          });
          break;
        }
      }
      SearchIndexingQueue.add("search_indexing", {
        bookmarkId: bookmark.id,
        type: "index",
      });
      return bookmark;
    }),

  updateBookmark: authedProcedure
    .input(zUpdateBookmarksRequestSchema)
    .output(zBareBookmarkSchema)
    .use(ensureBookmarkOwnership)
    .mutation(async ({ input, ctx }) => {
      const res = await ctx.db
        .update(bookmarks)
        .set({
          archived: input.archived,
          favourited: input.favourited,
          note: input.note,
        })
        .where(
          and(
            eq(bookmarks.userId, ctx.user.id),
            eq(bookmarks.id, input.bookmarkId),
          ),
        )
        .returning();
      if (res.length == 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Bookmark not found",
        });
      }
      SearchIndexingQueue.add("search_indexing", {
        bookmarkId: input.bookmarkId,
        type: "index",
      });
      return res[0];
    }),

  updateBookmarkText: authedProcedure
    .input(
      z.object({
        bookmarkId: z.string(),
        text: z.string().max(2000),
      }),
    )
    .use(ensureBookmarkOwnership)
    .mutation(async ({ input, ctx }) => {
      const res = await ctx.db
        .update(bookmarkTexts)
        .set({
          text: input.text,
        })
        .where(and(eq(bookmarkTexts.id, input.bookmarkId)))
        .returning();
      if (res.length == 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Bookmark not found",
        });
      }
      SearchIndexingQueue.add("search_indexing", {
        bookmarkId: input.bookmarkId,
        type: "index",
      });
    }),

  deleteBookmark: authedProcedure
    .input(z.object({ bookmarkId: z.string() }))
    .use(ensureBookmarkOwnership)
    .mutation(async ({ input, ctx }) => {
      const asset = await ctx.db.query.bookmarkAssets.findFirst({
        where: and(eq(bookmarkAssets.id, input.bookmarkId)),
      });
      const deleted = await ctx.db
        .delete(bookmarks)
        .where(
          and(
            eq(bookmarks.userId, ctx.user.id),
            eq(bookmarks.id, input.bookmarkId),
          ),
        );
      SearchIndexingQueue.add("search_indexing", {
        bookmarkId: input.bookmarkId,
        type: "delete",
      });
      if (deleted.changes > 0 && asset) {
        await deleteAsset({ userId: ctx.user.id, assetId: asset.assetId });
      }
    }),
  recrawlBookmark: authedProcedure
    .input(z.object({ bookmarkId: z.string() }))
    .use(ensureBookmarkOwnership)
    .mutation(async ({ input }) => {
      await LinkCrawlerQueue.add("crawl", {
        bookmarkId: input.bookmarkId,
      });
    }),
  getBookmark: authedProcedure
    .input(
      z.object({
        bookmarkId: z.string(),
      }),
    )
    .output(zBookmarkSchema)
    .use(ensureBookmarkOwnership)
    .query(async ({ input, ctx }) => {
      const bookmark = await ctx.db.query.bookmarks.findFirst({
        where: and(
          eq(bookmarks.userId, ctx.user.id),
          eq(bookmarks.id, input.bookmarkId),
        ),
        with: {
          tagsOnBookmarks: {
            with: {
              tag: true,
            },
          },
          link: true,
          text: true,
          asset: true,
        },
      });
      if (!bookmark) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Bookmark not found",
        });
      }

      return toZodSchema(bookmark);
    }),
  searchBookmarks: authedProcedure
    .input(
      z.object({
        text: z.string(),
      }),
    )
    .output(zGetBookmarksResponseSchema)
    .query(async ({ input, ctx }) => {
      const client = await getSearchIdxClient();
      if (!client) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Search functionality is not configured",
        });
      }
      const resp = await client.search(input.text, {
        filter: [`userId = '${ctx.user.id}'`],
        showRankingScore: true,
        attributesToRetrieve: ["id"],
        sort: ["createdAt:desc"],
      });

      if (resp.hits.length == 0) {
        return { bookmarks: [], nextCursor: null };
      }
      const idToRank = resp.hits.reduce<Record<string, number>>((acc, r) => {
        acc[r.id] = r._rankingScore!;
        return acc;
      }, {});
      const results = await ctx.db.query.bookmarks.findMany({
        where: and(
          eq(bookmarks.userId, ctx.user.id),
          inArray(
            bookmarks.id,
            resp.hits.map((h) => h.id),
          ),
        ),
        with: {
          tagsOnBookmarks: {
            with: {
              tag: true,
            },
          },
          link: true,
          text: true,
          asset: true,
        },
      });
      results.sort((a, b) => idToRank[b.id] - idToRank[a.id]);

      return { bookmarks: results.map(toZodSchema), nextCursor: null };
    }),
  getBookmarks: authedProcedure
    .input(zGetBookmarksRequestSchema)
    .output(zGetBookmarksResponseSchema)
    .query(async ({ input, ctx }) => {
      if (input.ids && input.ids.length == 0) {
        return { bookmarks: [], nextCursor: null };
      }
      if (!input.limit) {
        input.limit = DEFAULT_NUM_BOOKMARKS_PER_PAGE;
      }

      const sq = ctx.db.$with("bookmarksSq").as(
        ctx.db
          .select()
          .from(bookmarks)
          .where(
            and(
              eq(bookmarks.userId, ctx.user.id),
              input.archived !== undefined
                ? eq(bookmarks.archived, input.archived)
                : undefined,
              input.favourited !== undefined
                ? eq(bookmarks.favourited, input.favourited)
                : undefined,
              input.ids ? inArray(bookmarks.id, input.ids) : undefined,
              input.tagId !== undefined
                ? exists(
                    ctx.db
                      .select()
                      .from(tagsOnBookmarks)
                      .where(
                        and(
                          eq(tagsOnBookmarks.bookmarkId, bookmarks.id),
                          eq(tagsOnBookmarks.tagId, input.tagId),
                        ),
                      ),
                  )
                : undefined,
              input.listId !== undefined
                ? exists(
                    ctx.db
                      .select()
                      .from(bookmarksInLists)
                      .where(
                        and(
                          eq(bookmarksInLists.bookmarkId, bookmarks.id),
                          eq(bookmarksInLists.listId, input.listId),
                        ),
                      ),
                  )
                : undefined,
              input.cursor ? lte(bookmarks.createdAt, input.cursor) : undefined,
            ),
          )
          .limit(input.limit + 1)
          .orderBy(desc(bookmarks.createdAt)),
      );
      // TODO: Consider not inlining the tags in the response of getBookmarks as this query is getting kinda expensive
      const results = await ctx.db
        .with(sq)
        .select()
        .from(sq)
        .leftJoin(tagsOnBookmarks, eq(sq.id, tagsOnBookmarks.bookmarkId))
        .leftJoin(bookmarkTags, eq(tagsOnBookmarks.tagId, bookmarkTags.id))
        .leftJoin(bookmarkLinks, eq(bookmarkLinks.id, sq.id))
        .leftJoin(bookmarkTexts, eq(bookmarkTexts.id, sq.id))
        .leftJoin(bookmarkAssets, eq(bookmarkAssets.id, sq.id))
        .orderBy(desc(sq.createdAt));

      const bookmarksRes = results.reduce<Record<string, ZBookmark>>(
        (acc, row) => {
          const bookmarkId = row.bookmarksSq.id;
          if (!acc[bookmarkId]) {
            let content: ZBookmarkContent;
            if (row.bookmarkLinks) {
              content = { type: "link", ...row.bookmarkLinks };
            } else if (row.bookmarkTexts) {
              content = { type: "text", text: row.bookmarkTexts.text ?? "" };
            } else if (row.bookmarkAssets) {
              content = {
                type: "asset",
                assetId: row.bookmarkAssets.assetId,
                assetType: row.bookmarkAssets.assetType,
              };
            } else {
              content = { type: "unknown" };
            }
            acc[bookmarkId] = {
              ...row.bookmarksSq,
              content,
              tags: [],
            };
          }

          if (row.bookmarkTags) {
            invariant(
              row.tagsOnBookmarks,
              "if bookmark tag is set, its many-to-many relation must also be set",
            );
            acc[bookmarkId].tags.push({
              ...row.bookmarkTags,
              attachedBy: row.tagsOnBookmarks.attachedBy,
            });
          }

          return acc;
        },
        {},
      );

      const bookmarksArr = Object.values(bookmarksRes);

      let nextCursor = null;
      if (bookmarksArr.length > input.limit) {
        const nextItem = bookmarksArr.pop();
        nextCursor = nextItem?.createdAt ?? null;
      }

      return { bookmarks: bookmarksArr, nextCursor };
    }),

  updateTags: authedProcedure
    .input(
      z.object({
        bookmarkId: z.string(),
        attach: z.array(
          z.object({
            tagId: z.string().optional(), // If the tag already exists and we know its id
            tag: z.string(),
          }),
        ),
        // Detach by tag ids
        detach: z.array(z.object({ tagId: z.string() })),
      }),
    )
    .use(ensureBookmarkOwnership)
    .mutation(async ({ input, ctx }) => {
      await ctx.db.transaction(async (tx) => {
        // Detaches
        if (input.detach.length > 0) {
          await tx.delete(tagsOnBookmarks).where(
            and(
              eq(tagsOnBookmarks.bookmarkId, input.bookmarkId),
              inArray(
                tagsOnBookmarks.tagId,
                input.detach.map((t) => t.tagId),
              ),
            ),
          );
        }

        if (input.attach.length == 0) {
          return;
        }

        // New Tags
        const toBeCreatedTags = input.attach
          .filter((i) => i.tagId === undefined)
          .map((i) => ({
            name: i.tag,
            userId: ctx.user.id,
          }));

        if (toBeCreatedTags.length > 0) {
          await tx
            .insert(bookmarkTags)
            .values(toBeCreatedTags)
            .onConflictDoNothing()
            .returning();
        }

        const allIds = (
          await tx.query.bookmarkTags.findMany({
            where: and(
              eq(bookmarkTags.userId, ctx.user.id),
              inArray(
                bookmarkTags.name,
                input.attach.map((t) => t.tag),
              ),
            ),
            columns: {
              id: true,
            },
          })
        ).map((t) => t.id);

        await tx
          .insert(tagsOnBookmarks)
          .values(
            allIds.map((i) => ({
              tagId: i,
              bookmarkId: input.bookmarkId,
              attachedBy: "human" as const,
              userId: ctx.user.id,
            })),
          )
          .onConflictDoNothing();
      });
    }),
});
