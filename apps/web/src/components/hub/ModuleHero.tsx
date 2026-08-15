// apps/web/src/components/hub/ModuleHero.tsx
// 모듈 hub 공통 헤로 — Minimal (v06.30)
//
// v06.30 슬림화 — 9개 hub 페이지 상단 영역이 너무 무겁다는 사용자 피드백 반영.
// 이전 (v06.27 Editorial premium) 의 6개 장식 layer (conic accent · soft orbs · ghost icon
// · grain · iridescent border · aurora edge) 와 거대한 폰트 (24-32px title) / padding
// (py-6 md:py-7) / bento stats grid 를 모두 제거 — 최소 표현으로 회귀.
//
// 목표:
//   · py-3 md:py-4 (이전 py-6 md:py-7) 약 50% 축소
//   · title 16-18px (이전 24-32px) 약 40% 축소
//   · stats: 인라인 가로 pill row (이전 bento 그리드)
//   · 단일 그라디언트만, 장식 layer 0
//
// API 100% 호환 — 9 hub 페이지 caller 변경 없음.

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
  /**
   * `quiet` — 그라디언트를 쓰지 않고 테마 지면(`--bg`)에 하네선으로만 앉는다.
   *
   * 왜 필요했나(2026-08-15 실측): PRACTICE 그룹 4화면이 각자 다른 고채도 그라디언트를
   * 갖고 있었다(핑크·파랑·초록·남색). 사이드바 한 묶음인데 **네 개의 다른 브랜드가 동시에
   * 소리쳤다.** 18% 화이트 오버레이로 톤다운해도 "서로 다른 네 개" 라는 사실은 안 바뀐다.
   * 연습 화면은 학습 직전의 대기실이라 자극이 아니라 준비가 필요하다.
   *
   * ⚠️ 조용한 대안으로 `--p-dark` 같은 잉크 면을 쓰지 않는다 — 그 토큰은 다크 테마에서
   * 밝은 파랑으로 뒤집혀 대비가 무너진다(같은 함정을 이미 한 번 밟았다). 테마와 무관하게
   * 어두운 표면 토큰이 없으므로, 조용한 변형은 **면을 칠하지 않는 쪽**으로 간다.
   */
  quiet?: boolean
  icon?: LucideIcon
  stats?: HeroStat[]
  primaryAction?: ReactNode
  bottomSlot?: ReactNode
}

export function ModuleHero({
  eyebrow,
  title,
  note,
  tagline,
  gradient,
  quiet = false,
  icon: Icon,
  stats,
  primaryAction,
  bottomSlot,
}: ModuleHeroProps) {
  const subText = note ?? tagline ?? null

  return (
    <header
      className={
        quiet
          ? 'relative overflow-hidden rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-4 py-3 text-[var(--t1)] md:px-5 md:py-3.5'
          : 'relative overflow-hidden rounded-[var(--r-md)] px-4 py-3 text-[var(--ti)] shadow-[var(--sh-xs)] md:px-5 md:py-3.5'
      }
      style={
        quiet
          ? undefined
          : {
              // Calm UI — 18% white overlay 로 모든 caller gradient 자동 톤다운
              // (9 hub 공통 패턴 1 곳 변경 = 전 페이지 효과)
              backgroundImage: `linear-gradient(rgba(255,255,255,0.16), rgba(255,255,255,0.16)), linear-gradient(135deg, ${gradient.from} 0%, ${gradient.to} 100%)`,
            }
      }
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {/* Eyebrow + title 한 줄 (좁은 화면에선 wrap) */}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {Icon && (
            <Icon
              size={14}
              aria-hidden
              strokeWidth={2.25}
              className="shrink-0 opacity-80"
            />
          )}
          <span className="font-mono text-[10px] font-[700] uppercase tracking-[0.10em] opacity-80">
            {eyebrow}
          </span>
          <span className="opacity-30" aria-hidden>·</span>
          <h1 className="font-display text-[15px] font-[700] leading-tight md:text-[16px]">
            {title}
          </h1>
          {subText && (
            <>
              <span className="hidden opacity-30 sm:inline" aria-hidden>·</span>
              <p className="hidden truncate font-body text-[12px] opacity-80 sm:block">
                {subText}
              </p>
            </>
          )}
        </div>

        {primaryAction && <div className="shrink-0">{primaryAction}</div>}
      </div>

      {/* 좁은 화면 — subText 줄바꿈 */}
      {subText && (
        <p className="mt-1 truncate font-body text-[11.5px] opacity-80 sm:hidden">
          {subText}
        </p>
      )}

      {bottomSlot && <div className="mt-2">{bottomSlot}</div>}

      {/* Stats — 인라인 가로 pill row */}
      {stats && stats.length > 0 && (
        <ul
          className="mt-2 flex flex-wrap gap-x-3 gap-y-1 border-t border-white/15 pt-2"
          aria-label="hub stats"
        >
          {stats.map((s, i) => (
            // data-hero-stat — 라벨을 **선언**으로 노출한다. 이게 없으면 테스트가 화면 산문에서
            // 숫자를 긁어야 하는데, 실제로 그렇게 했다가 SpellForge 히어로 설명문("이번 세션에서
            // 철자가 흔들리는 단어 17개를 만나요")의 숫자를 통계값으로 잘못 읽었다.
            <li
              key={i}
              data-hero-stat={s.label}
              className="inline-flex items-baseline gap-1 font-display tabular-nums leading-tight"
            >
              {/* 라벨 색은 면에 따라 뒤집힌다.
                  `quiet` 면은 밝은 지면이라 흰 글자를 쓰면 **라벨이 통째로 사라진다** —
                  실제로 그렇게 냈다(2026-08-15 PairFlip: "730점 ×4 1회" 만 남고
                  Best·최고 콤보·게임 이 안 보였다). 값은 상속된 `text-*` 를 쓰므로 무사했고,
                  라벨만 죽어서 **숫자가 무엇의 숫자인지 알 수 없는** 상태가 됐다. */}
              <span
                className={`text-[11px] font-[700] ${
                  quiet
                    ? s.emphasis
                      ? 'text-[var(--t1)]'
                      : 'text-[var(--t2)]'
                    : s.emphasis
                      ? 'text-white'
                      : 'text-white/75'
                }`}
              >
                {s.label}
              </span>
              <span
                className={`${
                  s.emphasis ? 'text-[15px] font-[800]' : 'text-[13px] font-[700]'
                }`}
              >
                {s.value}
                {s.unit && (
                  <span className="ml-0.5 text-[10px] font-[600] opacity-70">
                    {s.unit}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </header>
  )
}
