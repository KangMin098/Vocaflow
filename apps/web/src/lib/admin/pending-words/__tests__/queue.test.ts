// apps/web/src/lib/admin/pending-words/__tests__/queue.test.ts
//
// **조회 실패는 0 이 아니라 "모름" 이다** — 이 파일이 고정하는 것은 그 한 가지다.
//
// 고치기 전의 /admin/pending-words 는 세 질의 모두 구조분해에서 `error` 를 뺐다.
// DB 장애·RLS 거부가 전부 `rows=[]` 로 내려앉아 화면에는 "큐가 비어있습니다." 와
// "대기 중 0" 이 떴고, 관리자는 **할 일이 없다고 믿었다**.
//
// 같은 화면의 두 번째 뒤집힘은 더 조용했다. `unresolved_dict_words` RPC 가 실패하면
// "해석되는 후보" 집합에서 아무것도 빠지지 않아 **모든 후보가 사전에 있는 것으로** 바뀌고,
// 진성 갭이 0 · 철자 변이가 부풀어 관리자를 **존재하지 않는 해석기 버그**로 보냈다.
//
// 그래서 여기서는 Supabase 클라이언트를 모킹해 error 를 돌려주고, 화면이 읽는 순수 층
// (lib/admin/pending-words/queue.ts)이 null(모름)을 내는지 본다.

import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'

import {
  DEFAULT_PAGE_SIZE,
  DEFAULT_STATUS_FILTER,
  loadPendingQueue,
  parsePendingQueueQuery,
  pendingQueueHref,
  type PendingQueueQuery,
} from '../queue'

// ─────────────────────────────────────────────
// Supabase 스텁 — 체인을 기록해 어느 질의인지 판별한다
// ─────────────────────────────────────────────

interface FakeResponse {
  data?: unknown
  error?: unknown
  count?: number | null
}

interface BuilderState {
  table: string
  columns: string
  head: boolean
  eq: [string, unknown][]
  range: [number, number] | null
  orders: string[]
}

interface Plan {
  /** 목록 질의(head 아님) */
  list: FakeResponse
  /** status='pending' head count */
  pendingCount: FakeResponse
  /** status='added' head count */
  addedCount: FakeResponse
  /** unresolved_dict_words RPC */
  rpc: FakeResponse
}

interface Recorded {
  builders: BuilderState[]
  rpcArgs: unknown[]
}

function makeClient(plan: Plan): { client: SupabaseClient; recorded: Recorded } {
  const recorded: Recorded = { builders: [], rpcArgs: [] }

  function resolveFor(state: BuilderState): FakeResponse {
    if (state.head) {
      const status = state.eq.find(([col]) => col === 'status')?.[1]
      return status === 'added' ? plan.addedCount : plan.pendingCount
    }
    return plan.list
  }

  function makeBuilder(table: string) {
    const state: BuilderState = { table, columns: '', head: false, eq: [], range: null, orders: [] }
    recorded.builders.push(state)

    const builder = {
      select(columns: string, opts?: { count?: string; head?: boolean }) {
        state.columns = columns
        state.head = opts?.head === true
        return builder
      },
      eq(column: string, value: unknown) {
        state.eq.push([column, value])
        return builder
      },
      order(column: string) {
        state.orders.push(column)
        return builder
      },
      range(from: number, to: number) {
        state.range = [from, to]
        return builder
      },
      then(onFulfilled: (value: FakeResponse) => unknown) {
        return Promise.resolve(resolveFor(state)).then(onFulfilled)
      },
    }
    return builder
  }

  const client = {
    from: (table: string) => makeBuilder(table),
    rpc: (fn: string, args: unknown) => {
      recorded.rpcArgs.push({ fn, args })
      return Promise.resolve(plan.rpc)
    },
  }

  return { client: client as unknown as SupabaseClient, recorded }
}

const OK_QUERY: PendingQueueQuery = { status: 'pending', page: 1, pageSize: 100 }

function row(lemma: string, over: Partial<Record<string, unknown>> = {}) {
  return {
    id: `id-${lemma}`,
    lemma,
    surface: null,
    encounter_count: 5,
    doc_freq: 2,
    status: 'pending',
    admin_note: null,
    created_at: '2026-08-25T00:00:00Z',
    updated_at: '2026-08-25T00:00:00Z',
    ...over,
  }
}

