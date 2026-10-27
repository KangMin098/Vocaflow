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
import { SpotState } from '@/components/ui/SpotState'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { FileText } from 'lucide-react'

import { ResourceContext } from '@/components/layout/ResourceContext'
import { useStoryAuthGuard, type StoryAuthSource } from '@/components/library/story/use-story-auth-guard'
import { loginUrlWithReturn } from '@/lib/auth/redirect'
import { Rule } from '@/components/ui/press'
import { useListenQueue } from '@/components/wordvault/hooks/useListenQueue'
import { useSpeech } from '@/components/wordvault/hooks/useSpeech'
import type { BrowseChip, BrowseWord } from '@/lib/wordvault/browse-queries'
import {
  levelParamToClass,
  matchesLevel,
  matchesQuery,
  normalizeQuery,
  parseLevelParam,
} from '@/lib/wordvault/list-params'
import { VOCAB_MAP_QUERY_KEYS, vocabMapLink } from '@/lib/csat/map-return'
import { MapReturnBar } from '@/components/wordvault/WordVaultStudyClient'
import {
  filterByMemoryState,
  parseStateFilter,
  stateFilterLabel,
} from '@/lib/wordvault/state-filter'
import { applySourceFilter, membershipFetchTarget, normalizeSourceFilter, type SetMembership } from '@/lib/wordvault/source-filter'
import { fetchArticleSetMembership } from '@/lib/wordvault/set-membership-actions'
import { currentBrowseHref, sourceStudyHref } from '@/lib/wordvault/source-study'
import type { SetMembershipPayload } from '@/lib/wordvault/set-membership-query'

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
  /** T-0086 — 지도에서 온 목록이면 검증된 복귀 주소(없으면 일반 진입 — 지도 안내 없음) */
  mapBack?: string | null
  /** D5-I02 — Story 에서 명시 이동했을 때만 서버가 만든 작은 복귀 줄(없으면 null · 출처를 지어내지 않는다). 지도 복귀와 함께 오지 않는다. */
  storyReturn?: ReactNode
  /** 선택한 발행 기사 단어장의 정본 낱말(서버가 본인 세션으로 읽음) — 다른 출처에서 이미 가진 낱말도 그 단어장에 보이게 */
  setMembership?: SetMembershipPayload | null
  /** 칩으로 고른 세트의 정본 낱말 조회 — 기본은 서버 Action. 개발 하네스만 합성 응답을 주입한다(프로덕션 화면은 넘기지 않는다). */
  fetchMembership?: (filter: string) => Promise<SetMembershipPayload | null>
}

const SET_ACCENT = 'var(--p)' // 보라 — 라이브러리 단어장 정합
const TEXT_ACCENT = 'var(--learn-fresh)' // 인디고 — FlowNav "단어" stage 정합

