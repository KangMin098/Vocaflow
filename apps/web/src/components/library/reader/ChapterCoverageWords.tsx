// apps/web/src/components/library/reader/ChapterCoverageWords.tsx
// 라이브러리 도서 chapter — 비학습 롱테일 "독해 참고 단어" 패널.
// getChapterCoverageWords → select_book_chapter_coverage(coverage_lexicon, 학습 core 밖).
// 고유명사(Darcy·Collins)는 RPC의 first_sentence 소문자 필터로 제외됨.
// i+1 학습 패널(ChapterLevelWords)과 명확히 분리 — 암기 대상 아님, 읽기 이해 보조(Calm UI).

'use client'

import { getChapterCoverageWords, type CoverageWord } from '@/lib/library/chapter-words-queries'
import { createClient } from '@/lib/supabase/client'
import { BookOpen } from 'lucide-react'
import { useEffect, useState } from 'react'

interface ChapterCoverageWordsProps {
  libraryBookId: string
  chapterIdx: number
}

export function ChapterCoverageWords({ libraryBookId, chapterIdx }: ChapterCoverageWordsProps) {
  const [state, setState] = useState<
    | { kind: 'loading' }
    | { kind: 'empty' }
    | { kind: 'ready'; words: CoverageWord[] }
  >({ kind: 'loading' })

  useEffect(() => {
    let cancelled = false
    setState({ kind: 'loading' })
    const client = createClient()
    getChapterCoverageWords(client, libraryBookId, chapterIdx)
      .then((words) => {
        if (cancelled) return
        setState(words.length === 0 ? { kind: 'empty' } : { kind: 'ready', words })
      })
      .catch(() => {
        if (!cancelled) setState({ kind: 'empty' })
      })
    return () => {
      cancelled = true
    }
  }, [libraryBookId, chapterIdx])

  return (
    <aside
      className="mx-auto mt-4 max-w-2xl rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] p-5"
      aria-label="독해 참고 단어"
    >
      <header className="mb-1 flex items-center gap-2">
        <BookOpen size={14} className="text-[var(--t3)]" aria-hidden />
        <h2 className="font-display text-[13px] font-[700] text-[var(--t1)]">독해 참고 단어</h2>
      </header>
      <p className="mb-3 font-body text-[11px] leading-relaxed text-[var(--t3)]">
        핵심 학습 어휘는 아니지만 이 장에 나오는 드문 단어예요 — 암기보다 의미만 알아두면 충분해요.
      </p>

      {state.kind === 'loading' && (
        <p className="font-body text-[12px] text-[var(--t3)]">참고 단어 찾는 중…</p>
      )}

      {state.kind === 'empty' && (
        <p className="font-body text-[12px] leading-relaxed text-[var(--t3)]">
          이 장에는 별도 참고 단어가 없어요.
        </p>
      )}

      {state.kind === 'ready' && (
        <ul role="list" className="flex flex-col divide-y divide-[var(--bd)]">
          {state.words.map((w) => (
            <li key={w.word} className="flex items-baseline gap-2.5 py-2">
              <span className="w-28 shrink-0 font-english text-[14px] font-[700] text-[var(--t1)]">
                {w.word}
              </span>
              {w.pos && (
                <span className="shrink-0 font-body text-[10px] italic text-[var(--t3)]">{w.pos}</span>
              )}
              <span className="min-w-0 flex-1 truncate font-body text-[12px] text-[var(--t2)]">
                {w.meaningKo ? (
                  w.meaningKo
                ) : w.glossEn ? (
                  <span className="italic text-[var(--t3)]">{w.glossEn}</span>
                ) : (
                  '—'
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </aside>
  )
}
