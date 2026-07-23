// scripts/dict/foreign-dict-build.mjs
// 선제형 외국어 사전 구축 — 언어별 빈도목록 + Google 기계번역 → lexicon_clean(lang 태그).
// 설계: docs/proposals/foreign-language-reading-support.md. 청정: 빈도목록(사실)+자체 MT 뜻(외부 gloss 미사용).
// 안전: ignore-duplicates → 영어 표제어 절대 미변경(동형이의어 영어 우선).
import fs from 'node:fs'
const env=fs.readFileSync('apps/web/.env.local','utf8')
for(const l of env.split('\n')){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')}
const url=process.env.NEXT_PUBLIC_SUPABASE_URL, svc=process.env.SUPABASE_SERVICE_ROLE_KEY
const Hget={apikey:svc,Authorization:'Bearer '+svc}
// ignore-duplicates: 이미 존재하는 word(영어 포함) 미변경 → 신규 외국어만 삽입
const Hins={...Hget,'Content-Type':'application/json',Prefer:'resolution=ignore-duplicates,return=minimal'}
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
const LANG=process.env.LANG_CODE||'fr'
const SRC=process.env.SRC_URL
const LIMIT=parseInt(process.env.LIMIT||'0')||0
const CACHE='scratchpad-foreign/'+LANG+'.jsonl'
const wordRe=/^[a-zà-ÿœæ]([a-zà-ÿœæ'\-]*[a-zà-ÿœæ])?$/i

async function trBatch(texts, sl, n=5){
  const joined=texts.map(t=>t.replace(/[\r\n]+/g,' ').slice(0,120)).join('\n')
  const u='https://translate.googleapis.com/translate_a/single?client=gtx&sl='+sl+'&tl=ko&dt=t&q='+encodeURIComponent(joined)
  for(let i=0;i<n;i++){ try{
    const r=await fetch(u,{headers:{'User-Agent':'Mozilla/5.0'}}); if(!r.ok){await sleep(1200*(i+1));continue}
    const j=await r.json(); const full=(j[0]||[]).map(s=>s[0]||'').join('')
    const lines=full.split('\n').map(x=>x.trim()); if(lines.length===texts.length)return lines
    const segs=(j[0]||[]).map(s=>(s[0]||'').trim()).filter(Boolean); if(segs.length===texts.length)return segs
    return null
  }catch(e){await sleep(900*(i+1))} } return null
}
async function insert(b,n=6){for(let i=0;i<n;i++){try{const r=await fetch(url+'/rest/v1/lexicon_clean',{method:'POST',headers:Hins,body:JSON.stringify(b)});if(r.ok||r.status===409)return true}catch(e){}await sleep(500*(i+1))}return false}

// 1) 목록 로드 + 필터
console.error('['+LANG+'] 목록 다운로드…')
const raw=await (await fetch(SRC,{headers:{'User-Agent':'Mozilla/5.0'}})).text()
let words=raw.split('\n').map(l=>l.split(/\s+/)[0]).filter(w=>w&&w.length>=2&&w.length<=30&&wordRe.test(w))
words=[...new Set(words.map(w=>w.toLowerCase()))]
if(LIMIT)words=words.slice(0,LIMIT)
console.error('['+LANG+'] 유효 단어:',words.length)

// 2) 캐시 재개
const done=new Set()
if(fs.existsSync(CACHE))for(const l of fs.readFileSync(CACHE,'utf8').split('\n'))if(l){try{done.add(JSON.parse(l).word)}catch(e){}}
const todo=words.filter(w=>!done.has(w))
console.error('['+LANG+'] 캐시완료',done.size,'| 남은',todo.length)

// 3) 번역 → 캐시
const out=fs.createWriteStream(CACHE,{flags:'a'})
let tr=0
for(let i=0;i<todo.length;i+=15){
  const batch=todo.slice(i,i+15)
  let segs=await trBatch(batch,LANG); if(!segs)segs=batch.map(()=>null)
  for(let k=0;k<batch.length;k++){const ko=segs[k];if(ko&&/[가-힣]/.test(ko)&&ko.toLowerCase()!==batch[k]){out.write(JSON.stringify({word:batch[k],ko})+'\n');tr++}}
  if(i%1500===0)console.error('  번역',i,'/',todo.length)
  await sleep(60)
}
out.end(); await new Promise(r=>out.on('finish',r))
console.error('['+LANG+'] 번역완료 +',tr)

// 4) 적재 (ignore-duplicates)
const recs=[]
for(const l of fs.readFileSync(CACHE,'utf8').split('\n'))if(l){try{const o=JSON.parse(l);recs.push({word:o.word,lang:LANG,meaning_ko:o.ko,gloss_source:'mt',ko_source:'google-mt-'+LANG,is_valid_word:true})}catch(e){}}
let ins=0
for(let i=0;i<recs.length;i+=500){await insert(recs.slice(i,i+500));ins+=Math.min(500,recs.length-i)}
console.error('['+LANG+'] 적재 시도',ins,'(영어 충돌분 자동 skip)')
