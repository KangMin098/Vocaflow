// apps/web/src/app/layout.tsx
// Root Layout — next/font/google 4종 폰트 + ToastProvider
// CLAUDE.md v06.2 §Typography 기준
// ─────────────────────────────────────────────────────────────

import type { Metadata, Viewport } from "next";
import {
  Plus_Jakarta_Sans,
  DM_Sans,
  Lora,
  JetBrains_Mono,
} from "next/font/google";
import { ToastProvider } from "@/components/ui/Toast";
import { DevicePreferences } from "@/components/layout/DevicePreferences";
import { SITE_URL } from "@/lib/seo/site";
import "./globals.css";

const fontDisplay = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-display",
  display: "swap",
});

const fontBody = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

const fontSerif = Lora({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
});

const fontMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  // 이게 없으면 Next 는 OG·canonical 을 **상대경로**로 내보내고, 상대 OG URL 은 대부분의
  // 메신저·SNS 미리보기에서 무시된다 — 공유 링크에 제목을 붙여 놔도 안 보인다(2026-08-17 실측).
  metadataBase: SITE_URL,
  title: {
    default: "Vocaflow — 영어 스크립트 기반 종합 학습",
    template: "%s | Vocaflow",
  },
  description:
    "영어 스크립트를 붙여넣고 AI가 자동으로 단어장·플래시카드·게임·퀴즈를 생성합니다.",
  keywords: ["영어 학습", "단어장", "Vocaflow", "WordVault", "SpellForge", "WordBlitz", "ScriptQuiz"],
  authors: [{ name: "Vocaflow Team" }],
  creator: "Vocaflow",
  openGraph: {
    type: "website",
    locale: "ko_KR",
    siteName: "Vocaflow",
    title: "Vocaflow — 영어 스크립트 기반 종합 학습",
    description: "AI가 만드는 나만의 영어 학습 코스",
  },
  twitter: {
    card: "summary_large_image",
    title: "Vocaflow",
    description: "영어 스크립트 기반 종합 학습 플랫폼",
  },
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FFFFFF" },
    { media: "(prefers-color-scheme: dark)",  color: "#0B1120" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${fontDisplay.variable} ${fontBody.variable} ${fontSerif.variable} ${fontMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var stored = localStorage.getItem('vocaflow-theme');
                  var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  var theme = stored || (prefersDark ? 'dark' : 'light');
                  document.documentElement.setAttribute('data-theme', theme);
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="font-body antialiased">
        {/* 기기 취향(모션 감소)을 **모든 화면에서** 실제로 적용한다 —
            저장은 설정 화면이 하지만 적용은 여기 한 곳이다. 테마는 위 선행 스크립트가
            첫 페인트 전에 칠하므로 여기서 다시 만지지 않는다(두 곳이 칠하면 깜빡인다). */}
        <DevicePreferences />
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
