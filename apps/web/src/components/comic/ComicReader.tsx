// apps/web/src/components/comic/ComicReader.tsx
//
// CCP 학습자 리더 — 앱 내재화(아티팩트 재미 쇼케이스와 분리, Calm UI).
// 설계/검토 반영:
//   · Calm 2D 페이지 전환(translateX 슬라이드 + fade) — prefers-reduced-motion 시 즉시 컷.
//   · 앱 토큰만(--reading-bg/--t1../--bd/--p/--memory-*) · data-theme 자동.
//   · 대사 non-cover 대사존(아트 온전 · 캐릭터 안 가림).
//   · Desirable Difficulty: verbatim(정본) 버블은 blur→tap-reveal "기본"(회상 유도).
//   · Context-Dependent: target_vocab(정본 버블 한정) 칩 → 뜻/학습 팝오버.
//   · Journey: 마지막 페이지 = effortful 모듈 유입 CTA(읽기/퀴즈) — 소비 time-sink 방지.
//   · 절대 금지 준수: 폭죽/트로피 없음 · 차분한 "다음 단계".

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, BookOpen, Eye, ListChecks, Sparkles } from 'lucide-react'

export interface ComicBubble {
  speaker?: string | null
  text: string
  kind?: 'caption' | 'speech' | 'shout'
  pos?: string | null
  verbatim?: boolean
  by?: string | null
}
export interface ComicPage {
  pageOrder: number
  chapterIdx: number
  imageUrl: string
  bubbles: ComicBubble[]
  targetVocab: string[]
  staveLabel?: string | null
  bookVLevel?: number | null
}
interface ComicReaderProps {
  textId: string
  bookTitle: string
  pages: ComicPage[]
}

