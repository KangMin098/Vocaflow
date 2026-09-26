// apps/web/tailwind.config.ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // ── 기존 토큰 유지 ──
        bg: "var(--bg)",
        bg2: "var(--bg2)",
        bg3: "var(--bg3)",
        t1: "var(--t1)",
        t2: "var(--t2)",
        t3: "var(--t3)",
        t4: "var(--t4)",
        bd: "var(--bd)",
        bdf: "var(--bdf)",
        p: "var(--p)",
        "p-hover": "var(--p-hover)",
        "p-light": "var(--p-light)",
        "p-dark": "var(--p-dark)",
        ti: "var(--ti)",
        bde: "var(--bde)",
        accent: "var(--accent)",
        "accent-hover": "var(--accent-hover)",
        "accent-light": "var(--accent-light)",

        // ── v06.35 — semantic 색 (그동안 테마 누락으로 text-error / bg-success-light /
        //   text-ti / bg-p-light 등 단축 클래스가 no-op 이었음. CSS 변수는 globals.css 에
        //   이미 존재 → 매핑만 추가하면 앱 전역의 의도된 색이 한 번에 살아남) ──
        active: "var(--active)",
        "active-light": "var(--active-light)",

        // ── v07 주묵(朱墨) — 면적을 가진 브랜드 색. 정의·대비 실측은 tokens.css §주묵 ──
        //    ⚠️ 학습자의 오답에는 쓰지 않는다(learning-tone.test.ts 가 잡는다).
        ju: "var(--ju)",
        "accent-plum": "var(--accent-plum)",
        "ju-ink": "var(--ju-ink)",
        "ju-light": "var(--ju-light)",
        "ju-wash": "var(--ju-wash)",
        "on-ju": "var(--on-ju)",

        success: "var(--success)",
        "success-light": "var(--success-light)",
        error: "var(--error)",
        "error-light": "var(--error-light)",
        warning: "var(--warning)",
        "warning-light": "var(--warning-light)",
        info: "var(--info)",
        "info-light": "var(--info-light)",

        // ── 게임 전용 (CLAUDE.md §Colors Game Specific) ──
        gold: "var(--gold)",
        silver: "var(--silver)",
        bronze: "var(--bronze)",
        combo: "var(--combo)",
        streak: "var(--streak)",

        // ★ v6 — 학습 단계
        "learn-fresh": "var(--learn-fresh)",
        "learn-fresh-light": "var(--learn-fresh-light)",
        "learn-progress": "var(--learn-progress)",
        "learn-progress-light": "var(--learn-progress-light)",
        "learn-known": "var(--learn-known)",
        "learn-known-light": "var(--learn-known-light)",
        "learn-mastered": "var(--learn-mastered)",
        "learn-mastered-light": "var(--learn-mastered-light)",
        "learn-review": "var(--learn-review)",
        "learn-review-light": "var(--learn-review-light)",
        "learn-error": "var(--learn-error)",
        "learn-error-light": "var(--learn-error-light)",

        // ★ v6 — CEFR
        "level-a": "var(--level-a)",
        "level-a-light": "var(--level-a-light)",
        "level-b": "var(--level-b)",
        "level-b-light": "var(--level-b-light)",
        "level-c": "var(--level-c)",
        "level-c-light": "var(--level-c-light)",

        // ★ v6 — 보강
        "bg-strong": "var(--bg-strong)",
        "bd-strong": "var(--bd-strong)",
        t5: "var(--t5)",

        // ─── iOS HIG 시스템 컬러 (v06.36) ───
        // 사용 예: bg-ios-blue, text-ios-red, bg-ios-green-tint
        "ios-red": "var(--ios-red)",
        "ios-orange": "var(--ios-orange)",
        "ios-yellow": "var(--ios-yellow)",
        "ios-green": "var(--ios-green)",
        "ios-mint": "var(--ios-mint)",
        "ios-teal": "var(--ios-teal)",
        "ios-cyan": "var(--ios-cyan)",
        "ios-blue": "var(--ios-blue)",
        "ios-purple": "var(--ios-purple)",
        "ios-pink": "var(--ios-pink)",
        "ios-brown": "var(--ios-brown)",
        "ios-gray-1": "var(--ios-gray-1)",
        "ios-gray-2": "var(--ios-gray-2)",
        "ios-gray-3": "var(--ios-gray-3)",
        "ios-gray-4": "var(--ios-gray-4)",
        "ios-gray-5": "var(--ios-gray-5)",
        "ios-gray-6": "var(--ios-gray-6)",
        "ios-red-tint": "var(--ios-red-tint)",
        "ios-orange-tint": "var(--ios-orange-tint)",
        "ios-yellow-tint": "var(--ios-yellow-tint)",
        "ios-green-tint": "var(--ios-green-tint)",
        "ios-blue-tint": "var(--ios-blue-tint)",
        "ios-purple-tint": "var(--ios-purple-tint)",
        "ios-pink-tint": "var(--ios-pink-tint)",
      },

      // ══════════════════════════════════════════════════════════════════════
      // v07 「주묵 판면」 — **클래스 이름은 그대로, 스택만 바꾼다.**
      //
      // 학습자 표면이 `font-display` 1,193회 · `font-body` 848회 · `font-editorial` 73회 ·
      // `font-english` 268회를 이미 적어 뒀다. 이름을 바꾸면 447파일을 손대야 하고, 손대는
      // 순간 누락이 생긴다. 스택만 갈아 끼우면 **마크업 0줄 수정으로 70 라우트가 다 바뀐다.**
      //
      // ⚠️ 핵심: 한글 글꼴을 스택에 **반드시 넣는다.** 이전 스택은 넷 다 라틴 전용이라
      //    `-apple-system`/`system-ui` 로 떨어졌고, 그게 화면 글자 절반~4분의 3이었다
      //    (실측 근거는 `app/layout.tsx` 머리 주석 · `docs/design/00-inventory.md` §0-2).
      //
      // 글리프 단위 폴백을 이용한다 — 라틴은 앞 글꼴이, 한글은 뒤 한글 글꼴이 그린다.
      // 그래서 `editorial` 은 **영문 Lora + 한글 Hahmlet** 한 줄로 성립한다.
      // ══════════════════════════════════════════════════════════════════════
      fontFamily: {
        // editorial: 제목 · 표제어 · 감성 문장. 영문은 Lora, 한글은 Hahmlet 이 받는다.
        editorial: [
          "var(--font-serif)",
          "var(--font-ko-display)",
          "Lora",
          "Hahmlet",
          "Iowan Old Style",
          "Georgia",
          "serif",
        ],
        // ko-display: 한글만 세리프로 쓰고 싶을 때(제목이 한글로만 끝나는 자리).
        "ko-display": ["var(--font-ko-display)", "Hahmlet", "Georgia", "serif"],
        // display: UI 라벨 · nav · 버튼. IBM Plex Sans KR 한 벌이 한글·라틴을 같이 그린다.
        display: [
          "var(--font-display)",
          "IBM Plex Sans KR",
          "-apple-system",
          "BlinkMacSystemFont",
          "system-ui",
          "sans-serif",
        ],
        // body: 본문. display 와 같은 글꼴 — 역할이 같은 두 벌을 두지 않는다.
        body: [
          "var(--font-body)",
          "IBM Plex Sans KR",
          "-apple-system",
          "BlinkMacSystemFont",
          "system-ui",
          "sans-serif",
        ],
        // english: 영어 원문 전용 — 한글이 섞이면 안 되는 자리(지문·예문)라 Hahmlet 를 넣지 않는다.
        english: ["var(--font-serif)", "Lora", "Iowan Old Style", "Georgia", "serif"],
        serif: ["var(--font-serif)", "var(--font-ko-display)", "Lora", "Hahmlet", "serif"],
        // mono: 숫자·코드. ⚠️ 한글이 모노 폴백으로 떨어지던 것(실측 27노드)을 막으려고
        //       **한글 UI 글꼴을 뒤에 붙인다** — 모노 클래스에 한국어 라벨이 섞여 있어도
        //       자간이 무너지지 않는다.
        mono: [
          "var(--font-mono)",
          "JetBrains Mono",
          "SF Mono",
          "ui-monospace",
          "var(--font-body)",
          "IBM Plex Sans KR",
          "monospace",
        ],
      },

      // ⚠️ **전부 4의 배수다.** `s-2.5`(10px)가 하나 섞여 있었는데,
      //    그 자리가 이 저장소 간격 규율의 유일한 예외였다(2026-08-25 제거 · s-3 으로 대체).
      //    `s-1.5` 는 애초에 없었는데 화면 7곳이 쓰고 있었다 — 정의 없는 클래스라
      //    **여백이 아예 안 나던 자리**였다. 새 값을 더할 때 4의 배수인지 먼저 볼 것.
      spacing: {
        "s-1": "4px",
        "s-2": "8px",
        "s-3": "12px",
        "s-4": "16px",
        "s-5": "20px",
        "s-6": "24px",
        "s-8": "32px",
        "s-10": "40px",
        "s-12": "48px",
        "s-16": "64px",
      },

      transitionDuration: {
        instant: "80ms",
        fast: "150ms",
        normal: "220ms",
        slow: "320ms",
      },

      boxShadow: {
        xs: "0 1px 2px rgba(15,23,42,.04)",
        sm: "0 1px 3px rgba(15,23,42,.08), 0 1px 2px rgba(15,23,42,.04)",
        md: "0 4px 8px -2px rgba(15,23,42,.10), 0 2px 4px -2px rgba(15,23,42,.06)",
        lg: "0 12px 16px -4px rgba(15,23,42,.10), 0 4px 6px -2px rgba(15,23,42,.05)",
        xl: "0 20px 25px -5px rgba(15,23,42,.10), 0 10px 10px -5px rgba(15,23,42,.04)",

        // ─── iOS HIG shadows (v06.36+) ───
        "ios-1": "var(--sh-ios-1)",
        "ios-2": "var(--sh-ios-2)",
        "ios-3": "var(--sh-ios-3)",
        "ios-4": "var(--sh-ios-4)",
        "ios-button": "var(--sh-ios-button)",
        "ios-glow-tint": "var(--sh-ios-glow-tint)",     // brand tint glow (Indigo)
        "ios-glow-blue": "var(--sh-ios-glow-blue)",     // iOS Blue (info)
        "ios-glow-green": "var(--sh-ios-glow-green)",
        "ios-glow-red": "var(--sh-ios-glow-red)",
        "ios-glow-orange": "var(--sh-ios-glow-orange)",
      },

      borderRadius: {
        // ─── v07 「주묵 판면」 — Tailwind 기본 반경도 토큰 램프로 끌어온다 ───
        //  ⚠️ 실측 2026-09-16: 토큰(`--r-*`)을 2~8px 로 내렸는데도 화면에 **12px 이 남아 있었다**.
        //     원인은 소스가 토큰을 안 쓰고 Tailwind 기본 클래스를 쓰는 자리였다 —
        //     `rounded-xl` 35회 · `rounded-lg` 30회 · `rounded-md` 54회(학습자+공개 표면).
        //     토큰만 고치면 **고친 만큼만 바뀌고**, 안 쓰는 곳은 조용히 옛 값으로 남는다.
        //     그래서 기본 스케일 자체를 같은 램프로 재정의한다(클래스 이름은 그대로).
        //  `rounded-full` 은 건드리지 않는다 — 원형이 의미인 자리(아바타·칩)가 231곳이다.
        sm: "var(--r-sm)",    // 2px
        DEFAULT: "var(--r-sm)",
        md: "var(--r-md)",    // 3px
        lg: "var(--r-lg)",    // 4px
        xl: "var(--r-xl)",    // 5px
        "2xl": "var(--r-2xl)", // 6px
        "3xl": "var(--r-ios-3xl)", // 8px
        // ─── iOS HIG radius (v06.36) ───
        "ios-xs": "var(--r-ios-xs)",
        "ios-sm": "var(--r-ios-sm)",
        "ios-md": "var(--r-ios-md)",
        "ios-lg": "var(--r-ios-lg)",
        "ios-xl": "var(--r-ios-xl)",
        "ios-2xl": "var(--r-ios-2xl)",
        "ios-3xl": "var(--r-ios-3xl)",
        "ios-modal": "var(--r-ios-modal)",
        "ios-pill": "var(--r-ios-pill)",
      },

      transitionTimingFunction: {
        "ios-standard": "var(--ease-ios-standard)",
        "ios-emphasized": "var(--ease-ios-emphasized)",
        "ios-spring": "var(--ease-ios-spring)",
        "ios-spring-bouncy": "var(--ease-ios-spring-bouncy)",
      },

      keyframes: {
        "soft-pulse": {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.05)" },
        },
        "pulse-dot": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.4" },
        },
        "audio-glow": {
          "0%, 100%": { boxShadow: "0 4px 14px rgba(59,130,246,0.3)" },
          "50%": {
            boxShadow:
              "0 4px 14px rgba(59,130,246,0.3), 0 0 0 10px rgba(59,130,246,0.1)",
          },
        },
        "mic-glow": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(239,68,68,0.4)" },
          "50%": { boxShadow: "0 0 0 14px rgba(239,68,68,0)" },
        },
        expandDown: {
          from: { opacity: "0", maxHeight: "0", transform: "translateY(-4px)" },
          to: {
            opacity: "1",
            maxHeight: "300px",
            transform: "translateY(0)",
          },
        },
        revealIn: {
          from: { opacity: "0", transform: "translateY(-8px) scale(0.98)" },
          to: { opacity: "1", transform: "translateY(0) scale(1)" },
        },
      },
    },
  },
  plugins: [],
  darkMode: ["selector", '[data-theme="dark"]'],
};

export default config;
