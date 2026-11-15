// apps/web/src/lib/admin/__tests__/dcp-admission.test.ts
// 1C 관리자 경계 — 미리보기는 RPC 0 · 입고는 세션 RPC 만 · 합성 수요는 RPC 전에 거절 · 미설치는 not_installed
import { SOURCE_POLICY_SELECT } from '@vocaflow/library-pipeline'
import { expect, it, vi } from 'vitest'

import { fileSha, outputOf, packetOf, reviewOf, row, snapshot } from '@/lib/csat/map/v62/factory-bridge/__tests__/dcp-fixture'

import { admitDcpCandidates, CURRENT_SOURCE_SELECT, currentSourceReader, previewDcpAdmission } from '../dcp-admission'

const inputOf = async (synthetic: boolean) => {
  const packet = await packetOf(synthetic)
  const output = outputOf(packet)
  return { packet, output, outputSha256: fileSha(output), review: reviewOf(packet, output), rights: null }
}

// PostgREST 대역 — library_articles 는 select 문자열을 기록하고 주어진 행을, csat_dcp_items 는 head count 를 돌려준다
const fakeDb = (article: { data: unknown; error: unknown }, items: { count: number | null; error: unknown }) => {
  const calls: Array<{ table: string; select: string; opts?: unknown; eq: Array<[string, unknown]> }> = []
  const from = (table: string) => ({
    select(select: string, opts?: unknown) {
      const call = { table, select, opts, eq: [] as Array<[string, unknown]> }
      calls.push(call)
      const chain = {
        eq(k: string, v: unknown) { call.eq.push([k, v]); return chain },
        maybeSingle: async () => article,
        then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve({ data: null, ...items }).then(res, rej),
      }
      return chain
    },
  })
  return { db: { from } as never, calls }
}
// 실제 projected 행 = fixture 행에서 has_items 를 뺀 것(gate/windows 는 SOURCE_POLICY_SELECT 별칭으로 평평하게 온다)
const projected = (): Record<string, unknown> => { const r: Record<string, unknown> = row(); delete r.has_items; return r }
const NOW = new Date('2026-10-21T05:50:28Z')

it('currentSourceReader 는 정본 투영 + 같은 article 문항 존재를 조회해 평평한 snapshot 을 만든다', async () => {
  const { db, calls } = fakeDb({ data: projected(), error: null }, { count: 2, error: null })
  const r = await currentSourceReader(db, NOW)('s')
  expect(calls[0]).toMatchObject({ table: 'library_articles', select: CURRENT_SOURCE_SELECT, eq: [['id', 's']] })
  expect(CURRENT_SOURCE_SELECT.startsWith(SOURCE_POLICY_SELECT)).toBe(true)
  expect(CURRENT_SOURCE_SELECT).toMatch(/,content,source,source_url,license$/)
  expect(CURRENT_SOURCE_SELECT).not.toMatch(/\*/)
  expect(calls[1]).toMatchObject({ table: 'csat_dcp_items', select: 'id', opts: { head: true, count: 'exact' }, eq: [['kind', 'article'], ['ref_id', 's']] })
  expect(r).toEqual({ snapshot_kind: 'read_only_database_export', current_time: NOW.toISOString(), row: { ...projected(), has_items: true } })
})

it('reader 경유 preview = 같은 정상 snapshot 직접 preview (probe 회귀)', async () => {
  const input = await inputOf(true)
  const direct = await previewDcpAdmission(async () => snapshot(), input)
  const { db } = fakeDb({ data: projected(), error: null }, { count: 1, error: null })
  const viaReader = await previewDcpAdmission(currentSourceReader(db, NOW), input)
  expect(direct.status).toBe('ok')
  expect(viaReader).toEqual(direct)
})

it('raw csat_fit 모양(투영 안 된 행)은 평평한 값으로 오인하지 않고 거절한다', async () => {
  const raw = projected()
  raw.csat_fit = { gate: raw.gate, make: { windows: raw.windows } }
  delete raw.gate
  delete raw.windows
  const { db } = fakeDb({ data: raw, error: null }, { count: 1, error: null })
  await expect(currentSourceReader(db, NOW)('s')).rejects.toThrow('source_row_not_projected')
})

it('문항 조회 오류 · null count 는 false/0 으로 삼키지 않는다 · 문항 0 은 has_items=false', async () => {
  const ok = { data: projected(), error: null }
  await expect(currentSourceReader(fakeDb(ok, { count: null, error: { code: '42P01' } }).db, NOW)('s')).rejects.toThrow('source_items_read_failed:42P01')
  await expect(currentSourceReader(fakeDb(ok, { count: null, error: null }).db, NOW)('s')).rejects.toThrow('source_items_count_unavailable')
  await expect(currentSourceReader(fakeDb({ data: null, error: { code: 'XX' } }, { count: 0, error: null }).db, NOW)('s')).rejects.toThrow('source_read_failed:XX')
  expect(await currentSourceReader(fakeDb({ data: null, error: null }, { count: 0, error: null }).db, NOW)('s')).toBeNull()
  const r = await currentSourceReader(fakeDb(ok, { count: 0, error: null }).db, NOW)('s')
  expect(r?.row.has_items).toBe(false)
})

it('preview 는 계획만 · 합성 수요 real_admissible=false', async () => {
  const r = await previewDcpAdmission(async () => snapshot(), await inputOf(true))
  if (r.status !== 'ok') throw new Error(r.code)
  expect(r.writes).toBe('not_performed')
  expect(r.plan.real_admissible).toBe(false)
})

it('입고: 합성 수요 · 권리 unknown 은 RPC 전에 not_admissible', async () => {
  const rpc = vi.fn()
  expect(await admitDcpCandidates({ rpc } as never, async () => snapshot(), await inputOf(true))).toMatchObject({ status: 'rejected', code: 'not_admissible' })
  expect(rpc).not.toHaveBeenCalled()
})

it('입고: 미설치 RPC(PGRST202)는 not_installed — 세션 클라이언트 rpc 로만 호출', async () => {
  // 고정 픽스처는 실등록 가능(real_admissible)이 아니므로 등록 서비스만 대역으로 바꿔 RPC 경계를 본다
  vi.resetModules()
  vi.doMock('@/lib/csat/map/v62/factory-bridge/dcp-supply', () => ({
    previewAdmission: vi.fn(),
    admitCandidates: async (c: { rpc: (fn: string, a: object) => Promise<{ error: { message: string } | null }> }) => {
      const r = await c.rpc('factory_dcp_admit', {})
      return r.error ? { ok: false, code: 'factory_dcp_admit_failed', detail: r.error.message } : { ok: true, items: [] }
    },
  }))
  const mod = await import('../dcp-admission')
  const rpc = vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'Could not find the function' } })
  expect(await mod.admitDcpCandidates({ rpc } as never, async () => snapshot(), await inputOf(false))).toEqual({ status: 'not_installed' })
  expect(rpc).toHaveBeenCalledWith('factory_dcp_admit', {})
  rpc.mockResolvedValue({ data: null, error: { code: 'P0001', message: 'admission: synthetic demand cannot be admitted' } })
  expect(await mod.admitDcpCandidates({ rpc } as never, async () => snapshot(), await inputOf(false))).toMatchObject({ status: 'rejected', code: 'factory_dcp_admit_failed' })
  vi.doUnmock('@/lib/csat/map/v62/factory-bridge/dcp-supply')
})
