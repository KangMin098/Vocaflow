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

// 모듈 식별 색 — iOS systemColor 1:1 정합 (DESIGN_SYSTEM.md §iOS 시스템 컬러)
const MODULE_META: Record<HubModuleId, ModuleMeta> = {
  textviewer: { Icon: BookOpen, label: '스크립트', href: '/text', color: 'var(--p)' },           // brand indigo
  wordvault: { Icon: Library, label: '단어장', href: '/wordvault', color: 'var(--ios-purple)' }, // iOS purple
  flashcard: { Icon: Layers, label: '플래시카드', href: '/flashcard', color: 'var(--ios-orange)' }, // iOS orange
  spellforge: { Icon: Type, label: 'SpellForge', href: '/spellforge', color: 'var(--ios-blue)' },  // iOS blue
  wordblitz: { Icon: Zap, label: 'WordBlitz', href: '/wordblitz', color: 'var(--ios-green)' },     // iOS green
  pairflip: { Icon: Shuffle, label: 'PairFlip', href: '/pairflip', color: 'var(--ios-pink)' },     // iOS pink
  scriptquiz: { Icon: HelpCircle, label: 'ScriptQuiz', href: '/scriptquiz', color: 'var(--ios-yellow)' }, // iOS yellow
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
      className="group relative flex aspect-square min-h-[110px] flex-col items-center justify-center gap-2 overflow-hidden rounded-ios-2xl bg-[var(--bg)] shadow-ios-2 motion-safe:transition-all motion-safe:duration-[var(--dur-ios-normal)] motion-safe:ease-ios-emphasized motion-safe:hover:shadow-ios-3 motion-safe:hover:-translate-y-0.5 motion-safe:active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2"
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
        className={`font-body text-[11px] ${lastStudiedAt ? 'text-[var(--t2)]' : 'text-[var(--t2)]'}`}
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