export function ComicReader({ textId, bookTitle, pages }: ComicReaderProps) {
  const total = pages.length
  const [i, setI] = useState(0)
  const [revealed, setRevealed] = useState<Set<string>>(new Set())
  const [vocab, setVocab] = useState<string | null>(null)
  const touch = useRef<{ x: number; y: number; moved: boolean } | null>(null)

  const atEnd = i >= total // total = "다음 단계" 페이지 인덱스
  const go = useCallback((n: number) => setI((p) => Math.max(0, Math.min(total, n))), [total])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(i + 1)
      else if (e.key === 'ArrowLeft') go(i - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [i, go])

  const reveal = (key: string) => setRevealed((s) => new Set(s).add(key))

  const page = i < total ? pages[i] : null
  const stave = page?.staveLabel ?? (page ? `Chapter ${page.chapterIdx}` : '')

  return (
    <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-[860px] flex-col px-4 pb-4">
      {/* 상단바 — 뒤로 + 위치 */}
      <div className="flex items-center justify-between py-3">
        <Link
          href={`/text/${textId}?mode=read`}
          className="inline-flex items-center gap-1.5 font-body text-[12px] font-[500] text-[var(--t3)] transition-colors hover:text-[var(--p)]"
        >
          <ArrowLeft size={14} aria-hidden /> 본문으로
        </Link>
        <span className="font-mono text-[11px] tabular-nums text-[var(--t3)]">
          {atEnd ? `${total}/${total}` : `${i + 1}/${total}`}
        </span>
      </div>

      {/* 진행바 */}
      <div className="mb-3 h-[3px] w-full overflow-hidden rounded-full bg-[var(--bd)]/50">
        <div
          className="h-full rounded-full bg-[var(--p)] transition-[width] duration-[var(--dur-normal)] ease-[var(--ease)] motion-reduce:transition-none"
          style={{ width: `${(Math.min(i, total) / total) * 100}%` }}
        />
      </div>

      {/* 뷰포트 — 스와이프/탭 넘김 */}
      <div
        className="relative flex-1"
        onPointerDown={(e) => (touch.current = { x: e.clientX, y: e.clientY, moved: false })}
        onPointerMove={(e) => {
          if (touch.current && (Math.abs(e.clientX - touch.current.x) > 8 || Math.abs(e.clientY - touch.current.y) > 8))
            touch.current.moved = true
        }}
        onPointerUp={(e) => {
          const t = touch.current
          touch.current = null
          if (!t) return
          const dx = e.clientX - t.x, dy = e.clientY - t.y
          if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) return go(i + (dx < 0 ? 1 : -1))
          if (!t.moved) {
            if ((e.target as HTMLElement).closest('button,a,[data-no-nav]')) return
            const x = e.clientX / window.innerWidth
            if (x > 0.62) go(i + 1)
            else if (x < 0.38) go(i - 1)
          }
        }}
      >
        {page ? (
          <article key={i} className="flex animate-[cfade_.24s_ease] flex-col gap-3 motion-reduce:animate-none">
            {/* 위치 라벨 */}
            <div className="flex items-center gap-2">
              <span className="font-display text-[11px] font-[700] uppercase tracking-[0.12em] text-[var(--p)]">
                {stave}
              </span>
              <span className="h-px flex-1 bg-[var(--bd)]" aria-hidden />
            </div>

            {/* 아트 — 온전히(contain), 대사가 덮지 않음 */}
            <div className="flex items-center justify-center rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg2)] p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={page.imageUrl}
                alt={`${bookTitle} — ${stave} 컷 ${page.pageOrder}`}
                loading="lazy"
                className="max-h-[62vh] w-auto max-w-full rounded-[var(--r-md)]"
              />
            </div>

            {/* 대사존 — 아트 아래(캐릭터 안 가림) */}
            {page.bubbles.length > 0 && (
              <div className="flex flex-col gap-2">
                {page.bubbles.map((b, bi) => {
                  const key = `${i}-${bi}`
                  const isCap = (b.kind ?? 'speech') === 'caption'
                  const hidden = b.verbatim && !revealed.has(key)
                  if (isCap) {
                    return (
                      <p
                        key={key}
                        className="rounded-[var(--r-md)] border-l-[3px] border-[var(--p)] bg-[var(--bg2)] px-3 py-2 font-serif text-[13px] italic leading-relaxed text-[var(--t2)]"
                      >
                        {b.text}
                      </p>
                    )
                  }
                  return (
                    <div
                      key={key}
                      className={`self-start rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] px-3.5 py-2.5 shadow-[var(--sh-sm)] ${
                        b.kind === 'shout' ? 'font-[800]' : ''
                      }`}
                      style={{ maxWidth: 'min(560px, 94%)' }}
                    >
                      {b.speaker && (
                        <span className="mb-0.5 block font-display text-[10px] font-[700] uppercase tracking-[0.07em] text-[var(--p)]">
                          {b.speaker}
                        </span>
                      )}
                      {hidden ? (
                        <button
                          type="button"
                          data-no-nav
                          onClick={() => reveal(key)}
                          aria-label="정본 대사 확인 (기억해 보고 탭)"
                          className="group inline-flex items-center gap-2 rounded-[var(--r-md)] border border-dashed border-[var(--memory-shaky)] bg-[var(--memory-shaky)]/8 px-3 py-1.5 font-body text-[13px] text-[var(--t3)] transition-colors hover:text-[var(--t1)]"
                        >
                          <Eye size={13} aria-hidden className="text-[var(--memory-shaky)]" />
                          <span className="select-none blur-[4px] transition group-hover:blur-[3px]">{b.text}</span>
                          <span className="shrink-0 font-display text-[10px] font-[700] text-[var(--memory-shaky)]">
                            기억나면 탭
                          </span>
                        </button>
                      ) : (
                        <p className="font-body text-[14px] leading-snug text-[var(--t1)]">{b.text}</p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* target_vocab — 정본 정합 학습 단어 칩 */}
            {page.targetVocab.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="font-display text-[10px] font-[700] uppercase tracking-[0.08em] text-[var(--t3)]">
                  학습 단어
                </span>
                {page.targetVocab.map((w) => (
                  <button
                    key={w}
                    type="button"
                    data-no-nav
                    onClick={() => setVocab(w)}
                    className="rounded-[var(--r-full)] border border-[var(--bd)] bg-[var(--bg2)] px-2.5 py-1 font-body text-[12px] font-[600] text-[var(--t1)] transition-colors hover:border-[var(--p)] hover:text-[var(--p)]"
                  >
                    {w}
                  </button>
                ))}
              </div>
            )}
          </article>
        ) : (
          // 마지막 — 차분한 다음 단계(폭죽 없음)
          <div className="flex animate-[cfade_.24s_ease] flex-col items-center gap-5 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg2)] px-6 py-12 text-center motion-reduce:animate-none">
            <Sparkles size={22} className="text-[var(--p)]" aria-hidden />
            <div>
              <p className="font-display text-[17px] font-[800] text-[var(--t1)]">여기까지 잘 읽었어요</p>
              <p className="mt-1 font-body text-[13px] text-[var(--t2)]">
                이야기의 흐름을 잡았다면, 이제 본문으로 더 깊이 만나 볼까요?
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <Link
                href={`/text/${textId}?mode=read`}
                className="inline-flex items-center gap-1.5 rounded-[var(--r-full)] bg-[var(--p)] px-4 py-2 font-display text-[13px] font-[700] text-white shadow-[var(--sh-sm)] transition-transform hover:-translate-y-px"
              >
                <BookOpen size={14} aria-hidden /> 본문 읽기
              </Link>
              <Link
                href="/scriptquiz"
                className="inline-flex items-center gap-1.5 rounded-[var(--r-full)] border border-[var(--bd)] bg-[var(--bg)] px-4 py-2 font-display text-[13px] font-[700] text-[var(--t1)] transition-colors hover:border-[var(--p)]"
              >
                <ListChecks size={14} aria-hidden /> 퀴즈로 확인
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* 하단 넘김 */}
      <div className="mt-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => go(i - 1)}
          disabled={i === 0}
          className="inline-flex items-center gap-1 rounded-[var(--r-full)] border border-[var(--bd)] bg-[var(--bg)] px-3.5 py-1.5 font-display text-[13px] font-[700] text-[var(--t1)] transition-colors hover:border-[var(--p)] disabled:opacity-35"
        >
          <ArrowLeft size={14} aria-hidden /> 이전
        </button>
        <button
          type="button"
          onClick={() => go(i + 1)}
          disabled={atEnd}
          className="inline-flex items-center gap-1 rounded-[var(--r-full)] border border-[var(--bd)] bg-[var(--bg)] px-3.5 py-1.5 font-display text-[13px] font-[700] text-[var(--t1)] transition-colors hover:border-[var(--p)] disabled:opacity-35"
        >
          다음 <ArrowRight size={14} aria-hidden />
        </button>
      </div>

      {/* 단어 팝오버 (경량 · 정독 단서) */}
      {vocab && (
        <div
          role="dialog"
          aria-label={`${vocab} 학습`}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center"
          onClick={() => setVocab(null)}
        >
          <div
            className="w-full max-w-sm rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-5 shadow-[var(--sh-lg)]"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-display text-[20px] font-[800] text-[var(--t1)]">{vocab}</p>
            <p className="mt-1 font-body text-[12px] text-[var(--t3)]">
              이 장면의 맥락에서 만난 단어예요. 단어장에서 뜻과 함께 익혀 보세요.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setVocab(null)}
                className="rounded-[var(--r-full)] px-3 py-1.5 font-display text-[13px] font-[600] text-[var(--t3)] hover:text-[var(--t1)]"
              >
                닫기
              </button>
              <Link
                href={`/wordvault/browse?q=${encodeURIComponent(vocab)}`}
                className="inline-flex items-center gap-1.5 rounded-[var(--r-full)] bg-[var(--p)] px-3.5 py-1.5 font-display text-[13px] font-[700] text-white"
              >
                <BookOpen size={13} aria-hidden /> 단어장에서 보기
              </Link>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes cfade {
          from { opacity: 0; transform: translateX(8px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  )
}
