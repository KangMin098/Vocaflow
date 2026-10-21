// apps/web/src/components/workspace/InsightPanel.tsx

'use client'

import { ChapterLevelWords } from '@/components/library/reader/ChapterLevelWords'
import { ArrowUpRight, Bookmark, Info, Layers, X } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useRef } from 'react'
import { useEscapeKey } from '@/lib/ui/use-escape-key'
import { useFocusTrap } from '@/lib/ui/use-focus-trap'

interface MemoryStats {
  stable: number
  shaky: number
  risk: number
  newWords: number
}

interface BookmarkItem {
  id: string
  text: string
  page: number
  addedAt: string
}

interface InsightPanelProps {
  isOpen: boolean
  onClose: () => void
  bookmarks: BookmarkItem[]
  /** null means not connected/available, never four assumed zero counts. */
  memoryStats: MemoryStats | null
  memoryHref?: string
  /**
   * v06.35 (ADR 0004 D7) — 도서 챕터일 때 이 챕터의 개인화 학습 단어를 함께 낸다.
   * 이 패널을 여는 버튼은 라벨이 "챕터 단어장 N/M" 인데 정작 안에 단어가 없었다.
   * 개인화 단어 패널(ChapterLevelWords)은 그동안 enroll **전** 미리보기에만 있어서,
   * 정작 읽기 시작하면 사라졌다. 읽는 자리에 두는 게 맞다.
   */
  libraryBookId?: string | null
  chapterIdx?: number | null
}

