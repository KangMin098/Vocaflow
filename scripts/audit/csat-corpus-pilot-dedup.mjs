// scripts/audit/csat-corpus-pilot-dedup.mjs
// Read-only inventory scan plus bounded full-body near-duplicate comparison.
import fs from 'node:fs'
import { normalizeCorpusText, normalizedTextHash, canonicalSourceUrl, wordShingles, compareShingles, duplicateEvidence } from '../lib/corpus-dedup.mjs'
import { retryingFetch } from '../lib/supabase-client.mjs'
for(const line of fs.readFileSync('apps/web/.env.local','utf8').split(/\r?\n/)){
  const m=line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
  if(m&&!process.env[m[1]])process.env[m[1]]=m[2].trim().replace(/^["']|["']$/g,'')
}
const origin=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY
if(!origin||!key)throw Error('Missing environment')
const get=retryingFetch(),dir='.agent-logs/corpus-pilot'
const pilots=fs.readFileSync(`${dir}/articles.jsonl`,'utf8').trim().split('\n').map(JSON.parse)
async function scan(select,filters={}){
 const rows=[];let cursor=null
 for(;;){
  const qs=new URLSearchParams({select,order:'id.asc',limit:'500',...filters});if(cursor)qs.set('id',`gt.${cursor}`)
  const res=await get(`${origin}/rest/v1/library_articles?${qs}`,{headers:{apikey:key,Authorization:`Bearer ${key}`}})
  if(!res.ok)throw Error(`Inventory HTTP ${res.status}`)
  const page=await res.json();if(!Array.isArray(page))throw Error('Invalid inventory');rows.push(...page)
  if(page.length<500)break
  const next=page.at(-1).id;if(next===cursor)throw Error('Nonadvancing cursor');cursor=next
 }
 return rows
}
const inventory=await scan('id,source,title,source_url,content_hash')
process.stderr.write(`Metadata scanned ${inventory.length}\n`)
const indexBy=(key)=>{const index=new Map();for(const a of inventory){const k=key(a);if(!k)continue;const values=index.get(k)??[];values.push({id:a.id,source:a.source});index.set(k,values)}return index}
const hashes=indexBy(a=>a.content_hash),titles=indexBy(a=>normalizeCorpusText(a.title??'')),urls=indexBy(a=>canonicalSourceUrl(a.source_url))
const related=await scan('id,source,title,source_url,content',{source:'eq.storyweaver'})
const usable=fs.readFileSync('.agent-logs/csat-usable-bodies.jsonl','utf8').trim().split('\n').map(JSON.parse)
const comparison=[...new Map([...usable,...related].map(a=>[a.id,a])).values()]
process.stderr.write(`Near-body comparison ${comparison.length} bodies\n`)
const prepared=pilots.map(a=>({...a,normalizedHash:normalizedTextHash(a.content),shingles:wordShingles(a.content)}))
const matches=new Map(pilots.map(p=>[p.source_id,[]]))
for(const a of comparison){
 const h=normalizedTextHash(a.content),shingles=wordShingles(a.content)
 for(const p of prepared){
  const similarity=compareShingles(p.shingles,shingles)
  if(h===p.normalizedHash||(similarity.shared>=20&&((similarity.jaccard??0)>=0.8||(similarity.containment??0)>=0.9)))matches.get(p.source_id).push({id:a.id,source:a.source,normalizedExact:h===p.normalizedHash,...similarity})
 }
}
const results=prepared.map(p=>({source_id:p.source_id,contentHash:p.content_hash,normalizedHash:p.normalizedHash,
 storedHashMatches:hashes.get(p.content_hash)??[],
 titleMatches:titles.get(normalizeCorpusText(p.title))??[],
 urlMatches:urls.get(canonicalSourceUrl(p.source_url))??[],
 bodyMatches:matches.get(p.source_id),pilotMatches:prepared.filter(q=>q.source_id!==p.source_id).map(q=>({source_id:q.source_id,...duplicateEvidence(p,q)})).filter(e=>e.normalizedExact||e.nearReview)
}))
const out={measuredAt:new Date().toISOString(),readOnly:true,inventoryRows:inventory.length,storedHashPresent:inventory.filter(a=>a.content_hash).length,nearComparisonBodies:comparison.length,storyweaverBodies:related.length,
 method:'All inventory metadata: exact stored SHA256, normalized title and canonical URL. Body comparison: current usable snapshot plus all StoryWeaver rows; exact normalized text and 5-word shingle Jaccard>=0.8 or containment>=0.9 with >=20 shared shingles. All matches are review evidence, never deletion instructions.',
 limitations:['Near-duplicate comparison does not cover all 109k bodies. Missing stored hashes are unknown, not unique.','Semantic retellings may not share words and require manual reading. Paginated scan is not transactional.'],results}
fs.writeFileSync(`${dir}/dedup.json`,JSON.stringify(out,null,2)+'\n')
console.log(JSON.stringify({inventoryRows:out.inventoryRows,storedHashPresent:out.storedHashPresent,nearComparisonBodies:out.nearComparisonBodies,matches:results.filter(r=>r.storedHashMatches.length||r.bodyMatches.length||r.pilotMatches.length||r.titleMatches.length||r.urlMatches.length).map(r=>({source_id:r.source_id,stored:r.storedHashMatches.length,body:r.bodyMatches.length,pilot:r.pilotMatches.length,title:r.titleMatches.length,url:r.urlMatches.length}))},null,2))