export function WordVaultBrowseClient({
  words: allWords,
  textChips,
  setChips,
  bookContext,
  mapBack = null,
  storyReturn = null,
  setMembership = null,
  fetchMembership = fetchArticleSetMembership,
}: Props) {
  // 서버가 첫 URL 로 읽어 온 값에서 시작하고, 칩으로 다른 세트를 고르면 그 세트 것을 다시 읽는다(URL 은 그대로).
  const [membershipPayload, setMembershipPayload] = useState<SetMembershipPayload | null>(setMembership)
  // 같은 URL 이 다시 검증돼 서버가 새 값을 주면 그것으로 바꾼다(초기값만 쓰면 낡은 정본이 남는다) — 지금 칩이 다른 세트면 아래 조회가 다시 읽는다.
  useEffect(() => {
    setMembershipPayload(setMembership)
  }, [setMembership])
  const membership: SetMembership | null = useMemo(
    () => (!membershipPayload ? null : 'error' in membershipPayload ? { setId: membershipPayload.setId, error: true } : { setId: membershipPayload.setId, words: new Set(membershipPayload.words) }),
    [membershipPayload],
  )
  const router = useRouter()
  const searchParams = useSearchParams()
  // 접두어 없는 uuid(예전 Reader 링크)는 그 글의 text: 범위로 — 전체 목록으로 흘리지 않는다.
  const initialFilter = normalizeSourceFilter(searchParams?.get('filter'))
  // 허브가 걸어 보내는 목록 파라미터 — 판정은 `lib/wordvault/list-params` 가 소유한다.
  // 2026-08-30 이전에는 읽는 코드가 없어 `?q=`·`?level=` 이 조용히 버려졌다.
  const initialQuery = normalizeQuery(searchParams?.get('q'))
  const initialLevel = parseLevelParam(searchParams?.get('level'))

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
      // 지도 문맥도 챕터를 옮겨도 남긴다(T-0086 · 수행 · 문항 ID 는 옮기지 않는다)
      if (mapBack) for (const k of VOCAB_MAP_QUERY_KEYS) { const v = searchParams?.get(k); if (v) qs.set(k, v) }
      router.push(`/wordvault/browse?${qs.toString()}`)
    },
    [bookContext, mapBack, router, searchParams],
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
  // ⚠️ 초기값은 URL 에서 온다 — 허브가 `?q=`·`?level=` 로 보내고, 2026-08-30 이전에는
  //    그 둘을 읽는 코드가 없어 단어를 눌러도 **전체 목록**이 열렸다.
  const [searchQuery, setSearchQuery] = useState(initialQuery)
  // 'all' | 'a' | 'b' | 'c' | 'A1'…'C2' — 허브의 레벨 막대는 낱개 CEFR 로 보내고
  // 화면 셀렉트는 묶음으로 고른다. 둘 다 정당한 요청이라 둘 다 들고 있는다.
  const [levelFilter, setLevelFilter] = useState<string>(searchParams?.get('level') ?? 'all')
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
  // 목록이 내려가면(계정 경계 무효 · 화면 이동) 흘려듣기 · 낱말 읽기를 멈춘다 — 지운 목록의 낱말을 계속 읽지 않는다.
  const stopListening = queue.stopQueue
  useEffect(() => stopListening, [stopListening])

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
    if (scriptFilter.startsWith('set:') || scriptFilter.startsWith('text:')) {
      list = applySourceFilter(list, scriptFilter, membership)
    } else if (stateKey) {
      // 기억 상태 필터 — 리본 칩·허브 CTA 가 보내는 `state:*`.
      // 2026-08-29 이전에는 이 분기가 없어 **조용히 전체가 떴다**(state-filter.ts 머리말).
      list = filterByMemoryState(list, stateKey)
    }
    // 2) 검색 (단어/뜻) — URL 로 들어온 검색과 손으로 친 검색이 같은 규칙을 쓴다.
    if (searchQuery.trim()) {
      list = list.filter((w) => matchesQuery(w, searchQuery))
    }
    // 3) 난이도 — 묶음(a/b/c) 과 낱개 CEFR(B1) 둘 다 받는다.
    const level = parseLevelParam(levelFilter)
    if (level) {
      list = list.filter((w) => matchesLevel(w, level))
    }
    // 4) 정렬 (recent = 원본 순서 유지)
    if (sortBy === 'alpha') {
      list = [...list].sort((a, b) => a.word.localeCompare(b.word))
    } else if (sortBy === 'mastery') {
      list = [...list].sort((a, b) => a.mastery - b.mastery)
    }
    return list
  }, [allWords, scriptFilter, stateKey, searchQuery, levelFilter, sortBy, membership])

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

  // 조회 함수는 ref 로 — 부른 쪽이 매 렌더 새 함수를 넘겨도 진행 중 조회를 끊고 다시 부르는 루프가 생기지 않게
  const fetchMembershipRef = useRef(fetchMembership)
  fetchMembershipRef.current = fetchMembership
  // 칩으로 기사 단어장을 바꾸면 그 세트의 정본 낱말을 읽는다 — 늦게 온 이전 세트 응답은 버린다.
  useEffect(() => {
    const target = membershipFetchTarget(scriptFilter, membershipPayload)
    if (!target) return
    let alive = true
    void fetchMembershipRef.current(`set:${target}`)
      .then((r) => { if (alive) setMembershipPayload(r ?? { setId: target, words: [] }) })
      .catch(() => { if (alive) setMembershipPayload({ setId: target, error: true }) })
    return () => { alive = false }
  }, [scriptFilter, membershipPayload])

  // 필터 변경 시 선택 초기화
  useEffect(() => {
    setSelectedIds(new Set())
  }, [scriptFilter])

  const activeChip = chips.find((c) => c.id === scriptFilter)

  /**
   * 지금 목록에 걸려 있는 조건을 사람이 읽는 한 줄로.
   *
   * ⚠️ 조건이 여럿일 수 있다 — 허브에서 `?q=`·`?level=` 을 걸고 들어오면 소스 필터가
   *    `all` 이라도 목록은 걸러져 있다. 그때 "전체 3개" 라고 적으면 3이 어디서 나온
   *    수인지 화면이 말하지 않는 것이다(2026-08-30 이전에는 그 둘이 아예 무시됐다).
   */
  const conditionLabel = useMemo(() => {
    const parts: string[] = []
    if (stateKey) parts.push(stateFilterLabel(stateKey))
    else if (scriptFilter !== 'all' && activeChip) parts.push(activeChip.label)
    const level = parseLevelParam(levelFilter)
    if (level) parts.push(level.kind === 'cefr' ? level.value : `${level.value.toUpperCase()} 등급`)
    if (searchQuery.trim()) parts.push(`"${searchQuery.trim()}"`)
    return parts.length ? parts.join(' · ') : '전체'
  }, [stateKey, scriptFilter, activeChip, levelFilter, searchQuery])

  return (
    <>
      {mapBack && (
        <MapReturnBar
          href={mapBack}
          note="학습 지도 · 기본 의미(V1) 준비 — 여기서 모은 단어가 복습 대상이에요. 모으기 · 복습은 학습 기록이고 지도의 확인 · 해소 근거가 아니에요."
          next={{ href: vocabMapLink('/wordvault/review', mapBack), label: '모은 단어 복습하기 →' }}
        />
      )}
      {!mapBack && storyReturn}
      {membership && 'error' in membership && scriptFilter === `set:${membership.setId}` && (
        <p role="status" data-testid="vocab-set-membership-failed" className="mx-auto max-w-[960px] break-keep px-s-4 pt-s-3 font-body text-[13px] text-t2">
          이 단어장의 낱말 목록을 확인하지 못해, 이 단어장에서 저장한 단어만 보여요. 다른 곳에서 먼저 모은 같은 낱말은 빠졌을 수 있어요.
        </p>
      )}
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
                // 지금 걸려 있는 조건을 **전부** 말한다 — 하나만 말하면 나머지가 숨는다
                // (검색어로 걸러 놓고 "전체 3개" 라고 적으면 3이 어디서 나온 수인지 모른다).
                position: `${conditionLabel} · ${words.length.toLocaleString()}개`,
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
            {/*
              ── 도구 판면 ────────────────────────────────────────────────────
              v07 「주묵 판면」. 이 화면의 결함은 컨트롤이 많다는 것이 아니라
              **컨트롤마다 제 상자를 갖고 있다는 것**이었다 — 기억 필터 · 소스 내비 ·
              듣기 패널 · 검색줄 · 가리기줄이 각자 테두리를 두르고 세로로 쌓여서,
              390px 실측에서 **첫 단어가 나오기 전까지 5개의 카드**를 지나야 했다
              (화면 전체 높이 5,154px). 카드 다섯 장이 같은 무게로 서 있으면
              무엇이 도구이고 무엇이 내용인지가 형태로 구분되지 않는다.

              지면 문법에서 도구는 **여백(margin)** 이고 목록이 **판면**이다.
              그래서 상자를 없애는 대신 **하나로 합친다** — 바깥 테두리 하나,
              안쪽은 괘선으로 갈린다. 자식 컴포넌트는 손대지 않고 직계 자식의
              테두리·배경·라운드만 여기서 지운다(`[&>*]`는 직계에만 걸린다).
              기능은 하나도 감추지 않는다 — Progressive Disclosure 는 **위계**의 문제이지
              숨김의 문제가 아니다.
              ───────────────────────────────────────────────────────────────── */}
            <section
              aria-label="단어장 도구"
              className="overflow-hidden rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] [&>*+*]:border-t [&>*+*]:border-[var(--bd)] [&>*]:mb-0 [&>*]:rounded-none [&>*]:border-x-0 [&>*]:border-b-0 [&>*]:bg-transparent"
            >
              {/* ── 기억 상태로 걸러 들어온 경우: 무엇을 보고 있는지 + 학습 진입 ── */}
              {stateKey && !bookContext && (
                <MemoryFilterBar
                  filterKey={stateKey}
                  count={words.length}
                  onClear={clearStateFilter}
                  studyHref={sourceStudyHref({
                    filter: scriptFilter,
                    query: searchQuery,
                    level: levelFilter,
                    from: currentBrowseHref(new URLSearchParams(searchParams?.toString() ?? ''), { filter: scriptFilter, query: searchQuery, level: levelFilter }),
                  })}
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
                <div className="flex flex-col gap-2 px-3 py-2.5">
                  <ScriptsChipNav chips={chips} active={scriptFilter} onChange={setScriptFilter} />
                  {/* 스크립트 필터 시 해당 스크립트 본문으로 바로가기 */}
                  {scriptFilter.startsWith('text:') && (
                    <Link
                      href={`/text/${scriptFilter.slice(5)}`}
                      className="inline-flex w-fit items-center gap-2 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-3 py-2 font-display text-[12px] font-[700] text-[var(--learn-fresh)] transition-colors hover:bg-[var(--bg2)]"
                    >
                      <FileText size={12} aria-hidden />
                      이 스크립트 본문 열기 →
                    </Link>
                  )}
                </div>
              )}

              {/* ── 출처 목록 → 뜻 떠올리기(자기 평가) — 이 출처 · 검색 · 난이도 그대로, 끝나면 이 목록으로 ── */}
              {(scriptFilter.startsWith('set:') || scriptFilter.startsWith('text:')) && (
                <SourceRecallEntry
                  href={sourceStudyHref({
                    filter: scriptFilter,
                    query: searchQuery,
                    level: levelFilter,
                    from: currentBrowseHref(new URLSearchParams(searchParams?.toString() ?? ''), { filter: scriptFilter, query: searchQuery, level: levelFilter }),
                  })}
                  count={words.length}
                />
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
              <div className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <SearchRow
                    initialQuery={initialQuery}
                    // 낱개 CEFR(`B1`)은 셀렉트에 대응 칸이 없어 묶음으로 환산해 보여 준다 —
                    // 목록은 여전히 B1 만 거른다(허브 막대가 가리킨 칸이 그것이라서).
                    // 그 정확한 조건은 아래 ResourceContext 가 문장으로 말한다.
                    initialLevel={levelParamToClass(initialLevel)}
                    onSearchChange={setSearchQuery}
                    onLevelChange={setLevelFilter}
                    onSortChange={setSortBy}
                  />
                </div>
                <HideToggleBar hideStates={hideStates} onToggle={handleToggleHide} />
              </div>
            </section>

            {/* ── 목록 머리 괘선 — 여기서부터 **내용**이다.
                 도구와 목록 사이에 형태의 경계가 없던 것이 이 화면의 문제였다. */}
            <Rule
              label="단어"
              right={`${words.length.toLocaleString()}개`}
              className="mt-1"
            />

            {/* ── 4. 단어 리스트 / 필터 빈 상태 ── */}
            {words.length === 0 ? (
              <SpotState art="search" size="sm" role="status" title="이 필터에 해당하는 단어가 없어요" />
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
    </>
  )
}

/**
 * D5-I02 · T-0191 — 단어장 개인 화면의 계정 경계. 서버가 쿠키 세션(getUser)으로 확인해 그린 목록 · 칩 · 도서 문맥 · 듣기 ·
 * 복귀 줄은 `viewerId` 의 것이다. 브라우저 신원이 그 사람으로 **긍정 확인(same)** 될 때만 children 을 그린다.
 * - checking(확인 전 · 기준선 실패 · BFCache 복원 뒤 다시 확인 중): 개인 내용을 그리지 않는다 — 확인 실패를 같은 사람으로 치지 않는다.
 * - changed(다른 계정 · 로그아웃): children 을 내려 목록을 지우고(듣기도 멈춘다) 다시 열기 · 로그인 길만 둔다. 전역 로그아웃은 하지 않는다.
 * 판정 기계는 Story 화면과 같은 useStoryAuthGuard(구독 먼저 → 기준선 · 바뀜은 되살리지 않음). uid 는 비교에만 쓴다(DOM · URL 없음).
 * reopenHref 는 서버가 검증한 문맥만 담은 단어장 주소(Story 복귀 문맥 · 지도 문맥) — 쿼리 uid 같은 것은 없다.
 */
export function WordVaultViewerGate({
  viewerId,
  reopenHref,
  authSource,
  children,
}: {
  viewerId: string
  reopenHref: string
  /** 시험 · 하네스 주입(없으면 StoryAuthSourceContext → 실제 브라우저 세션). */
  authSource?: StoryAuthSource
  children: ReactNode
}) {
  const { status } = useStoryAuthGuard(viewerId, authSource)
  if (status === 'same') {
    return (
      <div data-vault-private="shown" className="contents">
        {children}
      </div>
    )
  }
  const changed = status === 'changed'
  return (
    <div
      className="mx-auto flex max-w-[480px] flex-col items-center px-s-4 py-s-16 text-center"
      data-vault-private={status}
      role="status"
      aria-live="polite"
    >
      <h1 className="sr-only">내 단어장</h1>
      <h2 className="mb-s-2 break-keep font-editorial text-[24px] font-[500] leading-snug tracking-[-0.015em] text-t1">
        {changed ? '로그인 상태가 바뀌었어요' : '로그인한 계정을 확인하고 있어요'}
      </h2>
      <p className="break-keep font-body text-sm text-t2">
        {changed
          ? '이 화면의 단어 목록과 듣기를 지웠어요. 지금 로그인한 계정으로 다시 열어 주세요.'
          : '확인이 끝나면 내 단어 목록을 보여 드려요.'}
      </p>
      {/* 서버가 지금 쿠키로 다시 그리도록 전체 이동(<a>) — 낡은 화면 상태를 재사용하지 않는다. */}
      <div className="mt-s-4 flex flex-wrap justify-center gap-2">
        <a
          href={reopenHref}
          data-vault-reopen
          className="inline-flex min-h-[44px] items-center rounded-[var(--r-md)] border border-[var(--bd)] px-4 font-display text-[13px] font-[700] text-t1 hover:bg-[var(--bg2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)]"
        >
          내 단어장 다시 열기
        </a>
        {changed && (
          <a
            href={loginUrlWithReturn(reopenHref)}
            data-vault-login
            className="inline-flex min-h-[44px] items-center rounded-[var(--r-md)] px-4 font-display text-[13px] font-[700] text-t2 underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)]"
          >
            로그인 화면으로
          </a>
        )}
      </div>
    </div>
  )
}

// DD-68 — 참조 빈 결과 문법. 예전 버튼은 높이 40px(누르는 자리 하한 44 미만)였다.
function EmptyAll() {
  return (
    <SpotState
      art="empty-vault"
      role="status"
      title="아직 보유한 단어가 없어요"
      body="공용 단어장을 추가하거나, 내 스크립트에서 단어를 추출해 보세요."
      primary={{ href: '/library/vocab', label: '공용 단어장 둘러보기' }}
      secondary={{ href: '/text', label: '내 스크립트' }}
    />
  )
}

/** 출처 목록의 작은 학습 진입 — 체크 선택이 아니라 지금 목록(출처 · 검색 · 난이도) 전체가 범위다. */
function SourceRecallEntry({ href, count }: { href: string; count: number }) {
  if (count === 0) return null
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2" data-testid="vocab-source-recall">
      <p className="break-keep font-body text-[12px] text-[var(--t2)]">
        지금 목록의 내 단어 {count.toLocaleString()}개{count > 50 ? ' 중 복습이 급한 50개' : ''}로 기본 뜻을 떠올리고 스스로 매겨요. 체크한 단어만 고르지는 않아요.
      </p>
      <Link
        href={href}
        data-testid="vocab-source-recall-start"
        className="inline-flex min-h-[44px] items-center rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-4 font-display text-[13px] font-[700] text-[var(--t1)] transition-colors hover:bg-[var(--bg2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)]"
      >
        이 목록으로 뜻 떠올리기 →
      </Link>
    </div>
  )
}
