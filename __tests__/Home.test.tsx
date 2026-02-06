import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Home from "@/app/page";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

describe("Home Page", () => {
  let localStorageMock: Record<string, string>;

  beforeEach(() => {
    global.fetch = vi.fn();
    // Mock clipboard API
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockImplementation(() => Promise.resolve()),
      },
    });
    // Mock localStorage
    localStorageMock = {};
    Object.defineProperty(window, "localStorage", {
      value: {
        getItem: vi.fn((key: string) => localStorageMock[key] || null),
        setItem: vi.fn((key: string, value: string) => {
          localStorageMock[key] = value;
        }),
        removeItem: vi.fn((key: string) => {
          delete localStorageMock[key];
        }),
        clear: vi.fn(() => {
          localStorageMock = {};
        }),
      },
      writable: true,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders correctly with title and input", () => {
    render(<Home />);
    expect(screen.getByText("URL短縮サービス")).toBeDefined();
    expect(screen.getByLabelText("短縮したいURLを入力")).toBeDefined();
    expect(screen.getByText("短縮する")).toBeDefined();
  });

  it("handles successful URL shortening", async () => {
    const shortCode = "abcd123";
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ shortCode }),
    } as Response);

    render(<Home />);
    const input = screen.getByLabelText("短縮したいURLを入力");
    const form = input.closest("form")!;

    fireEvent.change(input, { target: { value: "https://example.com/success" } });
    fireEvent.submit(form);

    await waitFor(() => {
      // フォームの入っているコンテナ（メインカード）内の短縮結果を確認
      const resultCard = screen.getByText("短縮URL:").parentElement!;
      expect(resultCard.textContent).toContain(shortCode);
    }, { timeout: 2000 });
  });

  it("handles API errors", async () => {
    const errorMessage = "API Error Message";
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: errorMessage }),
    } as Response);

    render(<Home />);
    const input = screen.getByLabelText("短縮したいURLを入力");
    const form = input.closest("form")!;

    fireEvent.change(input, { target: { value: "https://example.com/error" } });
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeDefined();
    }, { timeout: 2000 });
  });

  it("handles copy button click", async () => {
    const shortCode = "copy123";
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ shortCode }),
    } as Response);

    render(<Home />);
    const input = screen.getByLabelText("短縮したいURLを入力");
    const form = input.closest("form")!;

    fireEvent.change(input, { target: { value: "https://example.com/copy" } });
    fireEvent.submit(form);

    await waitFor(() => {
      const resultCard = screen.getByText("短縮URL:").parentElement!;
      expect(resultCard.textContent).toContain(shortCode);
    }, { timeout: 2000 });

    // メインカードのコピーボタンをクリック
    const copyButtons = screen.getAllByRole("button", { name: /コピー/ });
    fireEvent.click(copyButtons[0]); // 最初のがメインカードのボタン

    const expectedFullUrl = `${window.location.origin}/${shortCode}`;
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expectedFullUrl);

    await waitFor(() => {
      expect(screen.getByText("コピー完了！")).toBeDefined();
    }, { timeout: 2000 });
  });

  describe("History Feature", () => {
    it("saves URL to history after successful shortening", async () => {
      const shortCode = "hist123";
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ shortCode }),
      } as Response);

      render(<Home />);
      const input = screen.getByLabelText("短縮したいURLを入力");
      const form = input.closest("form")!;

      fireEvent.change(input, { target: { value: "https://example.com/history-test" } });
      fireEvent.submit(form);

      await waitFor(() => {
        // 履歴セクションが表示されるのを待機
        expect(screen.getByRole("heading", { name: "履歴" })).toBeDefined();
      }, { timeout: 2000 });

      // Check localStorage was called
      expect(window.localStorage.setItem).toHaveBeenCalledWith(
        "url-shortener-history",
        expect.stringContaining(shortCode)
      );
    });

    it("loads history from localStorage on mount", () => {
      const existingHistory = [
        { shortCode: "old123", longUrl: "https://old.example.com", createdAt: "2026-01-01T00:00:00.000Z" },
      ];
      localStorageMock["url-shortener-history"] = JSON.stringify(existingHistory);

      render(<Home />);

      expect(screen.getByRole("heading", { name: "履歴" })).toBeDefined();
      expect(screen.getByText(/old123/)).toBeDefined();
    });

    it("removes individual history item", async () => {
      const existingHistory = [
        { shortCode: "del123", longUrl: "https://delete.example.com", createdAt: "2026-01-01T00:00:00.000Z" },
      ];
      localStorageMock["url-shortener-history"] = JSON.stringify(existingHistory);

      render(<Home />);

      const deleteButton = screen.getByText("削除");
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(screen.queryByText(/del123/)).toBeNull();
      });
    });

    it("clears all history", async () => {
      const existingHistory = [
        { shortCode: "clear1", longUrl: "https://a.example.com", createdAt: "2026-01-01T00:00:00.000Z" },
        { shortCode: "clear2", longUrl: "https://b.example.com", createdAt: "2026-01-02T00:00:00.000Z" },
      ];
      localStorageMock["url-shortener-history"] = JSON.stringify(existingHistory);

      render(<Home />);
      expect(screen.getByRole("heading", { name: "履歴" })).toBeDefined();

      const clearButton = screen.getByText("すべて削除");
      fireEvent.click(clearButton);

      await waitFor(() => {
        expect(screen.queryByText("履歴")).toBeNull();
      });

      expect(window.localStorage.removeItem).toHaveBeenCalledWith("url-shortener-history");
    });
  });
});
