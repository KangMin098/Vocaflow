// Independent latest-main baseline for authored evidence projection, not a new grading rule.
import {describe,it,expect}from'vitest'
import {renderToStaticMarkup}from'react-dom/server'
import {EvidenceBlock}from'@/components/csat/diagnosis/map/EvidenceClaims'
import {evidenceView}from'@/lib/csat/map/v62/evidence-claims'
import {repairGate}from'@/lib/csat/map/v4/plan'
import {evidenceKeysOfTask}from'@/lib/csat/map/v4/definition'
const task='r.central_meaning' as const,key='authored-central-meaning',v='2026-10-01T00:00:00Z',after='2026-10-02T00:00:00Z'
const check={taskKey:key,status:'verified',independentItems:2,attemptedItems:2,verifiedItems:['authored:probe-ind-1','authored:probe-ind-2'],wrongItems:['authored:probe-ind-1','authored:probe-ind-2'],unseen:[],examSeen:[],verifiedAt:v}
const row=(o:Record<string,unknown>={})=>({attemptId:'3',sessionId:'s3',itemRef:'authored:probe-guide',taskKey:key,phase:'practice',activity:'practice',isCorrect:true,answeredAt:after,receivedAt:after,helpLevel:'viewed_first',synthetic:false,repairRole:'guided_practice',contentHash:'h',...o})
const view=(a:any[],o:Record<string,unknown>={})=>evidenceView({task,check:check as never,firsts:[],activity:a,hashes:{},transfer:{done:0,planned:2},...o} as never)
const asis={id:task,basis:'direct_check',status:'verified_need',check} as never
const first={attemptId:'1',sessionId:'s1',userId:'fixture',taskKey:key,itemRef:'authored:probe-ind-1',phase:'practice',activity:'theater',isCorrect:false,answeredAt:v,helpLevel:'independent',synthetic:false,afterViewedFirst:false,afterExplanation:false,contentHash:'h',expectedContentHash:'h'}
describe('authored evidence should project existing plan/server facts',()=>{
 it('eligible guided right: same PLAN repair gate true and evidence succeeded',()=>{const a=[row()];expect(evidenceKeysOfTask(task)).toContain(key);expect(repairGate(asis,a as never).succeeded).toBe(true);expect(view(a).instructionPath.repair).toBe('succeeded')})
 it('eligible guided wrong is tried, never successful',()=>{const a=[row({isCorrect:false})];expect(repairGate(asis,a as never).succeeded).toBe(false);expect(view(a).instructionPath.repair).toBe('tried')})
 it('existing authored attempt is not silently omitted from displayed evidence history',()=>{const a=row({...first,receivedAt:v,repairRole:undefined,passageKey:'synthetic-p1'});expect(view([a],{firsts:[first]}).attempts.map(a=>a.attemptId)).toContain('1')})
 it('header never reports zero as current-check count when existing currentCheck has two',()=>{const f2={...first,attemptId:'2',sessionId:'s2',itemRef:'authored:probe-ind-2'}; const acts=[first,f2].map(f=>row({...f,receivedAt:v,repairRole:undefined})); const e=view(acts,{firsts:[first,f2]}),html=renderToStaticMarkup(<EvidenceBlock e={e}/>);expect(e.currentCheck.independentItems).toBe(2);expect(html).not.toContain('현행 도구 독립 확인 문항 0개');expect(html).toMatch(/2(?:개|문항)/)})
 it('unread ledger remains unknown, not zero or successful',()=>{const e=view([],{activity:undefined});expect(e.ledger).toBe('unknown');expect(e.instructionPath.repair).toBe('unknown')})
 it('legacy KICE retry keeps valid success',()=>{const c={...check,taskKey:'claim-support',verifiedItems:['M2609#20'],wrongItems:['M2609#20']};expect(view([row({itemRef:'M2609#20',taskKey:'claim-support',activity:'theater',repairRole:undefined})],{check:c}).instructionPath.repair).toBe('succeeded')})
})
