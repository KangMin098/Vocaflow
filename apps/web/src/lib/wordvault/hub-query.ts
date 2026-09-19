// apps/web/src/lib/wordvault/hub-query.ts
//
// `/wordvault` 허브가 그리는 **모든 수치를 서버에서 한 번에** 접는다.
//
// ── 왜 생겼나 (실측 2026-09-05) ──────────────────────────────────────
// 허브는 라우트 파일부터 `'use client'` 였고, 그래서 서버가 그리는 것이 **하나도 없었다**
// (첫 HTML 은 스켈레톤). 하이드레이션이 끝난 뒤 8개 컴포넌트가 각자 Supabase 를 쳤다:
//
//   `vocabularies` **전량 2회**(useHubStats 의 FSRS 9열 + VocabularyLevelMap 의 lemma/word) ·
//   `auth.getUser()` 8회 · `user_profiles` 4회 · `library_books` 4회 · `texts` 3회 ·
//   `daily_activity` 2회 · `shared_dictionary` 를 500개씩 **직렬 루프**.
//
// 즉 **단어가 많은 학습자일수록 벌을 받는** 구조였다(1,945행 계정 기준 전량 왕복 4회 × 2).
//
// 규칙 셋:
//   ① 사용자 확인은 **호출부에서 한 번**. 이 함수는 이미 확인된 `userId` 를 받는다.
//   ② 한 테이블은 한 번만 읽는다 — 여러 섹션이 같은 표를 원하면 여기서 접어 나눠 준다.
//   ③ 섹션은 조회하지 않는다. props 로 받은 것만 그린다(그래야 서버 HTML 에 수치가 남는다).
//
// ⚠️ 전량이 필요한 조회는 반드시 `pagedSelect` 를 거친다 — PostgREST 는 1,000행에서
//    조용히 끊는다. 이 저장소가 같은 결함을 세 번 겪었다(`lib/supabase/paged-select` 머리말).

import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import { getMemoryState, type MemoryState, type ModuleId } from '@/lib/srs'
import { pagedSelect, pagedSelectIn } from '@/lib/supabase/paged-select'
import type { PublishedBook } from '@/lib/library/published-book'

// ─────────────────────────────────────────────────────────────────────
// 공개 형태 — 섹션 6개가 받는 props 의 원본
// ─────────────────────────────────────────────────────────────────────

export interface HubBuckets {
  stable: number
  shaky: number
  risk: number
  new: number
}

export interface LevelMapData {
  /** V0~V11 분포 (12칸) */
  byLevel: number[]
  currentVLevel: number | null
  trackLevels: Record<string, number>
  totalWithLevel: number
  /** 사전 조회 자체가 실패했는가 — "아직 없음" 과 "못 셌다" 를 화면이 구별해야 한다. */
  failed: boolean
}

export interface ResourceBookEntry {
  bookId: string
  title: string
  author: string | null
  totalChapters: number
  completedChapters: number
  inProgressChapters: number
  resumeTextId: string | null
  lastStudiedAt: number | null
}

export interface ResourceScriptEntry {
  id: string
  title: string
  isUserBook: boolean
  chapterCount: number
  completedChapters: number
  lastStudiedAt: number | null
  href: string
}

export interface ResourceSetEntry {
  bookId?: string | null
  title: string
  author?: string | null
  wordCount: number
  chapters?: number
  href: string
  /** 단일 공용단어장이면 그 set_id — 있으면 행 탭 시 챕터 학습 모달이 열린다. */
  setId?: string
  coverEmoji?: string | null
  category?: string | null
  cefrLevel?: string | null
}

export interface FlowDay {
  date: string
  words: number
  minutes: number
}

export interface RecommendedSetEntry {
  id: string
  slug: string
  title: string
  type: string
  category: string | null
  wordCount: number | null
}

export interface HubData {
  /** ── 1. VaultIdentity ── */
  total: number
  buckets: HubBuckets
  collectionsCount: number
  accumulatedDays: number
  weeklyDone: number
  weeklyTarget: number
  currentVLevel: number | null

  /** ── 2. VocabularyLevelMap ── */
  levelMap: LevelMapData

  /** ── 3. ResourcePortfolio ── */
  resources: {
    books: ResourceBookEntry[]
    scripts: ResourceScriptEntry[]
    sets: ResourceSetEntry[]
  }

