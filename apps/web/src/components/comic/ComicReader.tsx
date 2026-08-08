// apps/web/src/components/comic/ComicReader.tsx
//
// CCP 학습자 리더 v3 — 3관점 QA 감사(학습자·접근성·제3자) 반영.
//   접근성: 포커스-인지 키 핸들러(포커스가 컨트롤에 있으면 슬라이드 조작 안 함) · 실 모달
//     (aria-modal·focus 이동·Esc·focus 복귀) · 숨은 크롬 focus 시 자동 노출 · aria-live 컷 안내
//     · 44px 히트영역 · gold CTA 고대비 dark 텍스트 · 레일 shape 백업(완료/현재/남음).
//   UX: 크롬 컨트롤發 넘김은 크롬 유지(버튼 자기소멸 방지) · Dim 토큰 오버라이드(누수 0)
//     · 위치/Dim 영속(localStorage) · 첫 진입 온보딩 힌트 · 긴 대사 스크롤 · 깨진 이미지 폴백.
//   전권 로드(select_book_comic_all)로 stave-dot 레일 다중 dot + 챕터 연속.

'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, BookImage, BookOpen, Check, Eye, ListChecks, Loader2, Moon, Plus, Rows3, Sparkles, Square, Sun } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { addWordToVault } from '@/lib/wordvault/add-word'

interface VocabInfo {
  found?: boolean
  resolved_word?: string
  meaning_ko?: string
  pos?: string
  cefr_level?: string
  v_level?: number
  example_en?: string
}

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

const ON_GOLD = '#231a09' // gold(--active) 위 고대비 텍스트 (AA 통과, 양 테마)
// Dim 리딩 모드 — 토큰 오버라이드(모든 하위 요소 일괄 다크 · 누수 0)
const DIM_VARS: Record<string, string> = {
  '--bg': '#1a150f', '--bg2': '#120f0c', '--bg3': '#241d14',
  '--t1': '#ece4d6', '--t2': 'rgba(236,228,214,.64)', '--t3': 'rgba(236,228,214,.44)', '--t4': 'rgba(236,228,214,.22)',
  '--bd': '#3a3226', '--reading-bg': '#120F0C', '--mat-glass-bg-thin': 'rgba(26,21,15,.78)',
}

function speakerHue(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360
  return `hsl(${h} 34% 56%)`
}
const isInteractive = (el: EventTarget | null): boolean =>
  el instanceof HTMLElement && !!el.closest('button,a,input,textarea,select,[role="dialog"],[data-no-nav]')

