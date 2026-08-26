// apps/web/src/lib/textfit/level-map.ts
//
// 학습 어휘 레벨 맵 — **전체를 한 번 올려두고 메모리에서 답한다.**
//
// 왜 이렇게 하나 (2026-08-17 실측):
//   `/fit` 은 원래 브라우저가 Supabase 를 직접 쳤다. 지문 하나를 분석할 때마다
//   후보 수천 개를 300개씩 쪼개 **왕복 30회 이상**이 나갔고, 그 경로에 우리 서버가 없어서
//   레이트리밋을 붙일 자리조차 없었다.
//   그런데 맵 전체가 **18,271 표제어 · 200 KB 남짓**이다. 담아 둘 수 있는 크기다.
//   → 프로세스당 한 번 적재하고, 그 뒤로는 지문 분석에 **DB 왕복 0회**(실측: 콜드 2.7s → 웜 41ms).
//     비용을 줄인 게 아니라 경로에서 뺐다.
//
// RLS 를 우회하지 않는다 — service_role 이 아니라 **anon 키**로 읽는다.
//   (`lib/supabase/admin.ts` 는 "requireAdmin 뒤에서만" 이 규약이라 여기 후보가 아니다.)
//
// ⚠️ **이 맵은 "전체 어휘" 가 아니라 "공개적으로 읽을 수 있는 어휘" 다.**
//   `shared_words` 정책 `read words of published` 는 발행된 세트만, 그중 도서·아티클 파생은
//   **원본이 발행됐고 `copyright_safe_in_kr` 인 것만** 노출한다.
//   그래서 관리자 시점 81,409행 / 21,503 표제어 중 anon 에게는 **59,203행 / 18,271 표제어**만 보인다
//   (2026-08-17 정책 전문 재현으로 대조 — 로더가 읽은 수와 정확히 일치).
//   차이는 결함이 아니라 저작권 게이트다. 공개 화면이 그 이상을 알면 안 된다.

import 'server-only'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import type { CurriculumMark } from './curriculum'

/** 맵 유효 기간 — 어휘 세트 발행은 드물다. 만료되면 다음 요청이 다시 적재한다. */
const TTL_MS = 30 * 60_000

/**
 * 한 번에 요청할 행 수.
 *
 * 서버가 이보다 적게 돌려줄 수 있다(PostgREST `max-rows` 설정). 그래서 **요청한 크기가 아니라
 * 실제로 받은 개수만큼** 커서를 옮기고, 0건이 올 때 멈춘다.
 * (요청 크기를 기준으로 `rows.length < PAGE` 로 종료 판정하면, 서버가 1000으로 깎는 순간
 *  첫 페이지에서 끝났다고 판단해 **맵이 조용히 잘린다** — 잘린 맵은 오류 없이 틀린 답을 준다.)
 */
const PAGE = 5_000

/** 안전 상한 — 데이터가 예상보다 크게 늘어도 메모리를 무한정 먹지 않는다. */
const MAX_ROWS = 200_000

interface CachedMap {
  /** lemma(소문자) → 최소 v_level */
  levels: Map<string, number>
  loadedAt: number
  /** 적재에 걸린 ms — 진단용 */
  loadMs: number
  /** 왕복 횟수 — 서버가 페이지를 깎으면 늘어난다(진단용) */
  pages: number
  /** 실제로 읽은 행 수 — 기대치와 다르면 조기 종료를 의심한다 */
  rowsRead: number
}

let cache: CachedMap | null = null
/** 동시 요청이 각자 적재를 시작하지 않도록 진행 중인 약속을 공유한다. */
let inflight: Promise<CachedMap> | null = null

function anonClient(): SupabaseClient {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL']
  const key = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']
  if (!url || !key) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 누락')
  }
  // 서버에서 세션을 만들지 않는다 — 이 클라이언트는 공개 데이터만 읽는다.
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

