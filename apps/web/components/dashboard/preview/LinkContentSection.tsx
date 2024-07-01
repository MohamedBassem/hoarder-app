import { useState } from "react";
import Image from "next/image";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@radix-ui/react-scroll-area";

import {
  BookmarkTypes,
  ZBookmark,
  ZBookmarkedLink,
} from "@hoarder/shared/types/bookmarks";

function FullPageArchiveSection({ link }: { link: ZBookmarkedLink }) {
  return (
    <iframe
      title={link.url}
      src={`/api/assets/${link.fullPageArchiveAssetId}`}
      className="relative h-full min-w-full"
    />
  );
}

function ScreenshotSection({ link }: { link: ZBookmarkedLink }) {
  return (
    <div className="relative h-full min-w-full">
      <Image
        alt="screenshot"
        src={`/api/assets/${link.screenshotAssetId}`}
        width={0}
        height={0}
        sizes="100vw"
        style={{ width: "100%", height: "auto" }}
      />
    </div>
  );
}

function CachedContentSection({ link }: { link: ZBookmarkedLink }) {
  let content;
  if (!link.htmlContent) {
    content = (
      <div className="text-destructive">Failed to fetch link content ...</div>
    );
  } else {
    content = (
      <div
        dangerouslySetInnerHTML={{
          __html: link.htmlContent || "",
        }}
        className="prose mx-auto dark:prose-invert"
      />
    );
  }
  return <ScrollArea className="h-full">{content}</ScrollArea>;
}

function VideoSection({ link }: { link: ZBookmarkedLink }) {
  return (
    <div className="relative h-full w-full overflow-hidden">
      <div className="absolute inset-0 h-full w-full">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption -- captions not (yet) available */}
        <video className="m-auto max-h-full max-w-full" controls>
          <source src={`/api/assets/${link.videoAssetId}`} />
          Not supported by your browser
        </video>
      </div>
    </div>
  );
}

export default function LinkContentSection({
  bookmark,
}: {
  bookmark: ZBookmark;
}) {
  const [section, setSection] = useState<string>("cached");

  if (bookmark.content.type != BookmarkTypes.LINK) {
    throw new Error("Invalid content type");
  }

  let content;
  if (section === "cached") {
    content = <CachedContentSection link={bookmark.content} />;
  } else if (section === "archive") {
    content = <FullPageArchiveSection link={bookmark.content} />;
  } else if (section === "video") {
    content = <VideoSection link={bookmark.content} />;
  } else {
    content = <ScreenshotSection link={bookmark.content} />;
  }

  return (
    <div className="flex h-full flex-col items-center gap-2">
      <Select onValueChange={setSection} value={section}>
        <SelectTrigger className="w-fit">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value="cached">Cached Content</SelectItem>
            <SelectItem
              value="screenshot"
              disabled={!bookmark.content.screenshotAssetId}
            >
              Screenshot
            </SelectItem>
            <SelectItem
              value="archive"
              disabled={!bookmark.content.fullPageArchiveAssetId}
            >
              Archive
            </SelectItem>
            <SelectItem value="video" disabled={!bookmark.content.videoAssetId}>
              Video
            </SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
      {content}
    </div>
  );
}
