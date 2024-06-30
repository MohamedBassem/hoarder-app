import * as fs from "fs";
import * as path from "path";
import { z } from "zod";

import serverConfig from "./config";

const ROOT_PATH = path.join(serverConfig.dataDir, "assets");

export const enum ASSET_TYPES {
  IMAGE_JPEG = "image/jpeg",
  IMAGE_PNG = "image/png",
  IMAGE_WEBP = "image/webp",
  APPLICATION_PDF = "application/pdf",
  TEXT_HTML = "text/html",
  VIDEO_MP4 = "video/mp4",
}

export const IMAGE_ASSET_TYPES: Set<string> = new Set<string>([
  ASSET_TYPES.IMAGE_JPEG,
  ASSET_TYPES.IMAGE_PNG,
  ASSET_TYPES.IMAGE_WEBP,
]);

// The assets that we allow the users to upload
export const SUPPORTED_UPLOAD_ASSET_TYPES: Set<string> = new Set<string>([
  ...IMAGE_ASSET_TYPES,
  ASSET_TYPES.APPLICATION_PDF,
  ASSET_TYPES.VIDEO_MP4,
]);

// The assets that we support saving in the asset db
export const SUPPORTED_ASSET_TYPES: Set<string> = new Set<string>([
  ...SUPPORTED_UPLOAD_ASSET_TYPES,
  ASSET_TYPES.TEXT_HTML,
]);

function getAssetDir(userId: string, assetId: string) {
  return path.join(ROOT_PATH, userId, assetId);
}

export const zAssetMetadataSchema = z.object({
  contentType: z.string(),
  fileName: z.string().nullish(),
});

export function newAssetId() {
  return crypto.randomUUID();
}

export async function saveAsset({
  userId,
  assetId,
  asset,
  metadata,
}: {
  userId: string;
  assetId: string;
  asset: Buffer;
  metadata: z.infer<typeof zAssetMetadataSchema>;
}) {
  if (!SUPPORTED_ASSET_TYPES.has(metadata.contentType)) {
    throw new Error("Unsupported asset type");
  }
  const assetDir = getAssetDir(userId, assetId);
  await fs.promises.mkdir(assetDir, { recursive: true });

  await Promise.all([
    fs.promises.writeFile(path.join(assetDir, "asset.bin"), asset),
    fs.promises.writeFile(
      path.join(assetDir, "metadata.json"),
      JSON.stringify(metadata),
    ),
  ]);
}

export async function saveAssetFromFile({
  userId,
  assetId,
  assetPath,
  metadata,
}: {
  userId: string;
  assetId: string;
  assetPath: string;
  metadata: z.infer<typeof zAssetMetadataSchema>;
}) {
  if (!SUPPORTED_ASSET_TYPES.has(metadata.contentType)) {
    throw new Error("Unsupported asset type");
  }
  const assetDir = getAssetDir(userId, assetId);
  await fs.promises.mkdir(assetDir, { recursive: true });

  await Promise.all([
    fs.promises.rename(assetPath, path.join(assetDir, "asset.bin")),
    fs.promises.writeFile(
      path.join(assetDir, "metadata.json"),
      JSON.stringify(metadata),
    ),
  ]);
}

export async function readAsset({
  userId,
  assetId,
}: {
  userId: string;
  assetId: string;
}) {
  const assetDir = getAssetDir(userId, assetId);

  const [asset, metadataStr] = await Promise.all([
    fs.promises.readFile(path.join(assetDir, "asset.bin")),
    fs.promises.readFile(path.join(assetDir, "metadata.json"), {
      encoding: "utf8",
    }),
  ]);

  const metadata = zAssetMetadataSchema.parse(JSON.parse(metadataStr));
  return { asset, metadata };
}

/**
 * Deletes the passed in asset if it exists and ignores any errors
 * @param userId the id of the user the asset belongs to
 * @param assetId the id of the asset to delete
 */
export async function silentDeleteAsset(
  userId: string,
  assetId: string | undefined,
) {
  if (assetId) {
    await deleteAsset({ userId, assetId }).catch(() => ({}));
  }
}

export async function deleteAsset({
  userId,
  assetId,
}: {
  userId: string;
  assetId: string;
}) {
  const assetDir = getAssetDir(userId, assetId);
  await fs.promises.rm(path.join(assetDir), { recursive: true });
}

export async function deleteUserAssets({ userId }: { userId: string }) {
  const userDir = path.join(ROOT_PATH, userId);
  const dirExists = await fs.promises
    .access(userDir)
    .then(() => true)
    .catch(() => false);
  if (!dirExists) {
    return;
  }
  await fs.promises.rm(userDir, { recursive: true });
}
