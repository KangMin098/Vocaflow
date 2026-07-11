// apps/web/src/components/layout/SessionFrame.tsx
//
// 풀스크린 세션 라우트 진입 시 자동 주입되는 상단 셸.
// (main)/layout.tsx 에서 children 을 감싸므로 세션 페이지 코드 변경 불필요.
//
// 셸 구성 (v06.21.1 — 리소스 컨텍스트 추가):
//   ┌──────────────────────────────────────────────────────────┐
//   │ 🎯 플래시카드          [3 / 12]    [단계 ▾] [✕]        │  ← Top: 모듈 정체성
//   │ 📖 내 스크립트 › The Great Gatsby › Chapter 3            │  ← Sub: 리소스 브레드크럼
//   └──────────────────────────────────────────────────────────┘
//
// 페이지가 useSessionProgress() 로 진행도 + 리소스 컨텍스트를 주입.
// 풀스크린 라우트 아닐 때는 children 만 그대로 렌더 (passthrough).

'use client'

import { BookOpen, ChevronDown, Compass, Layers, Sparkles, X } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import { isFullScreenRoute } from '@/lib/layout/full-screen-routes'

// ── Session metadata ─────────────────────────────────────────────
interface SessionMeta {
  title: string
  emoji: string
  closeHref: string
}

const SESSION_META: Record<string, SessionMeta> = {
  '/flashcard/play': { title: '플래시카드', emoji: '🎯', closeHref: '/flashcard' },
  '/spellforge/play': { title: 'SpellForge', emoji: '⚡', closeHref: '/spellforge' },
  '/scriptquiz/play': { title: 'ScriptQuiz', emoji: '🏆', closeHref: '/scriptquiz' },
  '/dictate/session': { title: 'Dictation', emoji: '🎙', closeHref: '/dictate' },
  '/play/wordblitz': { title: 'WordBlitz', emoji: '⏱', closeHref: '/wordblitz' },
  '/play/pirate-quest': { title: "Pirate's Bounty", emoji: '🏴‍☠️', closeHref: '/hub' },
  '/pairflip/play': { title: 'PairFlip', emoji: '🎴', closeHref: '/pairflip' },
  '/wordvault/browse': { title: 'WordVault', emoji: '📖', closeHref: '/wordvault' },
  // ── 아케이드 스위트 6종 (v07.3) ──
  '/play/letter-forge': { title: 'Letter Forge', emoji: '🔤', closeHref: '/arcade' },
  '/play/cascade': { title: 'Cascade', emoji: '🌊', closeHref: '/arcade' },
  '/play/connections': { title: 'Connections', emoji: '🧩', closeHref: '/arcade' },
  '/play/word-economy': { title: 'Word Economy', emoji: '🪙', closeHref: '/arcade' },
  '/play/daily-blitz': { title: 'Daily Blitz', emoji: '📅', closeHref: '/arcade' },
  '/play/ghost-race': { title: 'Ghost Race', emoji: '🏁', closeHref: '/arcade' },
  '/play/glyph-tongue': { title: 'The Glyph Tongue', emoji: '📜', closeHref: '/arcade' },
  '/play/word-customs': { title: 'Word Customs', emoji: '🛂', closeHref: '/arcade' },
  '/play/lexicon-hands': { title: 'Lexicon Hands', emoji: '🃏', closeHref: '/arcade' },
  '/play/lexicon-detective': { title: 'Lexicon Detective', emoji: '🔍', closeHref: '/arcade' },
  '/play/morpheme-rules': { title: 'Morpheme Rules', emoji: '🧩', closeHref: '/arcade' },
}

const DEFAULT_META: SessionMeta = {
  title: '학습 세션',
  emoji: '✨',
  closeHref: '/hub',
}

// ── 단계 이동 콤보 옵션 ───────────────────────────────────────────
const STAGE_OPTIONS = [
  { label: '플래시카드', href: '/flashcard/play' },
  { label: 'WordBlitz', href: '/play/wordblitz' },
  { label: 'PairFlip', href: '/pairflip/play' },
  { label: 'SpellForge', href: '/spellforge/play' },
  { label: 'ScriptQuiz', href: '/scriptquiz/play' },
  { label: 'Dictation', href: '/dictate/session' },
] as const

// ── Resource type → 시각 매핑 ────────────────────────────────────
export type SessionResourceType = 'library' | 'vocab' | 'script' | 'custom'

const RESOURCE_TYPE_META: Record<
  SessionResourceType,
  { label: string; Icon: typeof BookOpen; color: string }
> = {
  library: { label: '라이브러리', Icon: Compass, color: '#8B5CF6' },
  vocab: { label: '공용 단어장', Icon: Layers, color: '#6366F1' },
  script: { label: '내 스크립트', Icon: BookOpen, color: '#8B5CF6' },
  custom: { label: '', Icon: Sparkles, color: '#F59E0B' },
}

