// apps/web/src/components/hub/ModuleHero.tsx
// 모듈 hub 공통 헤로 — Editorial premium (v06.27)
//
// v06.27 — 최고 수준 디자인 사이트 (Linear · Vercel · Stripe · Arc) 패턴 적용:
//   · Conic accent overlay     — Linear-style dimensional shift (low opacity)
//   · Iridescent edge border   — Vercel/Linear signature gradient-mask 1px ring
//   · Oversized ghost icon     — Stripe-style decorative background glyph
//   · Live indicator dot       — Linear "active session" idiom (motion-safe pulse)
//   · Bento asymmetric stats   — emphasis stat 1.4fr / 나머지 1fr (Vercel grid 리듬)
//   · Optical type             — font-feature 'ss01' + 'cv11' + tnum, ultra-tight tracking
//   · Tactile grain            — fractalNoise mask (인쇄물 질감)
//   · Aurora top + bottom edge — premium 시각 마침표
//
// Calm UI 보존: 애니메이션은 live dot ping 만 (prefers-reduced-motion 자동 disable).
// API 호환성: 기존 props 100% 유지.

import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

export interface HeroStat {
  label: string
  value: string | number
  unit?: string
  emphasis?: boolean
}

export interface ModuleHeroProps {
  eyebrow: string
  title: string
  note?: string
  tagline?: string
  gradient: { from: string; to: string }
  icon?: LucideIcon
  stats?: HeroStat[]
  primaryAction?: ReactNode
  bottomSlot?: ReactNode
}

