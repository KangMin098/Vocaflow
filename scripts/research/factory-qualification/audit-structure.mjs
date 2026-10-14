// scripts/research/factory-qualification/audit-structure.mjs
import fs from 'node:fs';
import crypto from 'node:crypto';
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const base='scripts/research/factory-qualification/local';
const all=['main','counter'].flatMap(split=>JSON.parse(fs.readFileSync(`${base}/dcp-${split}-input.json`,'utf8')).items);
const rows=all.map(x=>{const s=x.item.payload.sentences;const words=Array.isArray(s)&&s.every(v=>typeof v==='string')?s.join(' '):null;return {id:x.id,split:x.split,type:x.type,payload_sentences_n:Array.isArray(s)?s.length:null,sentence_element_type:typeof s?.[0],sentence_element_keys:typeof s?.[0]==='object'?Object.keys(s[0]):null,normalized_generated_passage_hash:words?sha(words.toLowerCase().replace(/\s+/g,' ').trim()):null,source_sha256:x.source_sha256,item_sha256:x.item_sha256,source_present:!!x.source?.content,ancestry_n:x.ancestry.length};});
const groups=new Map();for(const r of rows)if(r.normalized_generated_passage_hash){const h=r.normalized_generated_passage_hash;groups.set(h,[...(groups.get(h)??[]),r.id]);}
const out={version:'fq1-structure-2',earlier_export_preserved:true,correction:'first export checked passage_text/passage/text but actual payload uses sentences; null hashes were unassessed, not verified uniqueness',items:rows,duplicates:[...groups].filter(([,ids])=>ids.length>1).map(([hash,ids])=>({hash,ids,disposition:'hold without replacement'})),assessable_generated_passages:rows.filter(x=>x.normalized_generated_passage_hash).length};
const dest='docs/research/factory-qualification/data/sample-structure-v2.json';if(fs.existsSync(dest))throw Error('preserve first structure revision');fs.writeFileSync(dest,JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify({n:rows.length,assessable:out.assessable_generated_passages,duplicates:out.duplicates,types:rows.map(r=>[r.sentence_element_type,r.sentence_element_keys])}));
