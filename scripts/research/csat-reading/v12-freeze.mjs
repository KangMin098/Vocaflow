// scripts/research/csat-reading/v12-freeze.mjs
// Freeze source-admitted input before raters; freeze complete first submissions before key review.
import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {assertHash} from './agreement.mjs'
import {assertPreserved} from './v12-analysis.mjs'
const dir='docs/research/csat-reading/data/v12/',local='scripts/research/csat-reading/local/v12/'
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex'),sha=x=>createHash('sha256').update(x).digest('hex')
const reg=read(dir+'registration.json');assertPreserved(reg)
assertHash(fs.readFileSync('docs/research/csat-reading/PROTOCOL-v1.2.md'),reg.protocol_sha256,'protocol')
assertHash(fs.readFileSync(local+'pilot-key.json'),reg.key_sha256,'key')
const stage=process.argv[2],now=process.argv[3];if(!now||!/^2026-10-14T/.test(now))throw Error('Inject explicit operational UTC timestamp')
if(stage==='input'){
 const out=dir+'pilot-registration.json';if(fs.existsSync(out))throw Error('Source input already frozen')
 const input=read(local+'pilot-input.json'),source=read(dir+'pilot-source.json'),selected=read(dir+'pilot-selection.json')
 if(input.answer_blind!==true||input.items.length!==16||new Set(input.items.map(x=>x.id)).size!==16||source.items.length!==16)throw Error('Input source denominator/blindness')
 for(const item of input.items){
  if(!selected.some(x=>x.id===item.id))throw Error('Unexpected input item')
  const clean={...item};delete clean.source_binding
  if(sha(JSON.stringify(clean))!==item.source_binding||source.items.find(x=>x.id===item.id)?.source_binding!==item.source_binding)throw Error(`Binding mismatch ${item.id}`)
  if('answer'in item||'solved_answer'in item||item.choices.length!==5)throw Error('Answer leak or missing options')
  let end=0;for(const u of item.units){if(item.passage.slice(u.start,u.end)!==u.text||u.start<end)throw Error(`Stale unit ${item.id}/${u.id}`);end=u.end}
  if(source.items.find(x=>x.id===item.id)?.keymatch!==true)throw Error('Unverified same-form key')
 }
 const hashes=Object.fromEntries(['docs/research/csat-reading/PROTOCOL-v1.2.md','scripts/research/csat-reading/v12-analysis.mjs',local+'rater-instructions.md',local+'pilot-input.json',dir+'pilot-source.json',local+'pilot-key.json'].map(p=>[p,hash(p)]))
 fs.writeFileSync(out,JSON.stringify({protocol:'1.2',preregistration_commit:'bc4649287',source_frozen_at:now,hashes,source_complete:source.items.filter(x=>x.status==='complete').length,raters_started:false},null,2)+'\n');console.log('Source and blind input frozen')
}else if(stage==='first'){
 const out=dir+'pilot-execution.json';if(fs.existsSync(out))throw Error('First submissions already frozen')
 const inputReg=read(dir+'pilot-registration.json');for(const[p,h]of Object.entries(inputReg.hashes))assertHash(fs.readFileSync(p),h,p)
 const submissions={};for(const r of ['a','b']){const file=dir+`rater-${r}.json`,x=read(file);if(x.items.length!==16||x.rater!==r.toUpperCase())throw Error('First complete submission required');submissions[r.toUpperCase()]={sha256:hash(file),fork_turns:'none',context:'fresh AI, inherited configuration; pretraining unverified',complete_file_mtime:fs.statSync(file).mtime.toISOString()}}
 const hashes={...inputReg.hashes,...Object.fromEntries(['a','b'].map(r=>[dir+`rater-${r}.json`,submissions[r.toUpperCase()].sha256]))}
 fs.writeFileSync(out,JSON.stringify({...inputReg,raters_started:true,first_complete_frozen_at:now,key_review_after_this_record:true,first_submissions:submissions,hashes},null,2)+'\n');console.log('First complete submissions frozen before key review')
}else throw Error('Use input or first')