  /** ── 4. RecommendedBooks ── */
  recommendedBooks: PublishedBook[]

  /** ── 5. NextStepList ── */
  recommendedSets: RecommendedSetEntry[]
  /** 추천 RPC 가 답을 못 준 이유 — 진단 전 / 조회 실패 / 결과 0 */
  recommendedSetsStatus: 'ok' | 'no-diagnostic' | 'empty'

  /** ── 6. FlowStripe ── */
  flow: {
    days: FlowDay[]
    lastActivity: { date: string; modules: string[] } | null
  }
}

const DEFAULT_DAILY_GOAL = 12
const FLOW_DAYS = 28

interface VocabRow {
  id: string
  word: string | null
  lemma: string | null
  difficulty: number | null
  stability: number | null
  last_review_at: string | null
  next_review_at: string | null
  module_history: string[] | null
  review_count: number | null
  text_id: string | null
  shared_set_id: string | null
  created_at: string | null
}

interface TextRow {
  id: string
  title: string
  author: string | null
  cefr_level: string | null
  library_book_id: string | null
  user_book_group_id: string | null
  chapter_idx: number | null
  status: string | null
  progress_percent: number | null
  last_opened: string | null
}

interface SetRow {
  id: string
  title: string
  category: string | null
  curation_query: Record<string, unknown> | null
  cefr_level: string | null
  cover_emoji: string | null
}

const emptyBuckets = (): HubBuckets => ({ stable: 0, shaky: 0, risk: 0, new: 0 })

