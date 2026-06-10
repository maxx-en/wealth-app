import type { Metadata } from "next";
import "./globals.css";
import Providers from "@/components/Providers";

// OG/아이콘이 절대 URL로 잡히도록 기준 도메인 지정.
// 배포(Vercel)에선 자동 주입되는 도메인을, 로컬에선 localhost를 사용 → 도메인 바뀌어도 안전.
const siteUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "WeWorth — 우리의 자산, 함께",
  description: "현금흐름 · 투자 · 자산 · 목표를 한 곳에서. 가족과 함께 보는 자산 대시보드",
  openGraph: {
    title: "WeWorth — 우리의 자산, 함께 키우다",
    description: "현금흐름 · 투자 · 자산 · 목표를 한 곳에서. 가족과 함께 보는 자산 대시보드",
    type: "website",
  },
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
