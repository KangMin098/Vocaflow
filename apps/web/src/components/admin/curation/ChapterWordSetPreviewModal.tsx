// apps/web/src/components/admin/curation/ChapterWordSetPreviewModal.tsx
//
// Admin 전용 챕터 단어장 미리보기 모달.
// - 사용자용 VocabSetPreviewModal 과 달리 구독 CTA 없음 (검수 시점이라 부적합)
// - 단어 전수 fetch + 추출 메타(book_v_level filter, chapter_idx, slug, curation_query JSONB) 표시
// - Esc / 오버레이 클릭 / X 닫기

'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, X, Volume2 } from 'lucide-react'

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
  const dialogRef = useRef<HTMLDivElement>(null)

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

  // Esc 닫기 + body scroll lock + focus 복원(열 때 트리거 저장)
  useEffect(() => {
    if (!set) return
    const prevActive = document.activeElement as HTMLElement | null
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialogRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      prevActive?.focus()
    }
  }, [set, onClose])

  function speak(w: string) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    const u = new SpeechSynthesisUtterance(w)
    u.lang = 'en-US'
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(u)
  }

  if (!set) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${set.title} 단어 미리보기`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-[var(--r-xl)] bg-[var(--bg)] shadow-[var(--sh-xl)] focus:outline-none"
      >
        <header className="flex items-start justify-between gap-3 border-b border-[var(--bd)] p-5">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="rounded-[var(--r-full)] bg-[#8B5CF6]/10 px-2 py-1 font-display text-[10px] font-[700] text-[#6D28D9]">
                Ch.{set.chapterIdx}
              </span>
              <h3 className="font-display text-[16px] font-[700] text-[var(--t1)]">
                {set.title}
              </h3>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 font-body text-[11px] text-[var(--t2)]">
              <span className="font-display font-[700] text-[var(--t1)]">
                {set.wordCount}단어
              </span>
              {set.bookVLevel != null && (
                <>
                  <span>·</span>
                  <span>필터 V{set.bookVLevel}+</span>
                </>
              )}
              {set.cefrLevel && (
                <>
                  <span>·</span>
                  <span>CEFR {set.cefrLevel}</span>
                </>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="shrink-0 rounded-[var(--r-sm)] p-1 text-[var(--t2)] transition-colors hover:bg-[var(--bg2)] hover:text-[var(--t1)]"
          >
            <X size={18} aria-hidden />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5">
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
            <ul className="flex flex-col divide-y divide-[var(--bd)]/40">
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
                    className="shrink-0 rounded-full p-2 text-[var(--t2)] transition-colors hover:bg-[var(--bg2)] hover:text-[var(--p)]"
                  >
                    <Volume2 size={14} aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <footer className="border-t border-[var(--bd)] bg-[var(--bg2)] p-3">
          <details className="font-body text-[11px] text-[var(--t2)]">
            <summary className="cursor-pointer font-display font-[700] uppercase tracking-wider hover:text-[var(--t1)]">
              추출 메타 (curation_query JSONB)
            </summary>
            <pre className="mt-2 overflow-x-auto rounded-[var(--r-sm)] bg-[var(--bg)] p-2 font-mono text-[10px] text-[var(--t2)]">
              {JSON.stringify(set.curationQuery, null, 2)}
            </pre>
          </details>
        </footer>
      </div>
    </div>
  )
}
