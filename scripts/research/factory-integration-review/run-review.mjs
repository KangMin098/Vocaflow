// scripts/research/factory-integration-review/run-review.mjs
import fs from 'node:fs';import path from 'node:path';import {createRequire} from 'node:module';import {spawnSync} from 'node:child_process';
const dep=process.env.VF_REVIEW_DEP_ROOT??process.cwd(),require=createRequire(path.join(dep,'apps/web/package.json'));
const cli=path.join(path.dirname(require.resolve('vitest/package.json')),'vitest.mjs');
const modes=process.argv.includes('--original')?[false]:process.argv.includes('--new')?[true]:[false,true];
for(const isNew of modes){const r=spawnSync(process.execPath,[cli,'run','--config','scripts/research/factory-integration-review/vitest.config.mjs'],{stdio:'inherit',env:{...process.env,VF_REVIEW_DEP_ROOT:dep,VF_REVIEW_NEW_TESTS:isNew?'1':'0'}});if(r.status!==0)process.exit(r.status??1);}
const p='docs/research/factory-integration-review/data/counterexamples.json';if(fs.existsSync(p)){const x=JSON.parse(fs.readFileSync(p,'utf8'));console.log(JSON.stringify({diagnostics:'executed',contract_safety:x.counts.safety_fail?'FAIL':'PASS',...x.counts}));if(process.argv.includes('--acceptance')&&x.counts.safety_fail)process.exitCode=1;}
