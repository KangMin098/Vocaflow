// apps/web/src/lib/csat/map/v62/factory-bridge/__tests__/independent.test.ts
import {afterEach,describe,expect,it,vi} from 'vitest'
import type {FactoryRequest} from '../../factory-integration'
import type {FqResult} from '../../qualification'
import * as crosswalk from '../crosswalk'
import {cellIdOf,verifyLineage,type ArtifactRef,type CellRef} from '../lineage'
import {projectUnits} from '../material-unit'
import {productionNeed,groupSharedNeeds,type BriefDraft,ORDER_POLICY_FIELDS} from '../production-need'
import {resolveStock,type StockCandidate} from '../stock-resolver'

const H=(c:string)=>c.repeat(64)
const request=(n=2):FactoryRequest=>({schema:'vf.factory-request/1',requestId:'request',idempotencyKey:'key',demandKey:'d',workspaceId:'w',versions:{goal:1,plan:1,definition:'v6.2'},task:'v.contextual_sense',supportTasks:[],role:'guided_practice',lineNo:0,education:{performanceGoal:'context meaning',learnerOutput:'choice',teachingStage:'practice',exposure:'help allowed',reason:'stage_repair'},content:{csatTypes:['R-VOCAB'],factoryTypes:['vocab_choice']},quantity:{n,unit:'문항',basis:'plan_stage_quantity'},source:{rightsUsable:true,excludeUnsupportedExams:true},constraints:{gold:false,unseenByLearner:false,noExplanationBefore:false,versionBinding:'exact_revision'},postReview:[],reuseAllowed:true,productionUnit:{support:'convertible_to_volume',why:'activity_unit_unsupported',commands:[]},connection:'MOCK_ONLY',approvalsNeeded:[]})
const brief:BriefDraft={grade_scope:{mode:'single_grade',grades:['high_2']},purpose:'vocabulary_in_context',domain_weights:{science:1},genre_weights:{expository:1},duration_days:10,units_per_chapter:5,difficulty:{start:5,end:6},passage_words:{start:150,end:200},source_strategy:'balanced'}
const policies=()=>Object.fromEntries(ORDER_POLICY_FIELDS.map(k=>[k,{version:'v1',hash:H('a')}]))
const rules=[{from:'item' as const,to:'cell' as const,factor:2,evidenceId:'conversion-v1'}]
const stock=(n=2)=>resolveStock({task:'v.contextual_sense',role:'guided_practice',requested:n},'ok',[])
const candidate=(ref='a'):StockCandidate=>({artifact:{kind:'csat_item',ref,contentType:'check_task'},currentRevision:'rev1',passage:'passage',fq:{content:{id:ref,revision:'rev1'},task:'v.contextual_sense',role:'guided_practice',axes:Object.fromEntries(['A','B','C','D','E','F','G','H'].map(k=>[k,{state:'pass'}])) as FqResult['axes'],eligibleRoles:[],publicQualified:false,assessmentQualified:false},qualificationId:'q1',approvals:[{id:'approval',qualificationId:'q1',scope:'public',approverRole:'admin',revoked:false}],exposure:'none'})
afterEach(()=>{vi.restoreAllMocks()})

