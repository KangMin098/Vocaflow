// apps/web/src/components/comic/ComicReader.tsx
//
// CCP 학습자 리더 v2 — "아트는 무대, UI는 조명" (웹툰/Kindle/Duolingo/MasterClass 딥서치 반영).
//   · 몰입 크롬 자동숨김 + 중앙 탭 토글 + 글래스(paper-blur) 상/하단바 (Naver Webtoon·Apple)
//   · stave-dot 진행 레일 + gold ring 현재 위치 + dot 탭 점프 (Kindle 챕터 스크러버·Duolingo 노드)
//   · 방향성 페이지 전환 + 엣지 rubber-band + Space/Shift+Space (Lezhin·Kindle)
//   · 대사 non-cover + film-strip gold hairline tie + 화자 dot+라벨 (Dual Coding)
//   · verbatim blur→reveal 유지(Desirable Difficulty) · Light/Dim 리딩 모드
//   · Calm UI: 폭죽/트로피 없음 · prefers-reduced-motion 전면 대응 · 앱 토큰만

'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, ArrowRight, BookOpen, Eye, ListChecks, Moon, Sparkles, Sun,
} from 'lucide-react'

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

// 화자별 낮은-채도 hue (색 + 이름 라벨 병행 → 색맹 대응)
function speakerHue(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360
  return `hsl(${h} 32% 52%)`
}

