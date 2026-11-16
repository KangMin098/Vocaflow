// apps/web/src/app/dev/wordvault-membership/harness.tsx
// 합성 자료 — 개인 데이터 아님 · 기록 없음. 단위 회귀(set-membership.test)의 네 행과 기사 A/B 정본을 그대로 쓴다.
//   1 flooding  — A 에서 구독(origin A)
//   2 harvest   — B 에서 먼저 가짐 · A 정본에도 있음
//   3 satellite — 직접 글(T)에서 · A 정본에도 있음
//   4 drought   — B 에만
// 「서버 새 값」 버튼은 같은 URL 의 재검증으로 서버가 A 의 새 membership prop 을 내려준 경우를 흉내 낸다.
'use client'

import { useRef, useState } from 'react'
import { WordVaultBrowseClient } from '@/components/wordvault/WordVaultBrowseClient'
import type { BrowseWord } from '@/lib/wordvault/browse-queries'
import type { SetMembershipPayload } from '@/lib/wordvault/set-membership-query'

const A = '00000000-0000-4000-8000-00000000000a'
const B = '00000000-0000-4000-8000-00000000000b'
const T = '00000000-0000-4000-8000-0000000000aa'

function word(id: number, w: string, meaning: string, setId: string | null, textId: string | null): BrowseWord {
  return { id, dbId: `harness-${id}`, setId, textId, word: w, pos: 'n.', meaning, exampleEn: '', level: 'B1', levelClass: 'b', mastery: 1, lastDays: 0, nextDays: 0 }
}

const WORDS: BrowseWord[] = [
  word(1, 'flooding', '홍수', A, null),
  word(2, 'harvest', '수확', B, null),
  word(3, 'satellite', '위성', null, T),
  word(4, 'drought', '가뭄', B, null),
]
const CANON: Record<string, string[]> = { [A]: ['flooding', 'harvest', 'satellite', 'soybean'], [B]: ['harvest', 'drought'] }
const LABEL: Record<string, string> = { [A]: 'A', [B]: 'B' }

export function WordVaultMembershipHarness({ slow, fail, initial }: { slow: string; fail: string; initial: string }) {
  const calls = useRef<string[]>([])
  const [log, setLog] = useState('')
  const [serverProp, setServerProp] = useState<SetMembershipPayload | null>(initial === 'A' ? { setId: A, words: CANON[A] } : null)

  async function fetchMembership(filter: string): Promise<SetMembershipPayload | null> {
    const id = filter.slice(4)
    const name = LABEL[id] ?? '?'
    calls.current.push(name)
    setLog(calls.current.join(','))
    await new Promise((r) => setTimeout(r, slow.split(',').includes(name) ? 1500 : 150))
    if (fail.split(',').includes(name)) throw new Error('harness network')
    return { setId: id, words: CANON[id] ?? [] }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 border-b border-[var(--bd)] bg-[var(--bg)] px-6 py-3 font-display text-[13px] text-[var(--t2)]">
        <span>합성 자료 · 개인 데이터 아님 · 기록 없음 · slow={slow || '-'} fail={fail || '-'}</span>
        <span>
          조회 <span data-testid="harness-calls">{log}</span>
        </span>
        <button type="button" data-testid="harness-prop-a-no-harvest" className="min-h-[44px] rounded border border-[var(--bd)] px-3" onClick={() => setServerProp({ setId: A, words: ['flooding', 'satellite', 'soybean'] })}>
          서버 새 값: A 정본에서 harvest 제외
        </button>
        <button type="button" data-testid="harness-prop-a-error" className="min-h-[44px] rounded border border-[var(--bd)] px-3" onClick={() => setServerProp({ setId: A, error: true })}>
          서버 새 값: A 조회 실패
        </button>
      </div>
      <WordVaultBrowseClient
        words={WORDS}
        textChips={[{ id: `text:${T}`, label: '직접 글 T', count: 1 }]}
        setChips={[
          { id: `set:${A}`, label: '기사 A', count: 1 },
          { id: `set:${B}`, label: '기사 B', count: 2 },
        ]}
        setMembership={serverProp}
        fetchMembership={fetchMembership}
      />
    </div>
  )
}
