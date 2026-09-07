// scripts/dict/latin-build.mjs
// 라틴어 선제형 사전 — UD Latin treebank 표면형(공개) + Google sl=la 번역 → lexicon_clean lang='la'.
// Google가 굴절 표면형 직접 번역(aeternitatis→영원의). 출처: Universal Dependencies Latin (PROIEL/ITTB/Perseus/LLCT).
// 영어 우선 조회로 동형이의어 안전(ignore-duplicates). 청정: 표면형=사실, 뜻=자체 MT.
import fs from 'node:fs'
const env=fs.readFileSync('apps/web/.env.local','utf8')
for(const l of env.split('\n')){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')}
const URL=process.env.NEXT_PUBLIC_SUPABASE_URL, SVC=process.env.SUPABASE_SERVICE_ROLE_KEY
const Hget={apikey:SVC,Authorization:'Bearer '+SVC}
const Hup={...Hget,'Content-Type':'application/json',Prefer:'resolution=ignore-duplicates,return=minimal'}
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
const CACHE='scratchpad-foreign/la.jsonl'

async function trBatch(texts, n=5){
  const joined=texts.join('\n')
  const u='https://translate.googleapis.com/translate_a/single?client=gtx&sl=la&tl=ko&dt=t&q='+encodeURIComponent(joined)
  for(let i=0;i<n;i++){try{const r=await fetch(u,{headers:{'User-Agent':'Mozilla/5.0'}});if(!r.ok){await sleep(1000*(i+1));continue}
    const j=await r.json();const full=(j[0]||[]).map(s=>s[0]||'').join('');const lines=full.split('\n').map(x=>x.trim());if(lines.length===texts.length)return lines;return null
  }catch(e){await sleep(800*(i+1))}}return null
}
async function ins(b,n=6){for(let i=0;i<n;i++){try{const r=await fetch(URL+'/rest/v1/lexicon_clean',{method:'POST',headers:Hup,body:JSON.stringify(b)});if(r.ok||r.status===409)return true}catch(e){}await sleep(500*(i+1))}return false}

// 1) UD Latin 표면형
const UD=['UD_Latin-PROIEL/master/la_proiel-ud-train.conllu','UD_Latin-ITTB/master/la_ittb-ud-train.conllu','UD_Latin-Perseus/master/la_perseus-ud-train.conllu','UD_Latin-LLCT/master/la_llct-ud-train.conllu']
const forms=new Set()
for(const p of UD){try{const t=await(await fetch('https://raw.githubusercontent.com/UniversalDependencies/'+p,{headers:{'User-Agent':'Mozilla/5.0'}})).text()
  for(const line of t.split('\n')){if(!line||line[0]==='#')continue;const col=line.split('\t');if(col.length>=2){const f=col[1].toLowerCase().replace(/[^a-z]/g,'');if(f.length>=3&&/^[a-z]+$/.test(f))forms.add(f)}}}catch(e){}}
const words=[...forms]
console.error('라틴 표면형:',words.length)

// 2) 캐시 재개
const done=new Set()
if(fs.existsSync(CACHE))for(const l of fs.readFileSync(CACHE,'utf8').split('\n'))if(l){try{done.add(JSON.parse(l).word)}catch(e){}}
const todo=words.filter(w=>!done.has(w))
console.error('캐시완료',done.size,'| 남은',todo.length)

// 3) 번역→캐시
const out=fs.createWriteStream(CACHE,{flags:'a'}); let tr=0
for(let i=0;i<todo.length;i+=15){
  const batch=todo.slice(i,i+15)
  let segs=await trBatch(batch); if(!segs)segs=batch.map(()=>null)
  for(let k=0;k<batch.length;k++){const ko=segs[k];if(ko&&/[가-힣]/.test(ko)&&ko.toLowerCase()!==batch[k]){out.write(JSON.stringify({word:batch[k],ko})+'\n');tr++}}
  if(i%1500===0)console.error('  번역',i,'/',todo.length)
  await sleep(60)
}
out.end(); await new Promise(r=>out.on('finish',r))
console.error('번역완료 +',tr)

// 4) 적재
const recs=[]
for(const l of fs.readFileSync(CACHE,'utf8').split('\n'))if(l){try{const o=JSON.parse(l);recs.push({word:o.word,lang:'la',meaning_ko:o.ko,gloss_source:'mt',ko_source:'google-mt-la',is_valid_word:true})}catch(e){}}
let ins2=0
for(let i=0;i<recs.length;i+=500){await ins(recs.slice(i,i+500));ins2+=Math.min(500,recs.length-i)}
console.error('적재 시도',ins2,'(영어 충돌 skip)')