export function ComicReader({ textId, bookTitle, pages }: ComicReaderProps) {
  const total = pages.length
  const [i, setI] = useState(0)
  const [revealed, setRevealed] = useState<Set<string>>(new Set())
  const [vocab, setVocab] = useState<string | null>(null)
  const [chrome, setChrome] = useState(true)
  const [dim, setDim] = useState(false)
  const [bump, setBump] = useState<'l' | 'r' | null>(null)
  const [dir, setDir] = useState<1 | -1>(1)
  const [broken, setBroken] = useState<Set<number>>(new Set())
  const [coach, setCoach] = useState(false)
  const [vocabInfo, setVocabInfo] = useState<VocabInfo | null>(null)
  const [vocabBusy, setVocabBusy] = useState(false)
  const [added, setAdded] = useState<'idle' | 'adding' | 'done' | 'exists'>('idle')
  const [recalled, setRecalled] = useState<Set<string>>(new Set()) // 세션 회상 성공(자기효능감)
  const [view, setView] = useState<'page' | 'scroll'>('page') // 페이지 넘김 / 세로 스크롤(웹툰형)
  const touch = useRef<{ x: number; y: number; moved: boolean } | null>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const bumpTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reduced = useRef(false)
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const vocabTrigger = useRef<HTMLElement | null>(null)
  const posKey = `vocaflow.comic.pos.${textId}`

  // 마운트: reduced-motion · 위치/Dim 복원 · 크롬 자동숨김 · 온보딩
  useEffect(() => {
    reduced.current = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    try {
      const saved = JSON.parse(localStorage.getItem(posKey) || '{}')
      if (typeof saved.i === 'number') setI(Math.max(0, Math.min(total, saved.i)))
      if (typeof saved.dim === 'boolean') setDim(saved.dim)
      if (saved.view === 'scroll' || saved.view === 'page') setView(saved.view)
      if (!localStorage.getItem('vocaflow.comic.coached')) setCoach(true)
    } catch { /* noop */ }
    if (!reduced.current) hideTimer.current = setTimeout(() => setChrome(false), 3000)
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current); if (bumpTimer.current) clearTimeout(bumpTimer.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 위치/Dim/뷰 영속
  useEffect(() => { try { localStorage.setItem(posKey, JSON.stringify({ i, dim, view })) } catch { /* noop */ } }, [i, dim, view, posKey])

  const dismissCoach = useCallback(() => {
    setCoach(false)
    try { localStorage.setItem('vocaflow.comic.coached', '1') } catch { /* noop */ }
  }, [])

  const atEnd = i >= total
  // src: 'chrome' 이면 크롬 유지(버튼/레일發 넘김이 스스로를 숨기지 않게)
  const go = useCallback((n: number, d: 1 | -1, src?: 'chrome' | 'key') => {
    setI((p) => {
      const t = Math.max(0, Math.min(total, n))
      if (t === p) {
        if (!reduced.current) { setBump(d < 0 ? 'l' : 'r'); if (bumpTimer.current) clearTimeout(bumpTimer.current); bumpTimer.current = setTimeout(() => setBump(null), 200) }
        return p
      }
      setDir(d)
      if (src === 'key') setChrome(true)           // 키보드 사용자는 크롬 노출 유지
      else if (src !== 'chrome') { setChrome(false); if (hideTimer.current) clearTimeout(hideTimer.current) }
      return t
    })
    if (coach) dismissCoach()
  }, [total, coach, dismissCoach])

  // 스크롤 모드: 대상 컷으로 스크롤
  const scrollToPanel = useCallback((n: number) => {
    const t = Math.max(0, Math.min(total, n))
    document.getElementById(`cp-${t}`)?.scrollIntoView({ behavior: reduced.current ? 'auto' : 'smooth', block: 'start' })
  }, [total])
  // 뷰 통합 네비게이션 (page → go · scroll → 스크롤)
  const nav = useCallback((n: number, d: 1 | -1, src?: 'chrome' | 'key') => {
    if (view === 'scroll') scrollToPanel(n)
    else go(n, d, src)
  }, [view, scrollToPanel, go])

  // 포커스-인지 키 핸들러 (다이얼로그 열림/컨트롤 포커스 시 슬라이드 조작 안 함)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (vocab) return // 모달 열림 → 리더 조작 차단(모달 자체 Esc 는 아래 effect)
      if (isInteractive(document.activeElement) && document.activeElement !== document.body) return
      if (e.key === 'ArrowRight' || (e.key === ' ' && !e.shiftKey)) { e.preventDefault(); nav(i + 1, 1, 'key') }
      else if (e.key === 'ArrowLeft' || (e.key === ' ' && e.shiftKey)) { e.preventDefault(); nav(i - 1, -1, 'key') }
      else if (e.key.toLowerCase() === 'm' || e.key === 'Escape') setChrome((c) => !c) // 크롬 토글(키보드)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [i, nav, vocab])

  // 모달: 포커스 이동 + Esc + 포커스 복귀
  useEffect(() => {
    if (!vocab) return
    const prev = document.activeElement as HTMLElement | null
    vocabTrigger.current = prev
    const node = dialogRef.current
    const focusables = node?.querySelectorAll<HTMLElement>('button,a[href]')
    focusables?.[0]?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); setVocab(null); return }
      if (e.key === 'Tab' && focusables && focusables.length) {
        const first = focusables[0], last = focusables[focusables.length - 1]
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => { document.removeEventListener('keydown', onKey, true); vocabTrigger.current?.focus?.() }
  }, [vocab])

  const toggleReveal = (key: string) => setRevealed((s) => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n })
  const toggleRecall = (key: string) => setRecalled((s) => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n })
  const reblur = (key: string) => setRevealed((s) => { const n = new Set(s); n.delete(key); return n })

  // 단어 팝오버 열림 → 실제 뜻 조회(lookup_word_meaning)
  useEffect(() => {
    if (!vocab) { setVocabInfo(null); setAdded('idle'); return }
    setVocabBusy(true); setVocabInfo(null)
    let alive = true
    createClient()
      .rpc('lookup_word_meaning', { p_surface: vocab })
      .then(({ data }: { data: unknown }) => { if (alive) setVocabInfo((Array.isArray(data) ? data[0] : data) ?? null) })
      .then(undefined, () => { if (alive) setVocabInfo(null) })
      .then(() => { if (alive) setVocabBusy(false) })
    return () => { alive = false }
  }, [vocab])

  const addToVault = async () => {
    if (!vocab || added === 'adding') return
    setAdded('adding')
    const res = await addWordToVault({
      word: vocab, meaning: vocabInfo?.meaning_ko ?? null, pronunciation: null,
      pos: vocabInfo?.pos ?? null, cefrLevel: vocabInfo?.cefr_level ?? null,
      exampleSentence: vocabInfo?.example_en ?? null, textId,
    })
    setAdded(res.ok ? (res.alreadyExists ? 'exists' : 'done') : 'idle')
  }

  // 스크롤 모드: 현재 컷 추적(IntersectionObserver) + 스크롤 시 크롬 숨김
  useEffect(() => {
    if (view !== 'scroll') return
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            const gi = Number((e.target as HTMLElement).dataset.gi)
            if (!Number.isNaN(gi)) setI(gi)
          }
        }
      },
      { rootMargin: '-45% 0px -45% 0px', threshold: 0 },
    )
    document.querySelectorAll('[data-gi]').forEach((el) => obs.observe(el))
    const onScroll = () => setChrome(false)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => { obs.disconnect(); window.removeEventListener('scroll', onScroll) }
  }, [view, total])

  const page = i < total ? pages[i] : null
  const stave = page?.staveLabel ?? (page ? `Chapter ${page.chapterIdx}` : '')

  // stave 그룹 (staveLabel 기준 — 전권 로드로 다중 dot)
  const staves = useMemo(() => {
    const seen = new Map<string, { key: string; label: string; first: number; count: number }>()
    pages.forEach((p, gi) => {
      const k = p.staveLabel ?? `Ch ${p.chapterIdx}`
      if (!seen.has(k)) seen.set(k, { key: k, label: k, first: gi, count: 0 })
      seen.get(k)!.count++
    })
    return [...seen.values()]
  }, [pages])
  const curStaveKey = page ? (page.staveLabel ?? `Ch ${page.chapterIdx}`) : staves[staves.length - 1]?.key

  const glass = { background: 'var(--mat-glass-bg-thin, rgba(250,250,247,.72))' }
  const rootStyle = { ...(dim ? DIM_VARS : {}), background: 'var(--reading-bg)', transition: 'background .3s var(--ease)' } as React.CSSProperties

  // 컷 1개 렌더 (page/scroll 공용). gi = 전권 index.
  const renderPanel = (p: ComicPage, gi: number) => {
    const st = p.staveLabel ?? `Chapter ${p.chapterIdx}`
    return (
      <>
        <div className="overflow-hidden rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] shadow-[var(--sh-sm)]">
          <div className="flex items-center justify-center bg-[var(--bg2)]">
            {broken.has(gi) || !p.imageUrl ? (
              <div className="grid h-[40vh] w-full place-items-center text-[var(--t4)]"><BookImage size={30} aria-hidden /></div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.imageUrl} alt={`${bookTitle} — ${st} 컷 ${p.pageOrder}`} loading="lazy" onError={() => setBroken((s) => new Set(s).add(gi))} className={`w-auto max-w-full ${view === 'scroll' ? 'max-h-[82vh]' : 'max-h-[56vh]'}`} />
            )}
          </div>
          <div aria-hidden style={{ height: 2, background: 'color-mix(in srgb, var(--active) 30%, transparent)' }} />
          <div className="flex select-text flex-col gap-2 px-3.5 py-3">
            <div className="flex items-center gap-2">
              <span className="font-display text-[10px] font-[700] uppercase tracking-[0.14em] text-[var(--active)]">{st}</span>
              <span className="h-px flex-1 bg-[var(--bd)]" aria-hidden />
            </div>
            {p.bubbles.length === 0 && <p className="font-body text-[12px] text-[var(--t4)]">…</p>}
            {p.bubbles.map((b, bi) => {
              const key = `${gi}-${bi}`
              const isCap = (b.kind ?? 'speech') === 'caption'
              const shown = !b.verbatim || revealed.has(key)
              if (isCap) return <p key={key} className="border-l-[3px] border-[var(--active)] pl-3 font-serif text-[13px] italic leading-relaxed text-[var(--t2)]">{b.text}</p>
              return (
                <div key={key} className="flex flex-col gap-0.5">
                  {b.speaker && (
                    <span className="inline-flex items-center gap-1.5 font-display text-[10px] font-[700] uppercase tracking-[0.06em] text-[var(--t3)]">
                      <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: speakerHue(b.speaker) }} />{b.speaker}
                    </span>
                  )}
                  {b.verbatim ? (
                    <div className="flex flex-col gap-1.5 self-start">
                      <button type="button" data-no-nav onClick={() => toggleReveal(key)} aria-pressed={shown} aria-label={shown ? `정본 대사: ${b.text}` : '정본 대사 — 기억해 보고 탭하여 확인'} className="group inline-flex min-h-11 items-center gap-2 rounded-[var(--r-md)] px-2.5 py-1.5 text-left font-body text-[14px] transition-colors motion-reduce:transition-none" style={{ border: '1px dashed color-mix(in srgb, var(--active) 55%, transparent)', background: 'color-mix(in srgb, var(--active) 8%, transparent)', color: shown ? 'var(--t1)' : 'var(--t3)' }}>
                        {!shown && <Eye size={13} aria-hidden style={{ color: 'var(--active)' }} />}
                        <span className={shown ? '' : 'select-none blur-[4px]'}>{b.text}</span>
                        {!shown && <span className="shrink-0 font-display text-[10px] font-[700] underline underline-offset-2" style={{ color: 'var(--active)' }}>기억나면 탭</span>}
                      </button>
                      {shown && (
                        <div className="flex items-center gap-2 pl-1">
                          <button type="button" data-no-nav onClick={() => toggleRecall(key)} aria-pressed={recalled.has(key)} className="inline-flex min-h-9 items-center gap-1 rounded-[var(--r-full)] px-2.5 py-1 font-display text-[11px] font-[700] transition-colors motion-reduce:transition-none" style={recalled.has(key) ? { background: 'color-mix(in srgb, var(--memory-stable) 16%, transparent)', color: 'var(--memory-stable)' } : { border: '1px solid var(--bd)', color: 'var(--t3)' }}>
                            {recalled.has(key) ? <><Check size={12} /> 기억함</> : '기억했어요'}
                          </button>
                          <button type="button" data-no-nav onClick={() => reblur(key)} className="min-h-9 font-body text-[11px] text-[var(--t3)] underline underline-offset-2 hover:text-[var(--t1)]">다시 볼게요</button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className={`font-body text-[14px] leading-snug text-[var(--t1)] ${b.kind === 'shout' ? 'font-[800]' : ''}`}>{b.text}</p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
        {p.targetVocab.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="font-display text-[10px] font-[700] uppercase tracking-[0.08em] text-[var(--t3)]">학습 단어</span>
            {p.targetVocab.map((w) => (
              <button key={w} type="button" data-no-nav onClick={(e) => { vocabTrigger.current = e.currentTarget; setVocab(w) }} className="min-h-11 rounded-[var(--r-full)] border border-[var(--bd)] bg-[var(--bg2)] px-2.5 py-1 font-body text-[13px] font-[600] text-[var(--t1)] transition-colors hover:border-[var(--active)] motion-reduce:transition-none">{w}</button>
            ))}
          </div>
        )}
      </>
    )
  }

  const endCTA = (
    <div className="flex flex-col items-center gap-5 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg2)] px-6 py-14 text-center">
      <Sparkles size={22} style={{ color: 'var(--active)' }} aria-hidden />
      <div>
        <p className="font-display text-[17px] font-[800] text-[var(--t1)]">여기까지 잘 읽었어요</p>
        <p className="mt-1 font-body text-[13px] text-[var(--t2)]">이야기의 흐름을 잡았다면, 이제 본문으로 더 깊이 만나 볼까요?</p>
        {recalled.size > 0 && (
          <p className="mt-2 inline-flex items-center gap-1.5 font-body text-[13px] font-[600]" style={{ color: 'var(--memory-stable)' }}>
            <Check size={14} aria-hidden /> 정본 대사 {recalled.size}개를 기억했어요
          </p>
        )}
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Link href={`/text/${textId}?mode=read`} className="inline-flex min-h-11 items-center gap-1.5 rounded-[var(--r-full)] px-4 py-2 font-display text-[13px] font-[700] shadow-[var(--sh-sm)] transition-transform hover:-translate-y-px motion-reduce:transition-none" style={{ background: 'var(--active)', color: ON_GOLD }}>
          <BookOpen size={14} aria-hidden /> 본문 읽기
        </Link>
        <Link href="/scriptquiz" className="inline-flex min-h-11 items-center gap-1.5 rounded-[var(--r-full)] border border-[var(--bd)] bg-[var(--bg)] px-4 py-2 font-display text-[13px] font-[700] text-[var(--t1)] transition-colors hover:border-[var(--active)]">
          <ListChecks size={14} aria-hidden /> 퀴즈로 확인
        </Link>
      </div>
    </div>
  )

  return (
    <div
      className="relative min-h-[calc(100vh-3rem)]"
      style={rootStyle}
      role="region"
      aria-roledescription="만화 리더"
      aria-label={`${bookTitle} 만화`}
    >
      {/* SR 전용 컷 안내 */}
      <div aria-live="polite" className="sr-only">
        {page ? `${stave}, 컷 ${i + 1} / ${total}` : `완료. 총 ${total}컷`}
      </div>

      {/* 상단 글래스바 (auto-hide · focus 시 자동 노출) */}
      <header
        onFocus={() => setChrome(true)}
        className={`fixed inset-x-0 top-0 z-30 transition-[opacity,transform] duration-[var(--dur-slower)] ease-[var(--ease)] motion-reduce:transition-none ${chrome ? 'translate-y-0 opacity-100' : 'pointer-events-none -translate-y-2 opacity-0'}`}
      >
        <div className="mx-auto flex max-w-[860px] items-center justify-between gap-3 px-4 py-2">
          <Link href={`/text/${textId}?mode=read`} className="inline-flex min-h-11 items-center gap-1.5 rounded-[var(--r-full)] px-3 py-1 font-body text-[13px] font-[600] text-[var(--t2)] backdrop-blur-xl transition-colors hover:text-[var(--p)]" style={glass}>
            <ArrowLeft size={15} aria-hidden /> 본문
          </Link>
          <span className="hidden truncate font-display text-[12px] font-[700] uppercase tracking-[0.1em] text-[var(--t3)] sm:block">{bookTitle}</span>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setView((v) => (v === 'page' ? 'scroll' : 'page'))} aria-label={view === 'page' ? '세로 스크롤 모드로' : '페이지 넘김 모드로'} className="inline-flex h-11 w-11 items-center justify-center rounded-[var(--r-full)] text-[var(--t2)] backdrop-blur-xl transition-colors hover:text-[var(--active)]" style={glass}>
              {view === 'page' ? <Rows3 size={16} /> : <Square size={16} />}
            </button>
            <button type="button" onClick={() => setDim((d) => !d)} aria-label={dim ? '밝은 모드로' : '어두운(몰입) 모드로'} aria-pressed={dim} className="inline-flex h-11 w-11 items-center justify-center rounded-[var(--r-full)] text-[var(--t2)] backdrop-blur-xl transition-colors hover:text-[var(--active)]" style={glass}>
              {dim ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </div>
      </header>

      {/* 뷰포트 */}
      <div
        className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-[860px] flex-col justify-start px-4 pb-24 pt-16 [touch-action:pan-y]"
        onPointerDown={(e) => (touch.current = { x: e.clientX, y: e.clientY, moved: false })}
        onPointerMove={(e) => { if (touch.current && (Math.abs(e.clientX - touch.current.x) > 8 || Math.abs(e.clientY - touch.current.y) > 8)) touch.current.moved = true }}
        onPointerUp={(e) => {
          const t = touch.current; touch.current = null; if (!t) return
          const dx = e.clientX - t.x, dy = e.clientY - t.y
          if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) return go(i + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1)
          if (!t.moved) {
            if (isInteractive(e.target)) return
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
            const x = (e.clientX - rect.left) / rect.width
            if (x > 0.62) go(i + 1, 1)
            else if (x < 0.38) go(i - 1, -1)
            else setChrome((c) => !c)
          }
        }}
      >
        {view === 'page' ? (
          page ? (
            <article key={i} className={`select-none ${bump === 'l' ? 'animate-[bumpL_.2s_ease]' : bump === 'r' ? 'animate-[bumpR_.2s_ease]' : dir === 1 ? 'animate-[slideN_.26s_ease]' : 'animate-[slideP_.26s_ease]'} motion-reduce:animate-none`}>
              {renderPanel(page, i)}
            </article>
          ) : (
            <div className="animate-[slideN_.26s_ease] motion-reduce:animate-none">{endCTA}</div>
          )
        ) : (
          <div className="flex flex-col gap-6">
            {pages.map((p, gi) => (
              <section key={gi} id={`cp-${gi}`} data-gi={gi} className="select-none scroll-mt-16">{renderPanel(p, gi)}</section>
            ))}
            <section id={`cp-${total}`} data-gi={total} className="scroll-mt-16 pt-2">{endCTA}</section>
          </div>
        )}
      </div>

      {/* 하단 글래스바: stave-dot 레일 */}
      <footer
        onFocus={() => setChrome(true)}
        className={`fixed inset-x-0 bottom-0 z-30 transition-[opacity,transform] duration-[var(--dur-slower)] ease-[var(--ease)] motion-reduce:transition-none ${chrome ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-2 opacity-0'}`}
      >
        <div className="mx-auto flex max-w-[860px] items-center gap-2 px-4 py-2.5">
          <button type="button" data-no-nav onClick={() => nav(i - 1, -1, 'chrome')} disabled={i === 0} aria-label="이전 컷" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--r-full)] text-[var(--t2)] backdrop-blur-xl transition-colors hover:text-[var(--p)] disabled:opacity-30 motion-reduce:transition-none" style={glass}><ArrowLeft size={17} /></button>

          <div className="flex flex-1 items-center justify-center gap-1 rounded-[var(--r-full)] px-2 py-1 backdrop-blur-xl" style={glass}>
            {staves.map((s, si) => {
              const isCur = s.key === curStaveKey
              const passed = i >= s.first + s.count
              const within = isCur && page ? (i - s.first + 1) / s.count : passed ? 1 : 0
              const state = passed ? '읽음' : isCur ? '현재' : '남음'
              return (
                <button key={s.key} type="button" data-no-nav onClick={() => { if (view === 'scroll' || s.first !== i) nav(s.first, s.first < i ? -1 : 1, 'chrome') }} aria-label={`${s.label}, ${s.count}컷, ${state}`} aria-current={isCur ? 'true' : undefined} className="group inline-flex h-11 items-center px-1.5">
                  {si > 0 && <span aria-hidden className="mr-1.5 h-px w-1.5 bg-[var(--bd)]" />}
                  <span aria-hidden className="relative inline-flex h-3 w-3 items-center justify-center rounded-full transition-all motion-reduce:transition-none" style={{
                    background: within >= 1 ? 'var(--active)' : within > 0 ? `color-mix(in srgb, var(--active) ${Math.round(within * 100)}%, transparent)` : 'transparent',
                    border: within >= 1 ? 'none' : `1.5px solid ${isCur ? 'var(--active)' : 'var(--t4)'}`,
                    boxShadow: isCur ? '0 0 0 2px color-mix(in srgb, var(--active) 40%, transparent)' : 'none',
                  }} />
                </button>
              )
            })}
          </div>

          <span className="shrink-0 font-mono text-[11px] tabular-nums text-[var(--t3)]" aria-hidden>{atEnd ? '완료' : `${i + 1}/${total}`}</span>
          <button type="button" data-no-nav onClick={() => go(i + 1, 1, 'chrome')} disabled={atEnd} aria-label="다음 컷" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--r-full)] text-[var(--t2)] backdrop-blur-xl transition-colors hover:text-[var(--p)] disabled:opacity-30 motion-reduce:transition-none" style={glass}><ArrowRight size={17} /></button>
        </div>
      </footer>

      {/* 첫 진입 온보딩 힌트 */}
      {coach && (
        <button type="button" onClick={dismissCoach} aria-label="안내 닫기" className="fixed inset-x-0 bottom-24 z-40 mx-auto flex w-fit items-center gap-2 rounded-[var(--r-full)] border border-[var(--bd)] px-4 py-2 font-body text-[12px] text-[var(--t2)] shadow-[var(--sh-lg)] backdrop-blur-xl" style={glass}>
          <Eye size={13} aria-hidden style={{ color: 'var(--active)' }} /> 가운데를 탭하면 메뉴 · 좌우로 넘겨요
        </button>
      )}

      {/* 단어 팝오버 (실 모달) */}
      {vocab && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" onClick={() => setVocab(null)}>
          <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={`${vocab} 학습`} className="w-full max-w-sm rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-5 shadow-[var(--sh-lg)]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-baseline gap-2">
              <p className="font-display text-[22px] font-[800] text-[var(--t1)]">{vocab}</p>
              {vocabInfo?.pos && <span className="font-body text-[12px] italic text-[var(--t3)]">{vocabInfo.pos}</span>}
              {vocabInfo?.cefr_level && <span className="rounded-[var(--r-full)] bg-[var(--bg2)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--t3)]">{vocabInfo.cefr_level}</span>}
            </div>
            {vocabBusy ? (
              <p className="mt-3 inline-flex items-center gap-1.5 font-body text-[13px] text-[var(--t3)]"><Loader2 size={13} className="animate-spin" /> 뜻을 불러오는 중…</p>
            ) : vocabInfo?.meaning_ko ? (
              <>
                <p className="mt-2 font-body text-[15px] font-[600] leading-snug text-[var(--t1)]">{vocabInfo.meaning_ko}</p>
                {vocabInfo.example_en && (
                  <p className="mt-2 border-l-[3px] border-[var(--active)] pl-3 font-serif text-[13px] italic leading-relaxed text-[var(--t2)]">{vocabInfo.example_en}</p>
                )}
              </>
            ) : (
              <p className="mt-2 font-body text-[13px] text-[var(--t3)]">이 장면의 맥락에서 만난 단어예요.</p>
            )}
            <div className="mt-4 flex items-center justify-between gap-2">
              <button type="button" onClick={() => setVocab(null)} className="min-h-11 rounded-[var(--r-full)] px-3 py-1.5 font-display text-[13px] font-[600] text-[var(--t3)] hover:text-[var(--t1)]">닫기</button>
              <div className="flex gap-2">
                <Link href={`/wordvault/browse?q=${encodeURIComponent(vocab)}`} className="inline-flex min-h-11 items-center gap-1.5 rounded-[var(--r-full)] border border-[var(--bd)] px-3 py-1.5 font-display text-[13px] font-[600] text-[var(--t2)] transition-colors hover:border-[var(--active)] hover:text-[var(--t1)]">
                  <BookOpen size={13} aria-hidden /> 단어장
                </Link>
                <button type="button" onClick={addToVault} disabled={added === 'adding' || added === 'done' || added === 'exists'} className="inline-flex min-h-11 items-center gap-1.5 rounded-[var(--r-full)] px-3.5 py-1.5 font-display text-[13px] font-[700] disabled:opacity-70" style={{ background: 'var(--active)', color: ON_GOLD }}>
                  {added === 'adding' ? <Loader2 size={13} className="animate-spin" /> : added === 'done' || added === 'exists' ? <Check size={14} /> : <Plus size={14} />}
                  {added === 'done' ? '추가됨' : added === 'exists' ? '이미 있음' : '단어장 추가'}
                </button>
              </div>
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
