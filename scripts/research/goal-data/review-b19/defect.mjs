// scripts/research/goal-data/review-b19/defect.mjs
import fs from 'node:fs'
import vm from 'node:vm'
import path from 'node:path'
const out='scripts/research/goal-data/review-b19/',main='D:/workspace/Vocaflow-main-serving',files=JSON.parse(fs.readFileSync(out+'packets.local.json')).files
const codePaths=['scripts/csat/build-corpus.mjs','scripts/csat/lib-passage.mjs','scripts/csat/corpus-sync.mjs','scripts/csat/analysis-drain-export.mjs','scripts/csat/data/columns2/2014A.txt']
const sources=Object.fromEntries(codePaths.map(p=>[p,fs.readFileSync(main+'/'+p,'utf8')]))
const rows=new Map();for(const [p,s]of Object.entries(files))if(p.endsWith('/input.json'))for(const r of JSON.parse(s).rows)rows.set(r.item_id,r)
// Triage signal, never an automatic rejection: a lowercase one-word sentence between periods.
const orphan=p=>[...p.matchAll(/[.!?]["”’)]?\s+([a-z]{2,20})\.(?=\s+[A-Z]|$)/g)].map(m=>({index:m.index,token:m[1]}))
const matches=[...rows.values()].flatMap(r=>{const hits=orphan(r.source.passage);return hits.length?[{item:r.item_id,hits}]:[]})
const corpus=sources['scripts/csat/build-corpus.mjs'],slice=corpus.slice(corpus.indexOf('const BLANK_TYPES'),corpus.indexOf('/** 순서 배열형'))
const context=vm.createContext({});vm.runInContext(slice+'\nthis.suspect=suspectBody;',context)
const target=rows.get('2014A#29'),blockLines=sources['scripts/csat/data/columns2/2014A.txt'].replaceAll('\r','').split('\n').slice(266,293)
const passageSource=sources['scripts/csat/lib-passage.mjs'];
// Read-only module import: helpers only; no corpus build or sync is executed.
const {passageOf}=await import('file:///'+main+'/scripts/csat/lib-passage.mjs')
const old=passageOf(blockLines),withEnglish=passageOf(blockLines,{keepEnglishNotes:true})
const norm=s=>s.replace(/\s+/g,' ').replace(/\s*\*\s*/g,'*').trim(),result={unique_inputs:rows.size,matches,target_body_ok:target.body_ok,length:target.source.passage.length,suspectBody:context.suspect(target.source.passage,target.type_id),parser_reproduces:norm(old)===norm(target.source.passage),comparison_normalization:'collapse whitespace and whitespace adjacent to asterisk; no other edits',english_note_restored:withEnglish.length>old.length,old,withEnglish,blockLines,sources,codePaths}
fs.writeFileSync(out+'defect.local.json',JSON.stringify(result,null,2))
console.log(JSON.stringify({...result,old:undefined,withEnglish:undefined,blockLines:undefined,sources:undefined},null,2))
if(!result.parser_reproduces||result.suspectBody||!result.english_note_restored)process.exitCode=1
