import * as React from "react";
import { useSet } from "@uidotdev/usehooks";
import { Check, ChevronsUpDown, Plus } from "lucide-react";

import {
  useAutoRefreshingBookmarkQuery,
  useUpdateBookmarkTags,
} from "@hoarder/shared-react/hooks/bookmarks";

import { cn } from "../utils/css";
import { api } from "../utils/trpc";
import { Button } from "./ui/button";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "./ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

export function TagsSelector({ bookmarkId }: { bookmarkId: string }) {
  const { data: allTags } = api.tags.list.useQuery();
  const { data: bookmark } = useAutoRefreshingBookmarkQuery({ bookmarkId });

  const existingTagIds = new Set(bookmark?.tags.map((t) => t.id) ?? []);

  const [input, setInput] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const currentlyUpdating = useSet<string>();

  const { mutate } = useUpdateBookmarkTags({
    onMutate: (req) => {
      req.attach.forEach((t) => currentlyUpdating.add(t.tagId ?? ""));
      req.detach.forEach((t) => currentlyUpdating.add(t.tagId ?? ""));
    },
    onSettled: (_resp, _err, req) => {
      if (!req) {
        return;
      }
      req.attach.forEach((t) => currentlyUpdating.delete(t.tagId ?? ""));
      req.detach.forEach((t) => currentlyUpdating.delete(t.tagId ?? ""));
    },
  });

  const toggleTag = (tagId: string) => {
    mutate({
      bookmarkId,
      attach: existingTagIds.has(tagId) ? [] : [{ tagId }],
      detach: existingTagIds.has(tagId) ? [{ tagId }] : [],
    });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="justify-between"
        >
          Add Tags...
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        <Command>
          <CommandInput
            value={input}
            onValueChange={setInput}
            placeholder="Search Tags ..."
          />
          <CommandList>
            <CommandGroup>
              {allTags?.tags
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((tag) => (
                  <CommandItem
                    key={tag.id}
                    value={tag.id}
                    keywords={[tag.name]}
                    onSelect={toggleTag}
                    disabled={currentlyUpdating.has(tag.id)}
                  >
                    <Check
                      className={cn(
                        "mr-2 size-4",
                        existingTagIds.has(tag.id)
                          ? "opacity-100"
                          : "opacity-0",
                      )}
                    />
                    {tag.name}
                  </CommandItem>
                ))}
            </CommandGroup>
            <CommandGroup>
              <CommandItem
                onSelect={() =>
                  mutate({
                    bookmarkId,
                    attach: [{ tagName: input }],
                    detach: [],
                  })
                }
              >
                <Plus className="mr-2 size-4" />
                Create &quot;{input}&quot; ...
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
