// scripts/research/csat-reading/v13-path-guard.mjs
// Post-seal supplemental guard. It flags contradictions without rewriting first judgments.
import fs from 'node:fs';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
export function paidSentenceUnion(item,path){const ids=new Set([...(path.used_units??[]),...(path.stimulus_units??[])]);return {ids:[...ids],n:[...ids].reduce((n,id)=>n+(item.units.find(u=>u.id===id)?.sentence_count??1),0),unknown:[...ids].filter(id=>!item.units.some(u=>u.id===id)),semantic_stimulus_is_paid_once:true};}
export function pathFlags(row,path){
 const flags=[],allowed=new Set([...(path.used_units??[]),...(path.stimulus_units??[])]),cells=new Set(path.visual_cells??[]);
 if(path.goal==='FOV'&&path.status==='sufficient'){const ns=(path.option_evidence??[]).map(x=>x.n).sort((a,b)=>a-b);if(ns.join(',')!=='1,2,3,4,5')flags.push({kind:'FOV_candidates_not_unique_1_to_5'});}
 if(path.goal==='FOV'&&path.status==='sufficient')for(const e of path.option_evidence??[]){
  const outside=(e.units??[]).filter(x=>!allowed.has(x));if(outside.length)flags.push({kind:'outside_option_anchor',option:e.n,units:outside});
  const referenced=[...(e.why??'').matchAll(/\bc\d+\b/gu)].map(x=>x[0]);
  if(!(e.units?.length)&&!referenced.some(c=>cells.has(c)))flags.push({kind:'unanchored_FOV_candidate',option:e.n,interpretation:'Review missing source anchors; not an automatic semantic verdict'});
  if(referenced.some(c=>!cells.has(c)))flags.push({kind:'outside_visual_anchor',option:e.n,cells:referenced.filter(c=>!cells.has(c))});
 }
 const mainAI=row.paths.find(p=>p.goal==='AI');
 if(path===mainAI)for(const code of row.relations_required??[]){const tests=row.relation_tests.filter(x=>x.path_id===path.id&&x.relation===code);if(!tests.length)flags.push({kind:'required_relation_without_same_path_test',relation:code});if(tests.length&&tests.every(x=>x.necessary===false))flags.push({kind:'required_relation_vs_removal_conflict',relation:code});}
 return flags;
}
if(process.argv.includes('--run')){const dir='docs/research/csat-reading/data/v13/',input=read('scripts/research/csat-reading/local/v13/pilot-input.json'),rows=[];for(const rater of ['a','b'])for(const row of read(dir+'rater-'+rater+'.json').items)for(const p of row.paths)rows.push({rater:rater.toUpperCase(),id:row.id,path_id:p.id,flags:pathFlags(row,p),paid_union:paidSentenceUnion(input.items.find(x=>x.id===row.id),p)});const result={version:'1.3-post-seal-supplement',first_outcomes_modified:false,paths_checked:rows.length,flagged_paths:rows.filter(x=>x.flags.length).length,rows:rows.filter(x=>x.flags.length),paid_unions:rows.map(({rater,id,path_id,paid_union})=>({rater,id,path_id,...paid_union})),meaning:'Mechanical source-containment/explicit-removal contradictions only; cannot prove semantics or repair target mismatch'};fs.writeFileSync(dir+'path-guard.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({paths:rows.length,flagged:result.flagged_paths}));}
