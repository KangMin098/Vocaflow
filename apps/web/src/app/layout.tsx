// apps/web/src/app/layout.tsx
// Root Layout — next/font/google 4종 폰트 + ToastProvider
// CLAUDE.md v06.2 §Typography 기준
// ─────────────────────────────────────────────────────────────

import type { Metadata, Viewport } from "next";
import {
  Figtree,
  Hahmlet,
  IBM_Plex_Sans_KR,
  Inter,
  Lora,
  JetBrains_Mono,
  Petrona,
  Space_Mono,
} from "next/font/google";
import { ToastProvider } from "@/components/ui/Toast";
import { DevicePreferences } from "@/components/layout/DevicePreferences";
import { SITE_URL } from "@/lib/seo/site";
import "./globals.css";

// ═══════════════════════════════════════════════════════════════════════════
// v07 「주묵 판면」 — 한글에 글꼴을 준다
//
// ⚠️ 이전까지 이 파일이 로드하던 4종(Plus Jakarta Sans · DM Sans · Lora · JetBrains Mono)은
//    **전부 `subsets: ["latin"]`** 이었다. 한글 글리프가 한 자도 없다는 뜻이다.
//    실측 2026-09-16(`/dashboard`, 로그인 상태): 본문 텍스트 노드 144개 중 한글이 108개(75%)인데
//    그 108개가 선언한 font-family 스택이 **100% 라틴 전용**이었다 — 즉 화면 글자의 4분의 3이
//    OS 기본 한글꼴(맑은 고딕 / Apple SD Gothic / Noto CJK)로 떨어지고 있었다.
//    27개는 한술 더 떠 **모노스페이스 폴백**으로 갔다(자간이 무너진다).
//    소스에 `font-display` 1,193회 + `font-body` 848회를 적어 놨지만 한글에 대해서는
//    **그 2,041번의 지정이 전부 무효**였다. "어디서나 본 템플릿 느낌" 의 1차 원인이다.
//
// 그래서 역할을 다시 나눈다 — **클래스 이름은 그대로 두고 스택만 바꾼다**(마크업 무변경):
//    · IBM Plex Sans KR — 모든 UI·본문 (한글+라틴 한 벌). Plus Jakarta/DM Sans 를 흡수했다.
//    · Hahmlet         — 한글 디스플레이(제목·뜻·감성 문장). 한글과 라틴을 한 설계에서 뽑은 세리프
//    · Lora            — 영어 원문·표제어 (v06.39 부터의 시그니처 · 유지)
//    · JetBrains Mono  — 숫자·코드 라벨
//    Pretendard 를 일부러 피했다: 안전하지만 지금 한국 웹의 절반이 그 얼굴이라
//    "스크린샷 한 장으로 알아보기" 라는 목표와 정반대로 간다(docs/design/01-research.md §1-1).
//
// ⚠️ **한글 폰트에 `preload` 를 켜면 안 된다.** Google Fonts 의 한글은 `unicode-range` 로
//    수백 조각으로 쪼개져 오고, next/font 의 preload 기본값(true)은 그 조각을 전부 preload 한다
//    (공개 사례: 281조각 2.32MB 가 모든 페이지에서). 브라우저가 필요한 조각만 가져가게 둔다.
// ⚠️ `subsets` 를 주지 않는다 — next/font 의 폰트 목록에 이 둘의 `korean` 서브셋이 등재돼
//    있지 않아서, 지정하면 오히려 라틴만 받아 온다. 미지정 + preload:false 가 Google 의
//    전체 CSS(= 한글 unicode-range 포함)를 쓰는 경로다.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * UI·본문 — 한글과 라틴을 한 벌로. 이전 `--font-display`(Plus Jakarta) 자리를 물려받는다.
 *
 * ⚠️ **한 번만 선언한다.** 처음에는 `--font-display` 와 `--font-body` 를 각각
 *    `IBM_Plex_Sans_KR({...})` 로 선언했는데, `next/font` 는 호출마다 별도 페이스를 만들어
 *    **같은 글꼴을 두 번 내려받는다**(실측 2026-09-16: `/pricing` 폰트 요청 37건 · 373KB).
 *    같은 글꼴을 가리키는 변수가 둘 필요할 뿐이지 페이스가 둘 필요한 게 아니다 —
 *    `variable` 하나로 선언하고 두 번째 이름은 CSS 에서 별칭으로 잇는다(globals.css).
 */
