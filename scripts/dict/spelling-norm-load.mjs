// scripts/dict/spelling-norm-load.mjs
// MorphAdorner(NCSA 퍼미시브) 철자정규화 맵 → spelling_norm 적재.
// EME(초기근대영어 350k) + NCF(19세기 소설 방언 5k). NCF 우선(방언), EME 보충.
// 소스: github.com/travisbrown/morphadorner (Northwestern MorphAdorner 미러). 라이선스 NCSA.
import fs from 'node:fs'
const env=fs.readFileSync('apps/web/.env.local','utf8')
for(const l of env.split('\n')){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')}
const URL=process.env.NEXT_PUBLIC_SUPABASE_URL, SVC=process.env.SUPABASE_SERVICE_ROLE_KEY
const H={apikey:SVC,Authorization:'Bearer '+SVC,'Content-Type':'application/json',Prefer:'resolution=ignore-duplicates,return=minimal'}
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
const base='https://raw.githubusercontent.com/travisbrown/morphadorner/master/data/'
const okv=/^[a-z][a-z'-]{1,29}$/, oks=/^[a-z][a-z' -]{1,40}$/

async function loadTab(f, src){
  const t=await (await fetch(base+f,{headers:{'User-Agent':'Mozilla/5.0'}})).text()
  const recs=[]
  for(const line of t.split('\n')){
    const [v,s]=line.replace(/\r/g,'').split('\t')
    if(!v||!s) continue
    const variant=v.toLowerCase().trim(), standard=s.toLowerCase().trim()
    if(!okv.test(variant)||!oks.test(standard)||variant===standard) continue
    recs.push({variant, standard, source:src})
  }
  return recs
}
async function ins(b,n=6){for(let i=0;i<n;i++){try{const r=await fetch(URL+'/rest/v1/spelling_norm',{method:'POST',headers:H,body:JSON.stringify(b)});if(r.ok||r.status===409)return true}catch(e){}await sleep(500*(i+1))}return false}

// NCF 먼저(방언 우선), EME 나중(ignore-duplicates → NCF 보존)
let total=0
for(const [f,src] of [['ncfmergedspellingpairs.tab','morphadorner-ncf'],['ememergedspellingpairs.tab','morphadorner-eme']]){
  const recs=await loadTab(f,src)
  // 배치 내 중복 variant 제거(PK 충돌 방지)
  const seen=new Set(), uniq=[]
  for(const r of recs){ if(seen.has(r.variant))continue; seen.add(r.variant); uniq.push(r) }
  console.error(f,'유효:',uniq.length)
  for(let i=0;i<uniq.length;i+=1000){ await ins(uniq.slice(i,i+1000)); if(i%20000===0)console.error('  적재',i) }
  total+=uniq.length
}
console.error('적재 시도 총:',total)
