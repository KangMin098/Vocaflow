// scripts/research/factory-i0-277-independent/unit-final.mjs
import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';import {createRequire} from 'node:module'
import {productHashes,assertSameManifest,hashFile} from '../lm-g1-5a-independent/binding.mjs'
const root=path.resolve(import.meta.dirname,'../../..'),local=import.meta.dirname+'/local',req=createRequire(root+'/apps/web/package.json')
fs.mkdirSync(local,{recursive:true})
const dirty=spawnSync('git',['diff','--exit-code','HEAD','--','apps/web'],{cwd:root,encoding:'utf8'});if(dirty.status!==0)throw Error('Uncommitted product source');
if(fs.existsSync(local+'/unit-final-binding.json'))throw Error('Immutable final unit run exists')
const hashes=productHashes(root),startedAt=new Date().toISOString(),head=spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).stdout.trim()
const result=spawnSync(process.execPath,[req.resolve('vitest/vitest.mjs'),'run','src/lib/csat/map/v62/factory-bridge/__tests__','--pool=forks','--poolOptions.forks.singleFork','--reporter=json','--outputFile='+local+'/unit-final.json'],{cwd:root+'/apps/web',encoding:'utf8',maxBuffer:16<<20,timeout:180000,windowsHide:true})
fs.writeFileSync(local+'/unit-final.log',(result.stdout??'')+(result.stderr??''))
if(result.status!==0)throw Error('Final I0 units failed')
const json=JSON.parse(fs.readFileSync(local+'/unit-final.json','utf8'))
if(json.numPassedTests!==77||json.numFailedTests||json.numPendingTests)throw Error('Incomplete I0 unit result')
assertSameManifest(productHashes(root),hashes)
fs.writeFileSync(local+'/unit-final-binding.json',JSON.stringify({head,startedAt,observedAt:new Date().toISOString(),hashes,runnerSha256:hashFile(import.meta.filename),resultSha256:hashFile(local+'/unit-final.json'),passed:77,failed:0,skipped:0},null,2))
console.log(JSON.stringify({passed:77,sourceStable:true}))
