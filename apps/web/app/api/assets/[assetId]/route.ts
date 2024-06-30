import { createContextFromRequest } from "@/server/api/client";

import { readAsset } from "@hoarder/shared/assetdb";

export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  { params }: { params: { assetId: string } },
) {
  const ctx = await createContextFromRequest(request);
  if (!ctx.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { asset, metadata } = await readAsset({
    userId: ctx.user.id,
    assetId: params.assetId,
  });

  const range = request.headers.get("Range");
  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : asset.length - 1;

    const chunk = asset.subarray(start, end + 1);
    return new Response(chunk, {
      status: 206, // Partial Content
      headers: {
        "Content-Range": `bytes ${start}-${end}/${asset.length}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunk.length.toString(),
        "Content-type": metadata.contentType,
      },
    });
  } else {
    return new Response(asset, {
      status: 200,
      headers: {
        "Content-Length": asset.length.toString(),
        "Content-type": metadata.contentType,
      },
    });
  }
}