async function load(): Promise<CachedMap> {
  const started = Date.now()
  const supabase = anonClient()
  const levels = new Map<string, number>()

  // 키셋 페이지네이션 — `OFFSET` 을 쓰지 않는다.
  //   OFFSET 방식으로 재 봤더니 81,409행 중 **59,203행만 읽고 조용히 멈췄다**(2026-08-17 실측).
  //   깊은 OFFSET 은 페이지마다 앞부분을 다시 훑어야 해서 느리고, 경계에서 이렇게 어긋난다.
  //   `id > 마지막id` 로 커서를 옮기면 매 페이지가 인덱스 탐색 한 번이라 빠르고, 무엇보다
  //   **빠뜨리거나 겹치지 않는다.**
  let cursor = ''
  let rowsRead = 0
  let pages = 0

  while (rowsRead < MAX_ROWS) {
    let query = supabase
      .from('shared_words')
      .select('id, word, lemma, v_level')
      .not('v_level', 'is', null)
      // `id` 로 정렬한다 — `lemma` 는 20% 가 NULL 이라 정렬 위치가 불안정하다.
      .order('id', { ascending: true })
      .limit(PAGE)

    if (cursor) query = query.gt('id', cursor)

    const { data, error } = await query
    if (error) throw new Error(`레벨 맵 적재 실패: ${error.message}`)

    const rows = (data ?? []) as {
      id: string
      word: string | null
      lemma: string | null
      v_level: number | null
    }[]
    for (const row of rows) {
      if (row.v_level === null) continue
      // `lemma` 는 **20%가 NULL** 이다(81,409행 중 16,563 · 2026-08-17 실측).
      // 이전 구현은 `.in('lemma', …)` 로 조회해 그 20%를 조용히 버렸다 — `word` 로 폴백한다.
      const key = (row.lemma ?? row.word ?? '').trim().toLowerCase()
      if (key.length === 0) continue
      // 같은 표제어가 여러 세트에 있으면 **가장 낮은 레벨**을 남긴다 —
      // 한 세트에서 고급으로 분류됐다고 그 단어가 초급 학습자에게 처음인 것은 아니다.
      const prev = levels.get(key)
      if (prev === undefined || row.v_level < prev) levels.set(key, row.v_level)
    }

    if (rows.length === 0) break
    // 커서는 **실제로 받은 마지막 행**에서 온다 — 서버가 페이지를 깎아도 이어서 읽는다.
    cursor = rows[rows.length - 1]!.id
    rowsRead += rows.length
    pages += 1
  }

  return { levels, loadedAt: Date.now(), loadMs: Date.now() - started, pages, rowsRead }
}

/**
 * 레벨 맵을 얻는다. 첫 호출만 DB 를 치고, 이후 TTL 안에서는 메모리에서 즉시 돌려준다.
 *
 * 동시 요청이 몰려도 적재는 **한 번만** 일어난다(inflight 공유).
 * 적재가 실패하면 다음 요청이 다시 시도한다 — 실패를 캐시하지 않는다.
 */
export async function getLevelMap(now: number = Date.now()): Promise<Map<string, number>> {
  if (cache && now - cache.loadedAt < TTL_MS) return cache.levels
  if (inflight) return (await inflight).levels

  inflight = load()
  try {
    cache = await inflight
    // 적재는 프로세스당 한 번뿐이라 로그가 시끄럽지 않고, 대신 **왜 첫 요청이 느린지**를
    // 나중에 설명할 수 있게 해 준다(왕복 수가 예상보다 많으면 서버가 페이지를 깎은 것이다).
    console.info(
      `[textfit] 레벨 맵 적재 완료 — 표제어 ${cache.levels.size} · ${cache.loadMs}ms · 왕복 ${cache.pages}회 · 행 ${cache.rowsRead}`,
    )
    return cache.levels
  } finally {
    inflight = null
  }
}

/** 적재 상태 — 진단·테스트용. 적재를 유발하지 않는다. */
export function levelMapStats(): {
  loaded: boolean
  size: number
  ageMs: number
  loadMs: number
  pages: number
  /** 실제로 읽은 행 수 — 기대치와 다르면 조기 종료를 의심한다 */
  rowsRead: number
} {
  if (!cache) return { loaded: false, size: 0, ageMs: 0, loadMs: 0, pages: 0, rowsRead: 0 }
  return {
    loaded: true,
    size: cache.levels.size,
    ageMs: Date.now() - cache.loadedAt,
    loadMs: cache.loadMs,
    pages: cache.pages,
    rowsRead: cache.rowsRead,
  }
}

/** 캐시를 비운다 — 테스트 전용. */
export function resetLevelMap(): void {
  cache = null
  inflight = null
}

/**
 * 레벨 맵에 없는 후보들이 **실재하는 영단어**인지 확인한다.
 *
 * 이게 있어야 "레벨 미상"(가르칠 목록 밖의 진짜 단어)과 "오탈자·고유명사"를 가른다.
 * `lexicon_clean` 은 45만 행이라 통째로 담지 않는다 — 잔여분만 한 번 조회한다.
 * 실측(2026-08-17) 기준 잔여는 내용어 토큰의 8.4% 라 지문당 수십 개 수준이다.
 */
export async function checkRealWords(candidates: string[]): Promise<Set<string>> {
  const found = new Set<string>()
  if (candidates.length === 0) return found

  const supabase = anonClient()
  const CHUNK = 300

  for (let i = 0; i < candidates.length; i += CHUNK) {
    const { data, error } = await supabase
      .from('lexicon_clean')
      .select('word')
      .in('word', candidates.slice(i, i + CHUNK))

    // 실재어 판정 실패는 치명적이지 않다 — 못 찾으면 '레벨 미상' 대신 '미해결' 로 분류될 뿐이고,
    // 두 경우 모두 커버리지 계산에서 불확실 질량으로 동일하게 취급된다.
    if (error) break

    for (const row of (data ?? []) as { word: string }[]) found.add(row.word.toLowerCase())
  }

  return found
}

