// scripts/research/goal-data/review-b21/source-chain.mjs
import fs from 'node:fs'
import crypto from 'node:crypto'
const out='scripts/research/goal-data/review-b21/',ts=JSON.parse(fs.readFileSync(out+'transcripts.local.json')),results=[]
const hash=s=>crypto.createHash('sha256').update(s).digest('hex')
for(const t of ts){const uses=[...new Map(t.tools.filter(x=>x.type==='tool_use').map(x=>[x.id,x])).values()],files=new Map(),edits=[],problems=[]
 for(const u of uses){const p=u.input?.file_path;if(!p?.includes('/sources/'+t.label+'/'))continue
  if(u.name==='Write')files.set(p,u.input.content)
  if(u.name==='Edit'){
   const s=files.get(p),a=u.input.old_string,b=u.input.new_string;if(s===undefined||!s.includes(a)){problems.push({line:u.line,path:p,kind:'unreplayed edit'});continue}
   files.set(p,u.input.replace_all?s.replaceAll(a,b):s.replace(a,b));edits.push({line:u.line,path:p,replace_all:!!u.input.replace_all})
  }
 }
 const compared=[...files].map(([path,s])=>({path,sha256:hash(s),equal:fs.readFileSync(path,'utf8')===s}));results.push({label:t.label,compared,edits,problems})
}
fs.writeFileSync(out+'source-chain.local.json',JSON.stringify(results,null,2))
console.log(JSON.stringify(results.map(r=>({label:r.label,files:r.compared.length,mismatch:r.compared.filter(x=>!x.equal),edits:r.edits.length,problems:r.problems})),null,2))