describe('independent A share specification',()=>{
 const need=(r=request(),p=policies(),rr=rules)=>productionNeed(r,stock(r.quantity.n),{brief,policies:p,rules:rr})
 it('policy hash changes cannot reuse a production group',()=>{const p=policies();p.rights={version:'v1',hash:H('b')};expect(need().shareKey).not.toBe(need(request(),p).shareKey)})
 it('policy revision changes cannot reuse a production group',()=>{const p=policies();p.rights.version='v2';expect(need().shareKey).not.toBe(need(request(),p).shareKey)})
 it('quantity changes cannot reuse an unaggregated production group',()=>expect(need().shareKey).not.toBe(need(request(7)).shareKey))
 it('conversion evidence changes cannot reuse a production group',()=>expect(need().shareKey).not.toBe(need(request(),policies(),[{...rules[0]!,evidenceId:'conversion-v2'}]).shareKey))
 it('factory item specification changes cannot reuse a production group',()=>expect(need().shareKey).not.toBe(need({...request(),content:{csatTypes:['X-VOCAB'],factoryTypes:['long_vocab']}}).shareKey))
 it('personal workspace and goal revisions do not alter a public specification',()=>expect(need().shareKey).toBe(need({...request(),requestId:'other',demandKey:'other-demand',workspaceId:'other-ws',idempotencyKey:'other-key',versions:{goal:9,plan:9,definition:'v6.2'}}).shareKey))
 it('duplicate request rows do not inflate shared request membership',()=>{const n=need();expect(groupSharedNeeds([n,n])[0]!.requestIds).toHaveLength(1)})
 it('stock for another task is not a matching request result',()=>expect(()=>productionNeed(request(),{...stock(),task:'r.central_meaning'})).toThrow())
 it('stock for another role is not a matching request result',()=>expect(()=>productionNeed(request(),{...stock(),role:'source_analysis'})).toThrow())
 it('stock for another quantity is not a matching request result',()=>expect(()=>productionNeed(request(),stock(9))).toThrow())
})

describe('independent B run and seal boundaries',()=>{
 it('a recorded boolean and artifact count cannot bypass missing brief and policies',()=>{const n=productionNeed(request(),stock(),{run:{recorded:true,artifacts:4}});expect(n.state).not.toBe('ARTIFACT_CANDIDATE');expect(n.state).not.toBe('RUN_RECORDED');expect(n.blockers.length).toBeGreaterThan(0)})
 it('reported run never authenticates even complete metadata without a factory validator',()=>{const c=crosswalk.crosswalkFor('v.contextual_sense')[0]!;vi.spyOn(crosswalk,'crosswalkFor').mockReturnValue([{...c,status:'validated',validationEvidenceId:'synthetic-review',reviewer:'synthetic'}]);const n=productionNeed(request(),stock(),{brief,policies:policies(),rules,run:{recorded:true,artifacts:1}});expect(['READY_TO_SEAL','RUN_PENDING','RUN_RECORDED','ARTIFACT_CANDIDATE']).not.toContain(n.state)})
 it('presence-only malformed ProductBrief cannot become ready to seal',()=>{const c=crosswalk.crosswalkFor('v.contextual_sense')[0]!;vi.spyOn(crosswalk,'crosswalkFor').mockReturnValue([{...c,status:'validated',validationEvidenceId:'synthetic-review',reviewer:'synthetic'}]);const malformed=Object.fromEntries(Object.keys(brief).map(k=>[k,''])) as BriefDraft;expect(productionNeed(request(),stock(),{brief:malformed,policies:policies(),rules}).state).not.toBe('READY_TO_SEAL')})
})

describe('independent C numeric boundaries',()=>{
 for(const v of [-1,NaN,Infinity,-Infinity,1.5,Number.MAX_SAFE_INTEGER+1]){
  it(`reject requested ${String(v)}`,()=>expect(()=>projectUnits({demandUnit:'문항',requested:v,eligible:0,productionUnit:'item'})).toThrow())
  it(`reject eligible ${String(v)}`,()=>expect(()=>projectUnits({demandUnit:'문항',requested:2,eligible:v,productionUnit:'item'})).toThrow())
  it(`reject stock requested ${String(v)}`,()=>expect(()=>resolveStock({task:'v.contextual_sense',role:'guided_practice',requested:v},'ok',[])).toThrow())
 }
 it('infinite conversion factor never creates zero production',()=>expect(projectUnits({demandUnit:'문항',requested:2,eligible:0,productionUnit:'cell',rules:[{...rules[0]!,factor:Infinity}]}).productionQuantity).toBeNull())
 it('blank conversion evidence is not a conversion',()=>expect(projectUnits({demandUnit:'문항',requested:2,eligible:0,productionUnit:'cell',rules:[{...rules[0]!,evidenceId:'   '}]}).productionQuantity).toBeNull())
 it('zero is legitimate and is not a missing stock read',()=>expect(projectUnits({demandUnit:'문항',requested:0,eligible:0,productionUnit:'item'})).toMatchObject({shortfall:0,productionQuantity:0}))
})

