// apps/web/src/lib/learner/taste-word.ts
//
// 관문이 **아직 아무것도 안 한 사람에게 보여 줄 단어 하나**.
//
// ─────────────────────────────────────────────────────────────
// 왜 필요한가 (2026-08-16 실측 + 리서치)
//
// `/admin` 리텐션 패널을 붙이고 처음 읽은 값이 **가입 → 첫 학습 중앙값 55일** 이었다.
// 리텐션 이전에 **활성화**가 막혀 있다는 뜻이다. 그 지점의 화면이 정확히 `/hub` 이고,
// 신규 학습자가 거기서 받는 제안은 **"5분 진단" 하나뿐**이었다. 진단을 안 하면 화면에
// 남는 것이 없다 — 단어 하나, 문장 하나 없이 시험만 있다.
//
// 온보딩 연구가 일관되게 말하는 것:
//   · 가치를 게이트 뒤에 두는 것이 온보딩에서 가장 비싼 실수다
//   · 가치 도달이 30분을 넘으면 이탈이 10분 이내 대비 약 3배
//   · 신규의 70~80%가 3일 안에 이탈하고, 그 대부분이 **가치를 만나기 전 첫 세션**에서 빠진다
//   · 온보딩 체크리스트 완주율 중앙값 10.1% — 5명 중 4명은 끝내지 않는다
//
// 그런데 보여 줄 재료는 **이미 있었다**: `shared_dictionary` 에 뜻·예문·CEFR·빈도순위를
// 모두 갖춘 단어가 **28,946개**(그중 A2~B1 · 1,000~6,000위 대역 1,524개). 파이프라인이
// 몇 달 동안 채운 것을 관문이 한 번도 쓰지 않고 있었다.
//
// 그래서 이 모듈은 **새 데이터를 만들지 않는다.** 있는 것에서 하나를 고른다.
// ─────────────────────────────────────────────────────────────
//
// 고르는 기준 (전부 화면이 감당할 수 있는 것만):
//   · 뜻(`meaning_ko`)과 예문(`example_en`)이 **둘 다** 있어야 한다 — 반쪽짜리 단어는
//     "이 제품이 뭘 하는지" 를 못 보여준다
//   · CEFR A2~B1 · 빈도 1,000~6,000위 — 처음 보는 사람이 "아 이 정도구나" 를 가늠할 수 있는 대역.
//     너무 쉬우면 시시하고, 너무 어려우면 나와 무관해 보인다
//   · 날짜로 결정한다(랜덤 아님) — SSR/CSR 이 다른 단어를 그리면 하이드레이션이 깨지고,
//     캡처·테스트도 매번 달라져 판정 도구가 못 된다

import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import { createClient } from '@/lib/supabase/server'

export interface TasteWord {
  word: string
  meaningKo: string
  exampleEn: string
  cefr: string | null
  /** 빈도 순위 — "얼마나 자주 나오는 단어인가" 를 학습자가 가늠하는 유일한 축 */
  rank: number | null
}

/**
 * 후보 대역 — **실측으로 정했다**(2026-08-16, `width_bucket` 로 1,000~9,000위를 8구간 표본).
 *
 *   1,000~2,000  minority · content · yard · boating   ← 이미 아는 말이 섞인다
 *   2,000~3,000  supply · maintenance · disturbed · twist
 *   3,000~4,000  thorough · calcium · veteran · ultimate
 *   4,000~5,000  illusion · tutor · pioneer · continuously
 *   5,000~6,000  flour · pierce · probable · unstable
 *   6,000~9,000  bilingual · thyroid · driveway · lug     ← 너무 지엽적
 *
 * → **2,000~6,000** 이 "닿을 만하되 배울 값어치가 있는" 구간이다.
 *
 * ⚠️ 첫 초안은 1,000~6,000 을 빈도 오름차순으로 500개만 받아 그 안에서 골랐다.
 *    그러면 풀이 **가장 흔한 500개**로 쏠려서, 실제로 오늘의 단어가 `football`(축구)로 뽑혔다.
 *    기술적으로는 맞지만 첫인상으로는 실패다 — 처음 온 사람에게 "이 제품이 나에게 뭘 해 주는가"
 *    를 전혀 못 보여준다. 값을 바꾸면 첫인상이 통째로 바뀌므로 근거 없이 만지지 말 것.
 */
