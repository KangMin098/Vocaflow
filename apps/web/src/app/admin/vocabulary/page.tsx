// apps/web/src/app/admin/vocabulary/page.tsx
// 단어장 마스터 — 표준 단어 사전 · CEFR · 예문 · IPA

'use client'

import {
  AlertCircle,
  BookMarked,
  CheckCircle2,
  Database,
  Edit3,
  Headphones,
  Plus,
  Volume2,
} from 'lucide-react'
import { useMemo, useState } from 'react'

import { AdminKpiGrid, type AdminKpi } from '@/components/admin/AdminKpiGrid'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'
import { AdminToolbar } from '@/components/admin/AdminToolbar'

interface MasterWord {
  id: string
  word: string
  pos: string
  cefr: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'
  meaning: string
  example: string
  ipa: string
  ipaVerified: boolean
  ttsCached: boolean
  usageCount: number
  updatedAt: string
}

const KPIS: AdminKpi[] = [
  {
    label: '표준 단어',
    value: '12,847',
    delta: { value: 124, positive: true, suffix: '' },
    icon: Database,
    accent: 'var(--p)',
    bg: 'var(--p-light)',
  },
  {
    label: 'IPA 검증',
    value: '94%',
    delta: { value: 2, positive: true },
    icon: CheckCircle2,
    accent: 'var(--success)',
    bg: 'var(--success-light)',
    hint: '12,074 / 12,847',
  },
  {
    label: 'TTS 캐시',
    value: '8,420',
    delta: { value: 6, positive: true },
    icon: Volume2,
    accent: 'var(--info)',
    bg: 'var(--info-light)',
  },
  {
    label: '검토 필요',
    value: '23',
    delta: { value: 8, positive: false },
    icon: AlertCircle,
    accent: 'var(--error)',
    bg: 'var(--error-light)',
    hint: 'IPA 누락 또는 충돌',
  },
]

const WORDS: MasterWord[] = [
  {
    id: 'w-001',
    word: 'advantages',
    pos: 'Noun · Plural',
    cefr: 'B1',
    meaning: '유리한 점, 이점',
    example: 'The advantages of online learning are clear.',
    ipa: '/ədˈvæntɪdʒɪz/',
    ipaVerified: true,
    ttsCached: true,
    usageCount: 412,
    updatedAt: '2025-12-01',
  },
  {
    id: 'w-002',
    word: 'criticizing',
    pos: 'Verb · Gerund',
    cefr: 'B2',
    meaning: '비판하는',
    example: 'She avoided criticizing his work openly.',
    ipa: '/ˈkrɪtɪˌsaɪzɪŋ/',
    ipaVerified: true,
    ttsCached: true,
    usageCount: 287,
    updatedAt: '2025-12-04',
  },
  {
    id: 'w-003',
    word: 'communicative',
    pos: 'Adjective',
    cefr: 'B2',
    meaning: '의사 소통의, 말하기 좋아하는',
    example: 'A communicative leader builds trust.',
    ipa: '/kəˈmjuːnɪkətɪv/',
    ipaVerified: true,
    ttsCached: false,
    usageCount: 198,
    updatedAt: '2025-11-28',
  },
  {
    id: 'w-004',
    word: 'unmistakable',
    pos: 'Adjective',
    cefr: 'C1',
    meaning: '틀림없는, 확실한',
    example: 'There was an unmistakable smell of rain.',
    ipa: '/ˌʌnmɪˈsteɪkəbəl/',
    ipaVerified: false,
    ttsCached: false,
    usageCount: 84,
    updatedAt: '2026-01-12',
  },
  {
    id: 'w-005',
    word: 'reserved',
    pos: 'Adjective',
    cefr: 'B1',
    meaning: '내성적인, 신중한',
    example: 'He was reserved but kind.',
    ipa: '/rɪˈzɜːrvd/',
    ipaVerified: true,
    ttsCached: true,
    usageCount: 372,
    updatedAt: '2025-09-12',
  },
  {
    id: 'w-006',
    word: 'inclined',
    pos: 'Adjective',
    cefr: 'B2',
    meaning: '~하는 경향이 있는',
    example: 'I am inclined to agree with you.',
    ipa: '/ɪnˈklaɪnd/',
    ipaVerified: true,
    ttsCached: true,
    usageCount: 245,
    updatedAt: '2025-10-05',
  },
]

const CEFR_COLOR: Record<MasterWord['cefr'], string> = {
  A1: '#22C55E',
  A2: '#10B981',
  B1: '#06B6D4',
  B2: '#3B82F6',
  C1: '#8B5CF6',
  C2: '#EC4899',
}

