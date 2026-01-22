"use client";

import { useState } from "react";

export default function Home() {
  const [longUrl, setLongUrl] = useState("");
  const [shortCode, setShortCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleShorten = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setShortCode("");

    try {
      const response = await fetch("/api/shorten", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: longUrl }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to shorten URL");
      }

      const data = await response.json();
      setShortCode(data.shortCode);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-primary to-secondary flex items-center justify-center p-4">
      <div className="bg-background rounded-lg shadow-lg p-8 w-full max-w-md">
        <h1 className="text-3xl font-bold text-foreground mb-6 text-center">
          URL短縮サービス
        </h1>

        <form onSubmit={handleShorten} className="space-y-4">
          <div>
            <label htmlFor="url" className="block text-sm font-medium text-foreground mb-2">
              長いURLを入力
            </label>
            <input
              id="url"
              type="url"
              value={longUrl}
              onChange={(e) => setLongUrl(e.target.value)}
              placeholder="https://example.com/very/long/url"
              required
              className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-input text-foreground"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-primary-foreground font-semibold py-2 rounded-lg hover:opacity-90 disabled:opacity-50 transition"
          >
            {loading ? "処理中..." : "短縮する"}
          </button>
        </form>

        {error && (
          <div className="mt-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        {shortCode && (
          <div className="mt-6 p-4 bg-accent bg-opacity-10 border border-accent rounded-lg">
            <p className="text-sm text-muted-foreground mb-2">短縮URL:</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-background p-2 rounded text-foreground font-mono text-sm break-all">
                {`${window.location.origin}/${shortCode}`}
              </code>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/${shortCode}`);
                }}
                className="px-3 py-2 bg-primary text-primary-foreground rounded text-sm hover:opacity-90 transition"
              >
                コピー
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
