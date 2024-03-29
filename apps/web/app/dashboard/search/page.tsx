"use client";

import { Suspense, useRef } from "react";
import BookmarksGrid from "@/components/dashboard/bookmarks/BookmarksGrid";
import { SearchInput } from "@/components/dashboard/search/SearchInput";
import { Separator } from "@/components/ui/separator";
import { useBookmarkSearch } from "@/lib/hooks/bookmark-search";

import Loading from "../bookmarks/loading";

function SearchComp() {
  const { data } = useBookmarkSearch();

  const inputRef: React.MutableRefObject<HTMLInputElement | null> =
    useRef<HTMLInputElement | null>(null);

  return (
    <div className="container flex flex-col gap-3 p-4">
      <SearchInput ref={inputRef} autoFocus={true} />
      <Separator />
      {data ? <BookmarksGrid bookmarks={data.bookmarks} /> : <Loading />}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense>
      <SearchComp />
    </Suspense>
  );
}
