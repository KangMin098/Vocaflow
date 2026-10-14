// scripts/research/factory-qualification/gold-logic.mjs
// Consistency on analyst-coded components only; no language/substring grading.
export function facetState(record) {
  const {required, correct, contradictions=[], inputAvailable=true, antecedentCount=1}=record;
  if(!Array.isArray(required)||!required.length||new Set(required).size!==required.length)throw Error('required component IDs invalid');
  if(!Array.isArray(correct)||!Array.isArray(contradictions))throw Error('component flags invalid');
  for(const id of [...correct,...contradictions])if(!required.includes(id))throw Error('unknown component');
  if(new Set(correct).size!==correct.length||new Set(contradictions).size!==contradictions.length)throw Error('duplicate component');
  if(typeof inputAvailable!=='boolean'||!Number.isInteger(antecedentCount)||antecedentCount<0)throw Error('observation invalid');
  if(!inputAvailable||antecedentCount!==1)return 'defer';
  if(contradictions.length)return 'defect';
  if(correct.length===required.length)return 'meets';
  return correct.length?'partial':'defer';
}
export function procedureState(record) {
  const keys=['solutionAccess','sourceExposureCleared','firstUnaidedFreeze','roleRecordsComplete'];
  if(keys.some(k=>!['yes','no','unknown'].includes(record[k])))throw Error('procedure flags invalid');
  if(record.solutionAccess==='yes'||record.sourceExposureCleared==='no')return 'ineligible';
  if(record.solutionAccess==='no'&&keys.slice(1).every(k=>record[k]==='yes'))return 'eligible';
  return 'defer';
}
export function propagateGroundContradiction(facets, groundId, dependencies) {
  const next=structuredClone(facets);
  for(const {facet,component,ground} of dependencies){
    if(!next[facet]||!next[facet].required.includes(component))throw Error('invalid dependency');
    if(ground===groundId){next[facet].contradictions=[...new Set([...(next[facet].contradictions??[]),component])];}
  }
  return next;
}
