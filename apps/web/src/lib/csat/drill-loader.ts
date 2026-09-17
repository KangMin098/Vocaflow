// apps/web/src/lib/csat/drill-loader.ts
//
// **구워 둔 훈련 문제를 읽어 여덟을 고른다 — DB 를 치지 않는다.**
//
// ── 왜 DB 가 아닌가 ──────────────────────────────────────────────────
// 처음에는 요청마다 골랐다 — `csat_item_analyses` 3,069행의 `choice_analysis`(jsonb)를 RLS
// 클라이언트로 **전량** 페이지네이션했다. 학습자 화면 한 장에 표 하나를 통째로 읽는 설계이고,
// `trap-atlas` 가 이미 같은 이유로 굽기를 택했다.
//
// ⚠️ 그 경로를 열었을 때 화면이 3분을 기다려도 안 떴지만, **같은 시각 프로젝트가 Cloudflare
//    522 를 내고 있었다**(2026-09-15). 그 3분은 이 설계의 증거가 아니다 — 원인을 못 가린
//    관측이라 근거로 쓰지 않는다. 굽는 이유는 「표를 통째로 읽는다」 하나로 충분하다.
//
// 지금은 `scripts/csat/build-trap-drill.mjs` 가 구운 JSON 만 읽는다:
// 조회 왕복 **0** · 지문 원문이 런타임 경로에 없다는 것이 **구조로** 보장된다.
//
// ⚠️ **`server-only` 를 들이지 않는다** — `fs` 를 쓰므로 서버에서만 도는 것이 사실이지만,
//    타입을 화면(클라이언트 컴포넌트)이 읽는다. 값 import 하나가 클라이언트 그래프에
//    server-only 를 끌고 들어가 빌드를 죽인 사고가 이 저장소에 **세 번** 있었다
//    (CONVENTIONS.md §server-only). 그래서 모양은 `trap-drill.ts`(순수)에 두고 여기서 읽기만 한다.
//
// ⚠️ **JSON 을 정적 import 하지 않는다.** 하면 그 1MB 가 클라이언트 그래프에 들어갈 길이
//    생긴다 — 화면에 필요한 것은 여덟 장뿐이다. `skeleton.ts` 와 같은 이유로 `fs` 로 읽는다.

import fs from 'node:fs'
import path from 'node:path'

import { pickSet, type DrillBias, type DrillCard } from './trap-drill'

const DATA = path.join(process.cwd(), 'src/lib/csat/drill-data/pool.json')

/** 한 세트의 문항 수. 8 은 작업기억을 넘기지 않으면서 함정 넷 이상을 만나는 크기다. */
export const DRILL_SIZE = 8

interface Pool {
  built_at: string
  per_trap: number
  eligible: number
  cards: DrillCard[]
}

// 빌드 산출물이라 한 번 읽으면 안 바뀐다. 요청마다 디스크를 치지 않는다.
let cache: Pool | null | undefined

function load(): Pool | null {
  if (cache !== undefined) return cache
  try {
    cache = JSON.parse(fs.readFileSync(DATA, 'utf8')) as Pool
  } catch {
    // **빈 풀을 지어내지 않는다** — 화면이 문제 0개를 그리면 「훈련할 것이 없다」로 읽히는데
    // 그건 거짓이다. null 을 받은 화면은 「불러오지 못했다」라고 말한다.
    cache = null
  }
  return cache
}

export interface DrillSet {
  cards: DrillCard[]
  /** 구운 문제 수 — 화면이 「무엇에서 골랐는지」 말할 수 있어야 한다. */
  pool: number
  /** 이번 세트에 **되돌아온** 카드 id (지난번 틀린 것) */
  returningIds: string[]
  /** 기록 때문에 자리를 먼저 받은 수법 */
  boosted: string[]
  error: string | null
}

/**
 * 한 세트를 고른다. 뽑기 규칙은 `trap-drill.ts` 의 `pickSet` 한 곳에 있다 —
 * 여기에 다시 적으면 화면과 회귀가 서로 다른 규칙을 보게 된다(이 파일에 한때 같은 루프가
 * 복제돼 있었다).
 *
 * `bias` 는 **기록이 문턱을 넘은 학습자에게만** 넘긴다(부르는 쪽 책임). 없으면 편향 없이 뽑고,
 * 그때의 세트는 같은 씨앗에 대해 편향 도입 전과 똑같다.
 */
export function loadTrapDrill(seed: string, size = DRILL_SIZE, bias?: DrillBias | null): DrillSet {
  const data = load()
  if (!data) return { cards: [], pool: 0, returningIds: [], boosted: [], error: '훈련 문제를 불러오지 못했어요.' }
  const set = pickSet(data.cards, seed, size, bias)
  return { ...set, pool: data.cards.length, error: null }
}
