// scripts/research/lm-g1-4-independent/cleanup.mjs
// Reuse the ID-bound cleanup procedure, rooted in this worktree's own local directory.
import fs from 'node:fs'
import path from 'node:path'
import {createRequire} from 'node:module'
import {cleanupOwnedAccounts} from '../lm-g1-1-independent/cleanup.mjs'
const root=path.resolve(import.meta.dirname,'../../..'),req=createRequire(root+'/apps/web/package.json'),{createClient}=req('@supabase/supabase-js')
const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}}),local=path.join(import.meta.dirname,'local')
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)])
const ids=[...new Set(walk(local).filter(f=>/owned-accounts\.local\.json$/.test(f)).flatMap(f=>JSON.parse(fs.readFileSync(f,'utf8'))))],existing=[]
for(const id of ids){const g=await db.auth.admin.getUserById(id);if(g.error?.code==='user_not_found'&&g.error.status===404)continue;if(g.error||!g.data.user)throw Error('Owned account lookup unknown');if(!/^(map-lmg|lmg11-boundary|map-lmg13a)/.test(g.data.user.email??''))throw Error('Ownership mismatch');existing.push(id)}
const result=await cleanupOwnedAccounts(db.auth.admin,existing),receipt={recorded:ids.length,presentBefore:existing.length,...result}
fs.writeFileSync(local+'/cleanup-'+Date.now()+'.json',JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));if(!result.ok)process.exitCode=1
