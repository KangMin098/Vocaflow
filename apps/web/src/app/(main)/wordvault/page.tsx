// apps/web/src/app/main/wordvault/page.tsx
// WordVault 메인 — 3-View 시스템 (Browse / Study / Review)

'use client'

import { Menu } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useMainLayout } from '../layout'

import { CollectionsRow } from '@/components/wordvault/CollectionsRow'
import { HideToggleBar } from '@/components/wordvault/HideToggleBar'
import { ListenPanel } from '@/components/wordvault/ListenPanel'
import { PageHeader } from '@/components/wordvault/PageHeader'
import { SearchRow } from '@/components/wordvault/SearchRow'
import { StatsGrid } from '@/components/wordvault/StatsGrid'
import { StudyMode } from '@/components/wordvault/StudyMode'
import { WordList } from '@/components/wordvault/WordList'
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
import { cn } from '@/lib/utils/cn'

export default function WordVaultPage() {
  const { openSidebar, theme, toggleTheme } = useMainLayout()

  // ── 화면 ──
  const [screen, setScreen] = useState<ScreenName>('browse')

  // ── 데이터 ──
  const [words] = useState<WordItem[]>(MOCK_WORDS)

  // ── 선택 ──
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

  // ── 숨김 (영단어 / 뜻) ──
  const [hideStates, setHideStates] = useState<HideStates>({
    word: false,
    meaning: false,
  })

  // ── 펼침 (예문) ──
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())

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

  const handleToggleExpand = useCallback((id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const allExpanded = expandedIds.size === words.length && words.length > 0

  const handleToggleAllExpanded = useCallback(() => {
    setExpandedIds((prev) => {
      if (prev.size === words.length) return new Set()
      return new Set(words.map((w) => w.id))
    })
  }, [words])

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

  // ── 키보드 단축키 ──
  useEffect(() => {
    if (screen !== 'browse') return

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
      } else if (e.key === 'e' || e.key === 'E') {
        handleToggleAllExpanded()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [screen, queue, words, handleToggleHide, handleToggleAllExpanded])

  return (
    <>
      {/* ── 헤더 ── */}
      <header className="sticky top-0 z-50 flex h-[56px] items-center gap-s-3 border-b border-bd bg-bg px-s-6">
        <button
          type="button"
          onClick={openSidebar}
          aria-label="메뉴"
          className="flex h-9 w-9 items-center justify-center rounded-md text-t1 transition-colors duration-fast hover:bg-bg2 lg:hidden"
        >
          <Menu size={18} />
        </button>

        <h1 className="font-display text-base font-semibold tracking-[-0.01em] text-t1">
          WordVault
        </h1>

        <div className="flex-1" />

        {/* View Switcher */}
        <div className="inline-flex rounded-lg border border-bd bg-bg2 p-[3px]">
          {(['browse', 'study', 'review'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setScreen(s)}
              className={cn(
                'flex items-center gap-s-2 rounded-md px-s-3 py-[5px]',
                'font-display text-[13px] font-semibold tracking-[-0.01em]',
                'transition-all duration-fast',
                screen === s ? 'bg-bg text-t1 shadow-xs' : 'text-t3 hover:text-t1'
              )}
              aria-current={screen === s ? 'page' : undefined}
            >
              {s === 'browse' && '둘러보기'}
              {s === 'study' && '학습'}
              {s === 'review' && '복습'}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={toggleTheme}
          aria-label="테마 전환"
          className="flex h-9 w-9 items-center justify-center rounded-md text-t2 transition-colors duration-fast hover:bg-bg2 hover:text-t1"
        >
          {theme === 'light' ? '🌙' : '☀️'}
        </button>
      </header>

      {/* ── 메인 ── */}
      <main className="flex-1 overflow-y-auto bg-bg p-s-6 pb-s-12">
        <div className="mx-auto max-w-[1200px]">
          {/* ── BROWSE ── */}
          {screen === 'browse' && (
            <>
              <PageHeader onStartStudy={() => setScreen('study')} />

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
                allExpanded={allExpanded}
                onToggleAllExpanded={handleToggleAllExpanded}
              />

              <SearchRow />

              <WordList
                words={words}
                selectedIds={selectedIds}
                onToggleSelect={handleToggleSelect}
                onToggleSelectAll={handleToggleSelectAll}
                expandedIds={expandedIds}
                onToggleExpand={handleToggleExpand}
                playingId={queue.currentWord?.id ?? null}
                hideStates={hideStates}
                onPlayWord={handlePlayWord}
                onPlayExample={handlePlayExample}
              />
            </>
          )}

          {/* ── STUDY ── */}
          {screen === 'study' && <StudyMode words={words} onExit={() => setScreen('browse')} />}

          {/* ── REVIEW ── */}
          {screen === 'review' && (
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
                onClick={() => setScreen('study')}
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
