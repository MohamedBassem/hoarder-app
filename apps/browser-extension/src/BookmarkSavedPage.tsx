import { useState } from "react";
import { ArrowUpRightFromSquare, Trash } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { useDeleteBookmark } from "@hoarder/shared-react/hooks/bookmarks";

import Spinner from "./Spinner";
import usePluginSettings from "./utils/settings";

export default function BookmarkSavedPage() {
  const { bookmarkId } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState("");

  const { mutate: deleteBookmark, isPending } = useDeleteBookmark({
    onSuccess: () => {
      navigate("/bookmarkdeleted");
    },
    onError: (e) => {
      setError(e.message);
    },
  });

  const { settings } = usePluginSettings();

  if (!bookmarkId) {
    return <div>NOT FOUND</div>;
  }

  return (
    <div className="flex flex-col gap-2">
      {error && <p className="text-red-500">{error}</p>}
      <div className="flex items-center justify-between gap-2">
        <p className="text-lg">Bookmarked!</p>
        <div className="flex gap-2">
          <Link
            className="flex gap-2 rounded-md p-3 text-black hover:text-black"
            target="_blank"
            rel="noreferrer"
            to={`${settings.address}/dashboard/preview/${bookmarkId}`}
          >
            <ArrowUpRightFromSquare className="my-auto" size="20" />
            <p className="my-auto">Open</p>
          </Link>
          <button
            onClick={() => deleteBookmark({ bookmarkId: bookmarkId })}
            className="flex gap-2 bg-transparent text-red-500 hover:text-red-500"
          >
            {!isPending ? (
              <>
                <Trash className="my-auto" size="20" />
                <p className="my-auto">Delete</p>
              </>
            ) : (
              <span className="m-auto">
                <Spinner />
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
