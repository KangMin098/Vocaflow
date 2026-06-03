// apps/web/src/components/library/reader/ChapterLevelWords.tsx
// 라이브러리 도서 chapter — 사용자 레벨 맞춤 단어 추출 패널 (Krashen i+1).
// getChapterWordsForUser → extract_vocabulary_for_user(목표 V-Level+1 가우시안).
// 기존 평면 LV 리스트(getChapterWords)와 달리 "내 레벨에 최적인 단어"를 sweet-spot 순으로.

'use client'

import {
  getChapterWordsForUser,
  type LeveledChapterResult,
} from '@/lib/library/chapter-words-queries'
import { createClient } from '@/lib/supabase/client'
import { Target } from 'lucide-react'
import { useEffect, useState } from 'react'

interface ChapterLevelWordsProps {
  libraryBookId: string
  chapterIdx: number
}

/** reasoning 문구 → 색 토큰 (i+1=초록 최적, 견고화=정보, 도전=경고, 보강=회색) */
function reasoningStyle(reasoning: string | null): { bg: string; text: string } {
  if (!reasoning) return { bg: 'var(--bg3)', text: 'var(--t3)' }
  if (reasoning.includes('i+1')) return { bg: 'var(--success-light)', text: 'var(--success)' }
  if (reasoning.includes('견고화')) return { bg: 'var(--info-light)', text: 'var(--info)' }
  if (reasoning.includes('도전')) return { bg: 'var(--warning-light)', text: 'var(--warning)' }
  return { bg: 'var(--bg3)', text: 'var(--t3)' }
}

export function ChapterLevelWords({ libraryBookId, chapterIdx }: ChapterLevelWordsProps) {
  const [state, setState] = useState<
    | { kind: 'loading' }
    | { kind: 'anon' }
    | { kind: 'empty' }
    | { kind: 'ready'; result: LeveledChapterResult }
  >({ kind: 'loading' })

  useEffect(() => {
    let cancelled = false
    setState({ kind: 'loading' })
    const client = createClient()
    ;(async () => {
      const {
        data: { user },
      } = await client.auth.getUser()
      if (cancelled) return
      if (!user) {
        setState({ kind: 'anon' })
        return
      }
      const result = await getChapterWordsForUser(client, libraryBookId, chapterIdx, user.id, 'auto')
      if (cancelled) return
      setState(result.words.length === 0 ? { kind: 'empty' } : { kind: 'ready', result })
    })().catch(() => {
      if (!cancelled) setState({ kind: 'empty' })
    })
    return () => {
      cancelled = true
    }
  }, [libraryBookId, chapterIdx])

  return (
    <aside
      className="mx-auto mt-8 max-w-2xl rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] p-5"
      aria-label="내 레벨 맞춤 단어"
    >
      <header className="mb-3 flex items-center gap-2">
        <Target size={14} className="text-[var(--p)]" aria-hidden />
        <h2 className="font-display text-[13px] font-[700] text-[var(--t1)]">
          내 레벨 맞춤 단어 (Krashen i+1)
        </h2>
      </header>

      {state.kind === 'loading' && (
        <p className="font-body text-[12px] text-[var(--t3)]">내 레벨로 추출 중…</p>
      )}

      {state.kind === 'anon' && (
        <p className="font-body text-[12px] leading-relaxed text-[var(--t3)]">
          로그인하면 내 진단 레벨(+1) 기준으로 이 챕터의 최적 학습 단어를 추출해 드려요.
        </p>
      )}

      {state.kind === 'empty' && (
        <p className="font-body text-[12px] leading-relaxed text-[var(--t3)]">
          이 챕터에서 추출할 맞춤 단어가 없어요 (이미 학습했거나 레벨에 맞는 단어가 적음).
        </p>
      )}

      {state.kind === 'ready' && <ReadyBody result={state.result} />}
    </aside>
  )
}

function ReadyBody({ result }: { result: LeveledChapterResult }) {
  const m = result.meta
  return (
    <>
      {m && (
        <p className="mb-3 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10px] text-[var(--t3)]">
          <span>
            내 레벨{' '}
            <strong className="text-[var(--t2)]">
              {m.effectiveUserV != null ? `V${m.effectiveUserV}` : '—'}
            </strong>
          </span>
          <span>
            목표(i+1){' '}
            <strong className="text-[var(--p)]">
              {m.targetVLevel != null ? `V${m.targetVLevel}` : '—'}
            </strong>
          </span>
          <span>
            글 P75 <strong className="text-[var(--t2)]">V{m.textVLevel ?? '—'}</strong>
          </span>
          <span>{result.words.length}개 추출</span>
          {m.levelSource && (
            <span className="text-[var(--t4)]">
              ({m.levelSource.includes('user') ? '진단 기준' : '글 기준 추정'})
            </span>
          )}
        </p>
      )}

      <ul role="list" className="flex flex-col divide-y divide-[var(--bd)]">
        {result.words.map((w) => {
          const rs = reasoningStyle(w.reasoning)
          return (
            <li key={w.word} className="flex items-baseline gap-2.5 py-2">
              <span className="w-28 shrink-0 font-display text-[14px] font-[700] text-[var(--t1)]">
                {w.word}
              </span>
              {w.cefrLevel && (
                <span className="shrink-0 font-mono text-[10px] text-[var(--t3)]">
                  {w.cefrLevel}·V{w.vLevel}
                </span>
              )}
              <span className="min-w-0 flex-1 truncate font-body text-[12px] text-[var(--t2)]">
                {w.meaning ?? '—'}
              </span>
              {w.reasoning && (
                <span
                  className="shrink-0 rounded-[3px] px-1.5 py-0.5 font-body text-[9px] font-[600]"
                  style={{ backgroundColor: rs.bg, color: rs.text }}
                  title={`i+1 근접도 ${w.vProximity != null ? w.vProximity.toFixed(2) : '—'}`}
                >
                  {w.reasoning}
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </>
  )
}
