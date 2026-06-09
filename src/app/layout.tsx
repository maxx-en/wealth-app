import type { Metadata } from "next";
import "./globals.css";
import Providers from "@/components/Providers";

export const metadata: Metadata = {
  title: "내 자산 관리",
  description: "현금흐름 · 투자 · 자산 · 목표를 한 곳에서",
};

// 시스템 설정에 따라 라이트/다크 자동 전환
export const viewport = {
  colorScheme: "light dark" as const,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f4f3" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0b" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full bg-bg text-text">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