/** machine-learning = 하이픈 합성 · unglamorous = 파생형 · sorbents = 진성 갭 */
const THREE_ROWS = [row('machine-learning'), row('unglamorous'), row('sorbents')]

const HEALTHY: Plan = {
  list: { data: THREE_ROWS, count: 26_413 },
  pendingCount: { count: 26_000 },
  addedCount: { count: 413 },
  // 후보(machine·learning·glamorous) 가 전부 해석된다 → 미해석 목록은 비어 있다
  rpc: { data: [] },
}

// ─────────────────────────────────────────────

describe('loadPendingQueue — 실패는 0 이 아니라 모름', () => {
  it('목록 질의가 실패하면 rows 는 빈 배열이 아니라 null 이다', async () => {
    const { client } = makeClient({
      ...HEALTHY,
      list: { error: { message: 'permission denied for table pending_words' } },
    })

    const view = await loadPendingQueue(client, OK_QUERY)

    expect(view.rows.value).toBeNull()
    expect(view.rows.error).toContain('permission denied')
    // "0건" 으로 뭉개면 화면이 "큐가 비어있습니다" 를 띄운다 — 그 경로를 막는다.
    expect(view.rows.value).not.toEqual([])
    expect(view.matched.value).toBeNull()
    expect(view.totalPages).toBeNull()
    expect(view.bucketCounts).toBeNull()
  })

  it('KPI 카운트가 실패하면 각각 null 이고 사유가 남는다', async () => {
    const { client } = makeClient({
      ...HEALTHY,
      pendingCount: { error: { message: 'statement timeout' } },
      addedCount: { error: { message: 'statement timeout' } },
    })

    const view = await loadPendingQueue(client, OK_QUERY)

    expect(view.pendingCount.value).toBeNull()
    expect(view.pendingCount.error).toContain('statement timeout')
    expect(view.addedCount.value).toBeNull()
    // 목록은 멀쩡하므로 그쪽은 정상이어야 한다 — 실패가 번지지 않는다.
    expect(view.rows.value).toHaveLength(3)
  })

  it('head 카운트가 count=null 을 주면(없는 테이블의 204) 0 이 아니라 모름이다', async () => {
    // ⚠️ `count ?? 0` 이 금지인 이유 — 없는 테이블도 head 요청엔 error 없이 count=null 을 준다.
    const { client } = makeClient({ ...HEALTHY, pendingCount: { count: null } })

    const view = await loadPendingQueue(client, OK_QUERY)

    expect(view.pendingCount.value).toBeNull()
    expect(view.pendingCount.error).not.toBeNull()
  })

  it('질의가 예외를 던져도(네트워크 단절) null 로 내려온다', async () => {
    const client = {
      from: () => {
        throw new Error('fetch failed')
      },
      rpc: () => Promise.resolve({ data: [] }),
    } as unknown as SupabaseClient

    const view = await loadPendingQueue(client, OK_QUERY)

    expect(view.rows.value).toBeNull()
    expect(view.rows.error).toContain('fetch failed')
    expect(view.pendingCount.value).toBeNull()
  })

  it('정상일 때는 0 과 값을 그대로 구분해 낸다', async () => {
    const { client } = makeClient({
      ...HEALTHY,
      list: { data: [], count: 0 },
      addedCount: { count: 0 },
    })

    const view = await loadPendingQueue(client, OK_QUERY)

    // 진짜로 없는 것은 [] · 0 이다 — null 이 아니다.
    expect(view.rows.value).toEqual([])
    expect(view.rows.error).toBeNull()
    expect(view.matched.value).toBe(0)
    expect(view.addedCount.value).toBe(0)
  })
})

