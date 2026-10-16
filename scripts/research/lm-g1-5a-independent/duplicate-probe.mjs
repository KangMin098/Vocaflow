// scripts/research/lm-g1-5a-independent/duplicate-probe.mjs
// Inject only a fixed SOURCES array into unchanged original/revised annotation index.
import fs from 'node:fs';import path from 'node:path';import {execFileSync} from 'node:child_process';import {sourceModule} from '../lm-g1-3a-independent/source-loader.mjs'
const root=path.resolve(import.meta.dirname,'../../..'),rel='apps/web/src/lib/knowledge/contextual-sense-annotations.ts',pinned=process.argv.includes('--pinned'),sha='4064c002bec87cedc3f4dece9d86172eed3d8fc0'
const a={version:'test.v1',itemId:'T#30',skeletonSig:'sig',sentenceCount:8,sourceRevision:'a'.repeat(64),officialAnswer:4,targets:[1,2,3,5,6],misfit:3,sense:{options:['less','more'],correct:0,rejectWhy:{1:'less context'}},cue:{sentences:[4],accepted:[],reviewed:true},review:{status:'accepted',annotator:'A',independentReviewer:'B',reviewerBlind:true,agreement:'BD',reviewedAt:'2026-10-17'}}
const original=pinned?execFileSync('git',['show',sha+':'+rel],{cwd:root,encoding:'utf8'}):fs.readFileSync(root+'/'+rel,'utf8')
const source=original.replace('const SOURCES: readonly unknown[] = []','const SOURCES: readonly unknown[] = '+JSON.stringify([a,{...a,version:'test.v2',sense:{...a.sense,correct:1,rejectWhy:{0:'different judgment'}}}]))
if(source===original)throw Error('Injection point missing')
const m=sourceModule(rel,{[path.resolve(root,rel)]:source}),row={name:'conflicting same-item versions remain unavailable',expected:null,actual:m.contextualSenseAnnotationFor(a.itemId)?.version??null};row.pass=row.actual===null
const file=path.join(import.meta.dirname,'local',pinned?'pinned-duplicate.json':'revised-duplicate.json');if(fs.existsSync(file))throw Error('Immutable output exists');fs.writeFileSync(file,JSON.stringify({source:pinned?sha:'working tree',row},null,2));console.log(JSON.stringify(row));if(!pinned&&!row.pass)process.exitCode=1
