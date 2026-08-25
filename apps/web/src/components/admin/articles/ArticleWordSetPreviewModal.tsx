// apps/web/src/components/admin/articles/ArticleWordSetPreviewModal.tsx
//
// 글 단어장 검수 모달 (책 ChapterWordSetPreviewModal 미러).
// - 글은 단일 섹션 = 단어장 1개 → 추출 단어 전수 + 뜻 + 발음 + 본문 첫 문장 표시
// - vocab 은 검수 페이지에서 이미 service-role 로 로드한 데이터를 props 로 받음 (재fetch X)
// - Esc / 오버레이 클릭 / X 닫기 · body scroll lock

'use client'

import { useEffect, useRef } from 'react'
import { X, Volume2 } from 'lucide-react'

import type { ReviewVocab } from '@/lib/articles/review-types'
import { RegisterBadge } from '@/components/library/RegisterBadge'

interface Props {
  open: boolean
  onClose: () => void
  title: string
  cefrLevel: string | null
  words: ReviewVocab[]
}

export function ArticleWordSetPreviewModal({ open, onClose, title, cefrLevel, words }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null)

  // Esc 닫기 + body scroll lock + focus 복원(열 때 트리거 저장)
  useEffect(() => {
    if (!open) return
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
  }, [open, onClose])

  function speak(w: string) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    const u = new SpeechSynthesisUtterance(w)
    u.lang = 'en-US'
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(u)
  }

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${title} 단어 검수`}
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
                글 단어장
              </span>
              <h3 className="font-display text-[16px] font-[700] text-[var(--t1)]">{title}</h3>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 font-body text-[11px] text-[var(--t2)]">
              <span className="font-display font-[700] text-[var(--t1)]">{words.length}단어</span>
              {cefrLevel && (
                <>
                  <span>·</span>
                  <span>CEFR {cefrLevel}</span>
                </>
              )}
              <span>·</span>
              <span>학습가치(LV) 내림차순</span>
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
          {words.length === 0 ? (
            <p className="font-body text-[13px] text-[var(--t2)]">
              추출된 단어가 없어요. 상단에서 “지금 처리/재분석”을 실행하세요.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-[var(--bd)]/40">
              {words.map((w) => (
                <li key={w.word} className="flex items-start gap-3 py-3">
                  <span className="mt-0.5 w-7 shrink-0 font-display text-[11px] font-[700] tabular-nums text-[var(--t2)]">
                    #{w.rank}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="font-english text-[15px] font-[600] text-[var(--t1)]">
                        {w.word}
                      </span>
                      <RegisterBadge register={w.wordRegister} />
                      {w.pos && (
                        <span className="font-body text-[10px] text-[var(--t2)]">{w.pos}</span>
                      )}
                      {w.vLevel != null && (
                        <span className="rounded-[var(--r-full)] bg-[var(--bg3)] px-2 py-1 font-mono text-[9px] font-[700] text-[var(--t2)]">
                          V{w.vLevel}
                        </span>
                      )}
                      {w.cefrLevel && (
                        <span className="rounded-[var(--r-full)] bg-[var(--bg3)] px-2 py-1 font-display text-[9px] font-[700] text-[var(--t2)]">
                          {w.cefrLevel}
                        </span>
                      )}
                    </div>
                    <p className="truncate font-body text-[12px] text-[var(--t2)]">
                      {w.meaningKo ?? '— (사전 미등재)'}
                    </p>
                    {w.firstSentence && (
                      <p className="mt-0.5 line-clamp-2 font-english text-[11px] italic leading-snug text-[var(--t2)]">
                        “{w.firstSentence}”
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => speak(w.word)}
                    aria-label={`${w.word} 발음 듣기`}
                    className="mt-0.5 shrink-0 rounded-full p-2 text-[var(--t2)] transition-colors hover:bg-[var(--bg2)] hover:text-[var(--p)]"
                  >
                    <Volume2 size={14} aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <footer className="border-t border-[var(--bd)] bg-[var(--bg2)] p-3">
          <p className="font-body text-[10px] text-[var(--t2)]">
            ※ <code className="font-mono">library_article_vocabularies</code> — 글 발행 시 학습자
            WordVault 추출 대상. 고어·시대어 register 는 본문 툴팁으로 노출.
          </p>
        </footer>
      </div>
    </div>
  )
}
