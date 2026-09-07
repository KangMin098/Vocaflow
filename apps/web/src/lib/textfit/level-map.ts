// apps/web/src/lib/textfit/level-map.ts
//
// 공개(미로그인) 지문 진단의 **어휘 레벨 해석** — 사전 RPC 한 번으로 답한다.
//
// ── 왜 전량 적재를 버렸나 (2026-09-05 실측) ─────────────────────────
//   이 파일은 원래 anon 이 읽을 수 있는 `shared_words` 를 통째로 프로세스에 올렸다.
//   2026-08-17 당시엔 18,271 표제어 · 200 KB · 콜드 2.7초라 말이 되는 설계였다.
//   그런데 그 표가 자라 **681,021행이 됐고, distinct 표제어는 29,308개뿐이다** — 23배 중복이다.
//   PostgREST 페이지가 1,000행 고정이라 왕복 200회 · **콜드 88초**가 걸렸고, 로더 상한
//   `MAX_ROWS` 200,000 에서 **조용히 멈췄다.** 잘린 맵은 오류를 내지 않는다 —
//   빠진 낱말이 '미지어' 로 세어져 **커버리지가 실제보다 낮게** 나왔다.
//   (그 함정의 일반형은 `docs/CONVENTIONS.md` §전량 적재 캐시에 적어 뒀다.)
//
//   대안도 재 봤다. `.in()` 표적 조회는 50 표제어에 7,617행 9.5초 · 600 표제어에 84,466행 41초 —
//   `shared_words` 는 표제어당 행이 많아 지문 규모에 못 쓴다. service_role 로 사전을 전량
//   적재해도 페이지 상한 탓에 ~49 왕복이다.
//
// ── 지금 구조 ───────────────────────────────────────────────────────
//   `resolveLevelsPublic()` 이 `textfit_resolve_levels_public` RPC 를 부른다. DB 가
//   `resolve_dict_headword` 로 굴절형을 풀고 `shared_dictionary`(48,969행 · 낱말당 한 행)에서
//   V-Level 을 붙인다. 실측: 표면형 112개 지문 한 편에 **294ms**(분석 전체 1.97초),
//   해석률 0.916 → **0.991**.
//   **로그인 경로(`queries.ts`)와 같은 해석기**라 두 화면의 숫자가 갈라지지 않는다.
//
//   anon 이 사전을 못 읽는 것(RLS `authenticated read dictionary`)이 진짜 장벽이었지
//   권한이 아니었다 — anon 은 INVOKER 함수에 EXECUTE 를 이미 갖고 있었고, 그래서 호출은
//   **오류 없이 0행**을 돌려주고 있었다. 마이그레이션 `20260905084613` 이
//   SECURITY DEFINER 쌍둥이를 만들어 그 벽을 넘되 **surface·headword·v_level 3열만** 준다.
//
// 권한: service_role 을 쓰지 않는다. anon 키로 공개 테이블과 공개 RPC 만 읽는다.
//   (`lib/supabase/admin.ts` 는 "requireAdmin 뒤에서만" 이 규약이라 여기 후보가 아니다.)

import 'server-only'

import { chunkedRpc, pagedSelectIn } from '@/lib/supabase/paged-select'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import type { CurriculumMark } from './curriculum'

function anonClient(): SupabaseClient {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL']
  const key = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']
  if (!url || !key) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 누락')
  }
  // 서버에서 세션을 만들지 않는다 — 이 클라이언트는 공개 데이터만 읽는다.
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

/** 공개 해석기가 돌려주는 한 행. */
interface PublicResolvedRow {
  surface: string
  headword: string
  v_level: number | null
}

/** 표면형 하나의 해석 결과. */
export interface ResolvedSurface {
  /** 사전 표제어 */
  headword: string
  /** V-Level. `null` 은 사전에 있으나 레벨이 아직 없는 낱말(48,969 중 312) */
  vLevel: number | null
}

/**
 * **표면형을 사전 표제어·V-Level 로 해석한다 — 공개 경로의 정본.**
 *
 * 왜 이것이 전량 적재를 대체하나 (2026-09-05 실측):
 *   `getLevelMap()` 은 anon 이 읽을 수 있는 `shared_words` 를 통째로 올린다. 그 표는
 *   **681,021행인데 distinct 표제어는 29,308개** — 23배 중복이다. PostgREST 페이지가
 *   1,000행 고정이라 왕복 200회 · **콜드 88초**가 걸리고, `MAX_ROWS` 에서 조용히 잘린다.
 *   반면 사전(`shared_dictionary`)은 낱말당 한 행이고, 해석은 DB 가 한다 —
 *   **10낱말 165ms**, 지문 하나에 왕복 8회 이하(500개씩 청크).
 *
 *   anon 이 사전을 못 읽는 것(RLS)이 진짜 장벽이었지 권한이 아니었다 →
 *   `textfit_resolve_levels_public`(마이그레이션 `20260905084613`)이 SECURITY DEFINER 로 그 벽을
 *   넘되 **surface·headword·v_level 3열만** 돌려준다(뜻·예문은 나가지 않는다).
 *
 * ⚠️ **500개씩 쪼갠다.** PostgREST 는 RPC 결과에도 `db-max-rows`(1,000)를 적용한다 —
 *    한 번에 다 보내면 오류 없이 잘리고, 빠진 낱말은 미지어로 세어져 커버리지가 낮아진다.
 *    (`chunkedRpc` 가 그 이유를 안고 있다.)
 *
 * 조각 하나라도 실패하면 **전체를 실패로 돌린다** — 반쯤 해석된 결과를 정상이라 부르면 더 나쁘다.
 */
