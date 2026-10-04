// scripts/textbook/frym-validation-collect.mjs
import fs from 'node:fs'
import path from 'node:path'
import { emptyEducationalResponseBatch,mergeEducationalResponses } from '@vocaflow/library-pipeline/educational-responses'
import { readEducationalValidation } from './educational-validation-contract.mjs'
import { digest } from './academic-reading-contract.mjs'

const arg=n=>{const i=process.argv.indexOf(`--${n}`);return i<0?null:process.argv[i+1]}
if(process.argv.includes('--commit'))throw Error('Educational response collection has no DB commit mode')
for(const n of ['input','precision-review','output'])if(!arg(n))throw Error(`--${n} required`)
const prepare=process.argv.includes('--prepare')
if(prepare===Boolean(arg('responses')))throw Error('Use either --prepare or --responses <batch.json>')
const out=path.resolve(arg('output'))
if(fs.existsSync(out))throw Error('Output exists; preserve previous results and choose a new path')
const now=Date.now(),validation=readEducationalValidation(arg('input'),now,arg('precision-review'))
if(prepare){
 fs.writeFileSync(out,JSON.stringify(emptyEducationalResponseBatch(validation.bundle),null,2)+'\n',{flag:'wx'})
 console.log(JSON.stringify({mode:'empty_response_batch',actual_responses:0,db_writes:0}))
}else{
 const raw=fs.readFileSync(arg('responses'),'utf8'),{bundle,stats}=mergeEducationalResponses(validation.bundle,JSON.parse(raw),now)
 const output=JSON.stringify(bundle,null,2)+'\n',receipt=out+'.receipt.json'
 // A fresh receipt is required too; neither input nor previous receipt is overwritten.
 if(fs.existsSync(receipt))throw Error('Receipt exists; choose a new output path')
 const summary={mode:'local_response_collection',...stats,db_writes:0}
 fs.writeFileSync(receipt,JSON.stringify({...summary,input_hash:validation.file_hash,response_hash:digest(raw),output_hash:digest(output),collected_at:new Date(now).toISOString()},null,2)+'\n',{flag:'wx'})
 fs.writeFileSync(out,output,{flag:'wx'})
 console.log(JSON.stringify(summary,null,2))
}
