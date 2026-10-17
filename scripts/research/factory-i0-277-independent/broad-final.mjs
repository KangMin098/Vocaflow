// scripts/research/factory-i0-277-independent/broad-final.mjs
import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process'
import {productHashes,assertSameManifest,hashFile} from '../lm-g1-5a-independent/binding.mjs'
const root=path.resolve(import.meta.dirname,'../../..'),local=path.resolve(import.meta.dirname,'local'),binding=local+'/broad-final-binding.json'
if(fs.existsSync(binding))throw Error('Immutable broad run exists')
const previous=path.resolve(local,'checks-broad'),preserved=path.resolve(local,'pre-followup-broad')
if(!previous.startsWith(path.resolve(root)+path.sep)||!preserved.startsWith(path.resolve(root)+path.sep))throw Error('Unsafe archive path')
if(fs.existsSync(previous)){if(fs.existsSync(preserved))throw Error('Broad archive already exists');fs.renameSync(previous,preserved)}
const hashes=productHashes(root),head=spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).stdout.trim(),startedAt=new Date().toISOString()
const result=spawnSync(process.execPath,[import.meta.dirname+'/checks.mjs','broad-units'],{cwd:root,encoding:'utf8',timeout:600000,maxBuffer:16<<20,windowsHide:true})
fs.writeFileSync(local+'/broad-final.log',(result.stdout??'')+(result.stderr??''))
if(result.status!==0)throw Error('Broad unit command incomplete')
const partitions=JSON.parse(fs.readFileSync(previous+'/partitions.json','utf8')),reports=[]
let files=0,passed=0,failed=0,skipped=0
for(const p of partitions){if(!p.ok)throw Error('Failed partition');const file=previous+'/'+p.report,j=JSON.parse(fs.readFileSync(file,'utf8'));files+=p.files.length;passed+=j.numPassedTests;failed+=j.numFailedTests;skipped+=j.numPendingTests;reports.push({file:p.report,sha256:hashFile(file)})}
if(files!==215||passed!==2602||failed!==0||skipped!==0)throw Error('Unexpected broad inventory or nonpassing result')
assertSameManifest(productHashes(root),hashes)
fs.writeFileSync(binding,JSON.stringify({head,startedAt,observedAt:new Date().toISOString(),hashes,files,passed,failed,skipped,runnerSha256:hashFile(import.meta.dirname+'/checks.mjs'),wrapperSha256:hashFile(import.meta.filename),reports},null,2));console.log(JSON.stringify({files,passed,failed,skipped,sourceStable:true}))
