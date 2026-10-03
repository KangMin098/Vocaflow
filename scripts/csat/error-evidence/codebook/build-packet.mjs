// scripts/csat/error-evidence/codebook/build-packet.mjs
//
// 사람 판정자용 판정 패킷(HTML 한 파일) — 판정자마다 따로 만든다. 문항 원문이 들어가므로 **저장소 밖**(기본: OS 임시 폴더)에 쓰고 배포하지 않는다.
// 패킷에는 기대 판정 · 다른 판정자 결과 · 모델 dry run 결과를 넣지 않는다. 연습(training) 사례만 제출 뒤 해설을 보여 준다.
//
//   node --tls-max-v1.2 --env-file=apps/web/.env.local scripts/csat/error-evidence/codebook/build-packet.mjs --reviewer A [--out <dir>]
// 입력: docs/csat-learner/codebook/data/human-corpus.json · human-training.json · CODEBOOK.md(고정 해시 확인)
// 판정자는 브라우저에서 열고 판정한 뒤 「결과 내보내기」로 JSON 을 저장해 돌려준다 → analyze-human.mjs

import { createHash } from 'node:crypto'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
const DIR = path.join(ROOT, 'docs/csat-learner/codebook')
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d }
const reviewer = arg('--reviewer')
if (!/^[A-Z]$/.test(reviewer ?? '')) { console.error('--reviewer A|B 필요'); process.exit(2) }
const out = arg('--out', path.join(os.tmpdir(), 'vocaflow-human-dry-run'))
if (path.resolve(out).startsWith(ROOT)) { console.error('문항 원문이 들어가므로 저장소 안에는 쓰지 않는다 — --out 을 저장소 밖으로'); process.exit(2) }

const corpus = JSON.parse(fs.readFileSync(path.join(DIR, 'data/human-corpus.json'), 'utf8'))
const training = JSON.parse(fs.readFileSync(path.join(DIR, 'data/human-training.json'), 'utf8'))
const codebook = fs.readFileSync(path.join(DIR, 'CODEBOOK.md'), 'utf8').replace(/\r\n/g, '\n')
const codebookHash = createHash('sha256').update(codebook).digest('hex')
if (corpus.codebook_sha256 && corpus.codebook_sha256 !== codebookHash) {
  console.error(`CODEBOOK.md 가 고정 해시와 다르다(고정 ${corpus.codebook_sha256.slice(0, 12)} · 지금 ${codebookHash.slice(0, 12)}) — 사람 dry run 중에는 코드북을 바꾸지 않는다`)
  process.exit(2)
}

const require = createRequire(path.join(ROOT, 'apps/web/package.json'))
const { createClient } = require('@supabase/supabase-js')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const ids = [...new Set([...corpus.cases, ...training.cases].map((c) => c.item_id))]
const { data: rows, error } = await db.from('csat_items').select('id, type_id, stem, passage, choices, answer, answers').in('id', ids)
if (error) { console.error(`문항 조회 실패: ${error.message}`); process.exit(1) }
const items = Object.fromEntries(rows.map((r) => [r.id, { stem: r.stem, passage: r.passage, choices: r.choices, answers: r.answers?.length ? r.answers : [r.answer] }]))
const missing = ids.filter((id) => !items[id])
if (missing.length) { console.error(`없는 문항: ${missing.join(', ')}`); process.exit(1) }

// 판정자에게 보이는 필드만 — 숨김(true_mechanism · chain · evidence_design · expected · boundaries)은 넣지 않는다
const visible = (c) => ({ case_id: c.case_id, item_id: c.item_id, type: c.type, chosen_option: c.chosen_option, confidence: c.confidence, reason: c.reason,
  blocked_span: c.blocked_span, interpretation: c.interpretation, self_category: c.self_category, context: c.context })
