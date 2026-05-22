import Sqids from "sqids";

/** 短縮コードの生成戦略。実装を差し替えれば slug 指定などにも対応できる。 */
export interface IdGenerator {
  generate(): string;
}

/** 48ビットの乱数を Sqids でエンコードして短縮コードを生成する。 */
export class SqidsIdGenerator implements IdGenerator {
  private readonly sqids: Sqids;

  constructor(minLength = 6) {
    this.sqids = new Sqids({ minLength });
  }

  generate(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(6));
    let value = 0;
    for (const byte of bytes) {
      value = value * 256 + byte;
    }
    return this.sqids.encode([value]);
  }
}
