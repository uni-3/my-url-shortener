"use client";

import { useState, useEffect, useRef } from "react";
import UrlShortener from "./components/UrlShortener";
import ChatInterface from "./components/ChatInterface";
import HistoryList, { type UrlHistoryItem } from "./components/HistoryList";

const HISTORY_KEY = "url-shortener-history";
const MAX_HISTORY = 20;

type Tab = "form" | "chat";

export default function Home() {
  const [history, setHistory] = useState<UrlHistoryItem[]>([]);
  const [tab, setTab] = useState<Tab>("form");
  // チャットパネルは初回アクティブ化まで遅延マウントし、以降はhiddenで切り替えて
  // セッション（とTurnstile）の状態を保持する
  const [chatMounted, setChatMounted] = useState(false);
  const formTabRef = useRef<HTMLButtonElement>(null);
  const chatTabRef = useRef<HTMLButtonElement>(null);

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

  const selectTab = (next: Tab) => {
    setTab(next);
    if (next === "chat") setChatMounted(true);
  };

  // 左右矢印キーでタブを移動する（タブは2つなのでトグル）
  const handleTabKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const next: Tab = tab === "form" ? "chat" : "form";
    selectTab(next);
    (next === "form" ? formTabRef : chatTabRef).current?.focus();
  };

  const tabClass = (selected: boolean) =>
    `flex-1 px-4 py-2 text-sm transition-colors ${
      selected
        ? "border-b-2 border-primary text-primary font-semibold"
        : "text-muted-foreground hover:text-foreground"
    }`;

  return (
    <main className="min-h-screen bg-gradient-to-br from-primary/20 via-background to-secondary/20 flex flex-col items-center justify-center p-4">
      <div
        role="tablist"
        aria-label="短縮方法の切り替え"
        className="w-full max-w-md mb-4 flex border-b border-border"
        onKeyDown={handleTabKeyDown}
      >
        <button
          ref={formTabRef}
          role="tab"
          id="tab-form"
          aria-selected={tab === "form"}
          aria-controls="panel-form"
          tabIndex={tab === "form" ? 0 : -1}
          onClick={() => selectTab("form")}
          className={tabClass(tab === "form")}
        >
          フォーム
        </button>
        <button
          ref={chatTabRef}
          role="tab"
          id="tab-chat"
          aria-selected={tab === "chat"}
          aria-controls="panel-chat"
          tabIndex={tab === "chat" ? 0 : -1}
          onClick={() => selectTab("chat")}
          className={tabClass(tab === "chat")}
        >
          チャット
        </button>
      </div>

      <div
        id="panel-form"
        role="tabpanel"
        aria-labelledby="tab-form"
        hidden={tab !== "form"}
        className="w-full max-w-md"
      >
        <UrlShortener onShorten={handleShorten} />
      </div>

      {chatMounted && (
        <div
          id="panel-chat"
          role="tabpanel"
          aria-labelledby="tab-chat"
          hidden={tab !== "chat"}
          className="w-full max-w-md"
        >
          <ChatInterface onShorten={handleShorten} />
        </div>
      )}

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
