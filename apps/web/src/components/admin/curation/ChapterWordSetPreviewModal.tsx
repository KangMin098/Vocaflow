// apps/web/src/components/admin/curation/ChapterWordSetPreviewModal.tsx
//
// Admin 전용 챕터 단어장 미리보기 모달.
// - 사용자용 VocabSetPreviewModal 과 달리 구독 CTA 없음 (검수 시점이라 부적합)
// - 단어 전수 fetch + 추출 메타(book_v_level filter, chapter_idx, slug, curation_query JSONB) 표시
// - 껍데기는 `ui/Dialog`(DD-68 · tines-mapping §28) — Esc · 바깥 · 뒤로가기 · 포커스는 그 계약.

'use client'

import { useEffect, useState } from 'react'
import { Loader2, Volume2 } from 'lucide-react'

import { Dialog } from '@/components/ui/Dialog'
import { createClient } from '@/lib/supabase/client'

export interface AdminChapterSet {
  id: string
  title: string
  chapterIdx: number
  wordCount: number
  cefrLevel: string | null
  bookVLevel: number | null
  curationQuery: Record<string, unknown>
}

interface PreviewWord {
  word: string
  meaningKo: string
  partOfSpeech: string | null
  cefrLevel: string | null
  sortOrder: number
}

interface Props {
  set: AdminChapterSet | null
  onClose: () => void
}

export function ChapterWordSetPreviewModal({ set, onClose }: Props) {
  const [words, setWords] = useState<PreviewWord[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!set) return
    let cancelled = false
    setLoading(true)
    setError(null)
    setWords(null)

    const supabase = createClient()
    supabase
      .from('shared_words')
      .select('word, meaning_ko, part_of_speech, cefr_level, sort_order')
      .eq('set_id', set.id)
      .order('sort_order', { ascending: false }) // frequency_in_chapter DESC
      .then(({ data, error: err }) => {
        if (cancelled) return
        if (err) setError(err.message)
        else
          setWords(
            (data ?? []).map((r) => ({
              word: r.word,
              meaningKo: r.meaning_ko,
              partOfSpeech: r.part_of_speech,
              cefrLevel: r.cefr_level,
              sortOrder: r.sort_order ?? 0,
            })),
          )
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [set])

  function speak(w: string) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    const u = new SpeechSynthesisUtterance(w)
    u.lang = 'en-US'
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(u)
  }

  if (!set) return null

  return (
    <Dialog
      onClose={onClose}
      size="lg"
      crumbs={['Admin', '도서 큐레이션', `Ch.${set.chapterIdx}`]}
      title={set.title}
      ariaLabel={`${set.title} 단어 미리보기`}
      byline="빈도 내림차순 · 검수용(구독 CTA 없음)"
      tags={[
        `${set.wordCount}단어`,
        ...(set.bookVLevel != null ? [`필터 V${set.bookVLevel}+`] : []),
        ...(set.cefrLevel ? [`CEFR ${set.cefrLevel}`] : []),
      ]}
      footer={
        <details className="w-full font-body text-[11px] text-[var(--t2)]">
          <summary className="cursor-pointer font-display font-[700] uppercase tracking-wider hover:text-[var(--t1)]">
            추출 메타 (curation_query JSONB)
          </summary>
          <pre className="mt-2 max-h-40 overflow-auto rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg2)] p-2 font-mono text-[10px] text-[var(--t2)]">
            {JSON.stringify(set.curationQuery, null, 2)}
          </pre>
        </details>
      }
    >
        <div>
          {loading && (
            <div className="flex items-center justify-center gap-2 py-12 font-body text-[13px] text-[var(--t2)]">
              <Loader2 size={16} className="animate-spin" aria-hidden />
              불러오는 중...
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="rounded-[var(--r-md)] border border-[var(--bde)] bg-[var(--error-light)] p-3 font-body text-[12px] text-[var(--error-ink)]"
            >
              {error}
            </div>
          )}

          {words && words.length === 0 && (
            <p className="font-body text-[13px] text-[var(--t2)]">단어가 없어요</p>
          )}

          {words && words.length > 0 && (
            <ul className="flex flex-col divide-y divide-[color-mix(in_srgb,var(--bd)_40%,transparent)]">
              {words.map((w) => (
                <li key={w.word} className="flex items-center gap-3 py-3">
                  <span className="font-display text-[11px] font-[700] tabular-nums text-[var(--t2)]">
                    #{w.sortOrder}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="font-english text-[15px] font-[600] text-[var(--t1)]">
                        {w.word}
                      </span>
                      {w.partOfSpeech && (
                        <span className="font-body text-[10px] text-[var(--t2)]">
                          {w.partOfSpeech}
                        </span>
                      )}
                      {w.cefrLevel && (
                        <span className="rounded-[var(--r-full)] bg-[var(--bg3)] px-2 py-1 font-display text-[9px] font-[700] text-[var(--t2)]">
                          {w.cefrLevel}
                        </span>
                      )}
                    </div>
                    <p className="truncate font-body text-[12px] text-[var(--t2)]">
                      {w.meaningKo}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => speak(w.word)}
                    aria-label={`${w.word} 발음 듣기`}
                    className="min-h-[44px] shrink-0 rounded-full p-2 text-[var(--t2)] transition-colors hover:bg-[var(--bg2)] hover:text-[var(--p)]"
                  >
                    <Volume2 size={14} aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
    </Dialog>
  )
}
