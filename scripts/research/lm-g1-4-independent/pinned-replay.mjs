// scripts/research/lm-g1-4-independent/pinned-replay.mjs
// Re-run the unchanged final safety fixture against the submitted adapter.
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {createRequire} from 'node:module';import {execFileSync,spawnSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'../../..'),web=root+'/apps/web',req=createRequire(web+'/package.json'),revision=process.argv[2]??'replay';
if(!/^[a-z0-9-]+$/.test(revision))throw Error('Invalid revision');const out=import.meta.dirname+'/local/'+revision;if(fs.existsSync(out))throw Error('Recorded run exists; use a new revision');fs.mkdirSync(out,{recursive:true});
const source='apps/web/src/lib/csat/map/v62/evidence-claims.ts',fixture='apps/web/src/lib/csat/map/v62/__tests__/evidence-claims-independent.test.ts',pinned='68b1541fff7dd0dd880e6bd51e1ba091d770786c';
const raw=execFileSync('git',['show',pinned+':'+source],{cwd:root,encoding:'utf8'});let relocated=raw;
for(const mod of ['../lifecycle-evidence','../v4/as-is','../v4/definition'])relocated=relocated.replaceAll("from '"+mod+"'",'from '+JSON.stringify(path.resolve(root,path.dirname(source),mod)+'.ts'));
fs.writeFileSync(out+'/pinned.ts',relocated);fs.writeFileSync(out+'/config.mjs','export default '+JSON.stringify({root:web,resolve:{alias:[{find:'@',replacement:web+'/src'},{find:'../evidence-claims',replacement:out+'/pinned.ts'}]},test:{environment:'node'},esbuild:{jsx:'automatic'}}));
const report=out+'/results.json',r=spawnSync(process.execPath,[req.resolve('vitest/vitest.mjs'),'run',path.relative(web,root+'/'+fixture),'--config',out+'/config.mjs','--pool=forks','--poolOptions.forks.singleFork','--reporter=json','--outputFile='+report],{cwd:web,encoding:'utf8',timeout:180000});
fs.writeFileSync(out+'/run.log',(r.stdout??'')+(r.stderr??''));const j=JSON.parse(fs.readFileSync(report,'utf8')),hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const result={pinned,sourceSha256:hash(raw),fixtureSha256:hash(fs.readFileSync(root+'/'+fixture)),tests:j.numTotalTests,pass:j.numPassedTests,fail:j.numFailedTests,expectedOriginalFailures:true,importsRelocatedOnly:true};fs.writeFileSync(out+'/manifest.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));if(r.status!==1||result.tests!==20||result.pass!==5||result.fail!==15)process.exitCode=1;
