// scripts/research/csat-reading/v12-descriptive.mjs
// Post-hoc descriptive item-cluster intervals for a purposive pilot, not population inference.
import fs from 'node:fs'
import {jaccard,assertHash} from './agreement.mjs'
const dir='docs/research/csat-reading/data/v12/',read=p=>JSON.parse(fs.readFileSync(p,'utf8')),ex=read(dir+'pilot-execution.json')
for(const[file,h]of Object.entries(ex.hashes))assertHash(fs.readFileSync(file),h,file)
const a=read(dir+'rater-a.json'),b=read(dir+'rater-b.json'),selection=read(dir+'pilot-selection.json')
const rows=selection.map(m=>({m,a:a.items.find(x=>x.id===m.id),b:b.items.find(x=>x.id===m.id)})),groups=[...new Set(selection.map(x=>x.passage_group))]
const bootstrap=metric=>{let seed=20261014;const random=()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296};const scores=[];for(let i=0;i<1000;i++){const sample=[];for(let n=0;n<groups.length;n++){const g=groups[Math.floor(random()*groups.length)];sample.push(...rows.filter(x=>x.m.passage_group===g))}scores.push(metric(sample))}scores.sort((a,b)=>a-b);return{low:scores[24],high:scores[974]}}
const intervals={};for(const axis of ['discourse','task'])intervals[axis]=bootstrap(rs=>rs.filter(r=>r.a[axis]===r.b[axis]).length/rs.length)
for(const axis of ['decisive_relations','inference'])intervals[axis]=bootstrap(rs=>rs.reduce((s,r)=>s+jaccard(r.a[axis],r.b[axis]),0)/rs.length)
for(const field of ['textual_support','task_fit'])intervals['option_'+field]=bootstrap(rs=>rs.reduce((s,r)=>s+r.a.choices.filter(c=>c[field]===r.b.choices.find(x=>x.n===c.n)[field]).length,0)/(5*rs.length))
const result={protocol:'1.2',timing:'post_first_freeze_post_hoc_descriptive',method:'1000 fixed-seed20261014 passage-cluster percentile resamples; all5choices kept within each selected item',n_items:rows.length,n_groups:groups.length,intervals,limitations:['Purposeful pilot; intervals are not population confidence intervals.','A degenerate bootstrap interval at1 is not certainty about future exams.','Intervals do not override point-based preregistered gates or prove teaching effects.','No causal comparison to v1.0/v1.1.']}
fs.writeFileSync(dir+'descriptive-intervals.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result.intervals,null,2))
