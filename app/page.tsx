"use client";

import { useState, useEffect } from "react";
import UrlShortener from "./components/UrlShortener";
import HistoryList, { type UrlHistoryItem } from "./components/HistoryList";

const HISTORY_KEY = "url-shortener-history";
const MAX_HISTORY = 20;

export default function Home() {
  const [history, setHistory] = useState<UrlHistoryItem[]>([]);

  // 初期読み込み
  useEffect(() => {
    const saved = localStorage.getItem(HISTORY_KEY);
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch {
        localStorage.removeItem(HISTORY_KEY);
      }
    }
  }, []);

  const saveHistory = (newHistory: UrlHistoryItem[]) => {
    setHistory(newHistory);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory));
  };

  const handleShorten = (shortCode: string, longUrl: string) => {
    const newItem: UrlHistoryItem = {
      shortCode,
      longUrl,
    };

    // 重複削除
    const filteredHistory = history.filter(item => item.shortCode !== shortCode);
    const newHistory = [newItem, ...filteredHistory].slice(0, MAX_HISTORY);
    saveHistory(newHistory);
  };

  const handleRemoveHistory = (index: number) => {
    const newHistory = history.filter((_, i) => i !== index);
    saveHistory(newHistory);
  };

  const handleRemoveAllHistory = () => {
    setHistory([]);
    localStorage.removeItem(HISTORY_KEY);
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-primary/20 via-background to-secondary/20 flex flex-col items-center justify-center p-4">
      <UrlShortener onShorten={handleShorten} />

      <HistoryList
        history={history}
        onRemove={handleRemoveHistory}
        onRemoveAll={handleRemoveAllHistory}
      />

      <div className="mt-8 max-w-md text-[10px] text-muted-foreground text-center space-y-1">
        <p>
          本サービスはウェブサイトの安全性を確認するために Google Safe Browsing API を使用しています。
        </p>
      </div>
    </main>
  );
}