describe('independent D inventory multiplicity',()=>{
 it('identical artifact rows count once for guided practice',()=>{const c=candidate();const s=resolveStock({task:'v.contextual_sense',role:'guided_practice',requested:2},'ok',[c,structuredClone(c)]);expect(s.eligible).toEqual(['a']);expect(s.newProductionNeeded).toBe(1);expect(s.counts.eligible_existing).toBe(1)})
 it('conflicting revisions of the same artifact do not select an arbitrary winner',()=>{const a=candidate(),b=structuredClone(a);b.currentRevision='rev2';b.fq!.content.revision='rev2';for(const cs of [[a,b],[b,a]])expect(resolveStock({task:'v.contextual_sense',role:'guided_practice',requested:2},'ok',cs).eligible).toHaveLength(0)})
 it('distinct practice items may share a passage without becoming independent evidence',()=>expect(resolveStock({task:'v.contextual_sense',role:'guided_practice',requested:2},'ok',[candidate('a'),candidate('b')]).eligible).toHaveLength(2))
 it('conflicting approval and unreviewed versions cannot be rescued by row order',()=>{const a=candidate(),b=structuredClone(a);b.approvals=[];for(const cs of [[a,b],[b,a]])expect(resolveStock({task:'v.contextual_sense',role:'guided_practice',requested:2},'ok',cs).eligible).toHaveLength(0)})
})

describe('independent E lineage structural boundary',()=>{
 const order={productOrderId:'order',orderRevision:1,orderHash:H('a')}
 const cell:CellRef={...order,cellId:cellIdOf(order,1),cellHash:H('b'),grade:'high_2',day:1}
 const links=[{requestId:'request',shareKey:'share',order}]
 const a:ArtifactRef={...order,id:'artifact',kind:'item',hash:H('c'),cellId:cell.cellId}
 it('malformed non-null manifest hash is rejected',()=>expect(verifyLineage(links,{drainHash:H('d'),manifestHash:'not-a-hash',cells:[cell]},[a]).ok).toBe(false))
 it('duplicate artifact identifiers cannot inflate candidate lineage',()=>expect(verifyLineage(links,{drainHash:H('d'),manifestHash:null,cells:[cell]},[a,a]).ok).toBe(false))
 it('negative order revision and day cannot form a legitimate cell',()=>{const o={...order,orderRevision:-1};const c={...cell,...o,day:-1,cellId:cellIdOf(o,-1)};expect(verifyLineage([{...links[0]!,order:o}],{drainHash:H('d'),manifestHash:null,cells:[c]},[]).ok).toBe(false)})
 it('empty arrays and a hash are not lineage evidence',()=>expect(verifyLineage([],{drainHash:H('d'),manifestHash:null,cells:[]},[]).ok).toBe(false))
 it('syntactically valid hashes never yield supply authorization',()=>expect(verifyLineage(links,{drainHash:H('d'),manifestHash:null,cells:[cell]},[a]).supplyApproved).toBe(false))
})

describe('independent F educational mapping',()=>{
 it('E3 option correspondence does not search grammar-only P06 as paraphrase material',()=>expect(crosswalk.crosswalkFor('e.option_correspondence').some(c=>c.productFamily==='P06')).toBe(false))
 it('no current search candidate can seal or authorize assessment',()=>{for(const c of crosswalk.CROSSWALK){expect(crosswalk.crosswalkUsable(c,'seal_order').ok).toBe(false);expect(crosswalk.crosswalkUsable(c,'assessment').ok).toBe(false)}})
})
