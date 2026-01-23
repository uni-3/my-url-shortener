import Sqids from "sqids";

const sqids = new Sqids({
  minLength: 6,
});

export function encodeId(id: number): string {
  return sqids.encode([id]);
}

export function decodeCode(code: string): number | null {
  const numbers = sqids.decode(code);
  return numbers.length > 0 ? numbers[0] : null;
}