export interface SessionResource {
  /** 출처 분류 */
  type: SessionResourceType
  /** 자료 메인 라벨 — 예: "The Great Gatsby", "수능 빈출 1000" */
  label: string
  /** 위치 부 라벨 (옵션) — 예: "Chapter 3", "Day 5", "Page 12" */
  position?: string
  /** 클릭 시 이동 (옵션) — 보통 hub URL */
  href?: string
}

// ── Progress / Resource Context ──────────────────────────────────
export interface SessionProgress {
  current?: number
  total?: number
  /** 직접 라벨 — current/total 보다 우선. 예: "Page 3 / 5" */
  label?: string
  /** 리소스 컨텍스트 — 좌측 하단 브레드크럼에 표시 */
  resource?: SessionResource
}

interface SessionContextValue {
  setProgress: (info: SessionProgress | null) => void
}

const SessionContext = createContext<SessionContextValue>({ setProgress: () => {} })

/**
 * 세션 페이지에서 호출하여 셸 상단에 진행도 + 리소스 컨텍스트 주입.
 *
 * @example
 *   const { setProgress } = useSessionProgress()
 *   useEffect(() => {
 *     setProgress({
 *       current: 3, total: 12,
 *       resource: {
 *         type: 'script',
 *         label: 'The Great Gatsby',
 *         position: 'Chapter 3',
 *       },
 *     })
 *   }, [...])
 */
export function useSessionProgress() {
  return useContext(SessionContext)
}

