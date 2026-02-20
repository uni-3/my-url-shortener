import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Home from "@/app/page";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

// --- Helpers ---
const setupFetchMock = (responseData: any, ok: boolean = true) => {
  vi.mocked(global.fetch).mockResolvedValue({
    ok,
    json: () => Promise.resolve(responseData),
  } as Response);
};

const fillAndSubmitUrlForm = (url: string) => {
  const input = screen.getByLabelText("短縮したいURLを入力");
  const form = input.closest("form")!;
  fireEvent.change(input, { target: { value: url } });
  fireEvent.submit(form);
};

const MOCK_HISTORY = [
  { shortCode: "old123", longUrl: "https://old.example.com", createdAt: "2026-01-01T00:00:00.000Z" },
  { shortCode: "del123", longUrl: "https://delete.example.com", createdAt: "2026-01-02T00:00:00.000Z" },
];

describe("Home Page", () => {
  let localStorageMock: Record<string, string>;

  beforeEach(() => {
    // Arrange Global Mocks
    global.fetch = vi.fn();

    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });

    localStorageMock = {};
    Object.defineProperty(window, "localStorage", {
      value: {
        getItem: vi.fn((key: string) => localStorageMock[key] || null),
        setItem: vi.fn((key: string, value: string) => { localStorageMock[key] = value; }),
        removeItem: vi.fn((key: string) => { delete localStorageMock[key]; }),
        clear: vi.fn(() => { localStorageMock = {}; }),
      },
      writable: true,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders correctly with title and input", () => {
    // Act
    render(<Home />);

    // Assert
    expect(screen.getByText("URL短縮サービス")).toBeDefined();
    expect(screen.getByLabelText("短縮したいURLを入力")).toBeDefined();
    expect(screen.getByText("短縮する")).toBeDefined();
  });

  it("handles successful URL shortening", async () => {
    // Arrange
    const shortCode = "abcd123";
    setupFetchMock({ shortCode });
    render(<Home />);

    // Act
    fillAndSubmitUrlForm("https://example.com/success");

    // Assert
    await waitFor(() => {
      const resultCard = screen.getByText("短縮URL:").parentElement!;
      expect(resultCard.textContent).toContain(shortCode);
    }, { timeout: 2000 });
  });

  it("handles API errors", async () => {
    // Arrange
    const errorMessage = "API Error Message";
    setupFetchMock({ error: errorMessage }, false);
    render(<Home />);

    // Act
    fillAndSubmitUrlForm("https://example.com/error");

    // Assert
    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeDefined();
    }, { timeout: 2000 });
  });

  it("handles copy button click", async () => {
    // Arrange
    const shortCode = "copy123";
    setupFetchMock({ shortCode });
    render(<Home />);

    // Act
    fillAndSubmitUrlForm("https://example.com/copy");

    await waitFor(() => {
      const resultCard = screen.getByText("短縮URL:").parentElement!;
      expect(resultCard.textContent).toContain(shortCode);
    });

    const copyButtons = screen.getAllByRole("button", { name: /コピー/ });
    fireEvent.click(copyButtons[0]);

    // Assert
    const expectedFullUrl = `${window.location.origin}/${shortCode}`;
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expectedFullUrl);

    await waitFor(() => {
      expect(screen.getByText("コピー完了！")).toBeDefined();
    });
  });

  describe("History Feature", () => {
    it("saves URL to history after successful shortening", async () => {
      // Arrange
      const shortCode = "hist123";
      setupFetchMock({ shortCode });
      render(<Home />);

      // Act
      fillAndSubmitUrlForm("https://example.com/history-test");

      // Assert
      await waitFor(() => {
        expect(screen.getByRole("heading", { name: "履歴" })).toBeDefined();
      });

      expect(window.localStorage.setItem).toHaveBeenCalledWith(
        "url-shortener-history",
        expect.stringContaining(shortCode)
      );
    });

    it("loads history from localStorage on mount", () => {
      // Arrange
      localStorageMock["url-shortener-history"] = JSON.stringify([MOCK_HISTORY[0]]);

      // Act
      render(<Home />);

      // Assert
      expect(screen.getByRole("heading", { name: "履歴" })).toBeDefined();
      expect(screen.getByText(/old123/)).toBeDefined();
    });

    it("removes individual history item", async () => {
      // Arrange
      localStorageMock["url-shortener-history"] = JSON.stringify([MOCK_HISTORY[1]]);
      render(<Home />);

      // Act
      const deleteButton = screen.getByText("削除");
      fireEvent.click(deleteButton);

      // Assert
      await waitFor(() => {
        expect(screen.queryByText(/del123/)).toBeNull();
      });
    });

    it("clears all history", async () => {
      // Arrange
      localStorageMock["url-shortener-history"] = JSON.stringify(MOCK_HISTORY);
      render(<Home />);

      // Act
      const clearButton = screen.getByText("すべて削除");
      fireEvent.click(clearButton);

      // Assert
      await waitFor(() => {
        expect(screen.queryByText("履歴")).toBeNull();
      });
      expect(window.localStorage.removeItem).toHaveBeenCalledWith("url-shortener-history");
    });
  });
});
