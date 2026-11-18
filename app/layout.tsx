import type { Metadata, Viewport } from "next";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://senior-life-platform.pages.dev";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "늘봄 | 언제나, 늘 곁에 있는 시니어 생활 플랫폼",
  description:
    "운세와 안부 인사카드, 1분 치매예방 퀴즈와 명예의 전당, 맞춤형 정부 지원금, 돋보기·생활 가이드, 가족 안부와 복약 체크를 한 곳에서. 늘봄 — 언제나, 늘 곁에 있는 시니어를 위한 스마트한 생활 플랫폼.",
  applicationName: "늘봄",
  // 홈 화면에 추가하면 주소창 없이 앱처럼 열린다(PWA)
  manifest: "/manifest.json",
  appleWebApp: { capable: true, title: "늘봄", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  openGraph: {
    title: "늘봄",
    description: "운세 · 치매예방 퀴즈 · 맞춤 지원금 · 가족 안부를 한 곳에서",
    images: ["/share-card.png"],
    type: "website",
  },
  icons: { icon: "/favicon.svg", apple: "/apple-touch-icon.png", shortcut: "/favicon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 3,
  themeColor: "#F9F7F1",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#18939B" />
        {/* Pretendard — 시니어 가독성 기준 글꼴 */}
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Nanum+Pen+Script&family=Gowun+Batang:wght@700&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
