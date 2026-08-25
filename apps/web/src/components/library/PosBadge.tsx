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
      return { Icon: Box, label: 'n.', color: '#6366F1' }
    case 'verb':
      return { Icon: Zap, label: 'v.', color: '#F59E0B' }
    case 'adjective':
    case 'adj':
      return { Icon: Palette, label: 'adj.', color: '#10B981' }
    case 'adverb':
    case 'adv':
      return { Icon: Gauge, label: 'adv.', color: '#06B6D4' }
    case 'pronoun':
      return { Icon: User, label: 'pron.', color: '#8B5CF6' }
    case 'preposition':
      return { Icon: Link2, label: 'prep.', color: '#64748B' }
    case 'conjunction':
      return { Icon: Link, label: 'conj.', color: '#64748B' }
    case 'determiner':
    case 'article':
      return { Icon: Hash, label: 'det.', color: '#64748B' }
    case 'interjection':
      return { Icon: MessageCircle, label: 'interj.', color: '#EC4899' }
    case 'idiom':
      return { Icon: Quote, label: '관용구', color: '#8B5CF6' }
    case 'phrasal_verb':
      return { Icon: Combine, label: '구동사', color: '#F59E0B' }
    case 'abbreviation':
      return { Icon: Type, label: '약어', color: '#64748B' }
    case 'numeral':
      return { Icon: Hash, label: '수사', color: '#64748B' }
    case 'auxiliary':
      return { Icon: Zap, label: '조동사', color: '#F59E0B' }
    case 'prefix':
      return { Icon: Type, label: '접두', color: '#64748B' }
    default:
      return { Icon: Tag, label: pos, color: '#94A3B8' }
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
