// scripts/dict/wiktionary-dialect-load.mjs
// wik-dialect.jsonl (추출본) 중 clean 방언 태그만 spelling_norm(source='wiktionary') 적재.
// 정밀: pronunciation-spelling·eye-dialect·dialectal·nonstandard 만 (informal/colloquial/alternative 노이즈 제외).
// ignore-duplicates → 기존 MorphAdorner variant 보존. 뜻은 우리 사전에서 해소(gloss 미배포).
import fs from 'node:fs'
const env=fs.readFileSync('apps/web/.env.local','utf8')
for(const l of env.split('\n')){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')}
const URL=process.env.NEXT_PUBLIC_SUPABASE_URL, SVC=process.env.SUPABASE_SERVICE_ROLE_KEY
const H={apikey:SVC,Authorization:'Bearer '+SVC,'Content-Type':'application/json',Prefer:'resolution=ignore-duplicates,return=minimal'}
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
// 방언/구어 태그 (alternative/archaic/obsolete 66k+ 노이즈 제외). tier 순서+표준형 게이트가 공통어 노이즈 차단.
const KEEP=new Set(['pronunciation-spelling','eye-dialect','dialectal','nonstandard','colloquial','contraction','informal'])
async function ins(b,n=6){for(let i=0;i<n;i++){try{const r=await fetch(URL+'/rest/v1/spelling_norm',{method:'POST',headers:H,body:JSON.stringify(b)});if(r.ok||r.status===409)return true}catch(e){}await sleep(500*(i+1))}return false}

const recs=[], seen=new Set()
for(const line of fs.readFileSync('scratchpad-foreign/wik-dialect.jsonl','utf8').split('\n')){
  if(!line)continue; let o; try{o=JSON.parse(line)}catch{continue}
  if(!KEEP.has(o.tag)) continue
  if(seen.has(o.variant)) continue; seen.add(o.variant)
  recs.push({variant:o.variant, standard:o.standard, source:'wiktionary'})
}
console.error('clean 방언 매핑:',recs.length)
for(let i=0;i<recs.length;i+=1000){ await ins(recs.slice(i,i+1000)); if(i%10000===0)console.error('  적재',i) }
console.error('적재 시도 완료:',recs.length)
