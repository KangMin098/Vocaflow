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
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { FileText, Layers } from 'lucide-react'

import { ResourceContext } from '@/components/layout/ResourceContext'
import { useListenQueue } from '@/components/wordvault/hooks/useListenQueue'
import { useSpeech } from '@/components/wordvault/hooks/useSpeech'
import type { BrowseChip, BrowseWord } from '@/lib/wordvault/browse-queries'
import {
  filterByMemoryState,
  parseStateFilter,
  stateFilterLabel,
} from '@/lib/wordvault/state-filter'

import { BrowseSourceBar } from './BrowseSourceBar'
import { HideToggleBar } from './HideToggleBar'
import { ListenPanel } from './ListenPanel'
import { MemoryFilterBar } from './MemoryFilterBar'
import { ScriptsChipNav, type ScriptChip } from './ScriptsChipNav'
import { SearchRow } from './SearchRow'
import { WordList } from './WordList'
import type { HideStates, HideType, ListenSettings } from './types'

interface BookContext {
  bookId: string
  bookTitle: string
  chapterIdx: number
  /** v06.34 — 사용자가 그 chapter 를 enroll 한 경우 texts.id. ResourceContext "본문으로" 직링크용. */
  currentTextId: string | null
  chapters: Array<{
    id: string
    chapterIdx: number
    title: string
    isCurrent: boolean
  }>
}

interface Props {
  words: BrowseWord[]
  textChips: BrowseChip[]
  setChips: BrowseChip[]
  /** v06.34 — workspace "단어" pill 에서 ?book&chapter 진입 시 컨텍스트 */
  bookContext?: BookContext | null
}

const SET_ACCENT = '#8B5CF6' // 보라 — 라이브러리 단어장 정합
const TEXT_ACCENT = '#6366F1' // 인디고 — FlowNav "단어" stage 정합

