// scripts/research/goal-data/review-b17/assembly.mjs
import fs from 'node:fs'
import vm from 'node:vm'
import {out,base,snap,json,check,checks,hash} from './audit.mjs'
const ts=JSON.parse(fs.readFileSync(out+'transcripts.local.json')),records=[]
const eq=(a,b)=>{if(a===b)return true;if(!a||!b||typeof a!=='object'||typeof b!=='object')return false;return Object.keys(a).length===Object.keys(b).length&&Object.keys(a).every(k=>Object.hasOwn(b,k)&&eq(a[k],b[k]))}
async function run(source,rows){const writes={},ctx=vm.createContext({console:{log:()=>{}}}),mod=new vm.SourceTextModule(source,{context:ctx});await mod.link(async name=>{if(name==='node:fs'){const m=new vm.SyntheticModule(['default'],function(){this.setExport('default',{readFileSync:p=>{const q=p.replace('D:/workspace/Vocaflow-goal-data/','');if(!q.startsWith(base+'b17-v24/chunk-')||!q.endsWith('.json')||q.endsWith('.out.json'))throw Error('unexpected assembly read '+q);return snap.files[q]},writeFileSync:(p,s)=>writes[p]=s})},{context:ctx});return m}if(name==='./rows.mjs')return new vm.SourceTextModule(rows,{context:ctx});throw Error('unexpected assembly import '+name)});await mod.evaluate();return Object.values(writes).map(JSON.parse)[0]}
for(const t of ts){const writes=t.tools.filter(t=>t.type==='tool_use'&&t.name==='Write'),firstPath=Object.keys(snap.files).find(p=>p.includes('b17-v24-'+t.label+'-first/')&&p.endsWith('chunk-'+t.label+'.out.json')),first=json(firstPath);let replay,content,before=null
 if(t.label==='B-01'){content=writes.find(w=>w.input.file_path.endsWith('.out.json')).input.content;replay=JSON.parse(content)}
 else if(t.label==='A-01'){const command=t.tools.find(t=>t.type==='tool_use'&&t.line===62).input.command;content=command.split("<<'EOF'\n")[1].split('\nEOF')[0];replay=await run(content,writes[0].input.content)}
 else {content=writes.find(w=>w.input.file_path.endsWith('build.mjs')).input.content;if(t.label==='B-02'){before=await run(content);const from="design: '(A) based 오답', distortion_type: 'form_error'",to="design: '(A) based 오답', distortion_type: 'other'";check('B02 pre-output substitution exactly one literal occurrence',content.split(from).length===2);content=content.replace(from,to)}replay=await run(content)}
 check(t.label+' assembly/direct Write replays own first snapshot',eq(replay,first))
 if(before){const diffs=before.rows.flatMap((r,i)=>eq(r,replay.rows[i])?[]:[{id:r.item_id,before:r.distractors,after:replay.rows[i].distractors}]);check('B02 pre-output change only 2017#29 distractor 1 type',diffs.length===1&&diffs[0].id==='2017#29'&&eq({...before.rows[17],distractors:replay.rows[17].distractors},replay.rows[17])&&before.rows[17].distractors[0].distortion_type==='form_error'&&replay.rows[17].distractors[0].distortion_type==='other');records.push({label:t.label,diffs})}
 const live=[];for(const w of writes.filter(w=>w.input.file_path.includes('scratchpad'))){const p=w.input.file_path;live.push({path:p,content:fs.readFileSync(p,'utf8')})}
 if(t.label==='A-01'){const p=live[0].path.replace('rows.mjs','build.mjs');live.push({path:p,content:fs.readFileSync(p,'utf8')})}
 records.push({label:t.label,firstPath,first_rows:first.rows.length,replay_sha256:hash(replay),first_sha256:hash(first),assembly:content,live})
}
fs.writeFileSync(out+'assembly.local.json',JSON.stringify({checks,records},null,2));console.log(JSON.stringify({checks:checks.length,failed:checks.filter(c=>!c.pass),records:records.map(({assembly,live,diffs,...r})=>r)}))
