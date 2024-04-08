"use client";

import Image from "next/image";
import { isBookmarkStillTagging } from "@/lib/bookmarkUtils";
import { api } from "@/lib/trpc";
import { cn } from "@/lib/utils";

import type { ZBookmark } from "@hoarder/trpc/types/bookmarks";

import BookmarkActionBar from "./BookmarkActionBar";
import TagList from "./TagList";

export default function AssetCard({
  bookmark: initialData,
  className,
}: {
  bookmark: ZBookmark;
  className?: string;
}) {
  const { data: bookmark } = api.bookmarks.getBookmark.useQuery(
    {
      bookmarkId: initialData.id,
    },
    {
      initialData,
      refetchInterval: (query) => {
        const data = query.state.data;
        if (!data) {
          return false;
        }
        if (isBookmarkStillTagging(data)) {
          return 1000;
        }
        return false;
      },
    },
  );
  const bookmarkedAsset = bookmark.content;
  if (bookmarkedAsset.type != "asset") {
    throw new Error("Unexpected bookmark type");
  }

  return (
    <div
      className={cn(
        className,
        cn(
          "flex h-min max-h-96 flex-col gap-y-1 overflow-hidden rounded-lg shadow-md",
        ),
      )}
    >
      {bookmarkedAsset.assetType == "image" && (
        <div className="relative h-56 max-h-56">
          <Image
            alt="asset"
            src={`/api/assets/${bookmarkedAsset.assetId}`}
            fill={true}
            className="rounded-t-lg object-cover"
          />
        </div>
      )}
      {bookmarkedAsset.assetType == "pdf" && (
        <iframe
          title={bookmarkedAsset.assetId}
          className="h-56 max-h-56 w-full"
          src={`/api/assets/${bookmarkedAsset.assetId}`}
        />
      )}
      <div className="flex flex-col gap-y-1 overflow-hidden p-2">
        <div className="flex h-full flex-wrap gap-1 overflow-hidden">
          <TagList
            bookmark={bookmark}
            loading={isBookmarkStillTagging(bookmark)}
          />
        </div>
        <div className="flex w-full justify-between">
          <div />
          <BookmarkActionBar bookmark={bookmark} />
        </div>
      </div>
    </div>
  );
}
