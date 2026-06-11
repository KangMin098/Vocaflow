// apps/web/src/app/(main)/wordvault/page.tsx
// WordVault — 허브 (4 Tier IA) + 3-View (Browse/Study/Review)
// Routes:
//   /wordvault                 → 허브 (기본 진입)
//   /wordvault?view=browse     → Browse (둘러보기)
//   /wordvault?view=study      → StudyMode (학습)
//   /wordvault?view=review     → Review (복습 placeholder)

'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

import { useToast } from '@/components/ui/Toast'
import { CollectionsRow } from '@/components/wordvault/CollectionsRow'
import { HideToggleBar } from '@/components/wordvault/HideToggleBar'
import { ListenPanel } from '@/components/wordvault/ListenPanel'
import { PageHeader } from '@/components/wordvault/PageHeader'
import { SearchRow } from '@/components/wordvault/SearchRow'
import { StatsGrid } from '@/components/wordvault/StatsGrid'
import { StudyMode } from '@/components/wordvault/StudyMode'
import { WordList } from '@/components/wordvault/WordList'
import { WordVaultHub } from '@/components/wordvault/hub/WordVaultHub'
import { useHubStats } from '@/components/wordvault/hooks/useHubStats'
import { useListenQueue } from '@/components/wordvault/hooks/useListenQueue'
import { useSpeech } from '@/components/wordvault/hooks/useSpeech'
import { MOCK_WORDS } from '@/components/wordvault/mock-data'
import type {
  HideStates,
  HideType,
  ListenSettings,
  ScreenName,
  WordItem,
} from '@/components/wordvault/types'
import { useTheme } from '@/hooks/useTheme'
import { consumePendingWords, toWordItem } from '@/lib/text-viewer/handoff'
import { cn } from '@/lib/utils/cn'

type ViewName = 'hub' | ScreenName

function parseView(param: string | null): ViewName {
  if (param === 'browse' || param === 'study' || param === 'review') return param
  return 'hub'
}

