// apps/web/src/components/hub/ModuleHero.tsx
// 모듈 hub 공통 헤로 — Minimal (v06.30)
//
// 2026-09-19 (DD-34 · docs/design/compare/module-hubs.md): 면(그라디언트 · 테두리 상자)을 걷고 **판면 머리**로 —
//   두꺼운 괘선 아래 제목. 제목이 15px 였다(h1 인데 본문보다 작았다) → 26/32px 편집 서체.
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
  // 2026-09-19 (DD-34) — 면을 칠하지 않는다. `gradient` · `quiet` 는 호출부 호환을 위해 받기만 한다.
  //   dictate(하늘→파랑) · pairflip 이 쓰던 그라디언트 띠가 판면 밖 SaaS 색으로 첫 화면의 주인이 됐다(감사 평균).
  icon: Icon,
  stats,
  primaryAction,
  bottomSlot,
}: ModuleHeroProps) {
  const subText = note ?? tagline ?? null

  return (
    // 판면 머리 — 다른 골든(`/practice` · `/reports` · `/dashboard`)과 같은 두꺼운 괘선 아래 제목
    <section aria-label={title} data-module-hero="" className="border-b-2 border-[var(--t1)] pb-3 text-[var(--t1)]">
      <p className="m-0 flex items-center gap-1.5 font-display text-[12px] font-[600] text-[var(--t2)]">
        {Icon && <Icon size={13} aria-hidden strokeWidth={2.25} className="shrink-0" />}
        {eyebrow}
      </p>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <h1 className="font-editorial text-[26px] font-[500] leading-[1.15] tracking-[-0.012em] md:text-[32px]">
          {title}
        </h1>
        {primaryAction && <div className="shrink-0">{primaryAction}</div>}
      </div>
      {subText && (
        <p className="m-0 mt-1 max-w-[62ch] font-body text-[13px] leading-[1.6] text-[var(--t2)] [word-break:keep-all]">
          {subText}
        </p>
      )}

      {bottomSlot && <div className="mt-2">{bottomSlot}</div>}

      {/* Stats — 인라인 한 줄. 라벨과 값이 붙어 읽힌다 */}
      {stats && stats.length > 0 && (
        <ul className="m-0 mt-2 flex list-none flex-wrap gap-x-4 gap-y-1 p-0" aria-label="hub stats">
          {stats.map((s, i) => (
            // data-hero-stat — 라벨을 **선언**으로 노출한다. 이게 없으면 테스트가 화면 산문에서
            // 숫자를 긁어야 하는데, 실제로 그렇게 했다가 SpellForge 히어로 설명문의 숫자를 통계값으로 잘못 읽었다.
            <li
              key={i}
              data-hero-stat={s.label}
              className="inline-flex items-baseline gap-1 font-display tabular-nums leading-tight"
            >
              <span className={`text-[11px] font-[700] ${s.emphasis ? 'text-[var(--t1)]' : 'text-[var(--t2)]'}`}>
                {s.label}
              </span>
              <span className={s.emphasis ? 'text-[15px] font-[800]' : 'text-[13px] font-[700]'}>
                {s.value}
                {s.unit && <span className="ml-0.5 text-[10px] font-[600] text-[var(--t2)]">{s.unit}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