export function WordVaultBrowseClient({
  words: allWords,
  textChips,
  setChips,
  bookContext,
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialFilter = searchParams?.get('filter') ?? 'all'

  const goToChapter = useCallback(
    (chapter: { id: string; chapterIdx: number }) => {
      if (!bookContext) return
      const qs = new URLSearchParams({
        filter: `set:${chapter.id}`,
        book: bookContext.bookId,
        chapter: String(chapter.chapterIdx),
      })
      // 세션 복귀(?from) 유지 — 챕터 이동 후 reload/bookmark 시에도 닫기 대상 보존.
      const from = searchParams?.get('from')
      if (from) qs.set('from', from)
      router.push(`/wordvault/browse?${qs.toString()}`)
    },
    [bookContext, router, searchParams],
  )

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [hideStates, setHideStates] = useState<HideStates>({ word: false, meaning: false })
  const [scriptFilter, setScriptFilter] = useState<string>(initialFilter)

  // 상태 필터 해제 — 화면 상태만 바꾸면 URL 이 `state:new` 로 남아 새로고침·뒤로가기에서
  // 필터가 되살아난다. 쿼리에서도 함께 지운다(아래 동기화 effect 가 'all' 로 되돌린다).
  const clearStateFilter = useCallback(() => {
    setScriptFilter('all')
    const params = new URLSearchParams(searchParams?.toString() ?? '')
    params.delete('filter')
    const qs = params.toString()
    router.replace(qs ? `/wordvault/browse?${qs}` : '/wordvault/browse')
  }, [router, searchParams])
  // 검색/난이도/정렬 — 이전엔 렌더만 되고 미연결(dead). 실제 필터링 연결.
  const [searchQuery, setSearchQuery] = useState('')
  const [levelFilter, setLevelFilter] = useState('all') // all | a | b | c
  const [sortBy, setSortBy] = useState('recent') // recent | alpha | mastery
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

  // 기억 상태 필터 — `state:new` 처럼 칩 id 가 아닌 값. 칩 행에는 대응하는 칩이 없으므로
  // 활성 표시와 학습 진입은 `MemoryFilterBar` 가 따로 맡는다.
  const stateKey = parseStateFilter(scriptFilter)

  const words = useMemo(() => {
    let list = allWords
    // 1) 소스 필터 (set / text / 기억 상태)
    if (scriptFilter.startsWith('set:')) {
      const id = scriptFilter.slice(4)
      list = list.filter((w) => w.setId === id)
    } else if (scriptFilter.startsWith('text:')) {
      const id = scriptFilter.slice(5)
      list = list.filter((w) => w.textId === id)
    } else if (stateKey) {
      // 기억 상태 필터 — 리본 칩·허브 CTA 가 보내는 `state:*`.
      // 2026-08-29 이전에는 이 분기가 없어 **조용히 전체가 떴다**(state-filter.ts 머리말).
      list = filterByMemoryState(list, stateKey)
    }
    // 2) 검색 (단어/뜻)
    const q = searchQuery.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (w) => w.word.toLowerCase().includes(q) || w.meaning.toLowerCase().includes(q),
      )
    }
    // 3) 난이도 (levelClass a/b/c)
    if (levelFilter !== 'all') {
      list = list.filter((w) => w.levelClass === levelFilter)
    }
    // 4) 정렬 (recent = 원본 순서 유지)
    if (sortBy === 'alpha') {
      list = [...list].sort((a, b) => a.word.localeCompare(b.word))
    } else if (sortBy === 'mastery') {
      list = [...list].sort((a, b) => a.mastery - b.mastery)
    }
    return list
  }, [allWords, scriptFilter, stateKey, searchQuery, levelFilter, sortBy])

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

  // 챕터 이동 등 URL filter 변경 시 scriptFilter 동기화.
  //   goToChapter 는 router.push 로 ?filter=set:{새 챕터 id} 를 갱신하지만 soft navigation 이라
  //   클라이언트가 언마운트되지 않아 useState(initialFilter) 가 이전 set 에 고정됨 → 단어 미갱신.
  //   initialFilter 는 매 렌더 URL 값으로 재계산되므로 dep 으로 안전 (chip 클릭은 URL 불변 → 미발화).
  useEffect(() => {
    setScriptFilter(initialFilter)
  }, [initialFilter])

  // 필터 변경 시 선택 초기화
  useEffect(() => {
    setSelectedIds(new Set())
  }, [scriptFilter])

  const activeChip = chips.find((c) => c.id === scriptFilter)

  return (
    <>
      <ResourceContext
        resource={
          bookContext
            ? {
                // v06.34 — workspace 진입: book title › Chapter N · 단어 수
                // href: currentTextId 있으면 본문 직링크 / 없으면 preview
                type: 'script',
                label: bookContext.bookTitle,
                position: `Chapter ${bookContext.chapterIdx} · ${words.length.toLocaleString()}개`,
                href: bookContext.currentTextId
                  ? `/text/${bookContext.currentTextId}?mode=read`
                  : `/library/books/${bookContext.bookId}?preview=1`,
              }
            : {
                type: 'vocab',
                label: '내 어휘 자산',
                position:
                  scriptFilter === 'all'
                    ? `전체 ${words.length.toLocaleString()}개`
                    : // 상태 필터에는 대응하는 칩이 없다 — 이름을 못 찾아 ` · 11개` 처럼
                      // 앞이 빈 문장이 되던 자리(2026-08-29).
                      `${stateKey ? stateFilterLabel(stateKey) : (activeChip?.label ?? '')} · ${words.length.toLocaleString()}개`,
                href: '/wordvault',
              }
        }
        total={words.length}
      />

      <div className="mx-auto flex max-w-[1200px] flex-col gap-3 px-4 py-4 md:px-6 md:py-5">
        {/* ── 단어 0개: 빈 상태 (라이브러리 안내) ── */}
        {allWords.length === 0 ? (
          <EmptyAll />
        ) : (
          <>
            {/* ── 기억 상태로 걸러 들어온 경우: 무엇을 보고 있는지 + 학습 진입 ── */}
            {stateKey && !bookContext && (
              <MemoryFilterBar
                filterKey={stateKey}
                count={words.length}
                onClear={clearStateFilter}
              />
            )}

            {/* ── 소스 바: 도서 컨텍스트 = 컴팩트 챕터/소스 바 / 일반 = chip nav ── */}
            {bookContext ? (
              <BrowseSourceBar
                bookId={bookContext.bookId}
                chapterIdx={bookContext.chapterIdx}
                currentTextId={bookContext.currentTextId}
                chapters={bookContext.chapters}
                wordCount={words.length}
                onGoToChapter={goToChapter}
              />
            ) : (
              <div className="flex flex-col gap-2">
                <ScriptsChipNav chips={chips} active={scriptFilter} onChange={setScriptFilter} />
                {/* 스크립트 필터 시 해당 스크립트 본문으로 바로가기 */}
                {scriptFilter.startsWith('text:') && (
                  <Link
                    href={`/text/${scriptFilter.slice(5)}`}
                    className="inline-flex w-fit items-center gap-2 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-3 py-2 font-display text-[12px] font-[700] text-[#6366F1] transition-colors hover:bg-[var(--bg2)]"
                  >
                    <FileText size={12} aria-hidden />
                    이 스크립트 본문 열기 →
                  </Link>
                )}
              </div>
            )}

            {/* ── 듣기 옵션 ── */}
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

            {/* ── 도구 모음: 검색 + 난이도 + 정렬 + Active Recall (1행 컴팩트) ── */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <SearchRow
                  onSearchChange={setSearchQuery}
                  onLevelChange={setLevelFilter}
                  onSortChange={setSortBy}
                />
              </div>
              <HideToggleBar hideStates={hideStates} onToggle={handleToggleHide} />
            </div>

            {/* ── 4. 단어 리스트 / 필터 빈 상태 ── */}
            {words.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[var(--bd)] bg-[var(--bg2)] py-12 text-center font-body text-[14px] text-[var(--t2)]">
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
      <Layers size={32} className="text-[var(--t2)]" aria-hidden />
      <p className="font-display text-[15px] font-[700] text-[var(--t1)]">
        아직 보유한 단어가 없어요
      </p>
      <p className="max-w-[360px] font-body text-[13px] text-[var(--t2)]">
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
