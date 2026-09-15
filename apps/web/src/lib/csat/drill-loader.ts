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

import { rngFrom, shuffle, type DrillCard } from './trap-drill'

const DATA = path.join(process.cwd(), 'src/lib/csat/drill-data/pool.json')

/** 한 세트의 문항 수. 8 은 작업기억을 넘기지 않으면서 함정 넷 이상을 만나는 크기다. */
export const DRILL_SIZE = 8

/** 한 세트에 같은 함정이 몇 번까지 나올 수 있나. 여덟이면 함정 넷 이상을 만난다. */
const MAX_PER_TRAP = 2

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
  error: string | null
}

export function loadTrapDrill(seed: string, size = DRILL_SIZE): DrillSet {
  const data = load()
  if (!data) return { cards: [], pool: 0, error: '훈련 문제를 불러오지 못했어요.' }

  // ── 뽑기 ─────────────────────────────────────────────────────────
  // 그냥 무작위로 여덟을 뽑으면 흔한 함정이 세 번 나온다. 그러면 한 세트가 한두 함정만 재게
  // 되고, 훈련이 「아홉 가지를 알아보는 것」이 아니라 「흔한 것을 찍는 것」이 된다.
  const rand = rngFrom(seed)
  const shuffled = shuffle(data.cards, rand)
  const seenItem = new Set<string>()
  const perTrap = new Map<string, number>()
  const picked: DrillCard[] = []

  for (const cap of [MAX_PER_TRAP - 1, MAX_PER_TRAP, Infinity]) {
    for (const c of shuffled) {
      if (picked.length >= size) break
      if (seenItem.has(c.item_id)) continue
      if ((perTrap.get(c.answer) ?? 0) >= cap) continue
      seenItem.add(c.item_id)
      perTrap.set(c.answer, (perTrap.get(c.answer) ?? 0) + 1)
      picked.push(c)
    }
    if (picked.length >= size) break
  }

  return { cards: picked, pool: data.cards.length, error: null }
}