export function InsightPanel({
  isOpen,
  onClose,
  bookmarks,
  memoryStats,
  memoryHref = '/wordvault',
  libraryBookId,
  chapterIdx,
}: InsightPanelProps) {
  const panelRef = useRef<HTMLElement>(null)
  useFocusTrap(isOpen, panelRef)
  // 패널 열릴 때 body 스크롤 잠금 — Stale-safe: cleanup 항상 reset
  useEffect(() => {
    if (!isOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isOpen])

  // 열린 곁 패널은 Esc 로 닫힌다(B4 — 이전에는 배경 누르기·닫기 단추만 됐다).
  useEscapeKey(isOpen, onClose)

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        aria-hidden="true"
        className={`fixed inset-0 z-[80] bg-black/40 backdrop-blur-[2px] transition-opacity duration-[var(--dur-slow)] ${isOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'} `}
      />

      {/* Panel */}
      <aside
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal={isOpen ? true : undefined}
        aria-label="학습 인사이트"
        aria-hidden={!isOpen}
        // 닫힌 패널은 화면 밖으로 밀려 있을 뿐 DOM 에 남는다 — aria-hidden 만으로는 안의 단추에
        // Tab 이 들어간다(2026-10-18 learner-overlay-check 실측). inert 로 포커스까지 막는다.
        // React 18 타입에 inert 가 없어 속성 객체로 넘긴다.
        {...({ inert: isOpen ? undefined : '' } as Record<string, string | undefined>)}
        className={`fixed bottom-0 right-0 top-0 z-[90] w-full overflow-y-auto border-l border-[var(--bd)] bg-[var(--bg)] shadow-[var(--sh-xl)] transition-transform duration-[var(--dur-slow)] ease-[var(--ease)] md:w-[420px] ${isOpen ? 'translate-x-0' : 'translate-x-full'} `}
      >
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--bd)] bg-[var(--bg)] px-6 py-5">
          <h2 className="flex items-center gap-2 font-display text-[16px] font-[700] text-[var(--t1)]">
            <Info size={16} strokeWidth={1.75} aria-hidden="true" />
            학습 인사이트
          </h2>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="flex h-8 w-8 items-center justify-center rounded-[var(--r-md)] bg-[var(--bg2)] text-[var(--t2)] transition-all duration-[var(--dur-normal)] hover:bg-[var(--bg3)] hover:text-[var(--t1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] lg:h-11 lg:w-11"
          >
            <X size={14} strokeWidth={2} aria-hidden="true" />
          </button>
        </header>

        <div className="p-6">
          {/* 이 챕터에서 익힐 단어 (도서 챕터에서만) — 패널이 열릴 때만 조회한다 */}
          {isOpen && libraryBookId && chapterIdx != null && (
            <div className="mb-8">
              <ChapterLevelWords libraryBookId={libraryBookId} chapterIdx={chapterIdx} bare />
            </div>
          )}

          {/* Bookmarks */}
          <section className="mb-8">
            <h3 className="mb-3 flex items-center gap-2 font-display text-[11px] font-[600] tracking-[0.04em] text-[var(--t2)]">
              <Bookmark size={11} fill="currentColor" strokeWidth={0} aria-hidden="true" />
              북마크 ({bookmarks.length})
            </h3>

            {bookmarks.length === 0 ? (
              <p className="px-3 py-6 text-center font-body text-[12px] italic text-[var(--t2)]">
                북마크가 없어요. B 키로 추가할 수 있어요.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {bookmarks.map((b) => (
                  <button
                    key={b.id}
                    className="flex items-center gap-3 rounded-[var(--r-md)] bg-[var(--bg2)] px-3 py-3 text-left transition-all duration-[var(--dur-normal)] hover:translate-x-0.5 hover:bg-[var(--bg3)]"
                  >
                    <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-[var(--r-sm)] bg-[var(--active-light)] text-[var(--active)]">
                      <Bookmark size={13} fill="currentColor" strokeWidth={0} aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 block font-english text-[13px] italic leading-snug text-[var(--t1)]">
                        &ldquo;{b.text}&rdquo;
                      </span>
                      <span className="mt-0.5 block font-body text-[11px] text-[var(--t2)]">
                        Page {b.page} · {b.addedAt}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* Memory Decay */}
          <section>
            <h3 className="mb-3 flex items-center gap-2 font-display text-[11px] font-[600] tracking-[0.04em] text-[var(--t2)]">
              <Layers size={11} strokeWidth={2} aria-hidden="true" />
              기억 상태
            </h3>

            {memoryStats ? <div className="grid grid-cols-2 gap-2">
              <DecayCard
                color="var(--memory-stable)"
                label="안정"
                count={memoryStats.stable}
                hint="잘 기억하고 있어요"
                hasGlow
              />
              <DecayCard
                color="var(--memory-shaky)"
                label="흔들림"
                count={memoryStats.shaky}
                hint="곧 복습이 좋아요"
              />
              <DecayCard
                color="var(--memory-risk)"
                label="위험"
                count={memoryStats.risk}
                hint="오늘 만나주세요"
                hasPulse
              />
              <DecayCard
                color="var(--memory-new)"
                label="신규"
                count={memoryStats.newWords}
                hint="처음 만난 단어"
              />
            </div> : (
              <Link href={memoryHref} className="flex min-h-11 items-center justify-between gap-3 rounded-[var(--r-md)] border border-[var(--bd)] px-3 py-3 font-body text-[12px] text-[var(--t2)] hover:bg-[var(--bg2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)]">
                <span className="break-keep">기억 상태는 단어장에서 확인할 수 있어요</span>
                <ArrowUpRight size={16} className="shrink-0" aria-hidden />
              </Link>
            )}
          </section>
        </div>
      </aside>
    </>
  )
}

interface DecayCardProps {
  color: string
  label: string
  count: number
  hint: string
  hasGlow?: boolean
  hasPulse?: boolean
}

function DecayCard({ color, label, count, hint, hasGlow, hasPulse }: DecayCardProps) {
  return (
    <div className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-3">
      <div
        className={`mb-2 h-6 w-6 rounded-full ${hasPulse ? 'animate-[pulse-soft_2s_ease-in-out_infinite]' : ''} `}
        style={{
          background: color,
          boxShadow: hasGlow ? `0 0 8px ${color}` : undefined,
        }}
        aria-hidden="true"
      />
      <p className="mb-1 font-display text-[11px] font-[600] tracking-[0.04em] text-[var(--t2)]">
        {label}
      </p>
      <p className="mb-0.5 font-display text-[22px] font-[800] tabular-nums leading-none text-[var(--t1)]">
        {count}
      </p>
      <p className="font-body text-[11px] text-[var(--t2)]">{hint}</p>
    </div>
  )
}
