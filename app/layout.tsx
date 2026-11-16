import type { Metadata, Viewport } from "next";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://senior-life-platform.pages.dev";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "시니어생활 도우미 | 운세·두뇌퀴즈·지원금·가족 안부",
  description:
    "어르신을 위한 하루 생활 도우미. 오늘의 운세와 안부 인사카드, 1분 두뇌 퀴즈와 명예의 전당, 맞춤형 정부 지원금 안내, 돋보기·카드뉴스, 가족 안부와 복약 체크를 한 곳에서.",
  openGraph: {
    title: "시니어생활 도우미",
    description: "운세 · 두뇌 퀴즈 · 맞춤 지원금 · 가족 안부를 한 곳에서",
    images: ["/share-card.png"],
    type: "website",
  },
  icons: { icon: "/favicon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 3,
  themeColor: "#FFFBF1",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
