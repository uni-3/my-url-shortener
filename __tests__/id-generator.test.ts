import { describe, it, expect } from "vitest";
import { SqidsIdGenerator } from "@/lib/core/id-generator";

describe("SqidsIdGenerator", () => {
  it("generates a string of at least the minimum length", () => {
    const code = new SqidsIdGenerator().generate();
    expect(typeof code).toBe("string");
    expect(code.length).toBeGreaterThanOrEqual(6);
  });

  it("respects a custom minimum length", () => {
    expect(new SqidsIdGenerator(12).generate().length).toBeGreaterThanOrEqual(12);
  });

  it("generates distinct codes across many calls", () => {
    const generator = new SqidsIdGenerator();
    const codes = new Set(Array.from({ length: 1000 }, () => generator.generate()));
    expect(codes.size).toBe(1000);
  });
});
