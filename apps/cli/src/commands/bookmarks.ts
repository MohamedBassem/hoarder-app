import * as fs from "node:fs";
import { addToList } from "@/commands/lists";
import {
  printError,
  printObject,
  printStatusMessage,
  printSuccess,
} from "@/lib/output";
import { getAPIClient } from "@/lib/trpc";
import { Command } from "@commander-js/extra-typings";

import type { ZBookmark } from "@hoarder/shared/types/bookmarks";
import {
  BookmarkTypes,
  MAX_NUM_BOOKMARKS_PER_PAGE,
} from "@hoarder/shared/types/bookmarks";

export const bookmarkCmd = new Command()
  .name("bookmarks")
  .description("manipulating bookmarks");

function collect<T>(val: T, acc: T[]) {
  acc.push(val);
  return acc;
}

type Bookmark = Omit<ZBookmark, "tags"> & {
  tags: string[];
};

function normalizeBookmark(bookmark: ZBookmark): Bookmark {
  const ret = {
    ...bookmark,
    tags: bookmark.tags.map((t) => t.name),
  };

  if (ret.content.type == BookmarkTypes.LINK && ret.content.htmlContent) {
    if (ret.content.htmlContent.length > 10) {
      ret.content.htmlContent =
        ret.content.htmlContent.substring(0, 10) + "... <CROPPED>";
    }
  }
  return ret;
}

function printBookmark(bookmark: ZBookmark) {
  printObject(normalizeBookmark(bookmark));
}

bookmarkCmd
  .command("add")
  .description("creates a new bookmark")
  .option(
    "--link <link>",
    "the link to add. Specify multiple times to add multiple links",
    collect<string>,
    [],
  )
  .option(
    "--note <note>",
    "the note text to add. Specify multiple times to add multiple notes",
    collect<string>,
    [],
  )
  .option("--stdin", "reads the data from stdin and store it as a note")
  .option("--list <id>", "if set, the bookmark(s) will be added to this list")
  .option(
    "--tag <tag>",
    "if set, this tag will be added to the bookmark(s). Specify multiple times to add multiple tags",
    collect<string>,
    [],
  )
  .action(async (opts) => {
    const api = getAPIClient();

    const results: Bookmark[] = [];

    const promises = [
      ...opts.link.map((url) =>
        api.bookmarks.createBookmark
          .mutate({ type: BookmarkTypes.LINK, url })
          .then((bookmark: ZBookmark) => {
            results.push(normalizeBookmark(bookmark));
          })
          .catch(printError(`Failed to add a link bookmark for url "${url}"`)),
      ),
      ...opts.note.map((text) =>
        api.bookmarks.createBookmark
          .mutate({ type: BookmarkTypes.TEXT, text })
          .then((bookmark: ZBookmark) => {
            results.push(normalizeBookmark(bookmark));
          })
          .catch(
            printError(
              `Failed to add a text bookmark with text "${text.substring(0, 50)}"`,
            ),
          ),
      ),
    ];

    if (opts.stdin) {
      const text = fs.readFileSync(0, "utf-8");
      promises.push(
        api.bookmarks.createBookmark
          .mutate({ type: BookmarkTypes.TEXT, text })
          .then((bookmark: ZBookmark) => {
            results.push(normalizeBookmark(bookmark));
          })
          .catch(
            printError(
              `Failed to add a text bookmark with text "${text.substring(0, 50)}"`,
            ),
          ),
      );
    }

    await Promise.allSettled(promises);
    printObject(results);
    for (const bookmark of results) {
      await updateTags(opts.tag, [], bookmark.id);
      if (opts.list) {
        await addToList(opts.list, bookmark.id);
      }
    }
  });

bookmarkCmd
  .command("get")
  .description("fetch information about a bookmark")
  .argument("<id>", "The id of the bookmark to get")
  .action(async (id) => {
    const api = getAPIClient();
    await api.bookmarks.getBookmark
      .query({ bookmarkId: id })
      .then(printBookmark)
      .catch(printError(`Failed to get the bookmark with id "${id}"`));
  });

