// apps/web/src/app/(main)/wordvault/page.tsx
// WordVault — 허브 (4 Tier IA) + 3-View (Browse/Study/Review)
// Routes:
//   /wordvault                 → 허브 (기본 진입)
//   /wordvault?view=browse     → Browse (둘러보기)
//   /wordvault?view=study      → StudyMode (학습)
//   /wordvault?view=review     → Review (복습 placeholder)

'use client'

import { RotateCcw } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

import { GlassBar, SegmentControl } from '@/components/ui/ios'
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
  //
  // ⚠️ **아직 목업이다 (알려진 결함 · 범위 밖).** `words` 는 `MOCK_WORDS` + TextViewer 인계
  // 단어로만 채워지고, 학습자의 실제 `vocabularies` 를 읽는 경로가 없다. 그래서
  // 둘러보기·학습·듣기 큐가 남의 단어 위에서 돈다.
  //
  // 왜 여기서 안 고치나: `WordItem.id` 가 `number` 인데 `vocabularies.id` 는 uuid 다. 실데이터를
  // 넣으려면 타입부터 바꿔야 하고 WordList·StudyMode·ListenPanel·useListenQueue·HideToggleBar 가
  // 함께 움직인다. 색 교체 수준이 아니라 별도 작업이다.
  //
  // 다만 **허브 통계는 더 이상 여기로 폴백하지 않는다** — 목업 13개가 실제 252개인 학습자의
  // 수치 자리에 앉아 있었다(2026-08-15 실측). 통계는 `useHubStats` 상태를 그대로 넘겨
  // "못 셌다" 와 "세어보니 0" 을 화면이 구별하게 한다.
  const [words, setWords] = useState<WordItem[]>(MOCK_WORDS)

  const hubStatsState = useHubStats()

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

  // ── ?view=study → 실 데이터 RSC 세션으로 redirect (A2) ──
  useEffect(() => {
    if (searchParams.get('view') === 'study') {
      router.replace('/wordvault/study')
    }
  }, [searchParams, router])

  // ── ?view=review → 실 데이터 RSC 복습 세션으로 redirect (A2b) ──
  useEffect(() => {
    if (searchParams.get('view') === 'review') {
      router.replace('/wordvault/review')
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
      {/* ── 헤더 (v06.36 GlassBar + SegmentControl 프리미티브) ── */}
      <GlassBar
        leading={
          <h1 className="font-editorial text-[18px] font-[500] tracking-[-0.012em] text-[var(--t1)]">
            WordVault
          </h1>
        }
        trailing={
          <>
            <SegmentControl
              ariaLabel="WordVault 뷰"
              active={view}
              items={[
                { key: 'hub', label: '허브', href: '/wordvault' },
                { key: 'browse', label: '둘러보기', href: '/wordvault/browse' },
                { key: 'study', label: '학습', href: '/wordvault?view=study' },
                { key: 'review', label: '복습', href: '/wordvault?view=review' },
              ]}
            />
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="테마 전환"
              // ⚠️ 보이는 크기는 32px 인데 **누르는 영역이 32px 이면 안 된다**(기준 44px).
              //    ⚠️ `::after` 로 히트영역만 얹으면 실제 탭은 커지지만 **계측기가 못 본다** —
              //       bounding rect 가 그대로라 위반이 그대로 찍힌다(WordRow 에서 겪었다).
              //    → 버튼 자체를 44px 로 만들고, 음수 마진으로 **차지하는 자리는 그대로** 둔다.
              className="group/theme -m-1.5 flex h-11 w-11 shrink-0 items-center justify-center"
            >
              <span
                aria-hidden
                className="flex h-8 w-8 items-center justify-center rounded-ios-pill text-[var(--t2)] transition-colors duration-[var(--dur-ios-fast)] group-hover/theme:bg-[var(--bg2)] group-hover/theme:text-[var(--t1)]"
              >
                {theme === 'light' ? '🌙' : '☀️'}
              </span>
            </button>
          </>
        }
      />

      {/* ── 메인 (iOS 그레이 캔버스) ── */}
      <main className="flex-1 overflow-y-auto bg-[var(--bg2)] pb-12">
        <div className={view === 'hub' ? '' : 'mx-auto max-w-[1200px] p-6'}>
          {/* ── HUB (기본 진입) ── */}
          {view === 'hub' && <WordVaultHub stats={hubStatsState} />}

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
                englishVoice={queue.englishVoice}
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
              <div className="mb-s-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--bg2)] text-learn-mastered">
                <RotateCcw size={28} aria-hidden />
              </div>
              <h2 className="mb-s-2 font-editorial text-[32px] font-[500] leading-tight tracking-[-0.015em] text-t1">
                오늘 복습할 단어 <span className="text-learn-mastered">12개</span>
              </h2>
              <p className="mb-s-5 font-body text-sm font-medium text-t2">
                vmPFC 재인코딩 강화 · 망각 곡선 기반 자동 선별
              </p>
              <button
                type="button"
                onClick={() => router.push('/wordvault?view=study')}
                className="bg-learn-mastered inline-flex items-center gap-s-2 rounded-md px-s-6 py-s-3 font-display text-sm font-bold tracking-[-0.01em] text-white shadow-md transition-all duration-fast hover:-translate-y-px hover:bg-[var(--p)] hover:shadow-lg"
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
