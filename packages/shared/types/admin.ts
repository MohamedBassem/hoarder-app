import { z } from "zod";

export enum AI_PROVIDERS {
  DISABLED = "disabled",
  OPEN_AI = "OpenAI",
  OLLAMA = "Ollama",
}

export const generalSettingsSchema = z.object({
  disableSignups: z.boolean(),
  maxAssetSize: z.coerce.number().positive(),
  disableNewReleaseCheck: z.boolean(),
});

export const crawlerConfigSchema = z.object({
  downloadBannerImage: z.boolean(),
  storeScreenshot: z.boolean(),
  storeFullPageScreenshot: z.boolean(),
  jobTimeout: z.coerce.number().positive(),
  navigateTimeout: z.coerce.number().positive(),
});

export const aiConfigSchema = z.object({
  aiProvider: z.nativeEnum(AI_PROVIDERS),

  [AI_PROVIDERS.OPEN_AI]: z
    .object({
      baseURL: z.string().url(),
      apiKey: z.string(),
      inferenceTextModel: z.string(),
      inferenceImageModel: z.string(),
      inferenceLanguage: z.string(),
    })
    .optional(),

  [AI_PROVIDERS.OLLAMA]: z
    .object({
      baseURL: z.string().url(),
      inferenceTextModel: z.string(),
      inferenceImageModel: z.string(),
      inferenceLanguage: z.string(),
    })
    .optional(),
});

export const dynamicConfigSchema = z.object({
  generalSettings: generalSettingsSchema,
  crawlerConfig: crawlerConfigSchema,
  aiConfig: aiConfigSchema,
});

export type dynamicConfigSchemaType = z.infer<typeof dynamicConfigSchema>;
export type generalSettingsSchemaType = z.infer<typeof generalSettingsSchema>;
export type crawlerConfigSchemaType = z.infer<typeof crawlerConfigSchema>;
export type aiConfigSchemaType = z.infer<typeof aiConfigSchema>;