import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Home from "@/app/page";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

describe("Home Page", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
    // Mock clipboard API
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockImplementation(() => Promise.resolve()),
      },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders correctly with title and input", () => {
    render(<Home />);
    expect(screen.getByText("URL短縮サービス")).toBeDefined();
    expect(screen.getByLabelText("長いURLを入力")).toBeDefined();
    expect(screen.getByText("短縮する")).toBeDefined();
  });

  it("handles successful URL shortening", async () => {
    const shortCode = "abcd123";
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ shortCode }),
    });

    render(<Home />);
    const input = screen.getByLabelText("長いURLを入力");
    const form = input.closest('form')!;

    fireEvent.change(input, { target: { value: "https://example.com/success" } });
    fireEvent.submit(form);

    await waitFor(() => {
      // The component displays the full URL: `${window.location.origin}/${shortCode}`
      // In JSDOM/Vitest, origin is usually http://localhost:3000 or similar
      expect(screen.getByText(new RegExp(shortCode))).toBeDefined();
    }, { timeout: 2000 });
  });

  it("handles API errors", async () => {
    const errorMessage = "API Error Message";
    (global.fetch as any).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: errorMessage }),
    });

    render(<Home />);
    const input = screen.getByLabelText("長いURLを入力");
    const form = input.closest('form')!;

    fireEvent.change(input, { target: { value: "https://example.com/error" } });
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeDefined();
    }, { timeout: 2000 });
  });

  it("handles copy button click", async () => {
    const shortCode = "copy123";
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ shortCode }),
    });

    render(<Home />);
    const input = screen.getByLabelText("長いURLを入力");
    const form = input.closest('form')!;

    fireEvent.change(input, { target: { value: "https://example.com/copy" } });
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText(new RegExp(shortCode))).toBeDefined();
    }, { timeout: 2000 });

    const copyButton = screen.getByText("コピー");
    fireEvent.click(copyButton);

    const expectedFullUrl = `${window.location.origin}/${shortCode}`;
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expectedFullUrl);

    await waitFor(() => {
      expect(screen.getByText("コピー完了！")).toBeDefined();
    }, { timeout: 2000 });
  });
});
