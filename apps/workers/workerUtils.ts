import { eq } from "drizzle-orm";

import { HoarderDBTransaction } from "@hoarder/db";
import { db } from "@hoarder/db/drizzle";
import { assets, bookmarks } from "@hoarder/db/schema";
import {
  DBAssetTypes,
  mapAssetsToBookmarkFields,
} from "@hoarder/shared/utils/bookmarkUtils";

/**
 * Removes the old asset and adds a new one instead
 * @param newAssetId the new assetId to add
 * @param oldAssetId the old assetId to remove (if it exists)
 * @param bookmarkId the id of the bookmark the asset belongs to
 * @param assetType the type of the asset
 * @param txn the transaction where this update should happen in
 */
export async function updateAsset(
  newAssetId: string | null,
  oldAssetId: string | undefined,
  bookmarkId: string,
  assetType: DBAssetTypes,
  txn: HoarderDBTransaction,
) {
  if (newAssetId) {
    if (oldAssetId) {
      await txn.delete(assets).where(eq(assets.id, oldAssetId));
    }
    await txn.insert(assets).values({
      id: newAssetId,
      assetType,
      bookmarkId,
    });
  }
}

export async function getBookmarkDetails(bookmarkId: string) {
  const bookmark = await db.query.bookmarks.findFirst({
    where: eq(bookmarks.id, bookmarkId),
    with: {
      link: true,
      assets: true,
    },
  });

  if (!bookmark || !bookmark.link) {
    throw new Error("The bookmark either doesn't exist or not a link");
  }
  return {
    url: bookmark.link.url,
    userId: bookmark.userId,
    ...mapAssetsToBookmarkFields(bookmark.assets),
  };
}