const BAND = { cefr: ['A2', 'B1', 'B2'], rankMin: 2_000, rankMax: 6_000 } as const

function kstDayIndex(now: number = Date.now()): number {
  return Math.floor((now + 9 * 3_600_000) / 86_400_000)
}

/**
 * 날짜 → 후보 목록 안의 위치.
 *
 * 랜덤을 쓰지 않는 이유는 위 주석대로다. 노출 함수로 둔 것은 **테스트가 같은 규칙을
 * 검증할 수 있게** 하기 위함이다(화면에서 다시 계산하지 않는다).
 */
export function pickIndex(poolSize: number, now: number = Date.now()): number {
  if (poolSize <= 0) return 0
  return kstDayIndex(now) % poolSize
}

/**
 * 오늘의 맛보기 단어. 후보가 없으면 `null` — 그러면 화면은 단어 자리를 그리지 않는다
 * (없는 것을 지어내지 않는다).
 */
export async function fetchTasteWord(): Promise<TasteWord | null> {
  const client = await createClient()
  const lc = client as unknown as SupabaseClient

  // ⚠️ 두 질의의 조건은 **글자 그대로 같아야 한다.** 한쪽만 바뀌면 offset 이 다른 집합을
  //    가리켜 조용히 엉뚱한 단어가 나온다. (헬퍼로 묶으려다 빌더 타입이 갈려 실패했다 —
  //    영리하게 묶는 것보다 두 번 적고 이 주석을 다는 편이 안전하다.)

  // ① 대역 크기만 센다(행은 안 받는다).
  const { count, error: countErr } = await lc
    .from('shared_dictionary')
    .select('word', { count: 'exact', head: true })
    .in('cefr_level', [...BAND.cefr])
    .gte('frequency_rank', BAND.rankMin)
    .lte('frequency_rank', BAND.rankMax)
    .not('meaning_ko', 'is', null)
    .not('example_en', 'is', null)
  if (countErr || !count || count <= 0) return null

  // ② 오늘의 offset 에서 **한 행만** 꺼낸다.
  //    풀을 N개 받아 그 안에서 고르면 그 N개가 정렬 기준 쪽으로 쏠린다(초안이 `football` 을
  //    뽑은 이유). 대역 전체를 모수로 두고 offset 으로 집는 편이 편향이 없다.
  //    정렬은 반드시 고정 — Postgres 는 정렬 없는 offset 의 순서를 보장하지 않는다.
  const offset = pickIndex(count)
  const { data, error } = await lc
    .from('shared_dictionary')
    .select('word, meaning_ko, example_en, cefr_level, frequency_rank')
    .in('cefr_level', [...BAND.cefr])
    .gte('frequency_rank', BAND.rankMin)
    .lte('frequency_rank', BAND.rankMax)
    .not('meaning_ko', 'is', null)
    .not('example_en', 'is', null)
    .order('frequency_rank', { ascending: true })
    .order('word', { ascending: true })
    .range(offset, offset)

  if (error || !data || data.length === 0) return null

  const row = data[0] as {
    word: string | null
    meaning_ko: string | null
    example_en: string | null
    cefr_level: string | null
    frequency_rank: number | null
  }
  if (!row.word || !row.meaning_ko?.trim() || !row.example_en?.trim()) return null

  return {
    word: row.word,
    meaningKo: row.meaning_ko.trim(),
    exampleEn: row.example_en.trim(),
    cefr: row.cefr_level,
    rank: row.frequency_rank,
  }
}
