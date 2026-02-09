"use client";

import { useState } from "react";

export interface UrlHistoryItem {
    shortCode: string;
    longUrl: string;
}

interface HistoryListProps {
    history: UrlHistoryItem[];
    onRemove: (index: number) => void;
    onRemoveAll: () => void;
}

export default function HistoryList({ history, onRemove, onRemoveAll }: HistoryListProps) {
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

    const copyHistoryItem = async (shortCode: string, index: number) => {
        await navigator.clipboard.writeText(`${window.location.origin}/${shortCode}`);
        setCopiedIndex(index);
        setTimeout(() => setCopiedIndex(null), 2000);
    };

    if (history.length === 0) return null;

    return (
        <div className="mt-6 bg-background rounded-xl shadow-lg p-6 w-full max-w-md border border-border">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-foreground">履歴</h2>
                <button
                    onClick={onRemoveAll}
                    className="text-xs text-muted-foreground hover:text-red-500 transition-colors"
                >
                    すべて削除
                </button>
            </div>
            <ul className="space-y-3 max-h-80 overflow-y-auto">
                {history.map((item, index) => (
                    <li
                        key={`${item.shortCode}`}
                        className="p-3 bg-accent/5 rounded-lg border border-border"
                    >
                        <div className="flex justify-between items-start gap-2">
                            <div className="flex-1 min-w-0">
                                <code className="text-sm font-mono text-primary block">
                                    {typeof window !== "undefined"
                                        ? `${window.location.origin}/${item.shortCode}`
                                        : `/${item.shortCode}`}
                                </code>
                                <p className="text-xs text-muted-foreground truncate mt-1">
                                    {item.longUrl}
                                </p>
                            </div>
                            <div className="flex gap-1 shrink-0">
                                <button
                                    onClick={() => copyHistoryItem(item.shortCode, index)}
                                    className={`px-2 py-1 rounded text-xs font-medium transition-all ${copiedIndex === index
                                        ? "bg-green-500 text-white"
                                        : "bg-primary/10 text-primary hover:bg-primary/20"
                                        }`}
                                >
                                    {copiedIndex === index ? "✓" : "コピー"}
                                </button>
                                <button
                                    onClick={() => onRemove(index)}
                                    className="px-2 py-1 rounded text-xs font-medium bg-red-50 text-red-500 hover:bg-red-100 transition-all"
                                >
                                    削除
                                </button>
                            </div>
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
}
