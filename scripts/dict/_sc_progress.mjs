import fs from 'node:fs'; import path from 'node:path'
const envPath = path.resolve('apps/web/.env.local')
if (fs.existsSync(envPath)) for (const line of fs.readFileSync(envPath,'utf8').split('\n')){const m=line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')}
const { createClient } = await import('@supabase/supabase-js')
const db = createClient(process.env['NEXT_PUBLIC_SUPABASE_URL'], process.env['SUPABASE_SERVICE_ROLE_KEY'], { auth:{persistSession:false} })
const V = parseInt(process.argv[2],10)
// pull all rows for level, count multi vs single among content alpha non-ing
let cursor='', all=[]
for(;;){ const {data,error}=await db.from('shared_dictionary').select('word,pos,meanings_ko').eq('v_level',V).not('classified_by','is',null).in('pos',['noun','verb','adjective']).gt('word',cursor).order('word',{ascending:true}).limit(1000); if(error){console.error(error.message);process.exit(1)} if(!data.length)break; all.push(...data); cursor=data[data.length-1].word; if(data.length<1000)break }
const content = all.filter(r=>/^[a-z]+$/.test(r.word) && !/ing$/.test(r.word) && Array.isArray(r.meanings_ko))
const single = content.filter(r=>r.meanings_ko.length===1).length
const multi = content.filter(r=>r.meanings_ko.length>=2).length
console.log(`V${V}: content(noun/verb/adj, alpha, non-ing)=${content.length} | multi-sense=${multi} (${(multi/content.length*100).toFixed(1)}%) | single-sense(targets)=${single}`)
