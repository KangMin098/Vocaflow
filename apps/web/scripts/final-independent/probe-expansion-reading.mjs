// apps/web/scripts/final-independent/probe-expansion-reading.mjs
// Compare a sealed independent reading with frozen actual format validation/grading; no DB.
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import {createRequire} from 'node:module'
import {execFileSync} from 'node:child_process'
const root=path.resolve(import.meta.dirname,'../../../..'),folder=path.join(root,'docs/research/final-independent-20261018'),head='4655e9be45fd0a75e354421c3465ffbbb5537fd7'
const source=p=>execFileSync('git',['show',head+':'+p],{cwd:root,encoding:'utf8'})
const bytes=fs.readFileSync(path.join(folder,'expansion-codex-reading.json'))
assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),'94ab434ab46e436712ad5751aa05a490aa14676838d5fb8e2f6fa8ad58fe8c8b')
const packetBytes=fs.readFileSync(path.join(folder,'expansion-body-packet.json'))
assert.equal(crypto.createHash('sha256').update(packetBytes).digest('hex'),'c017245c8e14dcdce29f8fa1af144cb03459443a45be4f418cbca59de71fbe33')
const reading=JSON.parse(bytes),packet=JSON.parse(packetBytes),snapshot=path.join(root,'.agent-logs/final-independent/owner-de5')
// Only unchanged dependencies are reused; format source itself is from the new candidate.
for(const f of ['apps/web/src/lib/knowledge/claim-support.ts','apps/web/src/lib/knowledge/claim-support-labels.ts'])assert.equal(fs.readFileSync(path.join(snapshot,f),'utf8'),source(f))
const req=createRequire(path.join(root,'apps/web/package.json')),{build}=createRequire(createRequire(req.resolve('vitest/package.json')).resolve('vite'))('esbuild')
const built=await build({stdin:{contents:source('apps/web/src/lib/knowledge/authored/formats.ts'),resolveDir:path.join(snapshot,'apps/web/src/lib/knowledge/authored'),loader:'ts'},bundle:true,write:false,platform:'node',format:'cjs',tsconfig:path.join(snapshot,'apps/web/tsconfig.json')})
const mod={exports:{}};new Function('module','exports',built.outputFiles[0].text)(mod,mod.exports)
const alias={subject_verb_agreement:'agreement',participle_voice:'participle',passive_voice:'voice'}
const rows=[]
for(const set of packet.sets){const full=JSON.parse(source(set.file));for(const item of full.items){const own=reading.items.find(x=>x.id===item.id);assert.ok(own);const response={...own.response};if(response.reason)response.reason=alias[response.reason]??response.reason;const spec=mod.exports.FORMAT_SPECS[set.format],validation=spec.validate(item.body,item.gold),graded=spec.grade(item.body,item.gold,response,'v1');rows.push({taskId:set.taskId,id:item.id,role:item.role,independentReading:own,response,validation,graded,gold:item.gold})}}
assert.equal(rows.length,36)
const result={head,packetSha256:reading.packetSha256,readingSha256:crypto.createHash('sha256').update(bytes).digest('hex'),scope:'Post-seal comparison, not human Gold or effectiveness evidence. Semantic grammar labels are adapted explicitly without changing the sealed reading.',reasonAliases:alias,rows}
fs.writeFileSync(path.join(folder,'expansion-reading-comparison.json'),JSON.stringify(result,null,2)+'\n')
for(const r of rows)console.log(JSON.stringify({id:r.id,valid:r.validation,grade:r.graded?.grade??null,contentVerdict:r.independentReading.verdict??null}))
console.log(JSON.stringify({items:rows.length,validatorErrors:rows.filter(r=>r.validation.length).length,accepted:rows.filter(r=>r.graded?.grade.isCorrect).length}))
