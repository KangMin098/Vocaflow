// packages/library-pipeline/src/textbook/educational-validation.test.ts
// All people, timestamps and scores below are synthetic regression fixtures, never study results.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe,it,expect } from 'vitest'
import { validationBundleSchema,validationProtocolSchema,instrumentIdentity,evaluateEducationalRecord,semanticDimensions,SEMANTIC_CRITERIA,DISTORTION_TAXONOMY,expertBlindPacket,matchEducationalBinding,educationalDeliveryState,assertPilotGradeCoverage } from './educational-validation'
import { canonical,digest,readPreservationRules } from '../../../../scripts/textbook/academic-reading-contract.mjs'
import { readEducationalValidation,validateEducationalPromotion } from '../../../../scripts/textbook/educational-validation-contract.mjs'
import { draftMeasurementItems } from '../../../../scripts/textbook/frym-validation/instruments.mjs'

const root=new URL('../../../../scripts/textbook/',import.meta.url)
const reviewFile=new URL('frym-precision/round-1.json',root)
const task=readPreservationRules(new URL('frym-precision/preservation-rules-1.json',root),reviewFile).values().next().value
const protocol=validationProtocolSchema.parse(JSON.parse(fs.readFileSync(new URL('frym-validation/protocol-1.json',root),'utf8')))
const text='Vision and touch have different functions. A single example cannot make one sense always the most important.'
const now=Date.parse('2026-10-04T10:00:00Z')
function fixture(){
  const record={id:'fixture-variant',pair_id:task.entry.pair_id,blind_item_id:'B-fixture',source_id:task.entry.source_id,source_hash:task.entry.source_hash,source_revision:task.entry.source_revision,research_hash:task.entry.research_hash,target_key:'1'.repeat(24),grade:'middle_1',passage_hash:digest(text),link_confidence:'high',provenance_verified:true,
    instrument:['comprehension','lexical','syntax','reasoning'].flatMap(axis=>[1,2,3].map(n=>({id:`${axis}-${n}`,axis,prompt:'Explain the synthetic sentence meaning.',source_quote:text,scoring_rubric:'Retain both functions and the ranking limit.'}))),
    expert_reviews:['expert-fixture-1','expert-fixture-2'].map(expert_id=>({expert_id,blind_item_id:'B-fixture',reviewed_at:'2026-10-02T00:00:00Z',passage_hash:digest(text),criteria:Object.fromEntries(SEMANTIC_CRITERIA.map(k=>[k,'pass'])),distortions:[],reason:'Synthetic reviewer preserves the relation and scope.'})),
    student_sessions:Array.from({length:5},(_,i)=>({student_id:`student-fixture-${i}`,grade:'middle_1',grade_verified_by:'lead-fixture',reading_started_at:'2026-10-03T00:00:00Z',reading_finished_at:'2026-10-03T00:02:00Z',unknown_word_count:0,lexical_burden:2,sentence_burden:2,reasoning_burden:2,perceived_difficulty:2,answers:[]})),
  }
  for(const s of record.student_sessions) s.answers=record.instrument.map(i=>({item_id:i.id,response:'Synthetic answer retaining the relationship.',score:1,scorer_id:'expert-fixture-1'}))
  const protocol_hash=digest(canonical(protocol)),instrument_hash=digest(canonical(instrumentIdentity([record])))
  return validationBundleSchema.parse({version:1,mode:'local_educational_validation',taxonomy_version:1,pilot_hash:'a'.repeat(64),review_hash:task.review_hash,rules_hash:task.rules_hash,protocol_hash,instrument_hash,protocol,
    protocol_approval:{human_lead_id:'lead-fixture',approved_at:'2026-10-01T00:00:00Z',protocol_hash,instrument_hash,registration_evidence:'Synthetic preregistration receipt for regression only.'},
    experts:['expert-fixture-1','expert-fixture-2'].map(id=>({id,kind:'human_domain_expert',independent_of_author:true,credential_verified_by:'lead-fixture',qualification_evidence:'Synthetic qualification evidence for regression only.'})),records:[record]})
}
describe('educational validation promotion',()=>{
  it('requires every gate and never reports production from a local validation',()=>{
    const b=fixture(),r=b.records[0]!,result=evaluateEducationalRecord(b,r,text,now)
    expect(result.state).toBe('gold');expect(result.blockers).toEqual([])
    expect(result.production).toBe(false);expect(result.scope).toBe('exact_passage_target_protocol_only')
    expect(result.metrics.reading_seconds).toBe(120)
  })
  it('missing actual reviews and students stays candidate with null measurements',()=>{
    const b=fixture(),r=b.records[0]!;b.protocol_approval=null;b.experts=[];r.expert_reviews=[];r.student_sessions=[]
    const result=evaluateEducationalRecord(b,r,text,now)
    expect(result.state).toBe('candidate');expect(result.student_count).toBe(0)
    expect(Object.values(result.metrics).every(v=>v===null)).toBe(true)
  })
  it('expert-reviewed passages still need student evidence',()=>{
    const b=fixture(),r=b.records[0]!;r.student_sessions=[]
    expect(evaluateEducationalRecord(b,r,text,now).state).toBe('reviewed')
  })
  it.each(SEMANTIC_CRITERIA)('one failure in %s prevents gold',criterion=>{
    const b=fixture(),r=b.records[0]!;r.expert_reviews[0]!.criteria[criterion]='fail'
    expect(evaluateEducationalRecord(b,r,text,now).blockers).toContain('semantic_review_not_passed')
  })
  it('unnecessary supported additions and hallucinations are distinct',()=>{
    const c=fixture().records[0]!.expert_reviews[0]!.criteria;c.no_unnecessary_addition='fail'
    expect(semanticDimensions(c).no_hallucinated_content).toBe(true)
    c.no_unsupported_addition='unassessed';expect(semanticDimensions(c).no_hallucinated_content).toBeNull()
  })
  it('incomplete, non-independent, unknown or agent judges cannot certify gold',()=>{
    const b=fixture(),r=b.records[0]!;r.expert_reviews[0]!.criteria.core_claim='unassessed'
    expect(evaluateEducationalRecord(b,r,text,now).state).toBe('candidate')
    r.expert_reviews[0]!.criteria.core_claim='pass';r.expert_reviews[0]!.expert_id='codex_observer'
    expect(evaluateEducationalRecord(b,r,text,now).state).toBe('candidate')
    const bad:any=fixture();bad.experts[0].kind='agent';expect(validationBundleSchema.safeParse(bad).success).toBe(false)
    bad.experts[0].kind='human_domain_expert';bad.experts[0].independent_of_author=false;expect(validationBundleSchema.safeParse(bad).success).toBe(false)
  })
  it('causal strength and comparison direction have different taxonomy codes',()=>{
    const data=JSON.parse(fs.readFileSync(new URL('frym-validation/taxonomy-1.json',root),'utf8'))
    expect(data.definitions).toEqual(DISTORTION_TAXONOMY)
    expect(data.examples.map(e=>e.alignment_id)).toEqual(['F05-A1','F09-A1','F10-A2','F13-A2'])
    expect(data.examples[0].codes).toEqual(['COMPARISON_REVERSAL'])
    const b=fixture(),r=b.records[0]!;r.expert_reviews[0]!.distortions=[{code:'CAUSE_REVERSAL',passage_quote:text,reason:'Synthetic deliberately failed interpretation.'}]
    expect(evaluateEducationalRecord(b,r,text,now).blockers).toContain('distortion_present')
  })
  it('lexical, syntax, reasoning and subjective burden are independent',()=>{
    const b=fixture(),r=b.records[0]!
    for(const s of r.student_sessions)for(const a of s.answers)if(a.item_id.startsWith('syntax'))a.score=0.5
    const result=evaluateEducationalRecord(b,r,text,now)
    expect(result.lexical_level.value).toBe(1);expect(result.syntax_level.value).toBe(0.5);expect(result.reasoning_level.value).toBe(1)
    expect(result.blockers).toContain('target_range_failed_syntax_accuracy')
    for(const s of r.student_sessions)s.lexical_burden=4
    expect(evaluateEducationalRecord(b,r,text,now).blockers).toContain('target_range_failed_lexical_burden')
  })
  it.each(['missing_students','unknown_scorer','missing_axis','early_session','wrong_grade','future_review','no_approval','changed_passage','low_link','bad_provenance'])('blocks %s',kind=>{
    const b=fixture(),r=b.records[0]!
    if(kind==='missing_students')r.student_sessions.pop()
    if(kind==='unknown_scorer')r.student_sessions[0]!.answers[0]!.scorer_id='unregistered'
    if(kind==='missing_axis')r.instrument=r.instrument.filter(i=>i.axis!=='reasoning')
    if(kind==='early_session')r.student_sessions[0]!.reading_started_at='2026-10-01T12:00:00Z'
    if(kind==='wrong_grade')r.student_sessions[0]!.grade='high_1'
    if(kind==='future_review')r.expert_reviews[0]!.reviewed_at='2026-10-05T00:00:00Z'
    if(kind==='no_approval')b.protocol_approval=null
    if(kind==='low_link')r.link_confidence='medium'
    if(kind==='bad_provenance')r.provenance_verified=false
    expect(evaluateEducationalRecord(b,r,kind==='changed_passage'?text+' New unsupported fact.':text,now).state).not.toBe('gold')
  })
  it('duplicate experts/students and the same student reading both variants are rejected',()=>{
    const b=fixture();b.records[0]!.expert_reviews.push(b.records[0]!.expert_reviews[0]!)
    expect(validationBundleSchema.safeParse(b).success).toBe(false)
    const other=fixture(),copy=structuredClone(other.records[0]!);copy.id='second-variant';copy.blind_item_id='B-second';copy.target_key='2'.repeat(24)
    other.records.push(copy);expect(validationBundleSchema.safeParse(other).success).toBe(false)
  })
  it('blind packets omit target, producer, prior verdict, source IDs and scoring rubrics',()=>{
    const pilot=JSON.parse(fs.readFileSync(new URL('frym-precision/adaptation-pilot-1.json',root),'utf8'))
    for(const r of pilot.records){
      const packet=expertBlindPacket('B-anonymous',r.text,['Research context supplied separately.'])
      const raw=JSON.stringify(packet)
      for(const secret of [r.id,r.target.age_band,r.target.reasoning_band,'Codex','observer_review','target_key',r.pair_id])expect(raw).not.toContain(secret)
      const items=draftMeasurementItems(r)
      expect(items.length).toBe(12);expect(items.every(i=>r.text.includes(i.source_quote))).toBe(true)
      expect(new Set(items.map(i=>i.axis)).size).toBe(4)
      const lexical=items.filter(i=>i.axis==='lexical')
      expect(lexical.every(i=>!i.scoring_rubric.split(' Score ')[0].includes('cause')&&!i.scoring_rubric.split(' Score ')[0].includes('universal'))).toBe(true)
      expect(items.filter(i=>i.axis==='comprehension').every(i=>i.scoring_rubric.includes('explicitly stated'))).toBe(true)
    }
  })
  it('import promotion refuses missing validation and binds the exact text/target',()=>{
    const b=fixture(),r=b.records[0]!,draft={text,reading:{target_key:r.target_key,target:{age_band:r.grade}}}
    const validated={bundle:b,file_hash:'b'.repeat(64)}
    expect(validateEducationalPromotion(draft,task,null,now).ok).toBe(false)
    expect(validateEducationalPromotion(draft,task,validated,now).certificate.state).toBe('gold')
    expect(validateEducationalPromotion({...draft,text:text+' Changed.'},task,validated,now).ok).toBe(false)
    expect(matchEducationalBinding({...r,target_key:'2'.repeat(24)},task,text,r.target_key)).toBe(false)
    expect(validateEducationalPromotion(draft,null,null,now)).toEqual({ok:true,certificate:null})
  })
  it('loaded provenance is rechecked against the current precision round',()=>{
    const temp=fs.mkdtempSync(path.join(os.tmpdir(),'edu-validation-')),file=path.join(temp,'results.json')
    try{
      const b=fixture();fs.writeFileSync(file,JSON.stringify(b))
      expect(readEducationalValidation(file,now,reviewFile).bundle.records[0].provenance_verified).toBe(true)
      b.records[0]!.source_hash='0'.repeat(64);fs.writeFileSync(file,JSON.stringify(b))
      expect(()=>readEducationalValidation(file,now,reviewFile)).toThrow('hash changed')
      b.instrument_hash=digest(canonical(instrumentIdentity(b.records)))
      b.protocol_approval!.instrument_hash=b.instrument_hash
      fs.writeFileSync(file,JSON.stringify(b))
      expect(readEducationalValidation(file,now,reviewFile).bundle.records[0].provenance_verified).toBe(false)
      b.protocol.minimum_students_per_variant=6;fs.writeFileSync(file,JSON.stringify(b))
      expect(()=>readEducationalValidation(file,now,reviewFile)).toThrow('hash changed')
    }finally{fs.unlinkSync(file);fs.rmdirSync(temp)}
  })
  it('rejects duplicate grades even when variant target keys differ',()=>{
    expect(()=>assertPilotGradeCoverage([{pair_id:'F02',grade:'middle_1'},{pair_id:'F02',grade:'high_1'}],['F02'])).not.toThrow()
    expect(()=>assertPilotGradeCoverage([{pair_id:'F02',grade:'middle_1'},{pair_id:'F02',grade:'middle_1'}],['F02'])).toThrow('exactly one')
    expect(()=>assertPilotGradeCoverage([{pair_id:'F02',grade:'middle_1'}],['F02'])).toThrow('exactly one')
  })
  it('only the current published DB row can derive production, with exact body/parent/target',()=>{
    const r=fixture().records[0]!,cert={state:'gold' as const,passage_hash:r.passage_hash,target_key:r.target_key,source_id:r.source_id}
    const article={id:'fixture-article',status:'published',content:text,adapted_from_id:r.source_id,composed_spec:{academic_reading:{target_key:r.target_key}}}
    expect(educationalDeliveryState(cert,null)).toBe('gold')
    expect(educationalDeliveryState(cert,article)).toBe('production')
    for(const changed of [{...article,status:'queued'},{...article,content:text+' Changed.'},{...article,adapted_from_id:'other-parent'},{...article,composed_spec:null}])expect(educationalDeliveryState(cert,changed)).toBe('gold')
  })
})
