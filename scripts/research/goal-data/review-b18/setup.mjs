// scripts/research/goal-data/review-b18/setup.mjs
// Adapt the prior independent verifier; never write to the source worktree.
import fs from 'node:fs'
const out='scripts/research/goal-data/review-b18/'
fs.mkdirSync('docs/research/goal-data-batches/review-b18',{recursive:true})
for(const p of [out,'docs/research/goal-data-batches/review-b18/'])fs.writeFileSync(p+'.gitignore','*.local.json\n')
for(const name of ['capture','audit','regression','supplement','verify-diff']){
 let s=fs.readFileSync('scripts/research/goal-data/review-b17/'+name+'.mjs','utf8').replaceAll('review-b17','review-b18').replaceAll('b17-v24','b18-v24').replaceAll('c839832caa110f886b397aa84fc3b7c9679f08b6','5d7292beaf412e4e238ce644151fee32358c777a')
 if(name==='capture')s=s.replace("['agent-a39da7e0de6ae26d2.jsonl','agent-a4cdc3e1974514d93.jsonl','agent-a8bb6b636c9d26d2d.jsonl','agent-aa8d780ff6bdd15e3.jsonl']","['agent-a1428e17ca7403ede.jsonl','agent-a289db1024ed53e7b.jsonl','agent-a5c00aaa5e7695dcf.jsonl','agent-a74aa60d95ab34552.jsonl']")
 if(name==='audit'){
 s=s.replace("old='8980aaa59'","old='c839832ca'").replace("'b16-v24','b18-v24']","'b16-v24','b17-v24','b18-v24']")
 s=s.replace("primary 34/40',primary.length===6&&agreement.primary_task_agreement===34","primary 35/40',primary.length===5&&agreement.primary_task_agreement===35")
 }
 if(name==='supplement'){
 s=s.replace("'2018 27 + 2017 13 and exclusions 2',inp.rows.filter(r=>r.exam_id==='2018').length===27&&inp.rows.filter(r=>r.exam_id==='2017').length===13&&json(doc+'b18-v24-selection.json').excluded.length===2","'2017 14 + 2016 26 and exclusions 15',inp.rows.filter(r=>r.exam_id==='2017').length===14&&inp.rows.filter(r=>r.exam_id==='2016').length===26&&json(doc+'b18-v24-selection.json').excluded.length===15")
 s=s.replace("at('scripts/research/goal-data/'+p,old)","at('scripts/research/goal-data/'+p,'8980aaa59')")
 s=s.replace("'cumulative 586/1371/509',r.length===586&&links.length===1371&&disputes.length===509","'cumulative 626/1446/528',r.length===626&&links.length===1446&&disputes.length===528")
 s=s.replace("'b17 78/16/40/160'","'b18 75/19/40/160'").replace("length===78&&disputes","length===75&&disputes").replace("length===16&&r.filter","length===19&&r.filter")
 const start=s.indexOf('const mood=[]'),end=s.indexOf('for(const b of [...new Set',start)
 s=s.slice(0,start)+"const mood=[],r6=[]\n"+s.slice(end)
 }
 fs.writeFileSync(out+name+'.mjs',s)
}
