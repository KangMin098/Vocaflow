// scripts/research/lm-g1-5a-independent/binding.mjs
import fs from 'node:fs'
import crypto from 'node:crypto'
import {spawnSync} from 'node:child_process'
export const hashFile=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')
export function productHashes(root){
 const r=spawnSync('git',['diff','--name-only','8ee927dcee80a9b19d70b2d4c86869e8ea013813...HEAD','--','apps/web'],{cwd:root,encoding:'utf8'})
 if(r.status!==0)throw Error('Cannot establish product source manifest')
 const files=r.stdout.trim().split(/\r?\n/).filter(Boolean)
 for(const f of ['apps/web/src/lib/knowledge/contextual-sense.ts','apps/web/src/lib/knowledge/product-server.ts','apps/web/src/components/csat/theater/ContextSensePanel.tsx'])if(!files.includes(f))throw Error('Incomplete product source manifest: '+f)
 return Object.fromEntries(files.sort().map(f=>[f,hashFile(root+'/'+f)]))
}
export function assertSameManifest(actual,expected){
 if(!actual||!Object.keys(actual).length||Object.keys(actual).length!==Object.keys(expected).length||Object.entries(expected).some(([f,h])=>actual[f]!==h))throw Error('Missing or changed source binding')
}
export function assertRows(value,count){
 if(!Array.isArray(value)||value.length!==count||value.some(x=>x.pass!==true))throw Error('Incomplete or failing counterexamples')
}
