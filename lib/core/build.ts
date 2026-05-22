import { getDb, type AppEnv } from "@/db";
import { checkUrlSafety } from "@/lib/api/safe-browsing";
import { SqidsIdGenerator } from "./id-generator";
import { D1UrlRepository } from "./repository";
import { ShortenService } from "./shorten-service";

/** 依存の配線。DIコンテナは使わず、ここで手動で組み立てる。 */
export function buildService(env: AppEnv): ShortenService {
  const repo = new D1UrlRepository(getDb(env));
  const idGenerator = new SqidsIdGenerator();
  const checkSafety = (url: string) => checkUrlSafety(url, env.GOOGLE_SAFE_BROWSING_API_KEY);
  return new ShortenService(repo, idGenerator, checkSafety);
}
