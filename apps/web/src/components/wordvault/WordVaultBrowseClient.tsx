// apps/web/src/components/wordvault/WordVaultBrowseClient.tsx
//
// WordVault Browse 풀스크린 세션 클라이언트 (v06.21.6)
//
// 변경 (v06.21.6):
//   - 풀스크린 세션 라우트로 분리 (`/wordvault/browse`) — SessionFrame 셸 자동 주입
//   - 우측 상단 "단어 추가" / "학습 시작" 제거 (Flashcard 모듈 중복 / 자산 추가는 hub 영역)
//   - StatsGrid (총단어/마스터/오늘 복습/평균 정확도) 제거 — 대시보드와 중복, 둘러보기 화면 의미 X
//   - 스크립트 칩 nav 신규 — "전체 N" + 각 스크립트 단어 수, 클릭 시 필터
//   - 듣기 옵션 항상 노출 — 토글 제거, 공간 절약
//   - SessionFrame 에 리소스 컨텍스트 (스크립트명) 주입

'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import { ResourceContext } from '@/components/layout/ResourceContext'
import { useListenQueue } from '@/components/wordvault/hooks/useListenQueue'
import { useSpeech } from '@/components/wordvault/hooks/useSpeech'
import { HideToggleBar } from './HideToggleBar'
import { ListenPanel } from './ListenPanel'
import { ScriptsChipNav, type ScriptChip } from './ScriptsChipNav'
import { SearchRow } from './SearchRow'
import { WordList } from './WordList'
import { MOCK_COLLECTIONS, MOCK_WORDS } from './mock-data'
import type { HideStates, HideType, ListenSettings } from './types'

// ── Mock: word → script 매핑 (Phase 2: vocabularies.text_id) ──
const COLLECTION_IDS = ['gatsby', '1984', 'ted', 'bbc', 'favorites'] as const
function getScriptId(wordId: number): string {
  if (wordId <= 3) return 'gatsby'
  if (wordId <= 6) return '1984'
  if (wordId <= 9) return 'ted'
  if (wordId <= 11) return 'bbc'
  return 'favorites'
}

export function WordVaultBrowseClient() {
  // ── 선택 ──
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

  // ── 숨김 (Active Recall) ──
  const [hideStates, setHideStates] = useState<HideStates>({
    word: false,
    meaning: false,
  })

  // ── 스크립트 필터 ──
  const [scriptFilter, setScriptFilter] = useState<string>('all')

  // ── 듣기 설정 ──
  const [listenSettings, setListenSettings] = useState<ListenSettings>({
    content: 'word',
    speed: 1.0,
    gap: 1.0,
    repeat: 1,
    shuffle: false,
  })

  const queue = useListenQueue(listenSettings)
  const { speak } = useSpeech()

  // ── 필터된 단어 + 스크립트 칩 데이터 ──
  const allWords = MOCK_WORDS

  const scriptChips: ScriptChip[] = useMemo(() => {
    const total = allWords.length
    const counts = COLLECTION_IDS.reduce<Record<string, number>>((acc, id) => {
      acc[id] = 0
      return acc
    }, {})
    for (const w of allWords) {
      const sid = getScriptId(w.id)
      counts[sid] = (counts[sid] ?? 0) + 1
    }
    const chips: ScriptChip[] = [{ id: 'all', label: '전체', count: total }]
    for (const c of MOCK_COLLECTIONS) {
      if (c.id === 'all' || c.id === 'favorites') continue
      const cnt = counts[c.id] ?? 0
      if (cnt === 0) continue
      chips.push({ id: c.id, label: c.name, count: cnt })
    }
    // 즐겨찾기는 마지막에 (별도)
    const favCount = counts['favorites'] ?? 0
    if (favCount > 0) {
      chips.push({ id: 'favorites', label: '즐겨찾기', count: favCount, accent: '#F59E0B' })
    }
    return chips
  }, [allWords])

  const words = useMemo(() => {
    if (scriptFilter === 'all') return allWords
    return allWords.filter((w) => getScriptId(w.id) === scriptFilter)
  }, [allWords, scriptFilter])

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
    [words, listenSettings.speed, speak],
  )

  // ── 키보드 단축키 ──
  useEffect(() => {
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
  }, [queue, words, handleToggleHide])

  // 필터 변경 시 선택 초기화 (잘못된 ID 방지)
  useEffect(() => {
    setSelectedIds(new Set())
  }, [scriptFilter])

  // ── SessionFrame 셸에 리소스 컨텍스트 ──
  const activeChip = scriptChips.find((c) => c.id === scriptFilter)

  return (
    <>
      <ResourceContext
        resource={{
          type: 'vocab',
          label: '내 어휘 자산',
          position:
            scriptFilter === 'all'
              ? `전체 ${words.length}개`
              : `${activeChip?.label ?? ''} · ${words.length}개`,
          href: '/wordvault',
        }}
        total={words.length}
      />

      <div className="mx-auto flex max-w-[1200px] flex-col gap-3 px-4 py-4 md:px-6 md:py-5">
        {/* ── 1. 스크립트 칩 nav ── */}
        <ScriptsChipNav
          chips={scriptChips}
          active={scriptFilter}
          onChange={setScriptFilter}
        />

        {/* ── 2. 듣기 옵션 (항상 노출) ── */}
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

        {/* ── 3. Active Recall 토글 + 검색 ── */}
        <div className="flex flex-col gap-2">
          <HideToggleBar hideStates={hideStates} onToggle={handleToggleHide} />
          <SearchRow />
        </div>

        {/* ── 4. 단어 리스트 ── */}
        {words.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--bd)] bg-[var(--bg2)] py-12 text-center font-body text-[14px] text-[var(--t3)]">
            이 스크립트에 등록된 단어가 없어요
          </div>
        ) : (
          <WordList
            words={words}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onToggleSelectAll={handleToggleSelectAll}
            playingId={queue.currentWord?.id ?? null}
            hideStates={hideStates}
            onPlayWord={handlePlayWord}
          />
        )}
      </div>

    </>
  )
}
