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
        accent: "var(--accent)",
        "accent-hover": "var(--accent-hover)",
        "accent-light": "var(--accent-light)",

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
      },

      fontFamily: {
        display: ["var(--font-display)", "Plus Jakarta Sans", "sans-serif"],
        body: ["var(--font-body)", "DM Sans", "sans-serif"],
        // CLAUDE.md §Typography — 영어 원문 전용 alias는 `english`
        english: ["var(--font-serif)", "Lora", "serif"],
        // 레거시 alias (font-serif → 동일 Lora 폰트로 매핑)
        serif: ["var(--font-serif)", "Lora", "serif"],
        mono: ["var(--font-mono)", "JetBrains Mono", "monospace"],
      },

      spacing: {
        "s-1": "4px",
        "s-2": "8px",
        "s-2.5": "10px",
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