export function ComicReader({ textId, bookTitle, pages }: ComicReaderProps) {
  const total = pages.length
  const [i, setI] = useState(0)
  const [revealed, setRevealed] = useState<Set<string>>(new Set())
  const [vocab, setVocab] = useState<string | null>(null)
  const [chrome, setChrome] = useState(true)
  const [dim, setDim] = useState(false)
  const [bump, setBump] = useState<'l' | 'r' | null>(null)
  const [dir, setDir] = useState<1 | -1>(1)
  const touch = useRef<{ x: number; y: number; moved: boolean } | null>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reduced = useRef(false)

  useEffect(() => {
    reduced.current = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    // 진입 2.5s 뒤 크롬 자동 숨김(reduced-motion 시 유지)
    if (!reduced.current) hideTimer.current = setTimeout(() => setChrome(false), 2500)
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current) }
  }, [])

  const atEnd = i >= total // total = "다음 단계" 페이지
  const go = useCallback((n: number, d: 1 | -1) => {
    setI((p) => {
      const t = Math.max(0, Math.min(total, n))
      if (t === p) { // 경계 — rubber-band
        if (!reduced.current) { setBump(d < 0 ? 'l' : 'r'); setTimeout(() => setBump(null), 200) }
        return p
      }
      setDir(d); setChrome(false) // 넘김 시 크롬 숨김
      if (hideTimer.current) clearTimeout(hideTimer.current)
      return t
    })
  }, [total])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || (e.key === ' ' && !e.shiftKey)) { e.preventDefault(); go(i + 1, 1) }
      else if (e.key === 'ArrowLeft' || (e.key === ' ' && e.shiftKey)) { e.preventDefault(); go(i - 1, -1) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [i, go])

  const reveal = (key: string) => setRevealed((s) => new Set(s).add(key))
  const page = i < total ? pages[i] : null
  const stave = page?.staveLabel ?? (page ? `Chapter ${page.chapterIdx}` : '')

  // stave 그룹 (진행 레일 + dot 점프)
  const staves = useMemo(() => {
    const seen = new Map<number, { idx: number; label: string; first: number; count: number }>()
    pages.forEach((p, gi) => {
      if (!seen.has(p.chapterIdx)) seen.set(p.chapterIdx, { idx: p.chapterIdx, label: p.staveLabel ?? `Ch ${p.chapterIdx}`, first: gi, count: 0 })
      seen.get(p.chapterIdx)!.count++
    })
    return [...seen.values()].sort((a, b) => a.idx - b.idx)
  }, [pages])
  const curStave = page?.chapterIdx ?? staves[staves.length - 1]?.idx

  return (
    <div
      className="relative min-h-[calc(100vh-3rem)] select-none"
      style={{ background: dim ? '#120F0C' : 'var(--reading-bg)', transition: 'background .3s var(--ease)' }}
    >
      {/* ── 상단 글래스바 (auto-hide) ── */}
      <header
        className={`fixed inset-x-0 top-0 z-30 transition-[opacity,transform] duration-[var(--dur-slower)] ease-[var(--ease)] motion-reduce:transition-none ${
          chrome ? 'translate-y-0 opacity-100' : 'pointer-events-none -translate-y-2 opacity-0'
        }`}
      >
        <div className="mx-auto flex max-w-[860px] items-center justify-between gap-3 px-4 py-2.5">
          <Link
            href={`/text/${textId}?mode=read`}
            className="inline-flex items-center gap-1.5 rounded-[var(--r-full)] px-2 py-1 font-body text-[12px] font-[600] text-[var(--t2)] backdrop-blur-xl transition-colors hover:text-[var(--p)]"
            style={{ background: 'var(--mat-glass-bg-thin, rgba(250,250,247,.72))' }}
          >
            <ArrowLeft size={14} aria-hidden /> 본문
          </Link>
          <span className="truncate font-display text-[12px] font-[700] uppercase tracking-[0.1em] text-[var(--t3)]">
            {bookTitle}
          </span>
          <button
            type="button"
            onClick={() => setDim((d) => !d)}
            aria-label={dim ? '밝게' : '어둡게(몰입)'}
            className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--r-full)] text-[var(--t2)] backdrop-blur-xl transition-colors hover:text-[var(--active)]"
            style={{ background: 'var(--mat-glass-bg-thin, rgba(250,250,247,.72))' }}
          >
            {dim ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </div>
      </header>

      {/* ── 뷰포트 ── */}
      <div
        className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-[860px] flex-col justify-center px-4 py-14"
        onPointerDown={(e) => (touch.current = { x: e.clientX, y: e.clientY, moved: false })}
        onPointerMove={(e) => {
          if (touch.current && (Math.abs(e.clientX - touch.current.x) > 8 || Math.abs(e.clientY - touch.current.y) > 8)) touch.current.moved = true
        }}
        onPointerUp={(e) => {
          const t = touch.current; touch.current = null; if (!t) return
          const dx = e.clientX - t.x, dy = e.clientY - t.y
          if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) return go(i + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1)
          if (!t.moved) {
            if ((e.target as HTMLElement).closest('button,a,[data-no-nav]')) return
            const x = e.clientX / window.innerWidth
            if (x > 0.62) go(i + 1, 1)
            else if (x < 0.38) go(i - 1, -1)
            else setChrome((c) => !c) // 중앙 탭 = 크롬 토글
          }
        }}
      >
        {page ? (
          <article
            key={i}
            className={`flex flex-col gap-0 ${bump === 'l' ? 'animate-[bumpL_.2s_ease]' : bump === 'r' ? 'animate-[bumpR_.2s_ease]' : dir === 1 ? 'animate-[slideN_.26s_ease]' : 'animate-[slideP_.26s_ease]'} motion-reduce:animate-none`}
          >
            {/* film-strip 카드: 아트 + gold hairline tie + 대사존 */}
            <div className="overflow-hidden rounded-[var(--r-lg)] border border-[var(--bd)] shadow-[var(--sh-sm)]" style={{ background: dim ? '#1a150f' : 'var(--bg)' }}>
              {/* 아트 (온전 · contain) */}
              <div className="flex items-center justify-center" style={{ background: dim ? '#0d0b08' : 'var(--bg2)' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={page.imageUrl}
                  alt={`${bookTitle} — ${stave} 컷 ${page.pageOrder}`}
                  loading="lazy"
                  className="max-h-[58vh] w-auto max-w-full"
                />
              </div>
              {/* gold hairline tie */}
              <div aria-hidden style={{ height: 2, background: 'color-mix(in srgb, var(--active) 30%, transparent)' }} />
              {/* 대사존 */}
              <div className="flex flex-col gap-2 px-3.5 py-3" style={{ color: dim ? '#e8e0d2' : undefined }}>
                <div className="flex items-center gap-2">
                  <span className="font-display text-[10px] font-[700] uppercase tracking-[0.14em] text-[var(--active)]">{stave}</span>
                  <span className="h-px flex-1" style={{ background: 'var(--bd)' }} aria-hidden />
                </div>
                {page.bubbles.length === 0 && <p className="font-body text-[12px] text-[var(--t4)]">…</p>}
                {page.bubbles.map((b, bi) => {
                  const key = `${i}-${bi}`
                  const isCap = (b.kind ?? 'speech') === 'caption'
                  const hidden = b.verbatim && !revealed.has(key)
                  if (isCap) {
                    return (
                      <p key={key} className="border-l-[3px] pl-3 font-serif text-[13px] italic leading-relaxed" style={{ borderColor: 'var(--active)', color: dim ? '#c9bfad' : 'var(--t2)' }}>
                        {b.text}
                      </p>
                    )
                  }
                  return (
                    <div key={key} className="flex flex-col gap-0.5">
                      {b.speaker && (
                        <span className="inline-flex items-center gap-1.5 font-display text-[10px] font-[700] uppercase tracking-[0.06em]" style={{ color: dim ? '#b9ad97' : 'var(--t3)' }}>
                          <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: speakerHue(b.speaker) }} />
                          {b.speaker}
                        </span>
                      )}
                      {hidden ? (
                        <button
                          type="button" data-no-nav onClick={() => reveal(key)}
                          aria-label="정본 대사 확인 (기억해 보고 탭)" aria-expanded={false}
                          className="group inline-flex items-center gap-2 self-start rounded-[var(--r-md)] px-2.5 py-1.5 text-left font-body text-[14px] transition-colors"
                          style={{ border: '1px dashed color-mix(in srgb, var(--active) 55%, transparent)', background: 'color-mix(in srgb, var(--active) 8%, transparent)', color: 'var(--t3)' }}
                        >
                          <Eye size={13} aria-hidden style={{ color: 'var(--active)' }} />
                          <span className="select-none blur-[4px] transition group-hover:blur-[3px] motion-reduce:transition-none">{b.text}</span>
                          <span className="shrink-0 font-display text-[10px] font-[700] underline underline-offset-2" style={{ color: 'var(--active)' }}>기억나면 탭</span>
                        </button>
                      ) : (
                        <p className={`font-body text-[14px] leading-snug ${b.kind === 'shout' ? 'font-[800]' : ''}`} style={{ color: dim ? '#ece4d6' : 'var(--t1)' }}>{b.text}</p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* target_vocab 칩 */}
            {page.targetVocab.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <span className="font-display text-[10px] font-[700] uppercase tracking-[0.08em] text-[var(--t3)]">학습 단어</span>
                {page.targetVocab.map((w) => (
                  <button
                    key={w} type="button" data-no-nav onClick={() => setVocab(w)}
                    className="rounded-[var(--r-full)] border px-2.5 py-1 font-body text-[12px] font-[600] transition-colors"
                    style={{ borderColor: 'var(--bd)', background: 'var(--bg2)', color: 'var(--t1)' }}
                  >
                    {w}
                  </button>
                ))}
              </div>
            )}
          </article>
        ) : (
          <div className="flex animate-[slideN_.26s_ease] flex-col items-center gap-5 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg2)] px-6 py-14 text-center motion-reduce:animate-none">
            <Sparkles size={22} style={{ color: 'var(--active)' }} aria-hidden />
            <div>
              <p className="font-display text-[17px] font-[800] text-[var(--t1)]">여기까지 잘 읽었어요</p>
              <p className="mt-1 font-body text-[13px] text-[var(--t2)]">이야기의 흐름을 잡았다면, 이제 본문으로 더 깊이 만나 볼까요?</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <Link href={`/text/${textId}?mode=read`} className="inline-flex items-center gap-1.5 rounded-[var(--r-full)] px-4 py-2 font-display text-[13px] font-[700] text-white shadow-[var(--sh-sm)] transition-transform hover:-translate-y-px" style={{ background: 'var(--active)' }}>
                <BookOpen size={14} aria-hidden /> 본문 읽기
              </Link>
              <Link href="/scriptquiz" className="inline-flex items-center gap-1.5 rounded-[var(--r-full)] border border-[var(--bd)] bg-[var(--bg)] px-4 py-2 font-display text-[13px] font-[700] text-[var(--t1)] transition-colors hover:border-[var(--active)]">
                <ListChecks size={14} aria-hidden /> 퀴즈로 확인
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* ── 하단 글래스바: stave-dot 진행 레일 (auto-hide) ── */}
      <footer
        className={`fixed inset-x-0 bottom-0 z-30 transition-[opacity,transform] duration-[var(--dur-slower)] ease-[var(--ease)] motion-reduce:transition-none ${
          chrome ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-2 opacity-0'
        }`}
      >
        <div className="mx-auto flex max-w-[860px] items-center gap-3 px-4 py-3">
          <button type="button" data-no-nav onClick={() => go(i - 1, -1)} disabled={i === 0} aria-label="이전 컷"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--r-full)] text-[var(--t2)] backdrop-blur-xl transition-colors hover:text-[var(--p)] disabled:opacity-30"
            style={{ background: 'var(--mat-glass-bg-thin, rgba(250,250,247,.72))' }}>
            <ArrowLeft size={16} />
          </button>

          {/* stave dot rail */}
          <div className="flex flex-1 items-center justify-center gap-1.5 rounded-[var(--r-full)] px-3 py-2 backdrop-blur-xl" style={{ background: 'var(--mat-glass-bg-thin, rgba(250,250,247,.72))' }}>
            {staves.map((s, si) => {
              const isCur = s.idx === curStave
              const passed = i >= s.first + s.count
              const within = isCur && page ? (i - s.first + 1) / s.count : passed ? 1 : 0
              return (
                <button
                  key={s.idx} type="button" data-no-nav onClick={() => go(s.first, s.first < i ? -1 : 1)}
                  aria-label={`${s.label}, ${s.count}컷${isCur ? ' (현재)' : ''}`}
                  className="group relative flex h-6 items-center px-1"
                  style={{ minWidth: 22 }}
                >
                  {si > 0 && <span aria-hidden className="absolute -left-1 h-px w-1.5" style={{ background: 'var(--bd)' }} />}
                  <span
                    aria-hidden
                    className="relative inline-flex h-2.5 w-2.5 items-center justify-center rounded-full transition-all"
                    style={{
                      background: within >= 1 ? 'var(--active)' : within > 0 ? `color-mix(in srgb, var(--active) ${Math.round(within * 100)}%, var(--t4))` : 'var(--t4)',
                      boxShadow: isCur ? '0 0 0 2px color-mix(in srgb, var(--active) 45%, transparent)' : 'none',
                    }}
                  />
                </button>
              )
            })}
          </div>

          <span className="shrink-0 font-mono text-[11px] tabular-nums text-[var(--t3)]">{atEnd ? `${total}/${total}` : `${i + 1}/${total}`}</span>

          <button type="button" data-no-nav onClick={() => go(i + 1, 1)} disabled={atEnd} aria-label="다음 컷"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--r-full)] text-[var(--t2)] backdrop-blur-xl transition-colors hover:text-[var(--p)] disabled:opacity-30"
            style={{ background: 'var(--mat-glass-bg-thin, rgba(250,250,247,.72))' }}>
            <ArrowRight size={16} />
          </button>
        </div>
      </footer>

      {/* 단어 팝오버 */}
      {vocab && (
        <div role="dialog" aria-label={`${vocab} 학습`} className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center" onClick={() => setVocab(null)}>
          <div className="w-full max-w-sm rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-5 shadow-[var(--sh-lg)]" onClick={(e) => e.stopPropagation()}>
            <p className="font-display text-[20px] font-[800] text-[var(--t1)]">{vocab}</p>
            <p className="mt-1 font-body text-[12px] text-[var(--t3)]">이 장면의 맥락에서 만난 단어예요. 단어장에서 뜻과 함께 익혀 보세요.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setVocab(null)} className="rounded-[var(--r-full)] px-3 py-1.5 font-display text-[13px] font-[600] text-[var(--t3)] hover:text-[var(--t1)]">닫기</button>
              <Link href={`/wordvault/browse?q=${encodeURIComponent(vocab)}`} className="inline-flex items-center gap-1.5 rounded-[var(--r-full)] px-3.5 py-1.5 font-display text-[13px] font-[700] text-white" style={{ background: 'var(--active)' }}>
                <BookOpen size={13} aria-hidden /> 단어장에서 보기
              </Link>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes slideN { from { opacity: 0; transform: translateX(14px) } to { opacity: 1; transform: translateX(0) } }
        @keyframes slideP { from { opacity: 0; transform: translateX(-14px) } to { opacity: 1; transform: translateX(0) } }
        @keyframes bumpR { 0%,100% { transform: translateX(0) } 50% { transform: translateX(-8px) } }
        @keyframes bumpL { 0%,100% { transform: translateX(0) } 50% { transform: translateX(8px) } }
      `}</style>
    </div>
  )
}
