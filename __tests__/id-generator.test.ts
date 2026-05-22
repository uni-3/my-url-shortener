import { describe, it, expect } from "vitest";
import { SqidsIdGenerator } from "@/lib/core/id-generator";

describe("SqidsIdGenerator", () => {
  const generator = new SqidsIdGenerator();

  it("encodes an id to a string of at least 6 characters", () => {
    const code = generator.encode(1);
    expect(typeof code).toBe("string");
    expect(code.length).toBeGreaterThanOrEqual(6);
  });

  it("decodes a code back to the original id", () => {
    const code = generator.encode(12345);
    expect(generator.decode(code)).toBe(12345);
  });

  it("returns null for an invalid code", () => {
    expect(generator.decode("invalid-code-!!!")).toBeNull();
  });

  it("respects a custom minimum length", () => {
    const generator = new SqidsIdGenerator(10);
    expect(generator.encode(1).length).toBeGreaterThanOrEqual(10);
  });
});
