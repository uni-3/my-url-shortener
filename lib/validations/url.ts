import { z } from "zod";

export const urlSchema = z.object({
  url: z.string().url({ message: "有効なURLを入力してください" }),
});

export type UrlInput = z.infer<typeof urlSchema>;

export function validateUrl(url: unknown) {
  return urlSchema.safeParse({ url });
}
