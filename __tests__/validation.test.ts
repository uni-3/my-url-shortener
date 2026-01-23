import { validateUrl } from "../lib/validations/url";

describe("URL Validation", () => {
  it("should validate a correct URL", () => {
    const result = validateUrl("https://example.com");
    expect(result.success).toBe(true);
  });

  it("should invalidate an incorrect URL", () => {
    const result = validateUrl("not-a-url");
    expect(result.success).toBe(false);
  });

  it("should invalidate an empty string", () => {
    const result = validateUrl("");
    expect(result.success).toBe(false);
  });
});
