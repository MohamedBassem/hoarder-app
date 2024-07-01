import { getGlobalOptions } from "@/lib/globals";
import {
  printError,
  printErrorMessageWithReason,
  printObject,
  printSuccess,
} from "@/lib/output";
import { getAPIClient } from "@/lib/trpc";
import { Command } from "@commander-js/extra-typings";
import { getBorderCharacters, table } from "table";

import { listsToTree } from "@hoarder/shared/utils/listUtils";

export const listsCmd = new Command()
  .name("lists")
  .description("manipulating lists");

listsCmd
  .command("list")
  .description("lists all lists")
  .action(async () => {
    const api = getAPIClient();

    try {
      const resp = await api.lists.list.query();

      if (getGlobalOptions().json) {
        printObject(resp);
      } else {
        const { allPaths } = listsToTree(resp.lists);
        const data: string[][] = [["Id", "Name"]];

        allPaths.forEach((path) => {
          const name = path.map((p) => `${p.icon} ${p.name}`).join(" / ");
          const id = path[path.length - 1].id;
          data.push([id, name]);
        });
        console.log(
          table(data, {
            border: getBorderCharacters("ramac"),
            singleLine: true,
          }),
        );
      }
    } catch (error) {
      printErrorMessageWithReason("Failed to list all lists", error as object);
    }
  });

listsCmd
  .command("delete")
  .description("deletes a list")
  .argument("<id>", "the id of the list")
  .action(async (id) => {
    const api = getAPIClient();

    await api.lists.delete
      .mutate({
        listId: id,
      })
      .then(printSuccess(`Successfully deleted list with id "${id}"`))
      .catch(printError(`Failed to delete list with id "${id}"`));
  });

export async function addToList(listId: string, bookmarkId: string) {
  const api = getAPIClient();

  await api.lists.addToList
    .mutate({
      listId,
      bookmarkId,
    })
    .then(
      printSuccess(
        `Successfully added bookmark "${bookmarkId}" to list with id "${listId}"`,
      ),
    )
    .catch(
      printError(
        `Failed to add bookmark "${bookmarkId}" to list with id "${listId}"`,
      ),
    );
}

listsCmd
  .command("add-bookmark")
  .description("add a bookmark to list")
  .requiredOption("--list <id>", "the id of the list")
  .requiredOption("--bookmark <bookmark>", "the id of the bookmark")
  .action(async (opts) => {
    await addToList(opts.list, opts.bookmark);
  });

listsCmd
  .command("remove-bookmark")
  .description("remove a bookmark from list")
  .requiredOption("--list <id>", "the id of the list")
  .requiredOption("--bookmark <bookmark>", "the id of the bookmark")
  .action(async (opts) => {
    const api = getAPIClient();

    await api.lists.removeFromList
      .mutate({
        listId: opts.list,
        bookmarkId: opts.bookmark,
      })
      .then(
        printSuccess(
          `Successfully removed bookmark "${opts.bookmark}" from list with id "${opts.list}"`,
        ),
      )
      .catch(
        printError(
          `Failed to remove bookmark "${opts.bookmark}" from list with id "${opts.list}"`,
        ),
      );
  });
