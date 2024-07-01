import { assert, beforeEach, describe, expect, test } from "vitest";

import { bookmarks } from "@hoarder/db/schema";
import { BookmarkTypes } from "@hoarder/shared/types/bookmarks";

import type { CustomTestContext } from "../testUtils";
import { defaultBeforeEach } from "../testUtils";

beforeEach<CustomTestContext>(defaultBeforeEach(true));

describe("Bookmark Routes", () => {
  test<CustomTestContext>("create bookmark", async ({ apiCallers }) => {
    const api = apiCallers[0].bookmarks;
    const bookmark = await api.createBookmark({
      url: "https://google.com",
      type: BookmarkTypes.LINK,
    });

    const res = await api.getBookmark({ bookmarkId: bookmark.id });
    assert(res.content.type == BookmarkTypes.LINK);
    expect(res.content.url).toEqual("https://google.com");
    expect(res.favourited).toEqual(false);
    expect(res.archived).toEqual(false);
    expect(res.content.type).toEqual(BookmarkTypes.LINK);
  });

  test<CustomTestContext>("delete bookmark", async ({ apiCallers }) => {
    const api = apiCallers[0].bookmarks;

    // Create the bookmark
    const bookmark = await api.createBookmark({
      url: "https://google.com",
      type: BookmarkTypes.LINK,
    });

    // It should exist
    await api.getBookmark({ bookmarkId: bookmark.id });

    // Delete it
    await api.deleteBookmark({ bookmarkId: bookmark.id });

    // It shouldn't be there anymore
    await expect(() =>
      api.getBookmark({ bookmarkId: bookmark.id }),
    ).rejects.toThrow(/Bookmark not found/);
  });

  test<CustomTestContext>("update bookmark", async ({ apiCallers }) => {
    const api = apiCallers[0].bookmarks;

    // Create the bookmark
    const bookmark = await api.createBookmark({
      url: "https://google.com",
      type: BookmarkTypes.LINK,
    });

    await api.updateBookmark({
      bookmarkId: bookmark.id,
      archived: true,
      favourited: true,
    });

    const res = await api.getBookmark({ bookmarkId: bookmark.id });
    expect(res.archived).toBeTruthy();
    expect(res.favourited).toBeTruthy();
  });

  test<CustomTestContext>("list bookmarks", async ({ apiCallers }) => {
    const api = apiCallers[0].bookmarks;
    const emptyBookmarks = await api.getBookmarks({});
    expect(emptyBookmarks.bookmarks.length).toEqual(0);

    const bookmark1 = await api.createBookmark({
      url: "https://google.com",
      type: BookmarkTypes.LINK,
    });

    const bookmark2 = await api.createBookmark({
      url: "https://google2.com",
      type: BookmarkTypes.LINK,
    });

    {
      const bookmarks = await api.getBookmarks({});
      expect(bookmarks.bookmarks.length).toEqual(2);
    }

    // Archive and favourite bookmark1
    await api.updateBookmark({
      bookmarkId: bookmark1.id,
      archived: true,
      favourited: true,
    });

    {
      const bookmarks = await api.getBookmarks({ archived: false });
      expect(bookmarks.bookmarks.length).toEqual(1);
      expect(bookmarks.bookmarks[0].id).toEqual(bookmark2.id);
    }

    {
      const bookmarks = await api.getBookmarks({ favourited: true });
      expect(bookmarks.bookmarks.length).toEqual(1);
      expect(bookmarks.bookmarks[0].id).toEqual(bookmark1.id);
    }

    {
      const bookmarks = await api.getBookmarks({ archived: true });
      expect(bookmarks.bookmarks.length).toEqual(1);
      expect(bookmarks.bookmarks[0].id).toEqual(bookmark1.id);
    }

    {
      const bookmarks = await api.getBookmarks({ ids: [bookmark1.id] });
      expect(bookmarks.bookmarks.length).toEqual(1);
      expect(bookmarks.bookmarks[0].id).toEqual(bookmark1.id);
    }
  });

  test<CustomTestContext>("update tags", async ({ apiCallers }) => {
    const api = apiCallers[0].bookmarks;
    const createdBookmark = await api.createBookmark({
      url: "https://google.com",
      type: BookmarkTypes.LINK,
    });

    await api.updateTags({
      bookmarkId: createdBookmark.id,
      attach: [{ tagName: "tag1" }, { tagName: "tag2" }],
      detach: [],
    });

    let bookmark = await api.getBookmark({ bookmarkId: createdBookmark.id });
    expect(bookmark.tags.map((t) => t.name).sort()).toEqual(["tag1", "tag2"]);

    const tag1Id = bookmark.tags.filter((t) => t.name == "tag1")[0].id;

    await api.updateTags({
      bookmarkId: bookmark.id,
      attach: [{ tagName: "tag3" }],
      detach: [{ tagId: tag1Id }],
    });

    bookmark = await api.getBookmark({ bookmarkId: bookmark.id });
    expect(bookmark.tags.map((t) => t.name).sort()).toEqual(["tag2", "tag3"]);

    await api.updateTags({
      bookmarkId: bookmark.id,
      attach: [{ tagId: tag1Id }, { tagName: "tag4" }],
      detach: [],
    });
    bookmark = await api.getBookmark({ bookmarkId: bookmark.id });
    expect(bookmark.tags.map((t) => t.name).sort()).toEqual([
      "tag1",
      "tag2",
      "tag3",
      "tag4",
    ]);
  });

  test<CustomTestContext>("update bookmark text", async ({ apiCallers }) => {
    const api = apiCallers[0].bookmarks;
    const createdBookmark = await api.createBookmark({
      text: "HELLO WORLD",
      type: BookmarkTypes.TEXT,
    });

    await api.updateBookmarkText({
      bookmarkId: createdBookmark.id,
      text: "WORLD HELLO",
    });

    const bookmark = await api.getBookmark({ bookmarkId: createdBookmark.id });
    assert(bookmark.content.type == BookmarkTypes.TEXT);
    expect(bookmark.content.text).toEqual("WORLD HELLO");
  });

  test<CustomTestContext>("privacy", async ({ apiCallers }) => {
    const user1Bookmark = await apiCallers[0].bookmarks.createBookmark({
      type: BookmarkTypes.LINK,
      url: "https://google.com",
    });
    const user2Bookmark = await apiCallers[1].bookmarks.createBookmark({
      type: BookmarkTypes.LINK,
      url: "https://google.com",
    });

    // All interactions with the wrong user should fail
    await expect(() =>
      apiCallers[0].bookmarks.deleteBookmark({ bookmarkId: user2Bookmark.id }),
    ).rejects.toThrow(/User is not allowed to access resource/);
    await expect(() =>
      apiCallers[0].bookmarks.getBookmark({ bookmarkId: user2Bookmark.id }),
    ).rejects.toThrow(/User is not allowed to access resource/);
    await expect(() =>
      apiCallers[0].bookmarks.updateBookmark({ bookmarkId: user2Bookmark.id }),
    ).rejects.toThrow(/User is not allowed to access resource/);
    await expect(() =>
      apiCallers[0].bookmarks.updateTags({
        bookmarkId: user2Bookmark.id,
        attach: [],
        detach: [],
      }),
    ).rejects.toThrow(/User is not allowed to access resource/);

    // Get bookmarks should only show the correct one
    expect(
      (await apiCallers[0].bookmarks.getBookmarks({})).bookmarks.map(
        (b) => b.id,
      ),
    ).toEqual([user1Bookmark.id]);
    expect(
      (await apiCallers[1].bookmarks.getBookmarks({})).bookmarks.map(
        (b) => b.id,
      ),
    ).toEqual([user2Bookmark.id]);
  });

  test<CustomTestContext>("bookmark links dedup", async ({ apiCallers }) => {
    // Two users with google in their bookmarks
    const bookmark1User1 = await apiCallers[0].bookmarks.createBookmark({
      url: "https://google.com",
      type: BookmarkTypes.LINK,
    });
    expect(bookmark1User1.alreadyExists).toEqual(false);

    const bookmark1User2 = await apiCallers[1].bookmarks.createBookmark({
      url: "https://google.com",
      type: BookmarkTypes.LINK,
    });
    expect(bookmark1User2.alreadyExists).toEqual(false);

    // User1 attempting to re-add google. Should return the existing bookmark
    const bookmark2User1 = await apiCallers[0].bookmarks.createBookmark({
      url: "https://google.com",
      type: BookmarkTypes.LINK,
    });
    expect(bookmark2User1.alreadyExists).toEqual(true);
    expect(bookmark2User1.id).toEqual(bookmark1User1.id);

    // User2 attempting to re-add google. Should return the existing bookmark
    const bookmark2User2 = await apiCallers[1].bookmarks.createBookmark({
      url: "https://google.com",
      type: BookmarkTypes.LINK,
    });
    expect(bookmark2User2.alreadyExists).toEqual(true);
    expect(bookmark2User2.id).toEqual(bookmark1User2.id);

    // User1 adding google2. Should not return an existing bookmark
    const bookmark3User1 = await apiCallers[0].bookmarks.createBookmark({
      url: "https://google2.com",
      type: BookmarkTypes.LINK,
    });
    expect(bookmark3User1.alreadyExists).toEqual(false);
  });

  // Ensure that the pagination returns all the results
  test<CustomTestContext>("pagination", async ({ apiCallers, db }) => {
    const user = await apiCallers[0].users.whoami();
    let now = 100_000;

    const bookmarkWithDate = (date_ms: number) => ({
      userId: user.id,
      createdAt: new Date(date_ms),
      type: BookmarkTypes.TEXT as const,
    });

    // One normal bookmark
    const values = [bookmarkWithDate(now)];
    // 10 with a second in between
    for (let i = 0; i < 10; i++) {
      now -= 1000;
      values.push(bookmarkWithDate(now));
    }
    // Another ten but at the same second
    for (let i = 0; i < 10; i++) {
      values.push(bookmarkWithDate(now));
    }
    // And then another one with a second afterwards
    for (let i = 0; i < 10; i++) {
      now -= 1000;
      values.push(bookmarkWithDate(now));
    }
    // In total, we should have 31 bookmarks

    const inserted = await db.insert(bookmarks).values(values).returning();

    const validateWithLimit = async (limit: number) => {
      const results: string[] = [];
      let cursor = undefined;

      // To avoid running the test forever
      let i = 0;

      do {
        const res = await apiCallers[0].bookmarks.getBookmarks({
          limit,
          cursor,
          useCursorV2: true,
        });
        results.push(...res.bookmarks.map((b) => b.id));
        cursor = res.nextCursor;
        i++;
      } while (cursor && i < 100);

      expect(results.sort()).toEqual(inserted.map((b) => b.id).sort());
    };

    await validateWithLimit(1);
    await validateWithLimit(2);
    await validateWithLimit(3);
    await validateWithLimit(10);
    await validateWithLimit(100);
  });
});
