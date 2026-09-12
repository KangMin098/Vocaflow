// apps/web/src/app/admin/compose/__tests__/transitions.test.ts
//
// 발주·묶음 상태 전이 회귀 — **화면이 그리는 버튼 = 서버가 허용하는 전이.**
//
// 갈려 있었다: 화면은 `pending`(취소)·`claimed`(회수)만 그렸는데 스키마는 `drafted`·`failed`
// 도 허용했고, `deleteComposeJob` 은 `.eq('status','pending')` 을 따로 적고 있었다. 그래서
// 실패한 발주는 사유만 보인 채 화면에서 아무것도 할 수 없었다(2026-09-06).
//
// 그래서 이 테스트는 표만 보지 않는다 — **서버 액션이 실제로 어떤 상태를 WHERE 에 넣는지**
// 를 가짜 클라이언트로 받아 적어 화면의 버튼 집합과 대조한다.

import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  BATCH_ACTIONS,
  JOB_ACTIONS,
  batchAcceptsJobs,
  batchActionsFor,
  jobActionsFor,
  type JobActionKey,
} from '../transitions'

/** 스키마 CHECK 그대로 (20260817064000_acp_compose_jobs.sql). */
const JOB_STATUSES = ['pending', 'claimed', 'drafted', 'failed', 'done'] as const
/** 스키마 CHECK 그대로 (20260817053009_acp_compose_batch_regroup.sql). */
const BATCH_STATUSES = ['collecting', 'ledger_ready', 'composing', 'done', 'abandoned'] as const

// ── 가짜 supabase — 서버 액션이 건 조건을 받아 적는다 ────────────────

interface Recorded {
  table: string
  op: 'delete' | 'update' | 'select'
  statuses?: string[]
  patch?: Record<string, unknown>
}

const recorded: Recorded[] = []
let rowResult: { data: unknown[] | null; error: unknown } = { data: [{ id: 'x' }], error: null }
let countResult: { count: number | null; error: unknown } = { count: 0, error: null }

function chain(rec: Recorded, result: unknown): Record<string, unknown> {
  const self: Record<string, unknown> = {
    eq: () => self,
    in: (_col: string, vals: string[]) => {
      rec.statuses = vals
      return self
    },
    select: () => self,
    then: (ok: (v: unknown) => unknown, fail?: (e: unknown) => unknown) =>
      Promise.resolve(result).then(ok, fail),
  }
  return self
}

vi.mock('next/cache', () => ({ revalidatePath: () => undefined }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: () =>
    Promise.resolve({
      from(table: string) {
        return {
          delete: () => {
            const rec: Recorded = { table, op: 'delete' }
            recorded.push(rec)
            return chain(rec, rowResult)
          },
          update: (patch: Record<string, unknown>) => {
            const rec: Recorded = { table, op: 'update', patch }
            recorded.push(rec)
            return chain(rec, rowResult)
          },
          select: () => {
            const rec: Recorded = { table, op: 'select' }
            recorded.push(rec)
            return chain(rec, countResult)
          },
        }
      },
    }),
}))

// 액션 모듈은 mock 이 걸린 뒤에 읽는다.
const { runBatchAction, runComposeJobAction } = await import('../actions')

beforeEach(() => {
  recorded.length = 0
  rowResult = { data: [{ id: 'x' }], error: null }
  countResult = { count: 0, error: null }
})

/** 이 동작을 실행했을 때 서버가 WHERE 에 넣은 상태 목록. */
async function serverStatusesFor(action: JobActionKey): Promise<string[]> {
  recorded.length = 0
  await runComposeJobAction('job-1', action)
  const rec = recorded.find((r) => r.table === 'article_compose_jobs')
  return rec?.statuses ?? []
}

