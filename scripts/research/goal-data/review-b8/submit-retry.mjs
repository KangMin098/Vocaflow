// scripts/research/goal-data/review-b8/submit-retry.mjs
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
const central='D:/workspace/Vocaflow-AI-Control',output='scripts/research/goal-data/review-b8/command-output.local.json';
const records=JSON.parse(fs.readFileSync(output,'utf8'));
const file=central+'/runtime/t-0113-ev.json',ev=JSON.parse(fs.readFileSync(file,'utf8'));
ev.command_or_protocol='node scripts/research/goal-data/review-b8/check.mjs; node scripts/research/goal-data/review-b8/supplement.mjs; source review at 1fa75b9cc (pass means review completed, findings retained)';
fs.writeFileSync(file,JSON.stringify(ev,null,2)+'\n');
for(const args of [['bin/vfc.mjs','task','evidence','T-0113','--file','runtime/t-0113-ev.json','--by','goal-data-independent'],['bin/vfc.mjs','task','submit','T-0113','--by','goal-data-independent']]){
 const r=spawnSync('node',args,{cwd:central,encoding:'utf8',maxBuffer:10e6});
 const record={command:['node',...args],cwd:central,exit_code:r.status,stdout:r.stdout??'',stderr:r.stderr??''};records.push(record);
 fs.writeFileSync(output,JSON.stringify(records,null,2)+'\n');console.log(JSON.stringify(record,null,2));if(r.status!==0)break;
}
