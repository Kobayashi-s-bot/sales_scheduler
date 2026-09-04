import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "営業カレンダー",
  description: "営業判断アプリ MVP",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