export default function AdminVocabularyPage() {
  const [query, setQuery] = useState('')
  const [activeChip, setActiveChip] = useState<'all' | 'unverified' | 'no-tts' | 'high-usage'>(
    'all'
  )

  const filtered = useMemo(() => {
    return WORDS.filter((w) => {
      if (query) {
        const q = query.toLowerCase()
        if (!w.word.toLowerCase().includes(q) && !w.meaning.toLowerCase().includes(q))
          return false
      }
      if (activeChip === 'unverified' && w.ipaVerified) return false
      if (activeChip === 'no-tts' && w.ttsCached) return false
      if (activeChip === 'high-usage' && w.usageCount < 200) return false
      return true
    })
  }, [query, activeChip])

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 md:px-8">
      <AdminPageHeader
        icon={BookMarked}
        title="단어장 마스터"
        description="표준 단어 DB · CEFR · IPA · TTS 캐시"
        actions={
          <button className="inline-flex items-center gap-1.5 rounded-[var(--r-md)] bg-[#8B5CF6] px-3 py-2 font-display text-[12px] font-[600] text-white shadow-[var(--sh-sm)] hover:bg-[#7C3AED]">
            <Plus size={14} aria-hidden />
            단어 추가
          </button>
        }
      />

      <AdminKpiGrid kpis={KPIS} />

      <AdminToolbar
        searchPlaceholder="영어 단어·뜻 검색"
        searchValue={query}
        onSearchChange={setQuery}
        chips={[
          {
            label: '전체',
            active: activeChip === 'all',
            count: WORDS.length,
            onClick: () => setActiveChip('all'),
          },
          {
            label: 'IPA 미검증',
            active: activeChip === 'unverified',
            count: WORDS.filter((w) => !w.ipaVerified).length,
            onClick: () => setActiveChip('unverified'),
          },
          {
            label: 'TTS 미생성',
            active: activeChip === 'no-tts',
            count: WORDS.filter((w) => !w.ttsCached).length,
            onClick: () => setActiveChip('no-tts'),
          },
          {
            label: '많이 쓰임',
            active: activeChip === 'high-usage',
            count: WORDS.filter((w) => w.usageCount >= 200).length,
            onClick: () => setActiveChip('high-usage'),
          },
        ]}
      />

      <div className="overflow-hidden rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] shadow-[var(--sh-sm)]">
        <table className="w-full">
          <thead className="bg-[var(--bg2)]">
            <tr>
              {['단어 · 품사', 'CEFR', '뜻 · 예문', 'IPA', 'TTS', '사용', ''].map((h, i) => (
                <th
                  key={i}
                  className="px-4 py-3 text-left font-display text-[10px] font-[700] uppercase tracking-[0.06em] text-[var(--t3)]"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--bd)]">
            {filtered.map((w) => (
              <tr key={w.id} className="transition-colors hover:bg-[var(--bg2)]/50">
                <td className="px-4 py-3">
                  <p className="font-english text-[15px] font-[700] text-[var(--t1)]">{w.word}</p>
                  <p className="mt-0.5 font-mono text-[10px] text-[var(--t3)]">{w.pos}</p>
                </td>
                <td className="px-4 py-3">
                  <span
                    className="inline-flex rounded-[var(--r-sm)] px-1.5 py-0.5 font-mono text-[10px] font-[700]"
                    style={{
                      backgroundColor: `${CEFR_COLOR[w.cefr]}15`,
                      color: CEFR_COLOR[w.cefr],
                    }}
                  >
                    {w.cefr}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <p className="font-body text-[13px] font-[500] text-[var(--t1)]">{w.meaning}</p>
                  <p className="mt-1 max-w-md truncate font-english text-[11px] italic text-[var(--t3)]">
                    {w.example}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <code className="font-mono text-[11px] text-[var(--t2)]">{w.ipa}</code>
                    {w.ipaVerified ? (
                      <CheckCircle2
                        size={12}
                        className="text-[var(--success)]"
                        aria-label="검증됨"
                      />
                    ) : (
                      <AlertCircle
                        size={12}
                        className="text-[var(--error)]"
                        aria-label="미검증"
                      />
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  {w.ttsCached ? (
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--info-light)] text-[var(--info)]">
                      <Headphones size={11} aria-hidden />
                    </span>
                  ) : (
                    <span className="font-mono text-[10px] text-[var(--t3)]">—</span>
                  )}
                </td>
                <td className="px-4 py-3 font-mono text-[12px] tabular-nums text-[var(--t1)]">
                  {w.usageCount.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--r-sm)] text-[var(--t3)] hover:bg-[var(--bg3)] hover:text-[var(--t1)]"
                    aria-label="수정"
                  >
                    <Edit3 size={13} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--bg3)] text-[var(--t3)]">
              <Database size={18} aria-hidden />
            </span>
            <p className="font-body text-[13px] text-[var(--t2)]">조건에 맞는 단어가 없어요.</p>
          </div>
        )}
      </div>
    </div>
  )
}
