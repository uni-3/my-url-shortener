import { z } from "zod";

export const urlSchema = z.object({
  url: z.string().url({ message: "https://から始まるURLを入力してください" }),
});

export type UrlInput = z.infer<typeof urlSchema>;

/**
 * Validates a URL string.
 */
export function validateUrl(url: string) {
  return urlSchema.safeParse({ url });
}

/**
 * Validates the shorten request body.
 */
export function validateShortenRequest(body: { url?: string }) {
  return urlSchema.safeParse(body);
}