export async function resolveLevelsPublic(
  surfaces: readonly string[],
): Promise<Map<string, ResolvedSurface>> {
  const out = new Map<string, ResolvedSurface>()
  if (surfaces.length === 0) return out

  const supabase = anonClient()
  const rows = await chunkedRpc<PublicResolvedRow>(
    surfaces,
    (chunk) => supabase.rpc('textfit_resolve_levels_public', { p_words: chunk }),
    'textfit_resolve_levels_public',
  )

  for (const row of rows) {
    if (!row.headword) continue
    const key = row.surface.trim().toLowerCase()
    if (!key) continue
    const vLevel = typeof row.v_level === 'number' ? row.v_level : null
    const prev = out.get(key)
    // 같은 표면형이 두 번 오면 **낮은 레벨**을 남긴다 — 전량 적재 경로와 같은 기준.
    if (prev === undefined || (vLevel !== null && (prev.vLevel === null || vLevel < prev.vLevel))) {
      out.set(key, { headword: row.headword, vLevel })
    }
  }

  return out
}

/**
 * **표적 조회 — `shared_words` 폴백.** 사전 RPC 가 실패했을 때만 쓴다.
 *
 * 왜 남겨 두나: `resolveLevelsPublic()` 이 정본이지만, RPC 가 죽으면 화면이 "분석 불가" 로
 * 멈추는 것보다 **덜 정확한 숫자라도 내는 편**이 낫다. 폴백은 굴절형을 `collectCandidates` 가
 * 만든 후보로 풀기 때문에 해석력이 떨어지고, 방향은 **과소평가**다 — 있는 실력을 없다고
 * 할지언정 없는 실력을 있다고 하지 않는다. 어느 쪽이 답했는지는 `AnalyzeResult.mode` 가 말한다.
 *
 * ⚠️ 정상 경로로 쓰면 안 된다. `shared_words` 는 표제어당 행이 많아 **50 표제어에 7,617행
 *    9.5초 · 600 표제어에 84,466행 41초**가 나온다(2026-09-05 실측).
 *
 * `lemma` 가 20% NULL 이라 `word` 로도 한 번 더 묻는다.
 * 같은 표제어가 여러 세트에 있으면 **가장 낮은 레벨**을 남긴다 — 사전 경로와 같은 기준.
 */
export async function loadLevelsFor(candidates: readonly string[]): Promise<Map<string, number>> {
  const levels = new Map<string, number>()
  if (candidates.length === 0) return levels

  const supabase = anonClient()
  const keys = [...new Set(candidates.map((c) => c.trim().toLowerCase()).filter(Boolean))]

  const put = (key: string | null, vLevel: number | null) => {
    const k = (key ?? '').trim().toLowerCase()
    if (!k || vLevel === null) return
    const prev = levels.get(k)
    if (prev === undefined || vLevel < prev) levels.set(k, vLevel)
  }

  type Row = { word: string | null; lemma: string | null; v_level: number | null }

  for (const column of ['lemma', 'word'] as const) {
    const rows = await pagedSelectIn<Row>(
      keys,
      (chunk, from, to) =>
        supabase
          .from('shared_words')
          .select('word, lemma, v_level')
          .not('v_level', 'is', null)
          .in(column, chunk)
          .range(from, to),
      `shared_words.${column} 레벨 표적 조회`,
    )
    for (const row of rows) put(column === 'lemma' ? row.lemma : row.word, row.v_level)
  }

  return levels
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
  type Row = {
    word: string
    curr_band: number | null
    csat: boolean | null
    via_derived: boolean | null
  }

  // ⚠️ **한 번에 다 보내면 안 된다.** PostgREST 는 RPC 결과에도 1,000행 상한을 건다
  //    (실측 2026-08-30 · 오류가 아니라 조용히 잘린다). 잘린 낱말은 교육과정 밴드가
  //    비어 "교과서에 없는 단어" 처럼 보인다 — 실제로는 있는데 안 물어본 것이다.
  let rows: Row[]
  try {
    rows = await chunkedRpc<Row>(lemmas, (chunk) =>
      (supabase as unknown as {
        rpc: (
          fn: string,
          args: Record<string, unknown>,
        ) => Promise<{ data: unknown; error: { message: string } | null }>
      }).rpc('curriculum_bands', { p_words: chunk }),
      'curriculum_bands',
    )
  } catch (e) {
    console.error('[textfit] 교육과정 밴드 조회 실패:', e instanceof Error ? e.message : e)
    return null
  }

  for (const row of rows) {
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