describe('loadPendingQueue — 사전 조회 실패는 분류를 뒤집지 않는다', () => {
  it('RPC 가 실패하면 모든 행이 판정 불가이고 진성 갭 수치를 내지 않는다', async () => {
    const { client } = makeClient({
      ...HEALTHY,
      rpc: { error: { message: 'function unresolved_dict_words does not exist' } },
    })

    const view = await loadPendingQueue(client, OK_QUERY)

    expect(view.triageError).toContain('unresolved_dict_words')
    expect(view.bucketCounts).toBeNull()
    expect(view.rows.value?.map((r) => r.bucket)).toEqual([null, null, null])
    // 예전 코드였다면 resolvable 이 후보 전체로 남아 machine-learning 이 하이픈 합성으로,
    // unglamorous 가 파생형으로 "확정" 됐다. 판정 불가는 그 어떤 라벨도 아니어야 한다.
    expect(view.rows.value?.some((r) => r.bucket === 'genuine_gap')).toBe(false)
  })

  it('RPC 가 목록이 아닌 것을 주면 그것도 판정 불가다', async () => {
    const { client } = makeClient({ ...HEALTHY, rpc: { data: null } })

    const view = await loadPendingQueue(client, OK_QUERY)

    expect(view.triageError).not.toBeNull()
    expect(view.bucketCounts).toBeNull()
  })

  it('RPC 가 정상이면 네 갈래로 분류하고 진성 갭을 맨 위에 둔다', async () => {
    const { client, recorded } = makeClient(HEALTHY)

    const view = await loadPendingQueue(client, OK_QUERY)

    expect(view.triageError).toBeNull()
    expect(view.bucketCounts).toEqual({
      genuine_gap: 1,
      derived_form: 1,
      spelling_variant: 0,
      hyphen_compound: 1,
    })
    expect(view.rows.value?.[0]?.lemma).toBe('sorbents')
    // 후보는 한 번의 배치 호출로만 묻는다 (N+1 회피)
    expect(recorded.rpcArgs).toHaveLength(1)
  })

  it('후보가 하나도 없으면 RPC 를 부르지 않는다', async () => {
    const { client, recorded } = makeClient({
      ...HEALTHY,
      list: { data: [row('sorbents')], count: 1 },
    })

    const view = await loadPendingQueue(client, OK_QUERY)

    expect(recorded.rpcArgs).toHaveLength(0)
    expect(view.rows.value?.[0]?.bucket).toBe('genuine_gap')
  })
})

describe('loadPendingQueue — 상태 필터와 페이지네이션', () => {
  it('필터 상태를 eq 로 걸고 페이지에 맞는 range 를 요청한다', async () => {
    const { client, recorded } = makeClient(HEALTHY)

    await loadPendingQueue(client, { status: 'reviewing', page: 3, pageSize: 50 })

    const list = recorded.builders.find((b) => !b.head)!
    expect(list.eq).toContainEqual(['status', 'reviewing'])
    expect(list.range).toEqual([100, 149])
  })

  it("status='all' 이면 상태를 걸지 않는다", async () => {
    const { client, recorded } = makeClient(HEALTHY)

    await loadPendingQueue(client, { status: 'all', page: 1, pageSize: 100 })

    const list = recorded.builders.find((b) => !b.head)!
    expect(list.eq).toEqual([])
  })

  it('전체 행 수로 마지막 페이지를 계산한다 — 26,000행의 꼬리도 도달 가능해야 한다', async () => {
    const { client } = makeClient({ ...HEALTHY, list: { data: THREE_ROWS, count: 26_413 } })

    const view = await loadPendingQueue(client, OK_QUERY)

    expect(view.matched.value).toBe(26_413)
    expect(view.totalPages).toBe(265)
  })
})

describe('parsePendingQueueQuery / pendingQueueHref', () => {
  it('기본값은 미처리만 · 1쪽', () => {
    expect(parsePendingQueueQuery(undefined)).toEqual({
      status: DEFAULT_STATUS_FILTER,
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
    })
    expect(DEFAULT_STATUS_FILTER).toBe('pending')
  })

  it('모르는 값·음수는 조용히 기본값으로 되돌린다', () => {
    expect(parsePendingQueueQuery({ status: 'nope', page: '-3', size: '9999' })).toEqual({
      status: 'pending',
      page: 1,
      pageSize: 200,
    })
  })

  it('배열로 온 쿼리도 첫 값을 쓴다', () => {
    expect(parsePendingQueueQuery({ status: ['added'], page: ['2'] })).toEqual({
      status: 'added',
      page: 2,
      pageSize: DEFAULT_PAGE_SIZE,
    })
  })

  it('기본값은 링크에 남기지 않는다', () => {
    expect(pendingQueueHref({ status: 'pending', page: 1, pageSize: DEFAULT_PAGE_SIZE })).toBe(
      '/admin/pending-words',
    )
    expect(pendingQueueHref({ status: 'all', page: 4, pageSize: DEFAULT_PAGE_SIZE })).toBe(
      '/admin/pending-words?status=all&page=4',
    )
  })
})
