// scripts/research/goal-data/review-b18/assembly.mjs
// Replay captured assembly and hand-written originals in a filesystem-free VM.
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import {out,base,snap,json,check,checks,hash,execute} from './audit.mjs'
const ts=JSON.parse(fs.readFileSync(out+'transcripts.local.json')),records=[]
const equal=(a,b)=>{if(a===b)return true;if(!a||!b||typeof a!=='object'||typeof b!=='object')return false;return Object.keys(a).length===Object.keys(b).length&&Object.keys(a).every(k=>Object.hasOwn(b,k)&&equal(a[k],b[k]))}
const differences=(a,b,p='')=>equal(a,b)?[]:!a||!b||typeof a!=='object'||typeof b!=='object'?[{field:p,before:a,after:b}]:[...new Set([...Object.keys(a),...Object.keys(b)])].flatMap(k=>differences(a[k],b[k],p?p+'.'+k:k))
async function replay(code,files,dir){
 const writes={},ctx=vm.createContext({console:{log:()=>{}}}),cache=new Map()
 const safe={readFileSync:p=>{p=p.replaceAll('\\','/');if(files[p]!==undefined)return files[p];const q=p.replace('D:/workspace/Vocaflow-goal-data/','');if(q.startsWith(base+'b18-v24/chunk-')&&!q.endsWith('.out.json')&&snap.files[q])return snap.files[q];throw Error('unapproved read '+p)},writeFileSync:(p,s)=>writes[p]=s}
 function requireLocal(p){if(p==='fs'||p==='node:fs')return safe;if(p==='path')return path;const q=path.posix.join(dir,p);if(!files[q])throw Error('unapproved require '+p);const module={exports:{}};vm.runInContext('(function(require,module,exports,__dirname){'+files[q]+'\n})',ctx)(requireLocal,module,module.exports,dir);return module.exports}
 async function moduleFor(p){if(cache.has(p))return cache.get(p);let m;if(p==='node:fs')m=new vm.SyntheticModule(['default'],function(){this.setExport('default',safe)},{context:ctx});else m=new vm.SourceTextModule(files[p],{context:ctx,identifier:p});cache.set(p,m);await m.link(s=>moduleFor(s.startsWith('node:')?s:path.posix.join(path.posix.dirname(p),s)));return m}
 if(code.includes('require('))vm.runInContext('(function(require,__dirname){'+code+'\n})',ctx)(requireLocal,dir)
 else{files={...files,[dir+'/assemble.mjs']:code};await(await moduleFor(dir+'/assemble.mjs')).evaluate()}
 if(Object.keys(writes).length!==1)throw Error('expected one in-memory output');return JSON.parse(Object.values(writes)[0])
}
for(const t of ts){
 const originals=t.tools.filter(x=>x.type==='tool_use'&&x.name==='Write'&&x.input.file_path.includes('scratchpad'))
 const dir=path.posix.dirname(originals[0].input.file_path),files=Object.fromEntries(originals.map(w=>[w.input.file_path,fs.readFileSync(w.input.file_path,'utf8')]))
 const initial=Object.fromEntries(originals.map(w=>[w.input.file_path,w.input.content]))
 const use=t.tools.find(x=>x.type==='tool_use'&&x.input.command?.includes("<<'EOF'")&&x.input.command.includes('assemble'))
 const code=use.input.command.split("<<'EOF'\n")[1].split('\nEOF')[0]
 const firstPath=Object.keys(snap.files).find(p=>p.includes('b18-v24-'+t.label+'-first/')&&p.endsWith('chunk-'+t.label+'.out.json'))
 const first=json(firstPath),final=json(base+'b18-v24/chunk-'+t.label+'.out.json'),result=await replay(code,files,dir),before=await replay(code,initial,dir)
 check(t.label+' hand originals + assembly reproduce first snapshot',equal(result,first))
 const finalDiff=final.rows.flatMap((r,i)=>differences(result.rows[i],r).map(d=>({item:r.item_id,...d})))
 check(t.label+' replay/final expected drift',t.label==='A-01'?finalDiff.length===2&&finalDiff.every(d=>['2016#22','2016#23'].includes(d.item)&&d.field==='not_observable.0.why'):finalDiff.length===0)
 const preDiff=before.rows.flatMap((r,i)=>differences(r,result.rows[i]).map(d=>({item:r.item_id,...d})))
 check(t.label+' original edits expected items',t.label==='B-02'?equal([...new Set(preDiff.map(d=>d.item))].sort(),['2016#31','2016#33','2016#37','2016#38']):preDiff.length===0)
 let replayValidation=null
 if(t.label==='A-01'){
  replayValidation=await execute('scripts/research/goal-data/d2-run.mjs',['b18-v24','validate','A','01'],{[base+'b18-v24/chunk-A-01.out.json']:JSON.stringify(result)})
  check('A01 reassembly loses corrections and fails validation',replayValidation.error==='EXIT 1')
 }
 records.push({label:t.label,session:t.path,assembly_line:use.line,code,files,initial,firstPath,replay_sha256:hash(result),first_sha256:hash(first),finalDiff,preDiff,replayValidation})
}
fs.writeFileSync(out+'assembly.local.json',JSON.stringify({checks,records},null,2))
console.log(JSON.stringify({checks:checks.length,failed:checks.filter(c=>!c.pass),records:records.map(({code,files,initial,...r})=>r)},null,2))

