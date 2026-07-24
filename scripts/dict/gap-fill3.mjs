// scripts/dict/gap-fill2.mjs
// Stage1: 잔여 실단어(복합·접두·고어, 2+권)를 Google en→ko baseline 번역 → 캐시.
// Stage2(Claude 교정)는 별도. 정밀 게이트: 부정접두 제외 안 함(Claude가 교정), 음성근접(오철자)=제외(suggestion 처리).
import fs from 'node:fs'
const env=fs.readFileSync('apps/web/.env.local','utf8')
for(const l of env.split('\n')){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')}
const URL=process.env.NEXT_PUBLIC_SUPABASE_URL, SVC=process.env.SUPABASE_SERVICE_ROLE_KEY
const Hget={apikey:SVC,Authorization:'Bearer '+SVC}
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
const CACHE='scratchpad-foreign/gap3.jsonl'
const ABBR=/^(acct|dept|rm|rms|wk|wks|yr|yrs|yd|yds|cts|mgr|vol|vols|pp|st|ave|apt|inst|fig|figs|nos|ibid|mdse|recd)$/
async function tr(texts,n=5){const j=texts.join('\n');const u='https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ko&dt=t&q='+encodeURIComponent(j);
  for(let i=0;i<n;i++){try{const r=await fetch(u,{headers:{'User-Agent':'Mozilla/5.0'}});if(!r.ok){await sleep(900*(i+1));continue}const d=await r.json();const full=(d[0]||[]).map(s=>s[0]||'').join('');const lines=full.split('\n').map(x=>x.trim());if(lines.length===texts.length)return lines;return null}catch(e){await sleep(700*(i+1))}}return null}
// dwyl
const wl=await(await fetch('https://raw.githubusercontent.com/dwyl/english-words/master/words_alpha.txt',{headers:{'User-Agent':'Mozilla/5.0'}})).text()
const EN=new Set(wl.split(/\r?\n/).map(w=>w.trim().toLowerCase()).filter(Boolean))
// 잔여
const rows=[];let off=0
for(;;){const r=await fetch(URL+'/rest/v1/_rx2?select=w,freq,books,phon,sig&order=w&offset='+off+'&limit=1000',{headers:Hget});const d=await r.json();if(!Array.isArray(d)||!d.length)break;rows.push(...d);off+=1000}
// 후보: 실단어(compound/prefix sig OR in dwyl), 2+권, 길이5+, 음성근접 아님(lev1 제외=오철자→suggestion), 비약어
const cand=rows.filter(o=>(o.books||0)===1 && /^[a-z]{5,20}$/.test(o.w) && o.phon!=='lev1' && !ABBR.test(o.w)
  && (o.sig==='compound진짜' || o.sig==='prefix파생' || EN.has(o.w)))
console.error('후보:',cand.length)
const done=new Set();if(fs.existsSync(CACHE))for(const l of fs.readFileSync(CACHE,'utf8').split('\n'))if(l){try{done.add(JSON.parse(l).word)}catch(e){}}
const todo=cand.filter(o=>!done.has(o.w))
const out=fs.createWriteStream(CACHE,{flags:'a'});let n=0
for(let i=0;i<todo.length;i+=15){const b=todo.slice(i,i+15);let ko=await tr(b.map(o=>o.w));if(!ko)ko=b.map(()=>null)
  for(let k=0;k<b.length;k++){if(ko[k]&&/[가-힣]/.test(ko[k])){out.write(JSON.stringify({word:b[k].w,freq:b[k].freq,g:ko[k]})+'\n');n++}}
  await sleep(70)}
out.end();await new Promise(r=>out.on('finish',r))
console.error('Google 번역완료:',n)
