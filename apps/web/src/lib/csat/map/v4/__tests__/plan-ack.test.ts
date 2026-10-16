// apps/web/src/lib/csat/map/v4/__tests__/plan-ack.test.ts
import { describe, expect, it } from 'vitest'
import { acknowledgePlan, bindPlanDraft, listenPlanAck, sameStageDraft } from '../plan-ack'
const ack = { version: 4, workspaceId: 'owned', stages: { r: 'repair', t: 'transfer' } }
describe('PLAN response handoff', () => {
 it('retains an acknowledgement across an unmounted editor, consumes it once', () => {
  acknowledgePlan('old', ack)
  const seen: number[] = []
  const off = listenPlanAck('old', a => { seen.push(a.version); return true })
  off()
  listenPlanAck('old', a => { seen.push(a.version); return true })()
  expect(seen).toEqual([4])
 })
 it('a different goal/viewer/version cannot consume a pending response', () => {
  acknowledgePlan('one', ack)
  const seen: number[] = []
  listenPlanAck('two', a => { seen.push(a.version); return true })()
  expect(seen).toEqual([])
  listenPlanAck('one', a => { seen.push(a.version); return true })()
  expect(seen).toEqual([4])
 })
 it('a workspace mismatch can refuse the handoff; invalid versions are ignored', () => {
  acknowledgePlan('mismatch', ack)
  listenPlanAck('mismatch', () => false)()
  const seen: number[] = []
  listenPlanAck('mismatch', a => { seen.push(a.version); return true })()
  acknowledgePlan('invalid', { ...ack, version: NaN })
  listenPlanAck('invalid', a => { seen.push(a.version); return true })()
  expect(seen).toEqual([4])
 })
 it('a changed stage discards only its quantity, preserving order and unchanged-stage edits', () => {
  expect(sameStageDraft({ order: [], planned: { r: 3, t: 1 }, stages: ack.stages }, ack.stages, { r: 'repair', t: 'recheck' })).toEqual({ order: [], planned: { r: 3 }, stages: { r: 'repair', t: 'recheck' } })
 })
})

it('local restoration drops unbound legacy quantities, not the order', () => {
 expect(bindPlanDraft({order:['r'],planned:{r:1}},{r:'repair'})).toEqual({order:['r'],planned:{},stages:{r:'repair'}})
})
it('local restoration keeps same-stage intent and drops cross-stage intent', () => {
 const draft={order:['r'],planned:{r:1},stages:{r:'repair'}}
 expect(bindPlanDraft(draft,{r:'repair'})?.planned).toEqual({r:1})
 expect(bindPlanDraft(draft,{r:'transfer'})?.planned).toEqual({})
})

it('an older response preserves a newer draft owned by the current stage', () => {
 expect(sameStageDraft({order:['r'],planned:{r:1},stages:{r:'transfer'}},{r:'repair'},{r:'transfer'})).toEqual({order:['r'],planned:{r:1},stages:{r:'transfer'}})
})