/**
 * 표제어들의 한국어 뜻을 가져온다 — **가장 어려운 단어 몇 개에만** 쓴다.
 *
 * 뜻까지 메모리에 담지 않는 이유: 레벨 맵은 20 만 자 남짓이지만 뜻을 붙이면 몇 MB 가 된다.
 * 그리고 화면이 실제로 보여주는 건 상위 24 개뿐이라, 그때 한 번 조회하는 편이 싸다.
 *
 * 같은 표제어가 여러 세트에 있으면 **가장 낮은 레벨 쪽 뜻**을 쓴다 — 레벨 판정과 같은 기준이라
 * "V6 이라면서 고급 세트의 뜻을 보여주는" 어긋남이 생기지 않는다.
 */
export async function loadMeanings(lemmas: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  if (lemmas.length === 0) return out

  const supabase = anonClient()
  const { data, error } = await supabase
    .from('shared_words')
    .select('word, lemma, meaning_ko, v_level')
    .in('lemma', lemmas)
    .not('meaning_ko', 'is', null)
    .order('v_level', { ascending: true })

  // 뜻은 부가 정보다 — 실패해도 판정은 그대로 나간다.
  if (error) return out

  type Row = { word: string | null; lemma: string | null; meaning_ko: string | null; v_level: number | null }
  for (const row of (data ?? []) as Row[]) {
    const key = (row.lemma ?? row.word ?? '').trim().toLowerCase()
    if (!key || !row.meaning_ko) continue
    // 정렬이 v_level 오름차순이므로 먼저 온 것이 가장 낮은 레벨이다.
    if (!out.has(key)) out.set(key, row.meaning_ko)
  }

  // `lemma` 가 NULL 인 행(20%)은 위 `.in('lemma', …)` 에 안 걸린다 — `word` 로 한 번 더 훑는다.
  const missing = lemmas.filter((l) => !out.has(l))
  if (missing.length > 0) {
    const { data: byWord } = await supabase
      .from('shared_words')
      .select('word, lemma, meaning_ko, v_level')
      .in('word', missing)
      .not('meaning_ko', 'is', null)
      .order('v_level', { ascending: true })

    for (const row of (byWord ?? []) as Row[]) {
      const key = (row.lemma ?? row.word ?? '').trim().toLowerCase()
      if (!key || !row.meaning_ko || out.has(key)) continue
      out.set(key, row.meaning_ko)
    }
  }

  return out
}

/**
 * 표제어들의 **교육과정 기본 어휘 밴드**와 수능 기출 여부.
 *
 * ── 왜 RPC 인가 ─────────────────────────────────────────────────────
 * 이 태그는 `shared_dictionary.list_tags` 에만 있고 익명은 그 표를 못 읽는다
 * (RLS: `authenticated read dictionary`). 공개 경로가 쓰는 `shared_words`·`lexicon_clean`
 * 에는 없다. 그래서 밴드만 돌려주는 `curriculum_bands`(SECURITY DEFINER)를 부른다.
 *
 * ── 실패는 `null` 이다. 빈 Map 이 아니다 ────────────────────────────
 * RPC 응답에 없는 낱말은 **교육과정 밖**으로 센다(태그 없는 낱말을 아예 안 돌려주기 때문).
 * 그래서 조회가 실패했을 때 빈 Map 을 돌려주면 **모든 낱말이 "교육과정 밖"** 이 되고,
 * 교사는 멀쩡한 지문을 보고 "밖 47개" 라는 거짓 경보를 받는다.
 * `null` 이면 호출부가 칸을 통째로 감춘다 — **틀린 숫자보다 없는 칸이 낫다.**
 */
export async function loadCurriculumMarks(
  lemmas: string[],
): Promise<Map<string, CurriculumMark> | null> {
  const out = new Map<string, CurriculumMark>()
  if (lemmas.length === 0) return out

  const supabase = anonClient()
  const { data, error } = await (supabase as unknown as {
    rpc: (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { message: string } | null }>
  }).rpc('curriculum_bands', { p_words: lemmas })

  if (error) {
    console.error('[textfit] 교육과정 밴드 조회 실패:', error.message)
    return null
  }

  type Row = {
    word: string
    curr_band: number | null
    csat: boolean | null
    via_derived: boolean | null
  }
  for (const row of (data ?? []) as Row[]) {
    const key = (row.word ?? '').trim().toLowerCase()
    if (!key) continue
    const band = row.curr_band
    out.set(key, {
      band: band === 1 || band === 2 || band === 3 ? band : null,
      csat: row.csat === true,
      viaDerived: row.via_derived === true,
    })
  }

  return out
}