export default function WordVaultPage() {
  const { theme, toggleTheme } = useTheme()
  const toast = useToast()
  const router = useRouter()
  const searchParams = useSearchParams()

  // ── 화면 — URL query param 기반 ──
  const view = parseView(searchParams?.get('view') ?? null)

  // ── 데이터 ──
  const [words, setWords] = useState<WordItem[]>(MOCK_WORDS)

  // ── 허브 Hero/VaultBar 실 데이터 (Phase 2 진입 — C-1) ──
  // 로딩 중에는 undefined 로 전달 → mock 그대로 표시 (FOUC 회피)
  const hubStatsState = useHubStats()
  const realStats = hubStatsState.status === 'ready' ? hubStatsState.data : undefined

  // ── TextViewer 인계 단어 수신 → ?view=browse 자동 진입 ──
  useEffect(() => {
    const pending = consumePendingWords()
    if (!pending || pending.length === 0) return

    setWords((prev) => {
      const baseId = prev.reduce((max, w) => Math.max(max, w.id), 0) + 1
      const incoming = pending.map((w, idx) => toWordItem(w, baseId + idx))
      return [...incoming, ...prev]
    })

    toast.success(`${pending.length}개 단어가 추가되었어요`, {
      title: 'TextViewer에서 인계',
    })

    // After ingestion, ensure user lands on browse view (v06.21.6 새 풀스크린 라우트)
    router.replace('/wordvault/browse')
  }, [toast, router])

  // ── ?view=browse 호환성 redirect (v06.21.6) — 쿼리 파라미터 보존 ──
  useEffect(() => {
    if (searchParams.get('view') === 'browse') {
      const params = new URLSearchParams(searchParams.toString())
      params.delete('view')
      const qs = params.toString()
      router.replace(qs ? `/wordvault/browse?${qs}` : '/wordvault/browse')
    }
  }, [searchParams, router])

  // ── 선택 ──
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

  // ── 숨김 (영단어 / 뜻) ──
  const [hideStates, setHideStates] = useState<HideStates>({
    word: false,
    meaning: false,
  })

  // ── 듣기 설정 ──
  const [listenSettings, setListenSettings] = useState<ListenSettings>({
    content: 'word',
    speed: 1.0,
    gap: 1.0,
    repeat: 1,
    shuffle: false,
  })

  // ── 듣기 훅 ──
  const queue = useListenQueue(listenSettings)
  const { speak } = useSpeech()

  // ── 핸들러 ──
  const handleToggleSelect = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleToggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (prev.size === words.length) return new Set()
      return new Set(words.map((w) => w.id))
    })
  }, [words])

  const handleToggleHide = useCallback((type: HideType) => {
    setHideStates((prev) => ({ ...prev, [type]: !prev[type] }))
  }, [])

  const handlePlayWord = useCallback(
    (id: number) => {
      const w = words.find((x) => x.id === id)
      if (w) speak(w.word, { rate: listenSettings.speed })
    },
    [words, listenSettings.speed, speak]
  )

  const handlePlayExample = useCallback(
    (id: number) => {
      const w = words.find((x) => x.id === id)
      if (w) speak(w.exampleEn, { rate: listenSettings.speed * 0.95 })
    },
    [words, listenSettings.speed, speak]
  )

  // ── 키보드 단축키 (browse 전용) ──
  useEffect(() => {
    if (view !== 'browse') return

    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return

      if (e.code === 'Space') {
        e.preventDefault()
        if (queue.isPlaying) queue.togglePause()
        else queue.startQueue(words)
      } else if (e.key === 'h' || e.key === 'H') {
        handleToggleHide('word')
      } else if (e.key === 'm' || e.key === 'M') {
        handleToggleHide('meaning')
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [view, queue, words, handleToggleHide])

  return (
    <>
      {/* ── 헤더 (v06.35 Editorial) ── */}
      <header className="sticky top-0 z-50 flex h-[56px] items-center gap-3 border-b border-[var(--bd)] bg-[var(--bg)] px-6">
        <div className="flex items-baseline gap-3">
          <h1 className="font-display text-[15px] font-[700] tracking-[-0.01em] text-[var(--t1)]">
            WordVault
          </h1>
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--t3)]">
            내 어휘
          </span>
        </div>

        <div className="flex-1" />

        {/* View Switcher — 단순화 (허브 / 학습 / 복습 — 둘러보기는 풀스크린 별도) */}
        <nav
          aria-label="WordVault 뷰"
          className="inline-flex items-center gap-1 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] p-[3px]"
        >
          {(
            [
              { key: 'hub', label: '허브', href: '/wordvault' },
              { key: 'browse', label: '둘러보기', href: '/wordvault/browse' },
              { key: 'study', label: '학습', href: '/wordvault?view=study' },
              { key: 'review', label: '복습', href: '/wordvault?view=review' },
            ] as const
          ).map((item) => {
            const isActive = view === item.key
            return (
              <Link
                key={item.key}
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'rounded-[var(--r-sm)] px-3 py-[5px] font-display text-[12px] font-[600] no-underline transition-colors duration-[var(--dur-fast)]',
                  isActive
                    ? 'bg-[var(--bg)] text-[var(--t1)] shadow-[var(--sh-xs)]'
                    : 'text-[var(--t3)] hover:text-[var(--t1)]',
                )}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>

        <button
          type="button"
          onClick={toggleTheme}
          aria-label="테마 전환"
          className="flex h-8 w-8 items-center justify-center rounded-[var(--r-sm)] text-[var(--t3)] transition-colors duration-[var(--dur-fast)] hover:bg-[var(--bg2)] hover:text-[var(--t1)]"
        >
          {theme === 'light' ? '🌙' : '☀️'}
        </button>
      </header>

      {/* ── 메인 (v06.35: 허브는 자체 max-width 적용 — 외곽 wrapper 제거) ── */}
      <main className="flex-1 overflow-y-auto bg-[var(--bg2)] pb-12">
        <div className={view === 'hub' ? '' : 'mx-auto max-w-[1200px] p-6'}>
          {/* ── HUB (기본 진입) ── */}
          {view === 'hub' && <WordVaultHub words={words} realStats={realStats} />}

          {/* ── BROWSE ── */}
          {view === 'browse' && (
            <>
              <PageHeader onStartStudy={() => router.push('/wordvault?view=study')} />

              <StatsGrid />

              <CollectionsRow />

              <ListenPanel
                allWords={words}
                selectedIds={selectedIds}
                settings={listenSettings}
                onSettingsChange={setListenSettings}
                onStartPlay={(q) => queue.startQueue(q)}
                onStop={queue.stopQueue}
                onTogglePause={queue.togglePause}
                onNext={queue.next}
                onPrev={queue.prev}
                isPlaying={queue.isPlaying}
                isPaused={queue.isPaused}
                currentIndex={queue.currentIndex}
                queueLength={queue.queueLength}
                currentWord={queue.currentWord}
              />

              <HideToggleBar
                hideStates={hideStates}
                onToggle={handleToggleHide}
              />

              <SearchRow />

              <WordList
                words={words}
                selectedIds={selectedIds}
                onToggleSelect={handleToggleSelect}
                onToggleSelectAll={handleToggleSelectAll}
                playingId={queue.currentWord?.id ?? null}
                hideStates={hideStates}
                onPlayWord={handlePlayWord}
              />
            </>
          )}

          {/* ── STUDY ── */}
          {view === 'study' && (
            <StudyMode
              words={words}
              onExit={() => router.push('/wordvault/browse')}
            />
          )}

          {/* ── REVIEW ── */}
          {view === 'review' && (
            <div className="border-learn-mastered from-learn-mastered-light mx-auto max-w-[680px] rounded-2xl border-[1.5px] bg-gradient-to-br to-bg p-s-12 text-center">
              <div className="mb-s-3 text-[48px]">🔁</div>
              <h2 className="mb-s-2 font-display text-[26px] font-extrabold tracking-[-0.025em] text-t1">
                오늘 복습할 단어 <span className="text-learn-mastered">12개</span>
              </h2>
              <p className="mb-s-5 font-body text-sm font-medium text-t2">
                vmPFC 재인코딩 강화 · 망각 곡선 기반 자동 선별
              </p>
              <button
                type="button"
                onClick={() => router.push('/wordvault?view=study')}
                className="bg-learn-mastered inline-flex items-center gap-s-2 rounded-md px-s-6 py-s-3 font-display text-sm font-bold tracking-[-0.01em] text-white shadow-md transition-all duration-fast hover:-translate-y-px hover:bg-[#7C3AED] hover:shadow-lg"
              >
                지금 시작 →
              </button>
            </div>
          )}
        </div>
      </main>
    </>
  )
}
