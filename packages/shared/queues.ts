import { Queue } from "bullmq";
import { z } from "zod";

import serverConfig from "./config";

export const queueConnectionDetails = {
  host: serverConfig.bullMQ.redisHost,
  port: serverConfig.bullMQ.redisPort,
  db: serverConfig.bullMQ.redisDBIdx,
  password: serverConfig.bullMQ.redisPassword,
};

// Link Crawler
export const zCrawlLinkRequestSchema = z.object({
  bookmarkId: z.string(),
  runInference: z.boolean().optional(),
});
export type ZCrawlLinkRequest = z.infer<typeof zCrawlLinkRequestSchema>;

export const LinkCrawlerQueue = new Queue<ZCrawlLinkRequest, void>(
  "link_crawler_queue",
  {
    connection: queueConnectionDetails,
    defaultJobOptions: {
      attempts: 5,
      backoff: {
        type: "exponential",
        delay: 1000,
      },
    },
  },
);

// OpenAI Worker
export const zOpenAIRequestSchema = z.object({
  bookmarkId: z.string(),
});
export type ZOpenAIRequest = z.infer<typeof zOpenAIRequestSchema>;

export const OpenAIQueue = new Queue<ZOpenAIRequest, void>("openai_queue", {
  connection: queueConnectionDetails,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 500,
    },
  },
});

// Search Indexing Worker
export const zSearchIndexingRequestSchema = z.object({
  bookmarkId: z.string(),
  type: z.enum(["index", "delete"]),
});
export type ZSearchIndexingRequest = z.infer<
  typeof zSearchIndexingRequestSchema
>;
export const SearchIndexingQueue = new Queue<ZSearchIndexingRequest, void>(
  "searching_indexing",
  {
    connection: queueConnectionDetails,
    defaultJobOptions: {
      attempts: 5,
      backoff: {
        type: "exponential",
        delay: 1000,
      },
    },
  },
);

export function triggerSearchReindex(bookmarkId: string) {
  SearchIndexingQueue.add("search_indexing", {
    bookmarkId,
    type: "index",
  });
}

export function triggerSearchDeletion(bookmarkId: string) {
  SearchIndexingQueue.add("search_indexing", {
    bookmarkId: bookmarkId,
    type: "delete",
  });
}

export const zvideoRequestSchema = z.object({
  bookmarkId: z.string(),
  url: z.string(),
});
export type ZVideoRequest = z.infer<typeof zvideoRequestSchema>;

export const VideoWorkerQueue = new Queue<ZVideoRequest, void>("video_queue", {
  connection: queueConnectionDetails,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 500,
    },
  },
});

export function triggerVideoWorker(bookmarkId: string, url: string) {
  VideoWorkerQueue.add("video_queue", {
    bookmarkId,
    url,
  });
}