/** Premium grain — fractalNoise mask (인쇄물 질감) */
const NOISE_SVG = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1, 0 0 0 0 1, 0 0 0 0 1, 0 0 0 0.35 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/></svg>`

export function ModuleHero({
  eyebrow,
  title,
  note,
  tagline,
  gradient,
  icon: Icon,
  stats,
  primaryAction,
  bottomSlot,
}: ModuleHeroProps) {
  // Bento grid template — emphasis stat 가 더 넓은 칼럼 (Vercel/Linear 리듬)
  const gridTemplate =
    stats && stats.length > 0
      ? stats
          .map((s) => (s.emphasis ? '1.4fr' : '1fr'))
          .join(' ')
      : undefined

  return (
    <header
      className="group/hero relative isolate overflow-hidden rounded-[var(--r-xl)] shadow-[var(--sh-md)]"
      style={{
        backgroundImage: `linear-gradient(135deg, ${gradient.from} 0%, ${gradient.to} 100%)`,
      }}
    >
      {/* ── Layer 1 · Conic accent — Linear-style dimensional shift ── */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.18] mix-blend-soft-light"
        style={{
          background:
            'conic-gradient(from 220deg at 80% 20%, rgba(255,255,255,0.9), transparent 35%, rgba(255,255,255,0.25) 60%, transparent 90%)',
        }}
      />

      {/* ── Layer 2 · Soft mesh orbs (warm + cool) ── */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full opacity-[0.22] blur-3xl"
        style={{ background: 'radial-gradient(circle, #FFFFFF 0%, transparent 70%)' }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 -left-10 h-48 w-48 rounded-full opacity-[0.14] blur-3xl"
        style={{ background: 'radial-gradient(circle, #FFFFFF 0%, transparent 70%)' }}
      />

      {/* ── Layer 3 · Oversized ghost icon — Stripe-style decorative glyph ── */}
      {Icon && (
        <Icon
          aria-hidden
          size={220}
          strokeWidth={1}
          className="pointer-events-none absolute -right-8 -top-10 text-white opacity-[0.06]"
          style={{ transform: 'rotate(-12deg)' }}
        />
      )}

      {/* ── Layer 4 · Tactile grain ── */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.08] mix-blend-overlay"
        style={{ backgroundImage: `url("${NOISE_SVG}")`, backgroundSize: '180px 180px' }}
      />

      {/* ── Layer 5 · Iridescent gradient-mask border — Vercel/Linear signature ── */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[var(--r-xl)] p-px"
        style={{
          background:
            'linear-gradient(135deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.08) 30%, rgba(255,255,255,0.02) 60%, rgba(255,255,255,0.25) 100%)',
          WebkitMask:
            'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
          WebkitMaskComposite: 'xor',
          mask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
          maskComposite: 'exclude',
        }}
      />

      {/* ── Layer 6 · Top sheen hairline ── */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/45 to-transparent"
      />

      {/* ── Content ── */}
      <div
        className="relative px-5 py-6 text-[var(--ti)] md:px-8 md:py-7"
        style={{ fontFeatureSettings: '"ss01", "cv11", "tnum"' }}
      >
        <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
          {/* 좌: eyebrow + title + note */}
          <div className="min-w-0 flex-1">
            {/* Eyebrow chip — live dot + icon + label */}
            <span className="inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1 font-mono text-[10px] font-[700] uppercase tracking-[0.14em] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.20)] backdrop-blur-md">
              {/* Live dot — Linear "active session" idiom */}
              <span className="relative inline-flex h-1.5 w-1.5 motion-safe:[&_span]:animate-ping">
                <span className="absolute inline-flex h-full w-full rounded-full bg-white/80 opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.8)]" />
              </span>
              {Icon && (
                <Icon size={11} aria-hidden strokeWidth={2.25} className="opacity-95" />
              )}
              {eyebrow}
            </span>

            <h1
              className="mt-3 font-display text-[24px] font-[700] leading-[1.08] tracking-[-0.025em] md:text-[32px]"
              style={{ textShadow: '0 1px 2px rgba(0,0,0,0.12)' }}
            >
              {title}
            </h1>

            {/* Title hairline accent */}
            <div
              aria-hidden
              className="mt-2.5 h-px w-12 rounded-full bg-gradient-to-r from-white/70 via-white/30 to-transparent"
            />

            {note ? (
              <p className="mt-3 max-w-md font-body text-[13px] leading-snug text-white/90 md:text-[14px]">
                {note}
              </p>
            ) : tagline ? (
              <p className="mt-3 max-w-md font-body text-[12px] leading-snug text-white/75 md:text-[13px]">
                {tagline}
              </p>
            ) : null}
          </div>

          {/* 우: Primary action */}
          {primaryAction && <div className="shrink-0">{primaryAction}</div>}
        </div>

        {/* bottomSlot */}
        {bottomSlot && <div className="mt-4">{bottomSlot}</div>}

        {/* ── Bento stats — asymmetric grid, emphasis = 1.4fr ── */}
        {stats && stats.length > 0 && (
          <ul
            className="mt-5 grid gap-px overflow-hidden rounded-[var(--r-md)] bg-white/10 p-px shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)] backdrop-blur-sm"
            style={{ gridTemplateColumns: gridTemplate }}
          >
            {stats.map((s, i) => (
              <li
                key={i}
                className={`relative px-3.5 py-3 ${
                  s.emphasis
                    ? 'bg-gradient-to-br from-white/[0.14] via-white/[0.06] to-transparent'
                    : 'bg-gradient-to-b from-white/[0.06] to-transparent'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <p className="font-display text-[10px] font-[700] uppercase tracking-[0.10em] text-white/75">
                    {s.label}
                  </p>
                  {s.emphasis && (
                    <span
                      aria-hidden
                      className="inline-block h-1 w-1 rounded-full bg-white/85 shadow-[0_0_4px_rgba(255,255,255,0.8)]"
                    />
                  )}
                </div>
                <p
                  className={`mt-1.5 font-display tabular-nums leading-none text-white ${
                    s.emphasis
                      ? 'text-[26px] font-[800] tracking-[-0.02em] md:text-[30px]'
                      : 'text-[19px] font-[700]'
                  }`}
                >
                  {s.value}
                  {s.unit && (
                    <span
                      className={`ml-1 font-display font-[600] text-white/70 ${
                        s.emphasis ? 'text-[12px]' : 'text-[11px]'
                      }`}
                    >
                      {s.unit}
                    </span>
                  )}
                </p>
                {/* Emphasis accent bar */}
                {s.emphasis && (
                  <span
                    aria-hidden
                    className="absolute bottom-1.5 left-3.5 block h-[2px] w-8 rounded-full bg-gradient-to-r from-white/85 to-white/0"
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Aurora bottom edge ── */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent"
      />
    </header>
  )
}
