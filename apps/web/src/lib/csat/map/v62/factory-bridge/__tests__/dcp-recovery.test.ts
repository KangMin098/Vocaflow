// apps/web/src/lib/csat/map/v62/factory-bridge/__tests__/dcp-recovery.test.ts
// Codex independent counterexample: a failed qualification must be resumable after the candidate insert committed.
// The fake follows the factory_dcp_qualify boundary: one qualification per admitted candidate, same args = same id.
import { expect, it } from 'vitest'
import { admitCandidates, type SupplyClient } from '../dcp-supply'
import { fileSha, outputOf, packetOf, reviewOf, snapshot } from './dcp-fixture'

async function harness(mode: 'fail_before_record' | 'response_lost') {
  const packet = await packetOf(false)
  const output = outputOf(packet)
  const admitted = new Map<string, string>()
  const qualified = new Map<string, { id: string; args: string }>()
  let failures = 1
  const admin: SupplyClient = {
    async rpc<T>(fn: string, args: Record<string, unknown>) {
      if (fn === 'factory_dcp_admit') {
        const key = String(args.p_request_key)
        const replayed = admitted.has(key)
        const id = admitted.get(key) ?? `00000000-0000-4000-8000-${String(admitted.size + 1).padStart(12, '0')}`
        admitted.set(key, id)
        return { data: { dcp_item_id: id, artifact_revision: 'a'.repeat(64), replayed } as T, error: null }
      }
      if (fn === 'factory_dcp_qualify') {
        const dcp = String(args.p_dcp_item)
        const body = JSON.stringify(args.p_args)
        if (mode === 'fail_before_record' && failures-- > 0) return { data: null, error: { message: 'injected qualification failure' } }
        const prev = qualified.get(dcp)
        if (prev && prev.args !== body) return { data: null, error: { message: 'different body' } }
        const rec = prev ?? { id: `qualification:${dcp}`, args: body }
        qualified.set(dcp, rec)
        if (mode === 'response_lost' && failures-- > 0) return { data: null, error: { message: 'injected response loss' } }
        return { data: rec.id as T, error: null }
      }
      throw new Error(`unexpected RPC: ${fn}`)
    },
  }
  const input = { packet, output, outputSha256: fileSha(output), review: reviewOf(packet, output), rights: { record_id: 'isolated-rights-fixture', basis: 'isolated_harness_only' } }
  return { admin, input, qualified, reader: async () => snapshot() }
}

for (const mode of ['fail_before_record', 'response_lost'] as const) {
  it(`retries qualification after admission succeeded (${mode})`, async () => {
    const { admin, input, qualified, reader } = await harness(mode)
    expect(await admitCandidates(admin, reader, input, { isolated: true })).toMatchObject({ ok: false, code: 'factory_dcp_qualify_failed' })
    const retry = await admitCandidates(admin, reader, input, { isolated: true })
    if (!retry.ok) throw new Error(retry.code)
    expect(retry.items.every((i) => i.replayed || i.item_id !== retry.items[0]!.item_id)).toBe(true)
    expect(retry.items.map((i) => i.qualification_id)).toEqual(retry.items.map((i) => `qualification:${i.dcp_item_id}`))
    expect(qualified.size).toBe(retry.items.length)
    // 세 번째 재요청도 같은 id · 추가 자격 없음
    const again = await admitCandidates(admin, reader, input, { isolated: true })
    if (!again.ok) throw new Error(again.code)
    expect(again.items.map((i) => i.qualification_id)).toEqual(retry.items.map((i) => i.qualification_id))
    expect(qualified.size).toBe(retry.items.length)
  })
}