function printTagMessage(
  tags: { tagName: string }[],
  bookmarkId: string,
  action: "Added" | "Removed",
) {
  tags.forEach((tag) => {
    printStatusMessage(
      true,
      `${action} the tag ${tag.tagName} ${action === "Added" ? "to" : "from"} the bookmark with id ${bookmarkId}`,
    );
  });
}

async function updateTags(addTags: string[], removeTags: string[], id: string) {
  const tagsToAdd = addTags.map((addTag) => {
    return { tagName: addTag };
  });

  const tagsToRemove = removeTags.map((removeTag) => {
    return { tagName: removeTag };
  });

  if (tagsToAdd.length > 0 || tagsToRemove.length > 0) {
    const api = getAPIClient();
    await api.bookmarks.updateTags
      .mutate({
        bookmarkId: id,
        attach: tagsToAdd,
        detach: tagsToRemove,
      })
      .then(() => {
        printTagMessage(tagsToAdd, id, "Added");
        printTagMessage(tagsToRemove, id, "Removed");
      })
      .catch(
        printError(
          `Failed to add/remove tags to/from bookmark with id "${id}"`,
        ),
      );
  }
}

bookmarkCmd
  .command("update")
  .description("update a bookmark")
  .option("--title <title>", "if set, the bookmark's title will be updated")
  .option("--note <note>", "if set, the bookmark's note will be updated")
  .option("--archive", "if set, the bookmark will be archived")
  .option("--no-archive", "if set, the bookmark will be unarchived")
  .option("--favourite", "if set, the bookmark will be favourited")
  .option("--no-favourite", "if set, the bookmark will be unfavourited")
  .option(
    "--addtag <tag>",
    "if set, this tag will be added to the bookmark. Specify multiple times to add multiple tags",
    collect<string>,
    [],
  )
  .option(
    "--removetag <tag>",
    "if set, this tag will be removed from the bookmark. Specify multiple times to remove multiple tags",
    collect<string>,
    [],
  )
  .argument("<id>", "the id of the bookmark to get")
  .action(async (id, opts) => {
    const api = getAPIClient();
    await updateTags(opts.addtag, opts.removetag, id);

    if ("archive" in opts || "favourite" in opts || "title" in opts) {
      await api.bookmarks.updateBookmark
        .mutate({
          bookmarkId: id,
          archived: opts.archive,
          favourited: opts.favourite,
          title: opts.title,
        })
        .then(printObject)
        .catch(printError(`Failed to update bookmark with id "${id}"`));
    }
  });

bookmarkCmd
  .command("list")
  .description("list all bookmarks")
  .option(
    "--include-archived",
    "If set, archived bookmarks will be fetched as well",
    false,
  )
  .option("--list-id <id>", "if set, only items from that list will be fetched")
  .action(async (opts) => {
    const api = getAPIClient();

    const request = {
      archived: opts.includeArchived ? undefined : false,
      listId: opts.listId,
      limit: MAX_NUM_BOOKMARKS_PER_PAGE,
      useCursorV2: true,
    };

    try {
      let resp = await api.bookmarks.getBookmarks.query(request);
      let results: ZBookmark[] = resp.bookmarks;

      while (resp.nextCursor) {
        resp = await api.bookmarks.getBookmarks.query({
          ...request,
          cursor: resp.nextCursor,
        });
        results = [...results, ...resp.bookmarks];
      }
      printObject(results.map(normalizeBookmark), { maxArrayLength: null });
    } catch (e) {
      printStatusMessage(false, "Failed to query bookmarks");
    }
  });

bookmarkCmd
  .command("delete")
  .description("delete a bookmark")
  .argument("<id>", "the id of the bookmark to delete")
  .action(async (id) => {
    const api = getAPIClient();
    await api.bookmarks.deleteBookmark
      .mutate({ bookmarkId: id })
      .then(printSuccess(`Bookmark with id '${id}' got deleted`))
      .catch(printError(`Failed to delete bookmark with id "${id}"`));
  });
