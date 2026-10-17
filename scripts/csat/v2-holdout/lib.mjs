// scripts/csat/v2-holdout/lib.mjs
import crypto from 'node:crypto';
export const sha256=value=>crypto.createHash('sha256').update(value).digest('hex');
export function normalizePassage(value){
 return value.replace(/[①②③④⑤]/g,'').replace(/\([a-e]\)/g,'').normalize('NFKC').toLowerCase().replace(/[‘’]/g,"'").replace(/[“”]/g,'"').replace(/\s+/g,' ').trim();
}
export function fiveTargetStem(stem){
 if(/\(A\).*\(B\).*\(C\)/.test(stem))return false;
 return /밑줄/.test(stem)&&/적절하지\s*않/.test(stem);
}
export function jaccard(a,b){
 const grams=s=>new Set(Array.from({length:Math.max(0,s.length-4)},(_,i)=>s.slice(i,i+5)));
 const x=grams(a),y=grams(b);
 if(!x.size&&!y.size)return a===b?1:0;
 const intersection=[...x].filter(v=>y.has(v)).length;
 return intersection/(x.size+y.size-intersection);
}
export function scoreOf(rules,rulesSha,item){return sha256(`${rules.ordering.seed}|${rulesSha}|${item.itemId}|${item.sourceRevision}`);}
export function chooseSample(rules,rulesSha,candidates,pilot){
 const threshold=rules.duplicates.nearThreshold ?? Number(rules.duplicates.near?.match(/>=\s*([0-9.]+)/)?.[1]);
 if(!Number.isFinite(threshold)||threshold<0||threshold>1)throw new Error('Missing or invalid duplicate threshold');
 const selected=[],primary=[],reserve=[],decisions=[];
 for(const cell of rules.ordering.globalCellOrder){
  let p=0,r=0;
  const pool=candidates.filter(x=>x.cell===cell&&x.status==='ELIGIBLE_LOCAL_RESEARCH').map(x=>({...x,selectionScore:scoreOf(rules,rulesSha,x)})).sort((a,b)=>a.selectionScore.localeCompare(b.selectionScore)||a.itemId.localeCompare(b.itemId));
  for(const item of pool){
   if(p>=rules.strata.primaryPerCell&&r>=rules.strata.reservePerCell)break;
   const comparison=[...pilot,...selected];
   const duplicate=comparison.find(x=>sha256(x.normalizedText)===sha256(item.normalizedText)||jaccard(x.normalizedText,item.normalizedText)>=threshold);
   if(duplicate){decisions.push({itemId:item.itemId,status:'HOLD_DUPLICATE_REVIEW',against:duplicate.itemId});continue;}
   const role=p<rules.strata.primaryPerCell?'PRIMARY':'RESERVE';
   const chosen={...item,role};selected.push(chosen);(role==='PRIMARY'?primary:reserve).push(chosen);if(role==='PRIMARY')p++;else r++;
  }
  if(p<rules.strata.primaryPerCell||r<rules.strata.reservePerCell)decisions.push({cell,status:'QUOTA_SHORTFALL',primaryMissing:rules.strata.primaryPerCell-p,reserveMissing:rules.strata.reservePerCell-r});
 }
 return {primary,reserve,decisions};
}
