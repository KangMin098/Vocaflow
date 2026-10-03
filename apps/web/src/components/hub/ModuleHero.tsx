// apps/web/src/components/hub/ModuleHero.tsx
// Tines 하위 화면의 eyebrow → 큰 제목 → 설명 → 행동 → 실측 메타 순서.
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import Image from 'next/image'
import { LearningPathArt } from '@/components/ui/LearningPathArt'

const HERO_ART: Record<string, { spot: string; tone: string }> = {
  Dictation: { spot: 'spot-listening', tone: 'teal' },
  Flashcard: { spot: 'spot-flashcard', tone: 'lavender' },
  SpellForge: { spot: 'spot-spellforge', tone: 'peach' },
  PairFlip: { spot: 'spot-pairflip', tone: 'green' },
  'My Library': { spot: 'spot-reading', tone: 'lavender' },
}

/**
 * 참조 /solutions 히어로 — PC 에서 가운데 정렬 + 양옆에 떠 있는 판 삽화 한 쌍(구역마다 한 쌍).
 * 받아쓰기는 University 히어로(tines.css)를 이미 쓰므로 여기 없다. 모바일은 기존 골격 그대로(스킨이 PC 에서만 켠다).
 */
const FLANKS: Record<string, [string, string]> = {
  Flashcard: ['practice-iso-left', 'practice-iso-right'],
  SpellForge: ['practice-iso-left', 'practice-iso-right'],
  PairFlip: ['practice-iso-right', 'practice-iso-left'],
  'My Library': ['hero-iso-left', 'hero-iso-right'],
}

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
  /** 기존 호출부 호환용. 화면별 브랜드 그라데이션은 사용하지 않는다. */
  gradient: { from: string; to: string }
  quiet?: boolean
  icon?: LucideIcon
  stats?: HeroStat[]
  primaryAction?: ReactNode
  bottomSlot?: ReactNode
}

export function ModuleHero({ eyebrow, title, note, tagline, quiet = false, icon: Icon, stats, primaryAction, bottomSlot }: ModuleHeroProps) {
  const subText = note ?? tagline
  const moduleKey = HERO_ART[title] ? title : Object.keys(HERO_ART).find(key => eyebrow.startsWith(key))
  const art = moduleKey ? HERO_ART[moduleKey] : undefined
  const flanks = moduleKey ? FLANKS[moduleKey] : undefined
  return (
    <section aria-label={title} data-module-hero={moduleKey ?? title} className={`tines-module-hero ${flanks ? 'tines-solutions-hero' : ''} ${eyebrow.startsWith('Dictation') ? 'tines-university-hero' : ''} ${quiet && !art ? 'bg-[var(--bg2)]' : `tone-${art?.tone ?? 'lavender'} dots`} relative overflow-hidden rounded-[var(--r-2xl)] border border-[var(--bd)] p-5 text-[var(--t1)] sm:p-8`}>
      {flanks && (
        <div aria-hidden className="tines-hero-flanks">
          <Image src={`/illustrations/tines/${flanks[0]}.webp`} alt="" width={1328} height={1328} sizes="280px" className="select-none" />
          <Image src={`/illustrations/tines/${flanks[1]}.webp`} alt="" width={1328} height={1328} sizes="260px" className="select-none" />
        </div>
      )}
      {moduleKey === 'Flashcard' && <LearningPathArt variant="cards" className="module-path-art hidden md:block" />}
      <div className="relative flex flex-wrap items-start gap-5">
        {Icon && <span aria-hidden className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--r-lg)] border border-current bg-[var(--bg)]"><Icon size={24} strokeWidth={1.5} /></span>}
        <div className="min-w-0 flex-1">
          <p className="break-keep font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--t2)]">{eyebrow}</p>
          <h1 className="mt-3 break-keep font-display text-[30px] font-[600] leading-[1.08] tracking-[-0.02em] sm:text-[40px]">{title}</h1>
          {subText && <p className="mt-4 max-w-[620px] break-keep font-body text-[14px] leading-relaxed text-[var(--t2)]">{subText}</p>}
        </div>
        {art && <Image src={`/illustrations/tines/${art.spot}.webp`} alt="" width={160} height={160} className="hidden h-24 w-24 shrink-0 select-none sm:block" />}
        {primaryAction && <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">{primaryAction}</div>}
      </div>
      {bottomSlot && <div className="relative mt-5">{bottomSlot}</div>}
      {stats && stats.length > 0 && (
        <ul className="relative mt-6 flex flex-wrap gap-x-6 gap-y-4 border-t border-[var(--bd)] pt-5" aria-label="hub stats">
          {stats.map((stat) => (
            <li key={stat.label} data-hero-stat={stat.label} className="flex min-w-0 flex-col gap-1 font-display tabular-nums">
              <span className="break-keep text-[12px] font-[500] text-[var(--t2)]">{stat.label}</span>
              <span className={`${stat.emphasis ? 'text-[26px]' : 'text-[22px]'} font-[600] leading-tight`}>{stat.value}{stat.unit && <span className="ml-1 text-[12px] font-[500]">{stat.unit}</span>}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
