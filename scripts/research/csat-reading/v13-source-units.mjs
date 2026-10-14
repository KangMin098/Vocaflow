// scripts/research/csat-reading/v13-source-units.mjs
// Source-preserving punctuation units; syntactic completeness is a separate judgment.
export function atomicRanges(text, baseOffset=0, {forcedEnds=[]}={}) {
  const ranges=[]; let begin=0;
  const emit=end=>{const raw=text.slice(begin,end),lead=raw.length-raw.trimStart().length,t=raw.trim();if(t)ranges.push({start:baseOffset+begin+lead,end:baseOffset+begin+lead+t.length,text:t});begin=end;};
  for(let i=0;i<text.length;i++) {
    if(!/[.!?]/u.test(text[i]))continue;
    if(text[i]==='.'&&!forcedEnds.includes(baseOffset+i+1)) {
      if(/\d/u.test(text[i-1]??'')&&/\d/u.test(text[i+1]??''))continue;
      const before=text.slice(0,i+1);
      if(/\b(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|vs|etc|e\.g|i\.e)\.$/iu.test(before))continue;
      if(/\b(?:[A-Z]\.){1,}$/u.test(before))continue;
      if(text[i+1]==='.')continue;
    }
    let end=i+1;
    while(/[”’"')\]]/u.test(text[end]??'')&&end<text.length)end++;
    if(end===text.length||/\s/u.test(text[end])){emit(end);i=end-1;}
  }
  emit(text.length);
  return ranges;
}
export function sourceRegions(item) {
  const p=item.presentation??{};
  if(p.kind==='letter')return [{...p.salutation,role:'salutation',syntactic_sentence:false},{start:p.salutation.end,end:p.signature.start,role:'body'},{...p.signature,role:'signature',syntactic_sentence:false}];
  if(p.kind==='summary')return [{start:0,end:p.body_box.end,role:'body'},{...p.summary_sentence,role:'task_stimulus'}];
  if(p.blocks?.length)return [...(p.given_sentence?[{...p.given_sentence,role:'given_stimulus'}]:[]),...p.blocks.map(b=>({...b,role:'body',block_label:b.label}))];
  if(p.kind==='insertion')return [{...p.given_sentence,role:'given_stimulus'},{start:p.given_sentence.end,end:item.passage.length,role:'body'}];
  return [{start:0,end:item.passage.length,role:p.kind==='stacked_percentage_bars'?'candidate_claim_layer':'body'}];
}
export function deriveUnits(item,{forcedEnds=[]}={}) {
  return sourceRegions(item).flatMap(region=>{
    const units=region.syntactic_sentence===false?[{start:region.start,end:region.end,text:item.passage.slice(region.start,region.end)}]:atomicRanges(item.passage.slice(region.start,region.end),region.start,{forcedEnds});
    return units.map(u=>({...u,role:region.role,block_label:region.block_label??null,kind:region.syntactic_sentence===false?'paratext':'punctuation_sentence',syntactic_completeness:'not_inferred_from_boundary',sentence_count:region.syntactic_sentence===false?0:1}));
  }).map((u,i)=>({id:'s'+(i+1),...u}));
}
export function informationBudget(item,bodyIds=[],candidateIds=[]) {
  const selected=new Set(bodyIds),overlaps=[];
  for(const id of candidateIds){const n=Number(id.replace(/^c/u,''))-1,span=item.presentation?.inline_candidates?.[n];if(span)for(const u of item.units)if(u.end>span.start&&u.start<span.end){selected.add(u.id);overlaps.push({candidate:id,unit:u.id});}}
  const units=item.units.filter(u=>selected.has(u.id));
  return {declared_body_units:bodyIds.length,effective_sentence_union:units.reduce((n,u)=>n+u.sentence_count,0),effective_unit_ids:units.map(u=>u.id),candidate_overlap:overlaps,other_information_required:['stem','candidate_meanings','labels_and_correspondence','glosses_if_accessed','given_or_summary_stimulus_if_accessed','visual_cells_and_axes_if_accessed','external_reference_if_used'],reading_time_estimate:null};
}
