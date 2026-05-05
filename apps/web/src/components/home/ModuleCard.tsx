// apps/web/src/components/home/ModuleCard.tsx
//
// Hub 의 7개 학습 모듈 정사각 카드 — Phase 3-3 Supabase 연동.
//   - moduleId : useHubData().modules[i].id 직접 주입
//   - lastStudiedAt : ISO 문자열 또는 null

'use client'

import { memo } from 'react'

import {
  BookOpen,
  HelpCircle,
  Layers,
  Library,
  Shuffle,
  Type,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import Link from 'next/link'

import { formatRelativeTime } from '@/lib/utils/relative-time'

import type { ModuleId } from '@/hooks/useHubData'

// Hub 에 노출되는 7개 모듈 (HUB_MODULE_IDS 와 정합)
type HubModuleId = Extract<
  ModuleId,
  'textviewer' | 'wordvault' | 'flashcard' | 'spellforge' | 'wordblitz' | 'pairflip' | 'scriptquiz'
>

interface ModuleMeta {
  Icon: LucideIcon
  label: string
  href: string
  color: string
}

const MODULE_META: Record<HubModuleId, ModuleMeta> = {
  textviewer: { Icon: BookOpen, label: '스크립트', href: '/text', color: 'var(--p)' },
  wordvault: { Icon: Library, label: '단어장', href: '/wordvault', color: 'var(--p-dark)' },
  flashcard: { Icon: Layers, label: '플래시카드', href: '/flashcard', color: '#F59E0B' },
  spellforge: { Icon: Type, label: 'SpellForge', href: '/spellforge', color: '#4A9FCF' },
  wordblitz: { Icon: Zap, label: 'WordBlitz', href: '/wordblitz', color: '#22C55E' },
  pairflip: { Icon: Shuffle, label: 'PairFlip', href: '/pairflip', color: '#8B5CF6' },
  scriptquiz: { Icon: HelpCircle, label: 'ScriptQuiz', href: '/scriptquiz', color: 'var(--active)' },
}

interface ModuleCardProps {
  moduleId: HubModuleId
  lastStudiedAt: string | null
}

function ModuleCardImpl({ moduleId, lastStudiedAt }: ModuleCardProps) {
  const meta = MODULE_META[moduleId]
  if (!meta) return null
  const { Icon, label, href, color } = meta

  const subline = lastStudiedAt ? formatRelativeTime(lastStudiedAt) : '아직 학습 전'

  return (
    <Link
      href={href}
      aria-label={`${label} — ${lastStudiedAt ? `마지막 학습 ${subline}` : '아직 학습 전'}`}
      className="group relative flex aspect-square min-h-[110px] flex-col items-center justify-center gap-2 overflow-hidden rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] shadow-[var(--sh-sm)] transition-all duration-[var(--dur-normal)] ease-[var(--ease)] hover:-translate-y-0.5 hover:shadow-[var(--sh-md)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2 active:scale-[0.97]"
    >
      <Icon
        size={28}
        strokeWidth={1.75}
        className="text-[var(--t2)] transition-colors duration-[var(--dur-normal)] group-hover:[color:var(--module-color)]"
        style={{ ['--module-color' as string]: color }}
        aria-hidden="true"
      />

      <span className="font-display text-[13px] font-[600] text-[var(--t1)]">{label}</span>

      <span
        className={`font-body text-[11px] ${lastStudiedAt ? 'text-[var(--t3)]' : 'text-[var(--t4)]'}`}
      >
        {subline}
      </span>

      {/* hover 하단 컬러 바 */}
      <span
        className="absolute bottom-0 left-0 right-0 h-[3px] opacity-0 transition-opacity duration-[var(--dur-normal)] group-hover:opacity-100"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
    </Link>
  )
}

export const ModuleCard = memo(ModuleCardImpl)
