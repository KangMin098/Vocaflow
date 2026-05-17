// apps/web/src/components/wordvault/WordVaultBrowseClient.tsx
//
// WordVault Browse 풀스크린 세션 클라이언트 (v06.22+ — 실 데이터)
//
// 변경 (실 데이터화):
//   - props 로 `words` / `textChips` / `setChips` 수신 (Server Component 가 fetch)
//   - chip 필터: "전체" + 구독 단어장(보라 #8B5CF6) + 스크립트(인디고 #6366F1)
//     ㄴ chip.id 포맷: "all" | "set:<uuid>" | "text:<uuid>"
//   - 빈 상태 분기: 단어 0개 (라이브러리 안내) vs 필터 결과 0개
//
// 유지: SessionFrame · 검색 · Active Recall · ListenPanel · WordList

'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Layers } from 'lucide-react'

import { ResourceContext } from '@/components/layout/ResourceContext'
import { useListenQueue } from '@/components/wordvault/hooks/useListenQueue'
import { useSpeech } from '@/components/wordvault/hooks/useSpeech'
import type { BrowseChip, BrowseWord } from '@/lib/wordvault/browse-queries'

import { HideToggleBar } from './HideToggleBar'
import { ListenPanel } from './ListenPanel'
import { ScriptsChipNav, type ScriptChip } from './ScriptsChipNav'
import { SearchRow } from './SearchRow'
import { WordList } from './WordList'
import type { HideStates, HideType, ListenSettings } from './types'

interface Props {
  words: BrowseWord[]
  textChips: BrowseChip[]
  setChips: BrowseChip[]
}

const SET_ACCENT = '#8B5CF6' // 보라 — 라이브러리 단어장 정합
const TEXT_ACCENT = '#6366F1' // 인디고 — FlowNav "단어" stage 정합

export function WordVaultBrowseClient({ words: allWords, textChips, setChips }: Props) {
  const searchParams = useSearchParams()
  const initialFilter = searchParams?.get('filter') ?? 'all'

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [hideStates, setHideStates] = useState<HideStates>({ word: false, meaning: false })
  const [scriptFilter, setScriptFilter] = useState<string>(initialFilter)
  const [listenSettings, setListenSettings] = useState<ListenSettings>({
    content: 'word',
    speed: 1.0,
    gap: 1.0,
    repeat: 1,
    shuffle: false,
  })

  const queue = useListenQueue(listenSettings)
  const { speak } = useSpeech()

  // ── 통합 chip: 전체 + 구독 세트 + 스크립트 ──
  const chips: ScriptChip[] = useMemo(() => {
    const list: ScriptChip[] = [{ id: 'all', label: '전체', count: allWords.length }]
    for (const c of setChips) list.push({ id: c.id, label: c.label, count: c.count, accent: SET_ACCENT })
    for (const c of textChips) list.push({ id: c.id, label: c.label, count: c.count, accent: TEXT_ACCENT })
    return list
  }, [allWords.length, setChips, textChips])

  const words = useMemo(() => {
    if (scriptFilter === 'all') return allWords
    if (scriptFilter.startsWith('set:')) {
      const id = scriptFilter.slice(4)
      return allWords.filter((w) => w.setId === id)
    }
    if (scriptFilter.startsWith('text:')) {
      const id = scriptFilter.slice(5)
      return allWords.filter((w) => w.textId === id)
    }
    return allWords
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

  // 필터 변경 시 선택 초기화
  useEffect(() => {
    setSelectedIds(new Set())
  }, [scriptFilter])

  const activeChip = chips.find((c) => c.id === scriptFilter)

  return (
    <>
      <ResourceContext
        resource={{
          type: 'vocab',
          label: '내 어휘 자산',
          position:
            scriptFilter === 'all'
              ? `전체 ${words.length.toLocaleString()}개`
              : `${activeChip?.label ?? ''} · ${words.length.toLocaleString()}개`,
          href: '/wordvault',
        }}
        total={words.length}
      />

      <div className="mx-auto flex max-w-[1200px] flex-col gap-3 px-4 py-4 md:px-6 md:py-5">
        {/* ── 단어 0개: 빈 상태 (라이브러리 안내) ── */}
        {allWords.length === 0 ? (
          <EmptyAll />
        ) : (
          <>
            {/* ── 1. chip nav (전체 + 세트 + 스크립트) ── */}
            <ScriptsChipNav chips={chips} active={scriptFilter} onChange={setScriptFilter} />

            {/* ── 2. 듣기 옵션 ── */}
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

            {/* ── 3. Active Recall + 검색 ── */}
            <div className="flex flex-col gap-2">
              <HideToggleBar hideStates={hideStates} onToggle={handleToggleHide} />
              <SearchRow />
            </div>

            {/* ── 4. 단어 리스트 / 필터 빈 상태 ── */}
            {words.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[var(--bd)] bg-[var(--bg2)] py-12 text-center font-body text-[14px] text-[var(--t3)]">
                이 필터에 해당하는 단어가 없어요
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
          </>
        )}
      </div>
    </>
  )
}

function EmptyAll() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[var(--bd)] bg-[var(--bg2)] py-16 text-center">
      <Layers size={32} className="text-[var(--t3)]" aria-hidden />
      <p className="font-display text-[15px] font-[700] text-[var(--t1)]">
        아직 보유한 단어가 없어요
      </p>
      <p className="max-w-[360px] font-body text-[13px] text-[var(--t3)]">
        공용 단어장을 추가하거나, 내 스크립트에서 단어를 추출해 보세요.
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
        <Link
          href="/library/vocab"
          className="inline-flex h-10 items-center rounded-[var(--r-md)] bg-[#8B5CF6] px-4 font-display text-[13px] font-[700] text-white transition-colors hover:bg-[#7C3AED] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6] focus-visible:ring-offset-2"
        >
          공용 단어장 둘러보기
        </Link>
        <Link
          href="/text"
          className="inline-flex h-10 items-center rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-4 font-display text-[13px] font-[600] text-[var(--t2)] transition-colors hover:bg-[var(--bg2)]"
        >
          내 스크립트
        </Link>
      </div>
    </div>
  )
}
