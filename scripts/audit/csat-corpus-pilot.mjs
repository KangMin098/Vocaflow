// scripts/audit/csat-corpus-pilot.mjs
// Local acquisition/normalization pilot. No database writes and no automatic publication.
// pnpm exec tsx scripts/audit/csat-corpus-pilot.mjs
import fs from 'node:fs'
import { createHash } from 'node:crypto'
import { htmlToPlainText } from '../../packages/library-pipeline/src/ingest-article/_helpers.ts'
const dir='.agent-logs/corpus-pilot'
fs.mkdirSync(dir,{recursive:true})
const hash=text=>createHash('sha256').update(text).digest('hex')
const records=[], events=[]
async function get(url, name) {
  const response=await fetch(url,{headers:{'User-Agent':'Vocaflow-Corpus-Audit/1.0 (+https://github.com/KangMin098/Vocaflow)'},signal:AbortSignal.timeout(30000)})
  events.push({url,status:response.status,at:new Date().toISOString()})
  if(!response.ok)throw new Error(`${name}: HTTP ${response.status}`)
  const raw=await response.text()
  fs.writeFileSync(`${dir}/${name}`,raw)
  return raw
}
// Use a publisher-provided machine-readable corpus, pinned to a commit.
const commit=JSON.parse(await get('https://api.github.com/repos/global-asp/asp-source/commits/master','asp-commit.json')).sha
if(!/^[a-f0-9]{40}$/.test(commit))throw new Error('Invalid corpus commit')
const base=`https://raw.githubusercontent.com/global-asp/asp-source/${commit}`
const readme=await get(`${base}/en/README.md`,'asp-license-index.md')
const entries=JSON.parse(await get(`https://api.github.com/repos/global-asp/asp-source/contents/en?ref=${commit}`,'asp-index.json'))
const licenses=new Map([...readme.matchAll(/^(\d{4}) \| \[([^\]]+)\]\(([^)]+)\) \| \[CC-BY\]\((https:\/\/creativecommons\.org\/licenses\/by\/[34]\.0\/)\)/gm)].map(m=>[m[1],{title:m[2],originalUrl:m[3],licenseUrl:m[4]}]))
const eligible=entries.filter(e=>licenses.has(e.name.slice(0,4)) && e.name.endsWith('.md')).sort((a,b)=>a.name.localeCompare(b.name))
if(eligible.length<50)throw new Error('Too few licensed stories for planned sample')
const selected=Array.from({length:50},(_,i)=>eligible[Math.floor(i*eligible.length/50)])
for(const entry of selected) {
  const id=entry.name.slice(0,4), rights=licenses.get(id)
  try {
    const raw=await get(`${base}/en/${entry.name}`,`asp-${entry.name}`)
    if(!/^\* License: \[CC-BY\]\s*$/m.test(raw))throw new Error('Individual license does not match licensed index')
    const author=raw.match(/^\* Text:\s*(.+)$/m)?.[1]?.trim()
    if(!author)throw new Error('Missing author')
    const body=raw.split(/^\* License:/m)[0].replace(/^# [^\n]+\n/,'').replace(/^##\s*$/gm,'').replace(/\n{3,}/g,'\n\n').trim()
    records.push({source:'african_storybook',source_id:`african_storybook:${id}`,title:raw.match(/^# (.+)$/m)?.[1]??rights.title,author,source_url:`https://github.com/global-asp/asp-source/blob/${commit}/en/${entry.name}`,origin_url:rights.originalUrl,license:`CC-BY-${rights.licenseUrl.includes('/3.0/')?'3.0':'4.0'}`,license_url:rights.licenseUrl,content:body,raw_hash:hash(raw),content_hash:hash(body),fetched_at:new Date().toISOString(),published_at:null,metadata:{commit,acquisition:'publisher-corpus',sample:'systematic 50 evenly spaced over CC-BY English story index',population:eligible.length}})
  } catch(error) { events.push({source:'african_storybook',id,error:String(error)}) }
  await new Promise(r=>setTimeout(r,250))
}
// NARA agency-produced writing has worldwide CC0; authorship/third-party quotations
// still require per-article review. This sample stays local until that review passes.
const robots=await get('https://prologue.blogs.archives.gov/robots.txt','nara-robots.txt')
if(!/Disallow:\s*\/wp-admin\//.test(robots)||/Disallow:\s*\/\s*$/m.test(robots))throw new Error('Unexpected robots policy; review before fetching')
const endpoint='https://prologue.blogs.archives.gov/wp-json/wp/v2/posts?per_page=50&_fields=id,link,title,content,date,author,categories'
const nara=JSON.parse(await get(endpoint,'nara-posts.json'))
if(!Array.isArray(nara))throw new Error('Invalid NARA response')
for(const post of nara) {
  const raw=post.content?.rendered
  if(typeof raw!=='string' || post.content.protected) {events.push({source:'nara',id:post.id,error:'Missing/protected body'});continue}
  const body=htmlToPlainText(raw.replace(/<figure\b[^>]*>[\s\S]*?<\/figure>/gi,''))
  records.push({source:'nara',source_id:`nara:prologue:${post.id}`,title:htmlToPlainText(post.title.rendered),author_id:post.author,author:null,source_url:post.link,license:null,license_url:'https://www.archives.gov/global-pages/privacy.html',rights_review:'Confirm agency authorship; exclude third-party quotations/images before CC0 assignment',content:body,raw_hash:hash(raw),content_hash:hash(body),fetched_at:new Date().toISOString(),published_at:post.date,metadata:{acquisition:'WordPress REST',sample:'50 latest posts at measurement time; not a representative sample of all NARA',removed:'figure elements, images and captions'}})
}
fs.writeFileSync(`${dir}/articles.jsonl`,records.map(r=>JSON.stringify(r)).join('\n')+'\n')
fs.writeFileSync(`${dir}/events.json`,JSON.stringify({measuredAt:new Date().toISOString(),commit,attemptedStories:50,attemptedNara:nara.length,events},null,2)+'\n')
console.log(JSON.stringify({records:records.length,asp:records.filter(r=>r.source==='african_storybook').length,nara:records.filter(r=>r.source==='nara').length,errors:events.filter(e=>e.error)},null,2))
