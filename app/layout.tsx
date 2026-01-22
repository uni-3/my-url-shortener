import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "URL短縮サービス",
  description: "長いURLを短い文字列に変換するサービス",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