/** 로컬 날짜(ISO yyyy-mm-dd). `toISOString()` 은 UTC 라 한국 자정 근처에서 하루가 밀린다. */
function isoDay(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * 허브 한 화면을 그리는 데 필요한 전부. **호출은 한 번**, 조회는 표당 한 번.
 *
 * 실패는 섹션 단위로 삼킨다 — 추천 도서 하나가 죽었다고 어휘 자산 수치까지 사라지면
 * 학습자는 "단어가 없어졌다" 로 읽는다. 다만 **못 센 것을 0 으로 말하지는 않는다**
 * (레벨 지도는 `failed` 로 구별해 넘긴다).
 */
export async function loadHubData(
  supabase: SupabaseClient,
  userId: string,
): Promise<HubData> {
  // ── ① vocabularies 전량 — 한 번. 4버킷 · 레벨 지도 · 세트별 개수가 전부 이 배열에서 나온다.
  const vocabs = await pagedSelect<VocabRow>(
    (lo, hi) =>
      supabase
        .from('vocabularies')
        .select(
          'id, word, lemma, difficulty, stability, last_review_at, next_review_at, module_history, review_count, text_id, shared_set_id, created_at',
        )
        .eq('user_id', userId)
        .range(lo, hi),
    'wordvault hub vocabularies',
  )

  const buckets = emptyBuckets()
  const byText = new Map<string, number>()
  const bySet = new Map<string, number>()
  const lemmas: string[] = []
  let earliest = Number.POSITIVE_INFINITY

  for (const r of vocabs) {
    const ms: MemoryState = getMemoryState({
      id: r.id,
      difficulty: r.difficulty ?? 6.0,
      stability: r.stability ?? 0,
      lastReviewAt: r.last_review_at ? new Date(r.last_review_at) : null,
      nextReviewAt: r.next_review_at ? new Date(r.next_review_at) : null,
      moduleHistory: (r.module_history ?? []) as ModuleId[],
      reviewCount: r.review_count ?? 0,
    })
    buckets[ms] += 1
    if (r.text_id) byText.set(r.text_id, (byText.get(r.text_id) ?? 0) + 1)
    if (r.shared_set_id) bySet.set(r.shared_set_id, (bySet.get(r.shared_set_id) ?? 0) + 1)
    // ⚠️ `lemma` 만 보면 안 된다 — 실측 2026-08-15 기준 252개 중 lemma 가 채워진 것은 1개였다.
    //    표면형(word)으로 매칭하면 242개가 v_level 까지 붙는다.
    const key = (r.lemma ?? r.word ?? '').trim().toLowerCase()
    if (key) lemmas.push(key)
    if (r.created_at) {
      const t = new Date(r.created_at).getTime()
      if (t < earliest) earliest = t
    }
  }

  const total = vocabs.length
  const accumulatedDays =
    total === 0 || !Number.isFinite(earliest)
      ? 0
      : Math.max(1, Math.floor((Date.now() - earliest) / 86_400_000))

  // ── ② 나머지 기본 조회는 서로를 기다릴 이유가 없다 — 한꺼번에 보낸다.
  const now = new Date()
  const flowCutoff = new Date(now)
  flowCutoff.setDate(now.getDate() - (FLOW_DAYS - 1))
  const flowCutoffStr = isoDay(flowCutoff)

  const [profileRes, activityRes, textsRes, subsRes] = await Promise.all([
    supabase
      .from('user_profiles')
      .select('current_v_level, current_track_levels, daily_word_goal')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('daily_activity')
      .select('date, total_words, total_minutes, by_module')
      .eq('user_id', userId)
      .gte('date', flowCutoffStr)
      .order('date', { ascending: true }),
    supabase
      .from('texts')
      .select(
        'id, title, author, cefr_level, library_book_id, user_book_group_id, chapter_idx, status, progress_percent, last_opened',
      )
      .eq('user_id', userId)
      .order('last_opened', { ascending: false, nullsFirst: false }),
    supabase.from('user_word_set_subscriptions').select('set_id').eq('user_id', userId),
  ])

  const profile = (profileRes.data ?? null) as {
    current_v_level: number | null
    current_track_levels: Record<string, number> | null
    daily_word_goal: number | null
  } | null
  const currentVLevel = profile?.current_v_level ?? null
  const dailyGoal = profile?.daily_word_goal ?? DEFAULT_DAILY_GOAL

  const texts = (textsRes.data ?? []) as TextRow[]
  const subscribedSetIds = ((subsRes.data ?? []) as Array<{ set_id: string }>).map((s) => s.set_id)

  // ── ③ 주간 목표 + 28일 흐름 — 같은 `daily_activity` 한 벌에서 둘 다 접는다.
  const activityRows = (activityRes.data ?? []) as Array<{
    date: string
    total_words: number | null
    total_minutes: number | null
    by_module: Record<string, number> | null
  }>
  const weekly = foldWeekly(activityRows, now)
  const flow = foldFlow(activityRows, flowCutoff)

  // ── ④ 레벨 지도 — 위에서 이미 받은 lemma 로 사전만 친다(전량 재조회 없음).
  const levelMap = await resolveLevelMap(supabase, lemmas, currentVLevel, profile?.current_track_levels ?? {})

  // ── ⑤ 자산 포트폴리오 + 컬렉션 수 + 추천 — 세트/도서 메타를 한 벌로 모은다.
  const resources = await buildResources(supabase, userId, texts, subscribedSetIds, bySet)

  // 컬렉션 = 스크립트가 걸린 text + 도서 단위 단어장 + 도서 외 단어장.
  const collectionsCount =
    byText.size + resources.libraryBookGroupCount + resources.standaloneSetCount

  const [recommendedBooks, recommended] = await Promise.all([
    loadRecommendedBooks(supabase, texts, currentVLevel),
    loadRecommendedSets(supabase, userId, currentVLevel),
  ])

  return {
    total,
    buckets,
    collectionsCount,
    accumulatedDays,
    weeklyDone: weekly.done,
    weeklyTarget: dailyGoal * 7,
    currentVLevel,
    levelMap,
    resources: {
      books: resources.books,
      scripts: resources.scripts,
      sets: resources.sets,
    },
    recommendedBooks,
    recommendedSets: recommended.sets,
    recommendedSetsStatus: recommended.status,
    flow,
  }
}

// ─────────────────────────────────────────────────────────────────────
// 접기 — 순수 함수 (같은 입력이면 같은 출력, 테스트 가능)
// ─────────────────────────────────────────────────────────────────────

interface ActivityRow {
  date: string
  total_words: number | null
  total_minutes: number | null
  by_module: Record<string, number> | null
}

/** 이번 주(월요일 시작) 누적 단어 수. */
export function foldWeekly(rows: ActivityRow[], now: Date): { done: number } {
  const day = now.getDay()
  const offset = day === 0 ? 6 : day - 1
  const monday = new Date(now)
  monday.setDate(now.getDate() - offset)
  monday.setHours(0, 0, 0, 0)
  const mondayStr = isoDay(monday)
  let done = 0
  for (const r of rows) {
    if (r.date >= mondayStr) done += r.total_words ?? 0
  }
  return { done }
}

/** 28일 스파크라인 + 마지막 활동. 빈 날도 칸을 남긴다(없는 날이 안 보이면 추세가 거짓말한다). */
export function foldFlow(
  rows: ActivityRow[],
  cutoff: Date,
): { days: FlowDay[]; lastActivity: { date: string; modules: string[] } | null } {
  const map = new Map<string, { words: number; minutes: number; byModule: Record<string, number> }>()
  for (const r of rows) {
    map.set(r.date, {
      words: r.total_words ?? 0,
      minutes: r.total_minutes ?? 0,
      byModule: r.by_module ?? {},
    })
  }
  const days: FlowDay[] = []
  for (let i = 0; i < FLOW_DAYS; i++) {
    const d = new Date(cutoff)
    d.setDate(cutoff.getDate() + i)
    const key = isoDay(d)
    const entry = map.get(key)
    days.push({ date: key, words: entry?.words ?? 0, minutes: entry?.minutes ?? 0 })
  }

  let lastActivity: { date: string; modules: string[] } | null = null
  const withActivity = rows.filter((r) => (r.total_words ?? 0) > 0 || (r.total_minutes ?? 0) > 0)
  const last = withActivity[withActivity.length - 1]
  if (last) {
    lastActivity = { date: last.date, modules: Object.keys(last.by_module ?? {}).slice(0, 3) }
  }
  return { days, lastActivity }
}

// ─────────────────────────────────────────────────────────────────────
// 조회 — 표당 한 번
// ─────────────────────────────────────────────────────────────────────

/** 내 단어의 V-Level 분포. 사전은 낱말당 한 행이라 500개씩 나눠 친다. */
async function resolveLevelMap(
  supabase: SupabaseClient,
  lemmas: string[],
  currentVLevel: number | null,
  trackLevels: Record<string, number>,
): Promise<LevelMapData> {
  const byLevel = new Array<number>(12).fill(0)
  let totalWithLevel = 0
  if (lemmas.length === 0) {
    return { byLevel, currentVLevel, trackLevels, totalWithLevel, failed: false }
  }

  // 같은 낱말이 여러 번 들어 있어도 사전은 한 번만 물어본다.
  const unique = Array.from(new Set(lemmas))
  try {
    const rows = await pagedSelectIn<{ word: string; v_level: number | null }>(
      unique,
      (chunk, from, to) =>
        supabase.from('shared_dictionary').select('word, v_level').in('word', chunk).range(from, to),
      'hub 사전 v_level',
    )
    // 사전 1행 = 낱말 1개지만, 내 단어장에는 같은 낱말이 여러 번 있을 수 있다.
    // 화면이 말하는 "N개 분류됨" 은 **내 단어 수**여야 하므로 보유 횟수로 센다.
    const owned = new Map<string, number>()
    for (const l of lemmas) owned.set(l, (owned.get(l) ?? 0) + 1)
    for (const r of rows) {
      if (r.v_level == null || r.v_level < 0 || r.v_level > 11) continue
      const n = owned.get(r.word) ?? 0
      if (n === 0) continue
      byLevel[r.v_level] = (byLevel[r.v_level] ?? 0) + n
      totalWithLevel += n
    }
  } catch {
    return { byLevel, currentVLevel, trackLevels, totalWithLevel: 0, failed: true }
  }

  return { byLevel, currentVLevel, trackLevels, totalWithLevel, failed: false }
}

interface ResourceResult {
  books: ResourceBookEntry[]
  scripts: ResourceScriptEntry[]
  sets: ResourceSetEntry[]
  libraryBookGroupCount: number
  standaloneSetCount: number
}

async function buildResources(
  supabase: SupabaseClient,
  userId: string,
  texts: TextRow[],
  subscribedSetIds: string[],
  wordsPerSet: Map<string, number>,
): Promise<ResourceResult> {
  const bookGroups = new Map<string, TextRow[]>()
  const userBookGroups = new Map<string, TextRow[]>()
  const standalone: TextRow[] = []
  for (const r of texts) {
    if (r.library_book_id) {
      const arr = bookGroups.get(r.library_book_id) ?? []
      arr.push(r)
      bookGroups.set(r.library_book_id, arr)
    } else if (r.user_book_group_id) {
      const arr = userBookGroups.get(r.user_book_group_id) ?? []
      arr.push(r)
      userBookGroups.set(r.user_book_group_id, arr)
    } else {
      standalone.push(r)
    }
  }

  // 구독 세트 메타 — 여기서 한 번만 읽는다.
  let setRows: SetRow[] = []
  if (subscribedSetIds.length > 0) {
    const { data } = await supabase
      .from('shared_word_sets')
      .select('id, title, category, curation_query, cefr_level, cover_emoji')
      .in('id', subscribedSetIds)
    setRows = (data ?? []) as SetRow[]
  }

  const setBookGroups = new Map<string, SetRow[]>()
  const otherSets: SetRow[] = []
  for (const s of setRows) {
    const bookId =
      s.category === 'library_book' && s.curation_query
        ? ((s.curation_query['book_id'] as string | undefined) ?? null)
        : null
    if (bookId) {
      const arr = setBookGroups.get(bookId) ?? []
      arr.push(s)
      setBookGroups.set(bookId, arr)
    } else {
      otherSets.push(s)
    }
  }

  // ⚠️ `library_books` 는 **한 번만** 친다 — 예전에는 useHubStats·ResourcePortfolio(2회)·
  //    RecommendedBooks 가 각자 쳐서 한 화면에 4회였다. 두 출처의 id 를 합쳐서 보낸다.
  const allBookIds = Array.from(new Set([...bookGroups.keys(), ...setBookGroups.keys()]))
  const bookMeta = new Map<string, { title: string; author: string | null }>()
  if (allBookIds.length > 0) {
    const { data } = await supabase
      .from('library_books')
      .select('id, title, author')
      .in('id', allBookIds)
    for (const b of (data ?? []) as Array<{ id: string; title: string; author: string | null }>) {
      bookMeta.set(b.id, { title: b.title, author: b.author })
    }
  }

  const books: ResourceBookEntry[] = []
  for (const [bid, rows] of bookGroups) {
    const sorted = [...rows].sort((a, b) => (a.chapter_idx ?? 0) - (b.chapter_idx ?? 0))
    const meta = bookMeta.get(bid)
    books.push({
      bookId: bid,
      title: meta?.title ?? sorted[0]?.title ?? '제목 없음',
      author: meta?.author ?? sorted[0]?.author ?? null,
      totalChapters: sorted.length,
      completedChapters: sorted.filter((r) => Number(r.progress_percent ?? 0) >= 100).length,
      inProgressChapters: sorted.filter((r) => {
        const p = Number(r.progress_percent ?? 0)
        return p > 0 && p < 100
      }).length,
      resumeTextId:
        (
          sorted.find((r) => r.status === 'in_progress') ??
          sorted.find((r) => !r.status || r.status === 'not_started') ??
          sorted[0]
        )?.id ?? null,
      lastStudiedAt: latestOpened(sorted),
    })
  }
  books.sort((a, b) => (b.lastStudiedAt ?? 0) - (a.lastStudiedAt ?? 0))

  const scripts: ResourceScriptEntry[] = []
  for (const [gid, rows] of userBookGroups) {
    const sorted = [...rows].sort((a, b) => (a.chapter_idx ?? 0) - (b.chapter_idx ?? 0))
    const resume = sorted.find((r) => r.status === 'in_progress') ?? sorted[0]
    scripts.push({
      id: gid,
      title: sorted[0]?.title ?? '내 책',
      isUserBook: true,
      chapterCount: sorted.length,
      completedChapters: sorted.filter((r) => Number(r.progress_percent ?? 0) >= 100).length,
      lastStudiedAt: latestOpened(sorted),
      href: resume ? `/text/${resume.id}?mode=read` : '/text',
    })
  }
  for (const r of standalone) {
    scripts.push({
      id: r.id,
      title: r.title,
      isUserBook: false,
      chapterCount: 1,
      completedChapters: Number(r.progress_percent ?? 0) >= 100 ? 1 : 0,
      lastStudiedAt: r.last_opened ? new Date(r.last_opened).getTime() : null,
      href: `/text/${r.id}?mode=read`,
    })
  }
  scripts.sort((a, b) => (b.lastStudiedAt ?? 0) - (a.lastStudiedAt ?? 0))

  // 챕터 보유 세트만 학습 모달로 라우팅 — 챕터 없는 세트는 단어 브라우저가 더 유용하다.
  const chapteredSetIds = new Set<string>()
  const otherSetIds = otherSets.map((s) => s.id)
  if (otherSetIds.length > 0) {
    const chRows = await pagedSelectIn<{ set_id: string }>(
      otherSetIds,
      (chunk, from, to) =>
        supabase
          .from('shared_words')
          .select('set_id')
          .in('set_id', chunk)
          .not('chapter', 'is', null)
          .range(from, to),
      '챕터 보유 세트',
    )
    for (const r of chRows) chapteredSetIds.add(r.set_id)
  }

  const sets: ResourceSetEntry[] = []
  for (const [bid, rows] of setBookGroups) {
    const meta = bookMeta.get(bid)
    const wc = rows.reduce((s, r) => s + (wordsPerSet.get(r.id) ?? 0), 0)
    const firstSet = [...rows].sort(
      (a, b) =>
        Number(a.curation_query?.['chapter_idx'] ?? 0) - Number(b.curation_query?.['chapter_idx'] ?? 0),
    )[0]
    sets.push({
      bookId: bid,
      title: meta?.title ?? '도서 단어장',
      author: meta?.author ?? null,
      wordCount: wc,
      chapters: rows.length,
      href: firstSet
        ? `/wordvault/browse?filter=set:${firstSet.id}&book=${bid}`
        : '/wordvault/browse',
    })
  }
  for (const s of otherSets) {
    const chaptered = chapteredSetIds.has(s.id)
    sets.push({
      title: s.title,
      wordCount: wordsPerSet.get(s.id) ?? 0,
      href: `/wordvault/browse?filter=set:${s.id}`,
      ...(chaptered
        ? { setId: s.id, coverEmoji: s.cover_emoji, category: s.category, cefrLevel: s.cefr_level }
        : {}),
    })
  }
  sets.sort((a, b) => b.wordCount - a.wordCount)

  void userId

  return {
    books,
    scripts,
    sets,
    libraryBookGroupCount: setBookGroups.size,
    standaloneSetCount: otherSets.length,
  }
}

function latestOpened(rows: TextRow[]): number | null {
  return rows.reduce<number | null>((acc, r) => {
    const t = r.last_opened ? new Date(r.last_opened).getTime() : null
    return t == null ? acc : acc == null || t > acc ? t : acc
  }, null)
}

/** i+1 권장 도서 후보. 진단 전(V-Level 없음)이면 조회 자체를 하지 않는다. */
async function loadRecommendedBooks(
  supabase: SupabaseClient,
  texts: TextRow[],
  currentVLevel: number | null,
): Promise<PublishedBook[]> {
  if (currentVLevel == null) return []
  const enrolled = new Set(
    texts.map((t) => t.library_book_id).filter((v): v is string => typeof v === 'string'),
  )
  const { data, error } = await supabase
    .from('library_books')
    .select(
      // popularity_rank 는 library_seed_catalog 소유 — library_books 에 없어 select 시 400.
      'id, title, author, cefr_level, cefr_band, book_v_level, word_count, chapter_count, reading_minutes, ' +
        'cover_from, cover_to, cover_image_url, lexical_coverage, is_picture_book, published_at',
    )
    .eq('status', 'published')
    .eq('copyright_safe_in_kr', true)
    .not('published_at', 'is', null)
    // 표시용 상위 후보만 — 점수는 아래 클라이언트 리프가 매긴다(순수 계산).
    .limit(80)
  if (error) return []
  return ((data ?? []) as unknown as PublishedBook[]).filter((b) => !enrolled.has(b.id))
}

async function loadRecommendedSets(
  supabase: SupabaseClient,
  userId: string,
  currentVLevel: number | null,
): Promise<{ sets: RecommendedSetEntry[]; status: 'ok' | 'no-diagnostic' | 'empty' }> {
  if (currentVLevel == null) return { sets: [], status: 'no-diagnostic' }
  const { data, error } = await supabase.rpc('recommend_word_sets_for_user', { p_user_id: userId })
  if (error) return { sets: [], status: 'empty' }
  const raws = (data ?? []) as Array<{
    set_id: string
    slug: string
    title: string
    category: string | null
    word_count: number | null
    recommendation_type: string
  }>
  const sets: RecommendedSetEntry[] = raws.slice(0, 5).map((r) => ({
    id: r.set_id,
    slug: r.slug,
    title: r.title,
    type: r.recommendation_type ?? 'fallback',
    category: r.category,
    wordCount: r.word_count,
  }))
  return { sets, status: sets.length > 0 ? 'ok' : 'empty' }
}
