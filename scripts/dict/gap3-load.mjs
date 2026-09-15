// hapax 교정본(서브에이전트 8배치) 통합 적재 → lexicon_clean lang='en'.
import fs from 'node:fs'
const env=fs.readFileSync('apps/web/.env.local','utf8')
for(const l of env.split('\n')){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')}
const URL=process.env.NEXT_PUBLIC_SUPABASE_URL, SVC=process.env.SUPABASE_SERVICE_ROLE_KEY
const H={apikey:SVC,Authorization:'Bearer '+SVC,'Content-Type':'application/json',Prefer:'resolution=ignore-duplicates,return=minimal'}
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
async function ins(b,n=6){for(let i=0;i<n;i++){try{const r=await fetch(URL+'/rest/v1/lexicon_clean',{method:'POST',headers:H,body:JSON.stringify(b)});if(r.ok||r.status===409)return true}catch(e){}await sleep(500*(i+1))}return false}
const seen=new Set(), recs=[]
for(let i=0;i<8;i++){const p='scratchpad-foreign/g3/out_0'+i+'.jsonl';if(!fs.existsSync(p))continue
  for(const l of fs.readFileSync(p,'utf8').split('\n')){if(!l.trim())continue;let o;try{o=JSON.parse(l)}catch{continue}
    const w=(o.word||'').toLowerCase().trim(), ko=(o.ko||'').trim()
    if(!/^[a-z][a-z'-]{1,29}$/.test(w)||!/[가-힣]/.test(ko)||seen.has(w))continue
    seen.add(w); recs.push({word:w,lang:'en',meaning_ko:ko,gloss_source:'mt',ko_source:'claude-batch',is_valid_word:true})}}
console.error('통합 적재 대상:',recs.length)
for(let i=0;i<recs.length;i+=400)await ins(recs.slice(i,i+400))
console.error('완료')
