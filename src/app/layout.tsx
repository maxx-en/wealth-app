import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "내 자산 관리",
  description: "현금흐름 · 투자 · 자산 · 목표를 한 곳에서",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full bg-neutral-50 text-neutral-900">{children}</body>
    </html>
  );
}
