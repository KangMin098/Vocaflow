// apps/web/src/components/library/vocab/VocabSetPreviewModal.tsx
//
// 공용 단어장 세트 미리보기 모달.
// - on open: 브라우저 supabase 클라이언트로 샘플 단어 10개 fetch (RLS read published)
// - Esc / 오버레이 클릭 / X 버튼 닫기
// - 본 세트 구독 CTA 동봉 (카드와 동일 Server Action)

'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, Loader2, Plus, Volume2, X } from 'lucide-react'

import { createClient } from '@/lib/supabase/client'
import type { PublishedVocabSet, SamplePreviewWord } from '@/lib/library/vocab/queries'

interface Props {
  set: PublishedVocabSet | null
  isSubscribed: boolean
  isPending: boolean
  onToggle: (set: PublishedVocabSet) => void
  onClose: () => void
}

export function VocabSetPreviewModal({
  set,
  isSubscribed,
  isPending,
  onToggle,
  onClose,
}: Props) {
  const [words, setWords] = useState<SamplePreviewWord[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  // 모달 열릴 때 샘플 단어 fetch
  useEffect(() => {
    if (!set) return
    let cancelled = false
    setLoading(true)
    setError(null)
    setWords(null)
    const supabase = createClient()
    supabase
      .from('shared_words')
      .select('word, meaning_ko, part_of_speech, cefr_level')
      .eq('set_id', set.id)
      .order('sort_order', { ascending: true })
      .limit(10)
      .then(({ data, error: e }) => {
        if (cancelled) return
        if (e) {
          setError('단어를 불러오지 못했어요')
        } else {
          setWords(
            (data ?? []).map((r) => ({
              word: r.word,
              meaningKo: r.meaning_ko,
              partOfSpeech: r.part_of_speech,
              cefrLevel: r.cefr_level,
            })),
          )
        }
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [set])

  // Esc / body scroll lock / focus 관리 (열 때 트리거 저장 → 닫을 때 복원)
  useEffect(() => {
    if (!set) return
    const prevActive = document.activeElement as HTMLElement | null
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    dialogRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      prevActive?.focus()
    }
  }, [set, onClose])

  if (!set) return null

  function speak(word: string) {
    if (typeof window === 'undefined' || !window.speechSynthesis) return
    const utter = new SpeechSynthesisUtterance(word)
    utter.lang = 'en-US'
    utter.rate = 0.95
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utter)
  }

  function handleToggle() {
    if (!set) return
    onToggle(set)
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="vocab-preview-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="flex max-h-[85vh] w-full max-w-[560px] flex-col overflow-hidden rounded-[var(--r-2xl)] bg-[var(--bg)] shadow-[var(--sh-xl)] focus:outline-none"
      >
        {/* 헤더 */}
        <div className="flex items-start justify-between gap-3 border-b border-[var(--bd)] px-6 py-4">
          <div className="min-w-0 flex-1">
            <h2
              id="vocab-preview-title"
              className="line-clamp-2 font-display text-[18px] font-[700] text-[var(--t1)]"
            >
              {set.coverEmoji} {set.title}
            </h2>
            <p className="mt-1 font-body text-[12px] text-[var(--t3)]">
              총 {set.wordCount.toLocaleString()}개 단어 · 미리보기 10개
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--r-full)] text-[var(--t3)] transition-colors hover:bg-[var(--bg2)] hover:text-[var(--t1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6]"
            aria-label="미리보기 닫기"
          >
            <X size={18} aria-hidden />
          </button>
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-10 text-[var(--t3)]">
              <Loader2 size={18} className="animate-spin" aria-hidden />
              <span className="font-body text-[13px]">단어를 불러오는 중...</span>
            </div>
          )}
          {error && !loading && (
            <p role="alert" className="py-6 text-center font-body text-[13px] text-[var(--error)]">
              {error}
            </p>
          )}
          {words && words.length > 0 && (
            <ul className="flex flex-col divide-y divide-[var(--bd)]">
              {words.map((w, i) => (
                <li key={`${w.word}-${i}`} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="font-english text-[16px] font-[600] text-[var(--t1)]">
                        {w.word}
                      </span>
                      {w.partOfSpeech && (
                        <span className="font-body text-[11px] italic text-[var(--t3)]">
                          {w.partOfSpeech}
                        </span>
                      )}
                      {w.cefrLevel && (
                        <span className="rounded-[var(--r-full)] bg-[var(--bg3)] px-1.5 py-0.5 font-display text-[10px] font-[600] text-[var(--t3)]">
                          {w.cefrLevel}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 font-body text-[13px] text-[var(--t2)]">{w.meaningKo}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => speak(w.word)}
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--r-full)] bg-[#8B5CF6]/10 text-[#6D28D9] transition-colors hover:bg-[#8B5CF6]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6]"
                    aria-label={`${w.word} 발음 듣기`}
                  >
                    <Volume2 size={16} aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {words && words.length === 0 && !loading && (
            <p className="py-6 text-center font-body text-[13px] text-[var(--t3)]">
              아직 등록된 단어가 없어요
            </p>
          )}
        </div>

        {/* 푸터 CTA */}
        <div className="flex items-center justify-end gap-2 border-t border-[var(--bd)] px-6 py-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-[40px] items-center rounded-[var(--r-md)] px-4 py-2 font-display text-[13px] font-[600] text-[var(--t2)] transition-colors hover:bg-[var(--bg2)]"
          >
            닫기
          </button>
          {isSubscribed ? (
            <button
              type="button"
              onClick={handleToggle}
              disabled={isPending}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-[var(--r-md)] border border-[var(--bd)] px-4 py-2 font-display text-[13px] font-[600] text-[var(--t2)] transition-colors hover:bg-[var(--bg2)] disabled:opacity-60"
            >
              {isPending ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Check size={14} aria-hidden />}
              구독 해지
            </button>
          ) : (
            <button
              type="button"
              onClick={handleToggle}
              disabled={isPending}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-[var(--r-md)] bg-[#8B5CF6] px-4 py-2 font-display text-[13px] font-[700] text-white transition-colors hover:bg-[#7C3AED] disabled:opacity-60"
            >
              {isPending ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Plus size={14} aria-hidden />}
              내 단어장에 추가
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
