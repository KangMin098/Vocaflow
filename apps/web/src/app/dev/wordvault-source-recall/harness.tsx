// apps/web/src/app/dev/wordvault-source-recall/harness.tsx
// 합성 자료 — 개인 데이터 아님 · 기록 없음. 글 A(2) · 글 B(1) · 세트 A(origin 1 + 다른 세트에서 먼저 가진 정본 낱말 1) · 세트 B(2).
'use client'

import { useEffect } from 'react'
import { consumeSessionEscape } from '@/components/layout/session-escape'
import { WordVaultBrowseClient } from '@/components/wordvault/WordVaultBrowseClient'
import { WordVaultStudyClient } from '@/components/wordvault/WordVaultStudyClient'
import type { BrowseWord } from '@/lib/wordvault/browse-queries'
import type { SetMembership } from '@/lib/wordvault/source-filter'
import { applyConditionsThenCap, conditionParts, parseStudyFilter, scopeSourceStudyWords, sourceStudyReturnHref } from '@/lib/wordvault/source-study'
import { filterByMemoryState, stateFilterLabel, toStateFilterValue } from '@/lib/wordvault/state-filter'

const TA = '00000000-0000-4000-8000-0000000000a1'
const TB = '00000000-0000-4000-8000-0000000000b1'
const SA = '00000000-0000-4000-8000-00000000000a'
const SB = '00000000-0000-4000-8000-00000000000b'

function word(id: number, w: string, meaning: string, setId: string | null, textId: string | null): BrowseWord {
  return { id, dbId: `harness-${id}`, setId, textId, word: w, pos: 'n.', meaning, exampleEn: '', level: 'B1', levelClass: 'b', mastery: 1, lastDays: 0, nextDays: 0 }
}
const WORDS: BrowseWord[] = [
  word(1, 'canyon', '협곡', null, TB),
  word(2, 'orbit', '궤도', null, TA),
  word(3, 'satellite', '위성', null, TA),
  word(4, 'flooding', '홍수', SA, null),
  word(5, 'harvest', '수확', SB, null),
  word(6, 'drought', '가뭄', SB, null),
]
const MEMBERSHIP: Record<string, string[]> = { [SA]: ['flooding', 'harvest'], [SB]: ['harvest', 'drought'] }

/** 개발 전용 얇은 Esc 호스트 — 실제 SessionFrame 과 같은 디스패처(consumeSessionEscape)만 부른다. 헤더 · 닫기 이동은 흉내 내지 않는다. */
function EscapeKeyHost() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') consumeSessionEscape()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  return null
}

export function WordVaultSourceRecallHarness({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const banner = <div className="border-b border-[var(--bd)] bg-[var(--bg)] px-6 py-3 font-display text-[13px] text-[var(--t2)]">합성 자료 · 개인 데이터 아님 · 기록 없음</div>
  if (searchParams.view === 'study') {
    const host = <EscapeKeyHost />
    const parsed = parseStudyFilter(searchParams.filter, searchParams.q, searchParams.level)
    if (parsed.kind === 'state-scoped' || parsed.kind === 'state') {
      // 서버 scopeStateStudyRows 와 같은 순서(상태 → 검색 · 난이도 → 상한) — 합성 단어는 srs 가 없어 모두 new
      const cond = parsed.kind === 'state-scoped' ? parsed : { query: '', level: null }
      const r = applyConditionsThenCap(filterByMemoryState(WORDS, parsed.key), cond, 50)
      return (<>{banner}{host}<WordVaultStudyClient words={r.words} backHref={sourceStudyReturnHref(searchParams.from, toStateFilterValue(parsed.key))} source={{ total: r.total, conditions: [`지금 기준 ${stateFilterLabel(parsed.key)}`, ...conditionParts(cond)].join(' · ') }} /></>)
    }
    if (parsed.kind !== 'source') {
      return (<>{banner}{host}<WordVaultStudyClient words={[]} backHref={sourceStudyReturnHref(searchParams.from, '')} source={{ total: 0, conditions: '', error: 'invalid' }} /></>)
    }
    const id = parsed.filter.slice(4)
    const membership: SetMembership | null = parsed.filter.startsWith('set:') && MEMBERSHIP[id] ? { setId: id, words: new Set(MEMBERSHIP[id]) } : null
    const scoped = scopeSourceStudyWords(WORDS, parsed, membership, 50)
    const back = sourceStudyReturnHref(searchParams.from, parsed.filter)
    return (
      <>
        {banner}
        {host}
        <WordVaultStudyClient
          words={scoped.status === 'ok' ? scoped.words : []}
          backHref={back}
          source={{ total: scoped.status === 'ok' ? scoped.total : 0, conditions: '이 목록', error: scoped.status === 'ok' ? undefined : 'membership' }}
        />
      </>
    )
  }
  const filter = typeof searchParams.filter === 'string' ? searchParams.filter : ''
  const initial = filter.startsWith('set:') && MEMBERSHIP[filter.slice(4)] ? { setId: filter.slice(4), words: MEMBERSHIP[filter.slice(4)] } : null
  return (
    <>
      {banner}
      <WordVaultBrowseClient
        words={WORDS}
        textChips={[{ id: `text:${TA}`, label: '글 A', count: 2 }, { id: `text:${TB}`, label: '글 B', count: 1 }]}
        setChips={[{ id: `set:${SA}`, label: '세트 A', count: 1 }, { id: `set:${SB}`, label: '세트 B', count: 2 }]}
        setMembership={initial}
        fetchMembership={async (f) => ({ setId: f.slice(4), words: MEMBERSHIP[f.slice(4)] ?? [] })}
      />
    </>
  )
}
