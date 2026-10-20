// verification/reviews/T-0063-r1-independent-probe/probe.test.tsx
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReasoningNoteForm } from '@/components/csat/theater/ReasoningNoteForm'
import { normalizeReasoningNote, type ReasoningNote } from '@/lib/csat/dissect'
import { EMPTY_NOTE, sending, settled, clearNote } from '@/lib/csat/explain-draft'
const A='a'.repeat(64), B='b'.repeat(64), deliveryId='11111111-2222-4333-8444-555555555555'
const note=(id:string, hash:string, at:number, parent?:string):ReasoningNote=>normalizeReasoningNote({
 id,item:'ev-guided-1',pairIds:[],binding:{analysisVersion:null},statement:`explanation-${id}`,grounds:'reason',applicability:'condition',limit:'boundary',evidence:[],afterExplanation:true,comparedWithModel:true,at,updatedAt:at,authored:{deliveryId,annotationHash:hash},...(parent?{revisionOf:parent}:{})
})!
function html(saved:ReasoningNote[], shownId:string, hash:string) {
 return renderToStaticMarkup(<ReasoningNoteForm itemId="ev-guided-1" analysisVersion={null} principle={{statement:'CURRENT_MODEL_ONLY',when_applies:[],when_not:[]} as never} pairs={[]} saved={saved} draft={{...EMPTY_NOTE,shownId}} onDraft={()=>{}} onSave={async()=>true} authored={{deliveryId,annotationHash:hash}} />)
}
describe('T0063 independent counterexamples',()=>{
 it('control: current edition root and revision compare normally',()=>{
  const out=html([note('note-0001',A,1),note('note-0002',A,2,'note-0001')],'note-0001',A)
  expect(out).toContain('CURRENT_MODEL_ONLY'); expect(out).toContain('data-testid="note-first"')
 })
 it('control: old edition note is retained but does not compare',()=>{
  const out=html([note('note-0001',A,1)],'note-0001',B)
  expect(out).not.toContain('CURRENT_MODEL_ONLY');expect(out).toContain('note-other-edition')
 })
 it('P1: selected current root must not authorize displayed different-edition revision',()=>{
  const out=html([note('note-0001',A,1),note('note-0002',B,2,'note-0001')],'note-0001',A)
  expect(out).toContain('explanation-note-0002')
  expect(out).not.toContain('CURRENT_MODEL_ONLY')
 })
 it('P1: current displayed revision must be comparable even when selected root is old',()=>{
  const out=html([note('note-0001',A,1),note('note-0002',B,2,'note-0001')],'note-0001',B)
  expect(out).toContain('explanation-note-0002')
  expect(out).toContain('CURRENT_MODEL_ONLY')
 })
 it('failed revision keeps parent, text, id and at across retransmission',()=>{
  const d={...EMPTY_NOTE,revising:'note-0001',fields:{...EMPTY_NOTE.fields,statement:'revised'}}
  const sent=sending(d,()=> 'note-0002',100)
  const fail=settled(sent.draft,false,sent.id,clearNote)
  const retry=sending(fail,()=> 'must-not-use',200)
  expect(retry.id).toBe('note-0002');expect(retry.at).toBe(100)
  expect(retry.draft.revising).toBe('note-0001');expect(retry.draft.fields.statement).toBe('revised')
 })
 it('successful revision clears only submitted draft; later edits remain',()=>{
  const d=sending({...EMPTY_NOTE,revising:'note-0001',fields:{...EMPTY_NOTE.fields,statement:'revised'}},()=> 'note-0002',100).draft
  expect(settled(d,true,'note-0002',clearNote).revising).toBeNull()
  const later={...d,rev:d.rev+1,fields:{...d.fields,statement:'new writing'}}
  expect(settled(later,true,'note-0002',clearNote).fields.statement).toBe('new writing')
 })
})