describe('발주 액션 — 화면과 서버가 같은 전이표를 본다', () => {
  it('failed 발주에 재시도와 삭제가 있고, 서버도 failed 를 받는다', async () => {
    expect(jobActionsFor('failed').map((a) => a.key)).toEqual(['retry', 'discard'])
    expect(await serverStatusesFor('retry')).toContain('failed')
    expect(await serverStatusesFor('discard')).toContain('failed')
  })

  it.each([...JOB_STATUSES])('%s 에서 노출되는 액션을 서버가 전부 허용한다', async (status) => {
    for (const action of jobActionsFor(status)) {
      expect(await serverStatusesFor(action.key)).toContain(status)
    }
  })

  it.each([...JOB_STATUSES])('%s 에서 숨긴 액션은 서버도 그 상태를 받지 않는다', async (status) => {
    const shown = new Set(jobActionsFor(status).map((a) => a.key))
    for (const key of Object.keys(JOB_ACTIONS) as JobActionKey[]) {
      if (shown.has(key)) continue
      expect(await serverStatusesFor(key)).not.toContain(status)
    }
  })

  it('어떤 상태에서도 누를 것이 하나도 없는 막다른 발주는 done 뿐이다', () => {
    const dead = JOB_STATUSES.filter((s) => jobActionsFor(s).length === 0)
    // drafted·failed 가 여기 끼면 큐에서 영원히 못 치우는 행이 다시 생긴 것이다.
    expect(dead).toEqual(['done'])
  })

  it('재시도는 지우지 않고 되돌린다 — 시도 횟수와 실패 사유는 남는다', async () => {
    recorded.length = 0
    await runComposeJobAction('job-1', 'retry')
    const rec = recorded.find((r) => r.table === 'article_compose_jobs')
    expect(rec?.op).toBe('update')
    expect(rec?.patch).toMatchObject({ status: 'pending' })
    expect(Object.keys(rec?.patch ?? {})).not.toContain('attempts')
    expect(Object.keys(rec?.patch ?? {})).not.toContain('last_error')
  })

  it('0행이면 성공이라고 하지 않는다 — 조용한 무동작이 가장 나쁘다', async () => {
    rowResult = { data: [], error: null }
    const r = await runComposeJobAction('job-1', 'retry')
    expect(r.ok).toBe(false)
    expect(r.error).toContain('재시도')
  })

  it('되돌릴 수 없는 동작에는 확인 문구가 있다', () => {
    for (const spec of Object.values(JOB_ACTIONS)) {
      if (spec.destructive) expect(spec.confirm ?? '').not.toHaveLength(0)
    }
  })
})

describe('취재 묶음 액션 — 치우는 길이 있다', () => {
  it.each([...BATCH_STATUSES])('%s 묶음에도 누를 것이 하나 이상 있다', (status) => {
    expect(batchActionsFor(status).length).toBeGreaterThan(0)
  })

  it('폐기된 묶음은 새 발주를 받지 않고, 복구하면 다시 받는다', () => {
    expect(batchAcceptsJobs('abandoned')).toBe(false)
    expect(batchAcceptsJobs(BATCH_ACTIONS.restore.to as string)).toBe(true)
  })

  it('지문이 나온 묶음은 지우지 않는다 — 몇 편인지 말해 준다', async () => {
    countResult = { count: 3, error: null }
    const r = await runBatchAction('b1', 'purge')
    expect(r.ok).toBe(false)
    expect(r.error).toContain('3편')
    // 확인에서 막혔으므로 DELETE 는 아예 나가지 않는다.
    expect(recorded.some((x) => x.op === 'delete')).toBe(false)
  })

  it('지문이 있는지 **모르면** 지우지 않는다 (count null = 모름)', async () => {
    countResult = { count: null, error: null }
    const r = await runBatchAction('b1', 'purge')
    expect(r.ok).toBe(false)
    expect(recorded.some((x) => x.op === 'delete')).toBe(false)
  })

  it('폐기는 지우지 않고 상태만 바꾼다 — 되돌릴 수 있다', async () => {
    const r = await runBatchAction('b1', 'abandon')
    expect(r.ok).toBe(true)
    const rec = recorded.find((x) => x.table === 'article_compose_batches')
    expect(rec?.op).toBe('update')
    expect(rec?.patch).toEqual({ status: 'abandoned' })
    expect(rec?.statuses).toEqual([...BATCH_ACTIONS.abandon.from])
  })
})