// 순서는 판정자마다 다르게 섞는다(같은 순서 효과 방지) — 판정자 글자로 고정된 시드
let seed = [...reviewer].reduce((s, ch) => s * 31 + ch.charCodeAt(0), 7)
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648)
const main = corpus.cases.map(visible).map((c) => [rand(), c]).sort((x, y) => x[0] - y[0]).map(([, c]) => c)
const train = training.cases.map((c) => ({ ...visible(c), answer: c.answer }))

const payload = { reviewer, corpusId: corpus.id, codebookHash, codebook, items, main, train, codes: corpus.codes }
const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>오답 원인 판정 · 판정자 ${reviewer}</title>
<style>
:root{--bg:#fbfaf7;--fg:#1f1d1a;--muted:#6b665e;--line:#ddd7cc;--accent:#2f5d8a;--warn:#9c3a30;--ok:#2e7d5a;--card:#fff}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:#171614;--fg:#ece8e1;--muted:#a39d93;--line:#3a3631;--accent:#8fb6dd;--warn:#e08b80;--ok:#7fc8a3;--card:#201e1b}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.6 system-ui,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;word-break:keep-all}
header{position:sticky;top:0;background:var(--bg);border-bottom:1px solid var(--line);padding:10px 16px;display:flex;gap:12px;align-items:center;flex-wrap:wrap;z-index:2}
main{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);gap:16px;padding:16px;max-width:1500px;margin:0 auto}
@media (max-width:900px){main{grid-template-columns:1fr}}
section{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px 16px}
h2{font-size:16px;margin:0 0 8px}.muted{color:var(--muted)}.passage{white-space:pre-wrap}
ol.choices li{margin:2px 0}.chosen{outline:2px solid var(--warn);border-radius:4px}.correct{outline:2px solid var(--ok);border-radius:4px}
label{display:block;margin:10px 0 4px;font-weight:600}select,textarea,input{width:100%;font:inherit;padding:8px;border:1px solid var(--line);border-radius:6px;background:var(--bg);color:var(--fg);min-height:44px}
textarea{min-height:72px}button{font:inherit;min-height:44px;padding:0 14px;border-radius:8px;border:1px solid var(--accent);background:var(--accent);color:#fff;cursor:pointer}
button.secondary{background:transparent;color:var(--accent)}button:focus-visible,select:focus-visible,textarea:focus-visible,input:focus-visible{outline:3px solid var(--accent);outline-offset:2px}
.ev dt{font-weight:600;margin-top:6px}.ev dd{margin:0 0 4px}.chips{display:flex;flex-wrap:wrap;gap:6px}.chips label{font-weight:400;display:flex;gap:4px;align-items:center;margin:0;padding:4px 8px;border:1px solid var(--line);border-radius:999px;min-height:36px}
.chips input{width:auto;min-height:0}details{margin-top:8px}pre.cb{white-space:pre-wrap;font-size:13px;max-height:70vh;overflow:auto}
header select{width:auto}.answer{border-left:4px solid var(--ok);padding:6px 10px;margin-top:10px}.progress{margin-left:auto}
</style></head><body>
<header><strong>오답 원인 판정 — 판정자 ${reviewer}</strong><span class="muted">코드북 rev3 · ${codebookHash.slice(0, 12)}</span>
<select id="mode" aria-label="모드"><option value="train">연습(해설 공개)</option><option value="main">본 판정(blind)</option></select>
<span class="progress muted" id="progress"></span>
<button class="secondary" id="prev">이전</button><button class="secondary" id="next">다음</button><button id="export">결과 내보내기</button>
<button class="secondary" id="import">불러오기</button><input type="file" id="file" accept="application/json" hidden></header>
<main><section id="item"></section><section id="form"></section></main>
<section style="margin:0 16px 16px"><details><summary>코드북 전문(rev3 — 판정 중 바뀌지 않는다)</summary><pre class="cb" id="cb"></pre></details></section>
<script>
const P=${JSON.stringify(payload).replace(/</g, '\\u003c')};
const KEY='ec-human-'+P.corpusId+'-'+P.reviewer;
let store={};try{store=JSON.parse(localStorage.getItem(KEY)||'{}')}catch(e){}
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(store))}catch(e){}};
let mode='train',idx=0;document.getElementById('cb').textContent=P.codebook;
const list=()=>mode==='train'?P.train:P.main;
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const OUT=['identified','multiple_plausible','insufficient_evidence','inconsistent_evidence','no_fitting_code','unsupported_stimulus'];
function render(){const L=list();const c=L[idx];const it=P.items[c.item_id];const key=mode+':'+c.case_id;const r=store[key]||{};
document.getElementById('progress').textContent=(mode==='train'?'연습 ':'본 판정 ')+(idx+1)+' / '+L.length+' · 완료 '+L.filter(x=>store[mode+':'+x.case_id]?.outcome).length;
const ch=(it.choices||[]).map((t,i)=>'<li class="'+(i+1===c.chosen_option?'chosen':'')+(it.answers.includes(i+1)?' correct':'')+'">'+esc(t)+(i+1===c.chosen_option?' <b>← 학생 선택</b>':'')+(it.answers.includes(i+1)?' <b>(정답)</b>':'')+'</li>').join('');
const b=c.blocked_span;
document.getElementById('item').innerHTML='<h2>'+esc(c.case_id)+' · '+esc(c.item_id)+' · '+esc(c.type)+'</h2><p><b>'+esc(it.stem)+'</b></p><div class="passage">'+esc(it.passage)+'</div><ol class="choices">'+ch+'</ol>'+
'<h2>학생 과정 증거</h2><dl class="ev"><dt>확신도</dt><dd>'+esc(c.confidence??'없음')+'</dd><dt>고른 이유</dt><dd>'+esc(c.reason??'없음')+'</dd><dt>막힌 곳</dt><dd>'+(b?esc(b.part+(b.option?(' '+b.option):''))+' — 「'+esc(b.quote)+'」':'없음')+'</dd><dt>학생 해석</dt><dd>'+esc(c.interpretation??'없음')+'</dd><dt>학생 자기 분류</dt><dd>'+esc(c.self_category??'없음')+'</dd><dt>시험 상황</dt><dd>'+esc(c.context??'없음')+'</dd></dl>';
const codeOpts=v=>'<option value="">—</option>'+P.codes.map(x=>'<option'+(x===v?' selected':'')+'>'+x+'</option>').join('');
const multi=(name,vals)=>'<div class="chips">'+P.codes.map(x=>'<label><input type="checkbox" name="'+name+'" value="'+x+'"'+((vals||[]).includes(x)?' checked':'')+'>'+x+'</label>').join('')+'</div>';
let f='<h2>판정</h2><label for="adequacy">증거 충분성</label><select id="adequacy"><option value="">—</option>'+['A0','A1','A2','A3'].map(x=>'<option'+(x===r.adequacy?' selected':'')+'>'+x+'</option>').join('')+'</select>'+
'<label for="outcome">판정 결과</label><select id="outcome"><option value="">—</option>'+OUT.map(x=>'<option'+(x===r.outcome?' selected':'')+'>'+x+'</option>').join('')+'</select>'+
'<label for="primary">primary(identified 일 때만)</label><select id="primary">'+codeOpts(r.primary)+'</select>'+
'<label>contributing(최대 2)</label>'+multi('contributing',r.contributing)+
'<label>후보(multiple_plausible 일 때 2개 이상)</label>'+multi('candidates',r.candidates)+
'<label for="judge_confidence">판정자 확신도(결과와 별개)</label><select id="judge_confidence"><option value="">—</option>'+['low','medium','high'].map(x=>'<option'+(x===r.judge_confidence?' selected':'')+'>'+x+'</option>').join('')+'</select>'+
'<label for="flow_stop">멈춘 판정 단계</label><input id="flow_stop" placeholder="예: Q4b" value="'+esc(r.flow_stop)+'">'+
'<label for="rationale">근거(증거를 인용해 1~2문장)</label><textarea id="rationale">'+esc(r.rationale)+'</textarea>'+
'<label for="difficulty">코드북이 불분명했던 점(있으면)</label><textarea id="difficulty">'+esc(r.codebook_difficulty)+'</textarea>'+
'<p><button id="save">저장</button> <span id="msg" class="muted"></span></p>';
if(mode==='train'&&r.outcome&&c.answer)f+='<div class="answer"><b>해설</b><br>결과 '+esc(c.answer.outcome)+(c.answer.primary?' · primary '+esc(c.answer.primary):'')+((c.answer.contributing||[]).length?' · 보조 '+esc(c.answer.contributing.join(', ')):'')+'<br>'+esc(c.answer.why)+'</div>';
document.getElementById('form').innerHTML=f;
document.getElementById('save').onclick=()=>{const v=id=>document.getElementById(id).value||null;const chk=n=>[...document.querySelectorAll('input[name='+n+']:checked')].map(x=>x.value);
const o={case_id:c.case_id,adequacy:v('adequacy'),outcome:v('outcome'),primary:v('primary'),contributing:chk('contributing'),candidates:chk('candidates'),judge_confidence:v('judge_confidence'),flow_stop:v('flow_stop'),rationale:v('rationale'),codebook_difficulty:v('difficulty'),saved_at:new Date().toISOString()};
const err=[];if(!o.outcome)err.push('판정 결과');if(o.outcome==='identified'&&!o.primary)err.push('primary');if(o.outcome!=='identified'&&o.primary)err.push('identified 가 아니면 primary 를 비운다');
if(o.outcome==='multiple_plausible'&&o.candidates.length<2)err.push('후보 2개 이상');if(o.contributing.length>2)err.push('contributing 은 2개까지');if(o.primary&&o.contributing.includes(o.primary))err.push('primary 를 contributing 에 다시 넣지 않는다');
if(o.contributing.includes('B.no_verification')===false&&o.primary==='B.no_verification')err.push('B.no_verification 은 contributing 전용(R11)');
if(err.length){document.getElementById('msg').textContent='확인: '+err.join(' · ');return}
store[key]=o;save();render();document.getElementById('msg').textContent='저장됨';};}
document.getElementById('mode').onchange=e=>{mode=e.target.value;idx=0;render()};
document.getElementById('prev').onclick=()=>{idx=Math.max(0,idx-1);render()};document.getElementById('next').onclick=()=>{idx=Math.min(list().length-1,idx+1);render()};
document.getElementById('export').onclick=()=>{const rows=P.main.map(c=>store['main:'+c.case_id]).filter(Boolean);
const left=P.main.length-rows.length;if(left&&!confirm('본 판정 '+left+'건이 비어 있다. 그래도 내보낼까?'))return;
const blob=new Blob([JSON.stringify({reviewer:P.reviewer,corpusId:P.corpusId,codebookHash:P.codebookHash,exported_at:new Date().toISOString(),judgments:rows},null,1)],{type:'application/json'});
const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='human-review-'+P.reviewer+'.json';a.click()};
document.getElementById('import').onclick=()=>document.getElementById('file').click();
document.getElementById('file').onchange=async e=>{const t=JSON.parse(await e.target.files[0].text());for(const r of t.judgments||[])store['main:'+r.case_id]=r;save();render()};
render();
</script></body></html>`
fs.mkdirSync(out, { recursive: true })
const file = path.join(out, `packet-${reviewer}.html`)
fs.writeFileSync(file, html)
console.log(`판정자 ${reviewer} 패킷: ${file} · 본 판정 ${main.length} · 연습 ${train.length} · 코드북 ${codebookHash.slice(0, 12)}`)
