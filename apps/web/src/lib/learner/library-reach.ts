// apps/web/src/lib/learner/library-reach.ts
//
// **사정권의 조회부** — 발행 카탈로그의 레벨 분포를 읽어 온다.
// 순수 계산(`V_LEVEL_MAX` · `computeReach` · `cumulative`)은 `reach-math.ts` 가 갖는다.
//
// ⚠️ 두 파일을 나눈 이유는 그 파일 머리 주석에 있다 — 셸 패널(클라이언트)이 상수 하나를
//    읽었다는 이유로 `server-only` 가 클라이언트 그래프에 끌려 들어가 **모든 라우트가 500**
//    이 됐다(2026-09-05 실측: `/login` 도 500).
//
// 왜 이 수인가:
//   레벨은 그 자체로 아무 뜻이 없다. "V7 입니다" 는 학습자에게 아무것도 약속하지 않는다.
//   같은 값을 **카탈로그에 곱하면** 약속이 된다 — "지금 274권, 한 계단 더 가면 38권이 더."
//   경쟁사가 이 문장을 베끼려면 레벨 축(4축 V-Level)과 레벨이 매겨진 카탈로그를 둘 다
//   가져야 한다. 우리는 `library_books.book_v_level` 에 실측이 있다(발행 312권 / V2~V9).
//
// 비용:
//   이 분포는 **사용자와 무관한 전역 값**이다. 학습자마다 다시 셀 이유가 없으므로
//   프로세스 안에 TTL 로 들고 있는다. 셸(layout)은 모든 라우트에서 도므로 여기에
//   쿼리를 하나 더 얹으면 그 비용이 화면 수만큼 곱해진다.

import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import { pagedSelect } from '@/lib/supabase/paged-select'
import { createClient } from '@/lib/supabase/server'

import { V_LEVEL_MAX, computeReach, type LevelReach } from './reach-math'

export { V_LEVEL_MAX, computeReach, cumulative, type LevelReach } from './reach-math'

interface Distribution {
  /** index = book_v_level, value = 그 레벨의 발행 도서 수 */
  byLevel: number[]
  total: number
  fetchedAt: number
}

/** 카탈로그 분포는 큐레이션이 발행할 때만 바뀐다 — 10분이면 충분히 신선하다. */
const TTL_MS = 10 * 60_000

let cached: Distribution | null = null
let inflight: Promise<Distribution> | null = null

async function loadDistribution(): Promise<Distribution> {
  const client = await createClient()
  const lc = client as unknown as SupabaseClient

  // 컬럼 하나 · 발행본만 — smallint 한 칸이라 페이로드가 작다. 그룹 집계는 PostgREST 로
  // 못 하므로 가장 작은 형태로 받아 여기서 센다. 결과는 TTL 동안 재사용된다.
  //
  // ⚠️ `.limit(N)` 을 쓰지 않는다 — PostgREST 는 **1,000행에서 조용히 끊는다**(요청한 만큼
  //    오지 않는다). 발행 도서가 지금은 312권이라 `.limit(2000)` 도 "돌아가는" 것처럼
  //    보였지만, 1,000권을 넘는 순간 사정권이 말없이 과소 집계된다 —
  //    학습자에게는 "열린 책이 줄어든" 것으로 보인다. `row-cap-lies` 회귀가 잡았다.
  const rows = await pagedSelect<{ book_v_level: number | null }>(
    (from, to) =>
      lc.from('library_books').select('book_v_level').eq('status', 'published').range(from, to),
    'library-reach published books',
  )

  const byLevel = new Array<number>(V_LEVEL_MAX + 1).fill(0)
  let total = 0
  for (const row of rows) {
    total += 1
    const lv = row.book_v_level
    // 레벨이 없는 책은 총계에는 들어가되 사정권에는 못 넣는다 — 어느 계단에
    // 놓아야 할지 모르는 책을 "열렸다" 고 세면 그 수가 거짓이 된다.
    if (typeof lv === 'number' && lv >= 0 && lv <= V_LEVEL_MAX) byLevel[lv] += 1
  }
  return { byLevel, total, fetchedAt: Date.now() }
}

async function distribution(): Promise<Distribution> {
  if (cached && Date.now() - cached.fetchedAt < TTL_MS) return cached
  // 동시 요청이 같은 쿼리를 N번 쏘지 않게 한 번만 날린다.
  if (!inflight) {
    inflight = loadDistribution()
      .then((d) => {
        cached = d
        return d
      })
      .finally(() => {
        inflight = null
      })
  }
  return inflight
}

/** 서버 조회 — 셸에서 부른다. TTL 캐시 덕에 대부분의 요청은 쿼리를 내지 않는다. */
export async function fetchLevelReach(vLevel: number | null): Promise<LevelReach> {
  const d = await distribution()
  return computeReach(d.byLevel, d.total, vLevel)
}

/** 테스트 전용 — 프로세스 캐시를 비운다. */
export function __resetReachCache(): void {
  cached = null
  inflight = null
}