const fontUI = IBM_Plex_Sans_KR({
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-display",
  display: "swap",
  preload: false,
});

/** 한글 디스플레이 — 제목·뜻·감성 문장. Lora 가 못 그리는 한글을 같은 세리프 정서로 받는다. */
const fontKoDisplay = Hahmlet({
  // 800 — 참조 선언 제목의 굵은 둘째 줄(tines-mapping §21). 없으면 700 으로 대체돼 두 굵기 대비가 줄었다.
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-ko-display",
  display: "swap",
  preload: false,
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

// ── Tines 스킨(DD-68) — 참조 서체(상용)의 픽셀 비교 1위 무료 대체 ─────────────────
// docs/design/refs/tines/font-lookalike.md · 변수는 skins/tines.css 가 읽는다.
// preload 를 끈다 — 스킨이 꺼진 화면에서는 한 바이트도 받지 않는다.
const fontTinesSans = Figtree({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-tines-sans",
  display: "swap",
  preload: false,
});

const fontTinesSerif = Petrona({
  subsets: ["latin"],
  weight: ["300", "400", "700"],
  variable: "--font-tines-serif",
  display: "swap",
  preload: false,
});

const fontTinesMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-tines-mono",
  display: "swap",
  preload: false,
});

// ── Admin 앱 스킨(DD-76) — 레퍼런스 앱의 InterVariable 은 Inter(OFL) 그대로다. 변수는 skins/admin-app.css 가 읽는다.
// 고정폭(Geist Mono)은 next 14.2 폰트 목록에 없어 이미 싣는 JetBrains Mono 로 대체한다. preload 를 끈다 — /admin 밖에서는 받지 않는다.
const fontAdminSans = Inter({
  subsets: ["latin"],
  variable: "--font-admin-sans",
  display: "swap",
  preload: false,
});

// admin-app.css 가 `--font-mono` 자체를 덮으므로 원래 JetBrains Mono 변수를 가리킬 수 없다 — 별도 변수로 한 번 더 선언한다.
const fontAdminMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-admin-mono",
  display: "swap",
  preload: false,
});

/**
 * 화면 스킨 — 기본은 `tines`(사용자 결정 2026-09-21 「가장 닮음으로 우선 진행 후 평가」).
 * `NEXT_PUBLIC_SKIN=off` 로 기본을 끄고, 브라우저에서는 `?skin=off|tines` 가 localStorage 에 남는다.
 */
const DEFAULT_SKIN = process.env.NEXT_PUBLIC_SKIN ?? "tines";

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
    { media: "(prefers-color-scheme: light)", color: "#FBFAF6" }, // --bg
    { media: "(prefers-color-scheme: dark)",  color: "#181410" }, // --bg2 (dark)
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
      className={`${fontUI.variable} ${fontKoDisplay.variable} ${fontSerif.variable} ${fontMono.variable} ${fontTinesSans.variable} ${fontTinesSerif.variable} ${fontTinesMono.variable} ${fontAdminSans.variable} ${fontAdminMono.variable}`}
      data-skin={DEFAULT_SKIN === "off" ? undefined : DEFAULT_SKIN}
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
                  var q = new URLSearchParams(location.search).get('skin');
                  if (q === 'off' || q === 'tines') localStorage.setItem('vocaflow-skin', q);
                  var skin = localStorage.getItem('vocaflow-skin');
                  if (skin === 'off') document.documentElement.removeAttribute('data-skin');
                  else if (skin) document.documentElement.setAttribute('data-skin', skin);
                  // 모션 취향도 **첫 페인트 전에** 칠한다 — globals.css §4.5 의 상시 루프는
                  // 마운트 뒤에 칠하면 끈 사람에게 한 프레임 번쩍인다(전환만 낮추던 때는 늦어도 됐다).
                  // 저장·동기화는 DevicePreferences 가 계속 맡는다(여기는 첫 칠만).
                  var mo = localStorage.getItem('vocaflow-reduced-motion');
                  var osReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
                  var reduced = mo === 'on' || (mo !== 'off' && osReduced);
                  if (reduced) document.documentElement.setAttribute('data-reduced-motion', 'on');
                } catch (e) {}
              })();
            `,
          }}
        />
        {/* 한글 산세리프(Tines 스킨) — Pretendard 동적 서브셋. 스킨이 꺼지면 글꼴 파일을 받지 않는다. */}
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
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