// ── SessionFrame ─────────────────────────────────────────────────
export function SessionFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? ''
  const router = useRouter()
  const [progress, setProgress] = useState<SessionProgress | null>(null)

  const ctx = useMemo<SessionContextValue>(
    () => ({ setProgress }),
    [setProgress],
  )

  const isFullScreen = isFullScreenRoute(pathname)
  const meta = SESSION_META[pathname] ?? DEFAULT_META

  // 진입 출처(?from=) — 워크스페이스(/text/[id]) 등에서 세션 진입 시 닫기/Esc 가 그 자리로 복귀.
  //   layout 레벨 useSearchParams 정적 deopt 회피 위해 window.location 으로 읽음 (client-only).
  const [fromHref, setFromHref] = useState<string | null>(null)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const f = new URLSearchParams(window.location.search).get('from')
    // 내부 절대경로만 허용 (open-redirect 차단)
    setFromHref(f && f.startsWith('/') && !f.startsWith('//') ? f : null)
  }, [pathname])

  // 닫기 목적지 — 출처가 있으면 그곳, 없으면 모듈 hub.
  const closeHref = fromHref ?? meta.closeHref
  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        router.push(closeHref)
      }
    },
    [router, closeHref],
  )

  useEffect(() => {
    if (!isFullScreen) return
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isFullScreen, handleEscape])

  // 라우트 변경 시 progress 초기화
  useEffect(() => {
    setProgress(null)
  }, [pathname])

  if (!isFullScreen) {
    return <SessionContext.Provider value={ctx}>{children}</SessionContext.Provider>
  }

  const progressLabel =
    progress?.label ??
    (progress?.current != null && progress?.total != null
      ? `${progress.current} / ${progress.total}`
      : '')

  const resource = progress?.resource
  const hasResource = !!resource && resource.label.length > 0

  const currentOptionMatch = STAGE_OPTIONS.some((o) => o.href === pathname)

  return (
    <SessionContext.Provider value={ctx}>
      <div className="flex min-h-screen flex-col bg-[var(--bg)]">
        {/* ── Sticky session header ── */}
        <header
          role="banner"
          className={`sticky top-0 z-40 shrink-0 border-b border-[var(--bd)] bg-[var(--bg)]/95 backdrop-blur ${
            hasResource ? 'px-3 py-2 md:px-5 md:py-2.5' : 'px-3 md:px-5'
          }`}
        >
          {/* Top row */}
          <div
            className={`flex items-center justify-between gap-2 ${
              hasResource ? '' : 'h-12 md:h-14'
            }`}
          >
            {/* Left: emoji + title + (desktop) progress */}
            <div className="flex min-w-0 items-center gap-2">
              <span className="text-[18px] leading-none" aria-hidden="true">
                {meta.emoji}
              </span>
              <h1 className="truncate font-display text-[14px] font-[700] tracking-tight text-[var(--t1)] md:text-[15px]">
                {meta.title}
              </h1>
              {progressLabel && (
                <span className="ml-1 hidden rounded-[var(--r-full)] bg-[var(--bg2)] px-2 py-0.5 font-mono text-[11px] font-[600] tabular-nums text-[var(--t2)] md:inline-block">
                  {progressLabel}
                </span>
              )}
            </div>

            {/* Right: stage combo + close */}
            <div className="flex shrink-0 items-center gap-1.5">
              <div className="relative">
                <select
                  value={currentOptionMatch ? pathname : ''}
                  onChange={(e) => {
                    if (!e.target.value) return
                    // 세션 전환 시에도 출처(워크스페이스) 유지
                    router.push(
                      fromHref
                        ? `${e.target.value}?from=${encodeURIComponent(fromHref)}`
                        : e.target.value,
                    )
                  }}
                  aria-label="다른 학습 세션으로 이동"
                  title="단계 이동"
                  className="h-9 min-h-[36px] cursor-pointer appearance-none rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] py-0 pl-3 pr-8 font-display text-[13px] font-[600] text-[var(--t1)] transition-colors duration-[var(--dur-normal)] hover:bg-[var(--bg2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-1"
                >
                  {!currentOptionMatch && (
                    <option value="" disabled hidden>
                      {meta.title}
                    </option>
                  )}
                  {STAGE_OPTIONS.map((opt) => (
                    <option key={opt.href} value={opt.href}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={14}
                  strokeWidth={2}
                  aria-hidden="true"
                  className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[var(--t3)]"
                />
              </div>

              <Link
                href={closeHref}
                aria-label="세션 닫기 (Esc)"
                title="세션 닫기 (Esc)"
                className="inline-flex h-9 w-9 min-h-[36px] min-w-[36px] items-center justify-center rounded-[var(--r-md)] text-[var(--t2)] transition-colors duration-[var(--dur-normal)] hover:bg-[var(--error-light)] hover:text-[var(--error)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-1"
              >
                <X size={18} strokeWidth={2} aria-hidden="true" />
              </Link>
            </div>
          </div>

          {/* ── Bottom row: 리소스 브레드크럼 (resource 있을 때만) ── */}
          {hasResource && resource && <ResourceBreadcrumb resource={resource} />}
        </header>

        {/* Mobile progress strip */}
        {progressLabel && (
          <div
            className="border-b border-[var(--bd)] bg-[var(--bg2)] px-4 py-1 font-mono text-[11px] font-[600] tabular-nums text-[var(--t2)] md:hidden"
            aria-live="polite"
          >
            {progressLabel}
          </div>
        )}

        {/* Session content */}
        <div className="flex-1">{children}</div>
      </div>
    </SessionContext.Provider>
  )
}

// ── Resource Breadcrumb ─────────────────────────────────────────
//
// 디자인:
//   [type icon] [type 라벨] › [자료명] › [위치]
//
//   - type icon: 16px, 출처별 색
//   - type 라벨: 11px mono uppercase tracking — 출처 분류 시각 강조
//   - 자료명: 12px font-display 600 — 메인 정체성
//   - 위치: 11px mono — 보조 위치 정보
//   - separator: chevron 10px muted (›)
//   - 클릭 가능 시 hover 시 type 색으로 강조
//
function ResourceBreadcrumb({ resource }: { resource: SessionResource }) {
  const meta = RESOURCE_TYPE_META[resource.type]
  const Icon = meta.Icon

  const inner = (
    <>
      {/* Type indicator (icon + label) */}
      <span className="inline-flex shrink-0 items-center gap-1.5">
        <Icon
          size={13}
          strokeWidth={2}
          aria-hidden="true"
          style={{ color: meta.color }}
        />
        {meta.label && (
          <span
            className="font-mono text-[10px] font-[700] uppercase tracking-[0.08em]"
            style={{ color: meta.color }}
          >
            {meta.label}
          </span>
        )}
      </span>

      {/* Separator */}
      {meta.label && (
        <span
          aria-hidden="true"
          className="text-[10px] font-[400] text-[var(--t4)]"
        >
          ›
        </span>
      )}

      {/* Main label */}
      <span className="min-w-0 truncate font-display text-[12px] font-[600] text-[var(--t1)]">
        {resource.label}
      </span>

      {/* Position (옵션) */}
      {resource.position && (
        <>
          <span aria-hidden="true" className="text-[10px] font-[400] text-[var(--t4)]">
            ›
          </span>
          <span className="shrink-0 font-mono text-[11px] font-[500] tabular-nums text-[var(--t3)]">
            {resource.position}
          </span>
        </>
      )}
    </>
  )

  const ariaLabel = `현재 학습: ${meta.label ? `${meta.label}, ` : ''}${resource.label}${
    resource.position ? `, ${resource.position}` : ''
  }`

  return (
    <nav
      aria-label="현재 학습 리소스"
      className="mt-1 flex min-w-0 items-center gap-1.5 md:mt-1.5"
    >
      {resource.href ? (
        <Link
          href={resource.href}
          aria-label={ariaLabel}
          className="group inline-flex min-w-0 items-center gap-1.5 rounded-[var(--r-sm)] px-1 py-0.5 -mx-1 transition-colors duration-[var(--dur-normal)] hover:bg-[var(--bg2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
        >
          {inner}
        </Link>
      ) : (
        <div
          aria-label={ariaLabel}
          className="inline-flex min-w-0 items-center gap-1.5"
        >
          {inner}
        </div>
      )}
    </nav>
  )
}
