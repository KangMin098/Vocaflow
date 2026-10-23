// docs/research/goal-data-batches/review/inspect.mjs
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
import crypto from 'node:crypto'
const dir = 'docs/research/goal-data-batches/review'
const base = 'docs/research/goal-data-batches/'
const git = (p, sha = '80fa44540') => execFileSync('git', ['show', `${sha}:${p}`], { encoding: 'utf8', maxBuffer: 30e6 })
const rows = p => git(base + p).trim().split('\n').map(JSON.parse)
const root = 'D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b2-v2'
const input = JSON.parse(fs.readFileSync(root + '/input.json', 'utf8')).rows
const links = rows('D2-task-mapping/b2-v2-item-task-links.jsonl')
const disputes = rows('D2-task-mapping/b2-v2-disputed-links.jsonl')
const d3 = rows('D3-principles/distractor-logic.jsonl').filter(r => r.batch === 'b2-v2')
const r1 = []; const seen = new Set()
for (const r of links) if (!seen.has(r.item) && ![25,38,39].includes(Number(r.item.split('#')[1]))) { r1.push(r); seen.add(r.item); if (r1.length === 30) break }
const r0 = disputes.filter(r => r.display === 'R3')
for (const r of disputes) if (r0.length < 30 && !r0.includes(r)) r0.push(r)
const ds = []
for (const type of ['R-GRAMMAR','R-ORDER',...new Set(d3.map(r => r.type_id).filter(t=>!['R-GRAMMAR','R-ORDER'].includes(t)))]) ds.push(...d3.filter(r => r.type_id === type).slice(0, type === 'R-GRAMMAR' || type === 'R-ORDER' ? 4 : 2))
for (const r of d3) if (ds.length < 30 && !ds.includes(r)) ds.push(r)
const selected = { r1, disputes: r0, d3: ds.slice(0,30) }
const judgments = { A: [], B: [] }
for (const track of ['A','B']) for (let n=1;n<=4;n++) judgments[track].push(...JSON.parse(fs.readFileSync(`${root}/chunk-${track}-0${n}.out.json`, 'utf8')).rows)
const line = (p, r) => rows(p).findIndex(v => JSON.stringify(v) === JSON.stringify(r)) + 1
if (process.argv[2] === 'packet') {
  const items = new Set([...r1,...r0].map(r=>r.item).concat(selected.d3.map(r=>r.item_id)))
  for (const id of [...items].slice(Number(process.argv[3]??0),Number(process.argv[4]??100))) {
    const item=input.find(r=>r.item_id===id)
    const brief=r=>({task:r.display,relevance:r.candidateRelevance,judgments:r.judgments,cf:r.counterfactual,why:r.why})
    console.log(JSON.stringify({id,source:item.source, r1:r1.filter(r=>r.item===id).map(brief),disputes:r0.filter(r=>r.item===id).map(brief),d3:selected.d3.filter(r=>r.item_id===id).map(r=>({choice:r.choice,distortion:r.distortion,why:r.why}))}))
  }
} else if (process.argv[2] === 'checks') {
  const checks=[]
  for (const [group,rs] of Object.entries(selected)) for (const r of rs) {
    const id=r.item??r.item_id, src=input.find(i=>i.item_id===id)
    const p=group==='d3'?'D3-principles/distractor-logic.jsonl':`D2-task-mapping/b2-v2-${group==='r1'?'item-task':'disputed'}-links.jsonl`
    const errors=[]
    const sourceHash=crypto.createHash('sha256').update(JSON.stringify(src.source)).digest('hex')
    if(sourceHash!==src.source_sha256) errors.push('source_sha256_mismatch')
    if(group!=='d3') for(const track of ['A','B']) {
      const j=judgments[track].find(j=>j.item_id===id)?.links.find(l=>l.task_id===r.task)
      if(j?.anchor) { const field=src.source[j.anchor.field]; const text=Array.isArray(field)?field.join('\n'):String(field??''); if(!text.includes(j.anchor.quote)) errors.push(`${track}:anchor_not_literal`) }
      if(j?.relevance==='indirect') {
        const cf=j.counterfactual
        if(!cf || !['choice','locus'].includes(cf.kind)) errors.push(`${track}:counterfactual_missing`)
        else if(cf.kind==='choice' && (!Number.isInteger(cf.choice)||cf.choice<1||cf.choice>5||(src.source.answers??[src.source.answer]).includes(cf.choice))) errors.push(`${track}:counterfactual_not_wrong_choice`)
        else if(cf.kind==='locus' && !JSON.stringify(src.source).includes(cf.quote)) errors.push(`${track}:locus_not_literal`)
      }
    }
    const sourceLine=fs.readFileSync(root+'/input.json','utf8').split('\n').findIndex(l=>l.includes(`"item_id": "${id}"`))+1
    checks.push({group,id,task:r.display??r.choice,evidence:`80fa44540:${base+p}:${line(p,r)}`,source:`${root}/input.json:${sourceLine}`,source_sha256:src.source_sha256,errors})
  }
  fs.writeFileSync(`${dir}/sample-checks.json`, JSON.stringify({selection:'R1: 입력 순서로 서로 다른 문항 첫 링크 30개(25·38·39 제외). 갈림: R3 전부 + 입력 순서 나머지 19. D3: b2-v2 어법·순서 각 첫 4개를 먼저, 나머지 유형별 첫 2개를 순서대로 택하여 30에서 자름. 의도 표본이며 모집단 추정 아님.',counts:{r1:r1.length,disputes:r0.length,r3:r0.filter(r=>r.display==='R3').length,d3:selected.d3.length},checks},null,2)+'\n')
  console.log(JSON.stringify(checks))
} else if(process.argv[2]==='db') {
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL, key=process.env.SUPABASE_SERVICE_ROLE_KEY
  if(!url?.includes('jajenrevcbmrpaliomxv')||!key) throw Error('dev credentials unavailable')
  const queries=[['insert','csat_items','select=id,exam_id,no,stem,passage,choices,raw_block&type_id=eq.R-INSERT'],['m2709','csat_exams','select=id,label&or=(id.eq.M2709,and(exam_year.eq.2027,month.eq.9))'],['m2709-items','csat_items','select=id&exam_id=eq.M2709'],['2023-38','csat_items','select=id,choices,body_ok&id=eq.2023%2338'],['rights','csat_exams','select=id,source_note'],['rights-positive-exam-items','csat_items','select=id&exam_id=eq.M2009']]
  const results=[]
  for(const [id,table,query] of queries) {
    try { const response=await fetch(`${url}/rest/v1/${table}?${query}`,{method:'GET',headers:{apikey:key,Authorization:`Bearer ${key}`}})
      const body=await response.json()
      if(!response.ok) {results.push({id,table,query,method:'GET',status:response.status,error:body.message??'query_failed'});continue}
      let summary
      if(id==='insert') summary={rows:body.length,raw_block_null:body.filter(r=>r.raw_block==null).length,stem_standard_only:body.filter(r=>/^글의 흐름으로 보아,? 주어진 문장이 들어가기에 가장 적절한 곳을 고르시오\.?$/.test(r.stem?.trim())).length,non_null_raw_ids:body.filter(r=>r.raw_block!=null).map(r=>r.id),counterexamples:body.filter(r=>['2025#38','2025#39'].includes(r.id)).map(r=>({id:r.id,raw_block_null:r.raw_block===null,passage_sha256:crypto.createHash('sha256').update(r.passage??'').digest('hex'),first_sentence_sha256:crypto.createHash('sha256').update((r.passage??'').split('. ')[0]+'.').digest('hex'),prefix_matches_local:input.find(i=>i.item_id===r.id)?.source.passage===r.passage,interpretation:r.id==='2025#38'?'첫 문장은 영업비밀 법적 보호가 없을 때 유출 위험으로 전환하고, 뒤 본문의 비밀 유지 이점→아이디어 공개 사이 ④를 잇는다.':'첫 문장은 선형 생애주기를 부정하고 수리·보관·재활용을 예시하여, 뒤 본문의 불완전한 정의 비판→추가 사례 사이 ④를 잇는다.'})),limitation:'raw_block null은 별도 저장소 전체 결손의 증명이 아니다. 삽입 대상 문장으로 해석되는 두 접두 문장은 외부 공식 PDF 대조까지 끝난 판정은 아니다.'}
      else if(id==='rights') summary={exams:body.length,source_note_present:body.filter(r=>String(r.source_note??'').trim()).map(r=>r.id),limitation:'source_note 부재만으로 법적 재배포 불가를 확정하지 않는다'}
      else summary=body
      results.push({id,table,query,method:'GET',status:response.status,summary})
    } catch(e) { results.push({id,table,query,method:'GET',error:e.cause?.code??e.message}) }
  }
  fs.writeFileSync(`${dir}/db-checks.json`,JSON.stringify({queried_at:new Date().toISOString(),project:'dev',writes:0,results},null,2)+'\n')
  console.log(JSON.stringify(results))
}
