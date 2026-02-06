"use client";

import { useState } from "react";
import ThreatAlert from "./ThreatAlert";

interface UrlShortenerProps {
    onShorten: (shortCode: string, longUrl: string) => void;
}

interface ShortenResponse {
    shortCode: string;
    url?: string;
    error?: string;
    threatType?: string;
}

export default function UrlShortener({ onShorten }: UrlShortenerProps) {
    const [longUrl, setLongUrl] = useState("");
    const [shortCode, setShortCode] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [threatType, setThreatType] = useState<string | undefined>(undefined);
    const [copied, setCopied] = useState(false);

    const handleShorten = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        setThreatType(undefined);
        setShortCode("");

        try {
            const response = await fetch("/api/shorten", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url: longUrl }),
            });

            const data = (await response.json()) as ShortenResponse;

            if (!response.ok) {
                setThreatType(data.threatType);
                throw new Error(data.error || "URLの短縮に失敗しました");
            }

            setShortCode(data.shortCode);
            onShorten(data.shortCode, longUrl);
        } catch (err) {
            setError(err instanceof Error ? err.message : "エラーが発生しました");
        } finally {
            setLoading(false);
        }
    };

    const handleCopy = async () => {
        const fullUrl = `${window.location.origin}/${shortCode}`;
        await navigator.clipboard.writeText(fullUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="bg-background rounded-xl shadow-xl hover:shadow-2xl transition-all duration-300 p-8 w-full max-w-md border border-border">
            <h1 className="text-3xl font-bold text-foreground mb-6 text-center tracking-tight">
                URL短縮サービス
            </h1>

            <form onSubmit={handleShorten} className="space-y-6">
                <div className="space-y-2">
                    <label htmlFor="url" className="block text-sm font-medium text-foreground/80">
                        短縮したいURLを入力
                    </label>
                    <input
                        id="url"
                        type="url"
                        value={longUrl}
                        onChange={(e) => setLongUrl(e.target.value)}
                        placeholder="https://example.com/very/long/url"
                        required
                        className="w-full px-4 py-3 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 bg-input text-foreground transition-all"
                    />
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-primary text-primary-foreground font-semibold py-3 rounded-lg hover:opacity-90 disabled:opacity-50 transition-all transform active:scale-[0.98]"
                >
                    {loading ? (
                        <span className="flex items-center justify-center gap-2">
                            <svg className="animate-spin h-5 w-5 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            処理中...
                        </span>
                    ) : "短縮する"}
                </button>
            </form>

            {error && (
                <div className="mt-6 p-4 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm flex flex-col gap-2">
                    <div className="flex items-start gap-2">
                        <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>{error}</span>
                    </div>
                    <ThreatAlert threatType={threatType} />
                </div>
            )}

            {shortCode && (
                <div className="mt-8 p-4 bg-accent/5 border border-accent/20 rounded-xl space-y-3 animate-in fade-in slide-in-from-top-2 duration-500">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">短縮URL:</p>
                    <div className="flex flex-col sm:flex-row items-stretch gap-2">
                        <code className="flex-1 bg-background border border-border p-3 rounded-lg text-foreground font-mono text-sm break-all">
                            {`${window.location.origin}/${shortCode}`}
                        </code>
                        <button
                            onClick={handleCopy}
                            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${copied
                                ? "bg-green-500 text-white"
                                : "bg-primary text-primary-foreground hover:opacity-90"
                                }`}
                        >
                            {copied ? "コピー完了！" : "コピー"}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
