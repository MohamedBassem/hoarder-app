export const enum DBAssetTypes {
  LINK_BANNER_IMAGE = "linkBannerImage",
  LINK_SCREENSHOT = "linkScreenshot",
  LINK_FULL_PAGE_ARCHIVE = "linkFullPageArchive",
  LINK_VIDEO = "linkVideo",
}

interface Asset {
  id: string;
  assetType: DBAssetTypes;
}

export const enum BookmarkAssetType {
  SCREENSHOT_ASSET_ID = "screenshotAssetId",
  FULL_PAGE_ARCHIVE_ASSET_ID = "fullPageArchiveAssetId",
  IMAGE_ASSET_ID = "imageAssetId",
  VIDEO_ASSET_ID = "videoAssetId",
}

export const ASSET_TYE_MAPPING: Record<DBAssetTypes, BookmarkAssetType> = {
  [DBAssetTypes.LINK_SCREENSHOT]: BookmarkAssetType.SCREENSHOT_ASSET_ID,
  [DBAssetTypes.LINK_FULL_PAGE_ARCHIVE]:
    BookmarkAssetType.FULL_PAGE_ARCHIVE_ASSET_ID,
  [DBAssetTypes.LINK_BANNER_IMAGE]: BookmarkAssetType.IMAGE_ASSET_ID,
  [DBAssetTypes.LINK_VIDEO]: BookmarkAssetType.VIDEO_ASSET_ID,
};

export function mapAssetsToBookmarkFields(
  assets: Asset | Asset[] = [],
): Record<BookmarkAssetType, string> {
  const assetsArray = Array.isArray(assets) ? assets : [assets];
  return assetsArray.reduce((result: Record<string, string>, asset: Asset) => {
    result[ASSET_TYE_MAPPING[asset.assetType]] = asset.id;
    return result;
  }, {});
}
