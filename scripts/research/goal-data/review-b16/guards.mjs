// scripts/research/goal-data/review-b16/guards.mjs
import fs from 'node:fs'
import path from 'node:path'
import {root,out,base,at,read,json,snap,execute,check,checks} from './audit.mjs'
const lib=at('scripts/csat/map/v62/data/pilot-lib.mjs').replace(/^import .*\r?\n/gm,'').replace(/^export /gm,'').replace(/const ROOT = .*\r?\n/,`const ROOT = ${JSON.stringify(root)};\n`)
const pilot=new Function('fs','path',lib+'\nreturn {nonHeldTasks,validateChunk,validateRow};')({readFileSync:p=>read(path.relative(root,String(p)).replaceAll('\\','/'))},path)
const code=at('scripts/research/goal-data/d2-validate.mjs').replace(/^import .*\r?\n/gm,'').replace(/^export /gm,'')
const make=c=>new Function('validateChunk','validateRow',c+'\nreturn {makeValidator,FIXED_INSERT_E2};')(pilot.validateChunk,pilot.validateRow)
const actual=make(code), forced=make(code.replace('if (reasonsRequired && BATCH_NO >= 14)','if (true)').replace('if (!reasonsRequired && !withReason.length) return []','if (false) return []'))
const shipped=await execute('scripts/research/goal-data/d2-validate.check.mjs')
check('shipped 20/20',shipped.error==='EXIT 0'&&shipped.logs.length===20&&shipped.logs.every(x=>x.startsWith('ok ')),shipped)
const tracks=[],norm=s=>s.replace(/\s+/g,' ').trim()
for(const batch of [...new Set(Object.keys(snap.files).filter(p=>p.endsWith('/input.json')).map(p=>p.split('/').at(-2)))].sort()){
 const input=json(base+batch+'/input.json'),ps=Object.keys(snap.files).filter(p=>p.startsWith(base+batch+'/chunk-')&&p.endsWith('.out.json'))
 for(const track of [...new Set(ps.map(p=>/chunk-([^-]+)-/.exec(p)[1]))]){
  const rows=ps.filter(p=>p.includes('/chunk-'+track+'-')).sort().flatMap(p=>json(p).rows),groups=new Map()
  for(const r of rows)for(const n of r.not_observable??[]){const k=norm(n.why.split(r.item_id).join('#'));if(n.task_id==='e.evidence_location'&&input.rows.find(i=>i.item_id===r.item_id)?.type_id==='R-INSERT'&&actual.FIXED_INSERT_E2.has(k))continue;const ids=groups.get(k)??new Set();ids.add(r.item_id);groups.set(k,ids)}
  const hits=[...groups].filter(([,ids])=>ids.size>=3).map(([why,ids])=>({why,ids:[...ids]})),errors=forced.makeValidator(input,[]).reasons(rows).filter(e=>e.includes('not_observable'))
  check(batch+'/'+track+' independent counts',hits.length===errors.length)
  tracks.push({batch,track,hits,errors})
 }
}
check('32 tracks including b15/b16',tracks.length===32)
check('expected historical hits',JSON.stringify(tracks.filter(t=>t.hits.length).map(t=>t.batch+'/'+t.track).sort())===JSON.stringify(['b3-insert/B','b8-v24/A','b9t-v24/A','b13-v24/A'].sort()))
const input=json(base+'b14-v24/input.json'),v=actual.makeValidator(input,pilot.nonHeldTasks().filter(t=>input.tasks.includes(t.id)))
const synth=n=>[1,2,3].map(k=>({item_id:'S#'+k,not_observable:[{task_id:'r.inference',why:'선택 하나만으로 수행의 근거 지목을 확인할 수 없다'},...Array.from({length:n},(_,j)=>({task_id:'e.task_demand',why:`고유 무의미 ${k} ${j}`}))]}))
for(const n of [1,2])check('padding 1+'+n+' blocked',v.reasons(synth(n)).some(e=>e.includes('not_observable')))
const insertion=actual.makeValidator({...input,rows:[1,2,3].map(k=>({item_id:'I#'+k,type_id:'R-INSERT'}))},[])
const variants=[...actual.FIXED_INSERT_E2].flatMap(s=>[{text:s,expect:false,kind:'fixed'},{text:'  '+s.replaceAll(' ','  ')+'\n',expect:false,kind:'whitespace normalized'},{text:s+'.',expect:true,kind:'punctuation changed'}]).concat({text:'무관한 동일 설명을 임의 삽입한다',expect:true,kind:'arbitrary'})
for(const x of variants){x.errors=insertion.reasons([1,2,3].map(k=>({item_id:'I#'+k,not_observable:[{task_id:'e.evidence_location',why:x.text}]})));check('E2 '+x.kind+' '+x.text.slice(0,12),!!x.errors.length===x.expect)}
const runs=[]
const run=async(label,b,t,n,overrides)=>{const r=await execute('scripts/research/goal-data/d2-run.mjs',[b,'validate',t,...(n?[n]:[])],overrides);runs.push({label,...r});return r}
const realPath=base+'b14-v24/chunk-A-01.out.json',real=json(realPath)
for(const n of [1,2]){const c=structuredClone(real);for(let k=0;k<3;k++)c.rows[k].not_observable=synth(n)[k].not_observable;const r=await run('real padding 1+'+n,'b14-v24','A',null,{[realPath]:JSON.stringify(c)});check('real padding 1+'+n+' blocked',r.error==='EXIT 1'&&r.logs.some(s=>s.includes('not_observable')))}
const unique=[1,2,3].map(k=>({item_id:'U#'+k,not_observable:[{task_id:'r.inference',why:['이메일 접수와 방문 안내의 기능을 구별했는지 남지 않는다','폭포에서 재도전 결심을 한 장면을 찾았는지 남지 않는다','사회적 공유가 반복될수록 기억이 고정됨을 연결했는지 남지 않는다'][k-1]}]}))
check('legitimate item-specific explanations accepted',v.reasons(unique).length===0)
check('same item repeated entries count once',v.reasons([{item_id:'U#1',not_observable:Array.from({length:4},()=>({task_id:'r.inference',why:'같은 문항 내부의 동일 설명'}))}]).length===0)
const firstPath=Object.keys(snap.files).find(p=>p.includes('b14-v24-B-01-first/')&&p.endsWith('.out.json')),firstOverride={[base+'b14-v24/chunk-B-01.out.json']:read(firstPath)}
const first=await run('first bad chunk','b14-v24','B','01',firstOverride),sibling=await run('clean sibling of excluded track','b14-v24','B','02',firstOverride)
check('initial bad B01 blocked',first.error==='EXIT 1')
check('clean sibling generic notice',sibling.error==='EXIT 0'&&sibling.logs.some(s=>s.includes('他')||s.includes('다른 청크'))&&!sibling.logs.some(s=>s.includes('「')))
// A chunk-level defect contains no item id. With a foreign track defect, missing-output suppression conceals it.
const b='b16-v24',p1=base+b+'/chunk-A-01.out.json',p2=base+b+'/chunk-A-02.out.json',c1=json(p1),c2=json(p2)
const repeated='독립 검사 전용 반복 설명이며 원문별 판단 근거가 없다'
for(const r of c1.rows.slice(0,3))r.not_observable=[{task_id:'r.inference',why:repeated}]
// Repeating one link's why in five rows triggers validateChunk independently of track reasons.
for(const r of c2.rows.slice(0,5))r.links[0].why='동일한 링크 설명을 여러 문항에 반복하여 청크 검사를 위반한다'
const overrides={[p1]:JSON.stringify(c1),[p2]:JSON.stringify(c2)}
const masked=await run('own chunk defect masked by foreign exclusion',b,'A','02',overrides),full=await run('whole track still fails',b,'A',null,overrides)
check('own repeated-link defect remains visible',masked.error==='EXIT 1'&&full.error==='EXIT 1', {masked:masked.logs,full:full.logs})
const empty=await run('empty own output masked by foreign exclusion',b,'A','02',{[p1]:JSON.stringify(c1),[p2]:JSON.stringify({...c2,rows:[]})})
check('empty own output falsely clean reproduced',empty.error==='EXIT 0'&&empty.logs.some(l=>l.includes('이 청크 결함 0')))
const agreement=await execute('scripts/research/goal-data/d2-run.mjs',[b,'agree'],overrides)
const combined=JSON.parse(agreement.writes['docs/research/goal-data-batches/D2-task-mapping/'+b+'-agreement.json'])
check('excluded A cannot enter agreement',combined.pairs===0&&combined.items_detail.every(i=>i.status==='HUMAN_REVIEW_REQUIRED'))
// Error messages retain at most the first three group ids. A fourth member in the sibling chunk is hidden.
const cross1=json(p1),cross2=json(p2)
for(const r of [...cross1.rows.slice(0,3),cross2.rows[0]])r.not_observable=[{task_id:'r.inference',why:repeated}]
const cross=await run('fourth participating member hidden',b,'A','02',{[p1]:JSON.stringify(cross1),[p2]:JSON.stringify(cross2)})
check('fourth member falsely clean reproduced',cross.error==='EXIT 0'&&cross.logs.some(l=>l.includes('이 청크 결함 0')))
const mixed1=json(p1),mixed2=json(p2)
for(const r of [...mixed1.rows.slice(0,2),mixed2.rows[0]])r.not_observable=[{task_id:'r.inference',why:repeated}]
const mixed=await run('cross chunk group redacts foreign ids',b,'A','02',{[p1]:JSON.stringify(mixed1),[p2]:JSON.stringify(mixed2)})
check('mixed group fails without foreign ids',mixed.error==='EXIT 1'&&!mixed.logs.some(l=>mixed1.rows.some(r=>l.includes(r.item_id))))
for(const t of ['A','B'])for(const n of ['01','02']){const r=await run('final '+t+n,b,t,n,{});check('final '+t+n+' clean',r.error==='EXIT 0')}
fs.writeFileSync(out+'guards.local.json',JSON.stringify({checks,shipped,tracks,variants,runs,agreement,cross},null,2)+'\n')
console.log(JSON.stringify({checks:checks.length,failed:checks.filter(c=>!c.pass),runs:runs.map(({label,error,logs})=>({label,error,logs}))},null,2))
