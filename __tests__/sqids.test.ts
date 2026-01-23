import { encodeId, decodeCode } from "../lib/utils/sqids";

describe("Sqids Utility", () => {
  it("should encode an ID to a string of at least 6 characters", () => {
    const id = 1;
    const code = encodeId(id);
    expect(typeof code).toBe("string");
    expect(code.length).toBeGreaterThanOrEqual(6);
  });

  it("should decode a code back to the original ID", () => {
    const id = 12345;
    const code = encodeId(id);
    const decodedId = decodeCode(code);
    expect(decodedId).toBe(id);
  });

  it("should return null for an invalid code", () => {
    const decodedId = decodeCode("invalid-code-!!!");
    expect(decodedId).toBeNull();
  });
});
