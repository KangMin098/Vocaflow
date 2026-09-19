// scripts/audit/csat-usable-topics.mjs
// Read-only: classify current usable article bodies with the existing topic classifier.
// pnpm exec tsx scripts/audit/csat-usable-topics.mjs
import fs from 'node:fs'
import { createHash } from 'node:crypto'
import { classify, TOPIC_V } from '../csat/lib-topic.mjs'
import { readability } from '../../packages/library-pipeline/src/textbook/readability.ts'
import { retryingFetch } from '../lib/supabase-client.mjs'

for (const line of fs.readFileSync('apps/web/.env.local','utf8').split(/\r?\n/)) {
  const m=line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
  if(m && !process.env[m[1]]) process.env[m[1]]=m[2].trim().replace(/^["']|["']$/g,'')
}
const origin=process.env.NEXT_PUBLIC_SUPABASE_URL, key=process.env.SUPABASE_SERVICE_ROLE_KEY
if(!origin || !key) throw new Error('Missing Supabase environment')
const get=retryingFetch(), startedAt=new Date().toISOString(), cells=new Map(), samples=new Map()
let cursor=null, scanned=0, skippedStale=0, missingStoredTopic=0
const privateRows=[]
for(;;) {
  const qs=new URLSearchParams({select:'article_id,source_updated_at,article:library_articles(id,title,source,content,updated_at,status,cefr_level,article_v_level,register,feed_id,feed_label,csat_fit)', 'result->>grade':'eq.usable',policy_version:'eq.3',order:'article_id.asc',limit:'500'})
  if(cursor) qs.set('article_id',`gt.${cursor}`)
  const response=await get(`${origin}/rest/v1/csat_source_eligibility?${qs}`,{headers:{apikey:key,Authorization:`Bearer ${key}`}})
  if(!response.ok) throw new Error(`Topic audit HTTP ${response.status}`)
  const rows=await response.json()
  if(!Array.isArray(rows)) throw new Error('Expected article array')
  for(const cache of rows) {
    const a=cache.article
    if(!a || cache.source_updated_at!==a.updated_at || !['ready','published'].includes(a.status)){skippedStale++;continue}
    if(typeof a.content!=='string' || !a.content.trim()) throw new Error(`Missing body: ${cache.article_id}`)
    const result=classify(a.content), reading=readability(a.content)
    scanned++;if(!a.csat_fit?.topic)missingStoredTopic++
    const cell={source:a.source,cefr:a.cefr_level,vLevel:a.article_v_level,topic:result.topic,register:a.register,schoolFeed:a.feed_id==='kid-excerpt'?a.feed_label:null}
    const k=JSON.stringify(cell), old=cells.get(k)??{...cell,n:0}
    old.n++;cells.set(k,old)
    const row={id:a.id,title:a.title,source:a.source,cefr:a.cefr_level,topic:result.topic,margin:result.margin,register:a.register,reading,content:a.content,rank:createHash('sha256').update(a.id).digest('hex')}
    privateRows.push({...row,source_updated_at:a.updated_at})
    const bucket=samples.get(result.topic)??[];bucket.push(row);bucket.sort((a,b)=>a.rank.localeCompare(b.rank));bucket.length=Math.min(4,bucket.length);samples.set(result.topic,bucket)
  }
  process.stderr.write(`usable body audit ${scanned}\n`)
  if(rows.length<500) break
  const next=rows.at(-1).article_id
  if(!next || next===cursor)throw new Error('Cursor did not advance')
  cursor=next
}
fs.mkdirSync('.agent-logs',{recursive:true})
const report={startedAt,measuredAt:new Date().toISOString(),readOnly:true,topicVersion:TOPIC_V,scanned,skippedStale,missingStoredTopic,
  method:'Existing lib-topic classifier on full bodies of current policy-v3 usable articles; no database changes. Paginated scan, not a transactional snapshot.',
  limitations:['Keyword estimates require manual review; registers are stored labels and may be ingestion defaults.','School feed denotes intended audience, not verified age suitability.'],
  cells:[...cells.values()],sampleIds:[...samples.values()].flat().map(({content,rank,...r})=>r)}
fs.writeFileSync('docs/reports/csat-usable-topics-20260919.json',JSON.stringify(report,null,2)+'\n')
fs.writeFileSync('.agent-logs/csat-usable-topic-samples.json',JSON.stringify([...samples.values()].flat(),null,2)+'\n')
fs.writeFileSync('.agent-logs/csat-usable-bodies.jsonl',privateRows.map(r=>JSON.stringify(r)).join('\n')+'\n')
const topics={};for(const c of report.cells)topics[c.topic]=(topics[c.topic]??0)+c.n
console.log(JSON.stringify({scanned,skippedStale,missingStoredTopic,topics},null,2))
