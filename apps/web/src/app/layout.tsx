// apps/web/src/app/layout.tsx
// Root Layout — 자체 호스팅 글꼴(@fontsource) + ToastProvider
// CLAUDE.md v06.2 §Typography 기준
// ─────────────────────────────────────────────────────────────

import type { Metadata, Viewport } from "next";
import { ToastProvider } from "@/components/ui/Toast";
import { DevicePreferences } from "@/components/layout/DevicePreferences";
import { LearnerColorScope } from "@/components/layout/LearnerColorScope";
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
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// 자체 호스팅(v6.2 P-F7e · 2026-10-14) — 빌드가 외부 글꼴 서버에 묻지 않는다.
//
// 이전에는 아래 9벌을 `next/font/google` 로 선언했다. next/font 는 **빌드 중** Google 에서 받으므로
// CI 빌드가 그 다운로드 실패로 간헐적으로 깨졌다(PR #246 · #254 · 재실행으로만 통과).
// 같은 글꼴 · 같은 굵기를 @fontsource(OFL-1.1, 정확한 버전 고정) 에서 읽는다 — 글꼴 · 화면은 그대로다.
//
// ⚠️ **한글 글꼴은 preload 하지 않는다.** 한글은 굵기마다 unicode-range 조각 약 90개로 나뉘고,
//    브라우저는 화면에 쓰인 글자의 조각만 받는다. CSS @font-face 는 preload 를 만들지 않는다
//    (이전 next/font 의 preload:false 와 같은 동작 — learning-tone.test.ts 가 지킨다).
// 변수 이름은 이전 next/font `variable` 과 같다. 정의는 ./fonts.css(html 클래스).
// ═══════════════════════════════════════════════════════════════════════════

// UI·본문 — IBM Plex Sans KR(한글+라틴 한 벌). `--font-body` 는 globals.css 에서 별칭으로 잇는다.
import "@fontsource/ibm-plex-sans-kr/300.css";
import "@fontsource/ibm-plex-sans-kr/400.css";
import "@fontsource/ibm-plex-sans-kr/500.css";
import "@fontsource/ibm-plex-sans-kr/600.css";
import "@fontsource/ibm-plex-sans-kr/700.css";
// 한글 디스플레이 — Hahmlet. 800 은 참조 선언 제목의 굵은 둘째 줄(tines-mapping §21).
import "@fontsource/hahmlet/300.css";
import "@fontsource/hahmlet/400.css";
import "@fontsource/hahmlet/500.css";
import "@fontsource/hahmlet/600.css";
import "@fontsource/hahmlet/700.css";
import "@fontsource/hahmlet/800.css";
// 영어 원문·표제어 — Lora(정체 · 이탤릭). 라틴만 싣는다(이전 subsets: latin).
import "@fontsource/lora/latin-400.css";
import "@fontsource/lora/latin-500.css";
import "@fontsource/lora/latin-600.css";
import "@fontsource/lora/latin-700.css";
import "@fontsource/lora/latin-400-italic.css";
import "@fontsource/lora/latin-500-italic.css";
import "@fontsource/lora/latin-600-italic.css";
import "@fontsource/lora/latin-700-italic.css";
// 숫자·코드 라벨 — JetBrains Mono(관리자 고정폭도 같은 글꼴).
import "@fontsource/jetbrains-mono/latin-400.css";
import "@fontsource/jetbrains-mono/latin-500.css";
import "@fontsource/jetbrains-mono/latin-700.css";
// Tines 스킨(DD-68) — 참조 서체(상용)의 픽셀 비교 1위 무료 대체.
import "@fontsource/figtree/latin-400.css";
import "@fontsource/figtree/latin-500.css";
import "@fontsource/figtree/latin-600.css";
import "@fontsource/figtree/latin-700.css";
import "@fontsource/petrona/latin-300.css";
import "@fontsource/petrona/latin-400.css";
import "@fontsource/petrona/latin-700.css";
import "@fontsource/space-mono/latin-400.css";
import "@fontsource/space-mono/latin-700.css";
// Admin 앱 스킨(DD-82) — 레퍼런스 앱의 InterVariable 은 Inter(OFL) 그대로다. 변수는 skins/admin-app.css 가 읽는다.
import "@fontsource-variable/inter/wght.css";
import "./fonts.css";

/** html 에 붙는 변수 클래스(./fonts.css) — 이전 next/font 의 `.variable` 자리 */
const FONT_VARIABLE_CLASSES = [
  "vf-font-ui",
  "vf-font-ko-display",
  "vf-font-serif",
  "vf-font-mono",
  "vf-font-tines-sans",
  "vf-font-tines-serif",
  "vf-font-tines-mono",
  "vf-font-admin-sans",
  "vf-font-admin-mono",
].join(" ");

/**
 * 화면 스킨 — 항상 `tines`(DESIGN.md · DD-83, 2026-10-03 사용자 결정: 학습자 PC = Tines).
 * 예전의 끄는 길(환경변수 · 주소 쿼리 → localStorage)은 지웠다 — 기준을 해제하는 장치가
 * 남아 있으면 검증 화면과 실제 화면이 갈린다. 관리자는 이 위에 `admin-app.css` 를 얹는다.
 */
const SKIN = "tines";

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
      className={FONT_VARIABLE_CLASSES}
      data-skin={SKIN}
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
                  // 옛 스킨 해제 저장값은 더 읽지 않고 지운다(DD-83).
                  localStorage.removeItem('vocaflow-skin');
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
        <LearnerColorScope />
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
