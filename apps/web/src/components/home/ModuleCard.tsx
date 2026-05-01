// apps/web/src/components/home/ModuleCard.tsx

import {
  BarChart3,
  BookOpen,
  HelpCircle,
  Layers,
  Library,
  Type,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import Link from 'next/link'

type ModuleKey =
  | 'text'
  | 'wordvault'
  | 'flashcard'
  | 'spellforge'
  | 'wordblitz'
  | 'scriptquiz'
  | 'dashboard'

interface ModuleMeta {
  Icon: LucideIcon
  label: string
  href: string
  color: string
}

const MODULE_META: Record<ModuleKey, ModuleMeta> = {
  text: { Icon: BookOpen, label: '원문', href: '/text', color: 'var(--p)' },
  wordvault: { Icon: Library, label: '단어장', href: '/wordvault', color: 'var(--p-dark)' },
  flashcard: { Icon: Layers, label: '플래시카드', href: '/flashcard', color: '#F59E0B' },
  spellforge: { Icon: Type, label: 'SpellForge', href: '/spellforge', color: '#4A9FCF' },
  wordblitz: { Icon: Zap, label: 'WordBlitz', href: '/wordblitz', color: '#22C55E' },
  scriptquiz: {
    Icon: HelpCircle,
    label: 'ScriptQuiz',
    href: '/scriptquiz',
    color: 'var(--active)',
  },
  dashboard: { Icon: BarChart3, label: '통계', href: '/dashboard', color: 'var(--info)' },
}

interface ModuleCardProps {
  module: ModuleKey
  lastStudiedAt?: Date | null
}

function relativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffMin < 1) return '방금'
  if (diffMin < 60) return `${diffMin}분 전`
  if (diffHour < 24) return `${diffHour}시간 전`
  if (diffDay === 1) return '어제'
  if (diffDay < 7) return `${diffDay}일 전`
  if (diffDay < 30) return `${Math.floor(diffDay / 7)}주 전`
  return `${Math.floor(diffDay / 30)}달 전`
}

export function ModuleCard({ module, lastStudiedAt }: ModuleCardProps) {
  const { Icon, label, href, color } = MODULE_META[module]

  return (
    <Link
      href={href}
      aria-label={`${label} 모듈로 이동`}
      className="group relative flex aspect-square min-h-[110px] flex-col items-center justify-center gap-2 overflow-hidden rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] shadow-[var(--sh-sm)] transition-all duration-[var(--dur-normal)] ease-[var(--ease)] hover:-translate-y-0.5 hover:shadow-[var(--sh-md)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2 active:scale-[0.97]"
    >
      {/* 아이콘 — 모듈 고유 색 */}
      <Icon
        size={28}
        strokeWidth={1.75}
        className="text-[var(--t2)] transition-colors duration-[var(--dur-normal)] group-hover:[color:var(--module-color)]"
        style={{ ['--module-color' as string]: color }}
        aria-hidden="true"
      />

      {/* 라벨 */}
      <span className="font-display text-[13px] font-[600] text-[var(--t1)]">{label}</span>

      {/* 마지막 학습 시간 */}
      {lastStudiedAt && (
        <span className="font-body text-[11px] text-[var(--t3)]">
          {relativeTime(lastStudiedAt)}
        </span>
      )}

      {/* 호버 시 하단 컬러 바 */}
      <span
        className="absolute bottom-0 left-0 right-0 h-[3px] opacity-0 transition-opacity duration-[var(--dur-normal)] group-hover:opacity-100"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
    </Link>
  )
}
