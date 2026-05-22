import Sqids from "sqids";

/** 短縮コードの生成戦略。実装を差し替えれば slug 指定などにも対応できる。 */
export interface IdGenerator {
  encode(id: number): string;
  decode(code: string): number | null;
}

export class SqidsIdGenerator implements IdGenerator {
  private readonly sqids: Sqids;

  constructor(minLength = 6) {
    this.sqids = new Sqids({ minLength });
  }

  encode(id: number): string {
    return this.sqids.encode([id]);
  }

  decode(code: string): number | null {
    const numbers = this.sqids.decode(code);
    return numbers.length > 0 ? numbers[0] : null;
  }
}
