// apps/web/src/components/library/PosBadge.tsx
// 품사(part-of-speech) 배지 — 아이콘 + 짧은 라벨. 사전 툴팁/단어장 공용.
// pos 원본은 shared_dictionary.pos (noun/adjective/verb/adverb/idiom/phrasal_verb …).

import {
  Box,
  Combine,
  Gauge,
  Hash,
  Link,
  Link2,
  MessageCircle,
  Palette,
  Quote,
  Tag,
  Type,
  User,
  Zap,
  type LucideIcon,
} from 'lucide-react'

interface PosMeta {
  Icon: LucideIcon
  label: string
  /** 아이콘 색 — 품사군 빠른 스캔용 (배지 배경은 중립 유지, Calm UI) */
  color: string
}

function posMeta(pos: string): PosMeta {
  const p = pos
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '_')
    .replace(/\.$/, '')
  switch (p) {
    case 'noun':
      return { Icon: Box, label: 'n.', color: 'var(--learn-fresh)' }
    case 'verb':
      return { Icon: Zap, label: 'v.', color: 'var(--memory-shaky)' }
    case 'adjective':
    case 'adj':
      return { Icon: Palette, label: 'adj.', color: 'var(--memory-stable)' }
    case 'adverb':
    case 'adv':
      return { Icon: Gauge, label: 'adv.', color: 'var(--learn-progress)' }
    case 'pronoun':
      return { Icon: User, label: 'pron.', color: 'var(--p)' }
    case 'preposition':
      return { Icon: Link2, label: 'prep.', color: 'var(--memory-new)' }
    case 'conjunction':
      return { Icon: Link, label: 'conj.', color: 'var(--memory-new)' }
    case 'determiner':
    case 'article':
      return { Icon: Hash, label: 'det.', color: 'var(--memory-new)' }
    case 'interjection':
      return { Icon: MessageCircle, label: 'interj.', color: 'var(--accent-plum)' }
    case 'idiom':
      return { Icon: Quote, label: '관용구', color: 'var(--p)' }
    case 'phrasal_verb':
      return { Icon: Combine, label: '구동사', color: 'var(--memory-shaky)' }
    case 'abbreviation':
      return { Icon: Type, label: '약어', color: 'var(--memory-new)' }
    case 'numeral':
      return { Icon: Hash, label: '수사', color: 'var(--memory-new)' }
    case 'auxiliary':
      return { Icon: Zap, label: '조동사', color: 'var(--memory-shaky)' }
    case 'prefix':
      return { Icon: Type, label: '접두', color: 'var(--memory-new)' }
    default:
      return { Icon: Tag, label: pos, color: 'var(--memory-new)' }
  }
}

export function PosBadge({
  pos,
  className = '',
}: {
  pos: string | null | undefined
  className?: string
}) {
  if (!pos || pos.trim().length === 0) return null
  const { Icon, label, color } = posMeta(pos)
  return (
    <span
      title={`품사: ${pos}`}
      className={`inline-flex items-center gap-1 rounded-[var(--r-sm)] bg-[var(--bg3)] px-2 py-1 font-body text-[10px] font-[600] text-[var(--t2)] ${className}`}
    >
      <Icon size={10} strokeWidth={2.25} aria-hidden style={{ color }} />
      {label}
    </span>
  )
}
