import fs from 'node:fs'
import crypto from 'node:crypto'
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
const dir='verification/reviews/T-0087-r1-independent',repo='D:/workspace/Vocaflow-main-serving',source='D:/workspace/Vocaflow-final-product'
const head='1607faebb096a4a361347f9cd80a45f23d0457a2',file='apps/web/src/lib/knowledge/authored/r5-central-meaning.v1.json',packet='docs/final/review/r5-authored-gold-packet.md'
const read=p=>fs.readFileSync(p,'utf8'),json=p=>JSON.parse(read(p)),sha=x=>crypto.createHash('sha256').update(x).digest('hex')
const canonical=x=>JSON.stringify(x,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v)
assert.equal(execFileSync('git',['rev-parse','HEAD'],{cwd:source,encoding:'utf8'}).trim(),head)
const bytes=fs.readFileSync(repo+'/'+file),data=JSON.parse(bytes),md=read(source+'/'+packet),set=json(repo+'/docs/final/review/FINAL_CONTENT_DECISION_MANIFEST_20261022.json').sets.find(s=>s.file===file),selection=json('verification/reviews/T-0045-next-product-20261022/first-r5-review-package.json')
assert.ok(set);assert.equal(sha(bytes),selection.file_sha256);assert.equal(sha(bytes),set.file_sha256);assert.equal(data.set,'r5-central-meaning.v3');assert.ok(md.includes(sha(bytes)))
const sections=md.split(/(?=^### \d+\. `r5-cm-)/m).slice(1),checks=[]
assert.equal(sections.length,8)
for(const [n,pick] of selection.items.entries()){
 const index=Number(pick.review_pointer.split('/').at(-1)),item=data.items[index],s=sections[n],m=set.items.find(x=>x.id===item.id)
 assert.equal(item.id,pick.id);assert.ok(s.startsWith('### '+(n+1)+'. `'+item.id+'`'));assert.ok(s.includes('`'+item.role+'`'));assert.ok(s.includes('`'+item.passageGroup+'`'));assert.ok(s.includes('`/items/'+index+'`'))
 for(const k of ['body','gold']){const hash=sha(canonical(item[k]));assert.equal(hash,pick[k+'_js_canonical_sha256']);assert.equal(hash,m[k+'_js_canonical_sha256']);assert.ok(s.includes(hash))}
 item.body.sentences.forEach((text,i)=>assert.ok(s.includes(`${i+1}. (raw ${i}) ${text}`),item.id+' sentence '+i))
 const symbols=['①','②','③','④','⑤'];item.body.choices.forEach((text,i)=>assert.ok(s.includes(`- ${symbols[i]} (raw ${i}) ${text}`)))
 assert.ok(s.includes('**발문** '+item.body.stem))
 for(const k of ['teach','hints'])if(item.body[k]){const blocks=[...s.matchAll(/```json\s*\n([\s\S]*?)\n```/g)].map(x=>JSON.parse(x[1]));assert.ok(blocks.some(x=>canonical(x)===canonical(item.body[k])),item.id+' '+k)}
 const g=item.gold;assert.ok(s.includes(`- 정답: ${symbols[g.answer]} (raw ${g.answer}) — ${item.body.choices[g.answer]}`));assert.ok(s.includes('- 요지(gist): '+g.gist))
 const fmt=a=>a.length?a.map(i=>`${i+1}번(raw ${i})`).join(', '):'없음'
 for(const [k,label] of [['claim','주장 문장(claim)'],['claimRestated','주장 재진술'],['support','뒷받침(support)'],['supportDisputed','뒷받침 이견(supportDisputed)'],['opposed','반대 견해(opposed)']]){const vals=Array.isArray(g[k])?g[k]:g[k]==null?[]:[g[k]];assert.ok(s.includes(label+': '+fmt(vals)),item.id+' '+k);vals.forEach(i=>assert.ok(i>=0&&i<item.body.sentences.length))}
 assert.ok(s.includes(`${g.relationProbe.sentence+1}번(raw ${g.relationProbe.sentence}) = \`${g.relationProbe.relation}\``));assert.ok(g.relationProbe.sentence>=0&&g.relationProbe.sentence<item.body.sentences.length)
 for(const d of g.distractors){assert.ok(s.includes(`- ${symbols[d.choice]} (raw ${d.choice}) \`${d.design}\` — ${d.why}`),item.id+' distractor');assert.ok(d.choice>=0&&d.choice<item.body.choices.length&&d.choice!==g.answer)}
 for(const op of m.rights_operations)assert.ok(s.includes(op));for(const scope of m.release_scopes)assert.ok(s.includes(scope))
 assert.ok(s.includes('| 미기록 |'));assert.ok(s.includes('사람 미확정'));checks.push({id:item.id,index,role:item.role,group:item.passageGroup,body_gold:'exact',sentences:item.body.sentences.length,choices:item.body.choices.length})
}
assert.equal(new Set(checks.map(x=>x.group)).size,8)
assert.ok(md.includes('human OR ai OR source_policy'));assert.ok(md.includes('2026-10-21T18:21:08'));assert.ok(/CONTENT_RELEASE_APPROVED\s*=\s*false/.test(md));assert.ok(md.includes('NONE'))
const out={task:'T-0087',head,observed_at:new Date().toISOString(),canonical_main:execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim(),set:data.set,file_sha256:sha(bytes),packet_sha256:sha(read(source+'/'+packet)),items:checks,body_gold_hash_matches:16,selected_items:8,distinct_groups:8,source_and_manifest_unchanged:true,db_writes:0,human_decisions_recorded:0,content_release_approved:false,scope:'Packet transcription and review readiness only; no human Gold, rights, release or educational effect approval.'}
fs.writeFileSync(dir+'/verification.json',JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify(out,null,2))
