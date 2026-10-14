// scripts/research/factory-qualification/gold-logic-revision2.mjs
// Post-first component-scope proposal; analyst judgments, not natural-language grading.
export function scopedFacetState(components) {
 if(!Array.isArray(components)||!components.length||new Set(components.map(c=>c.id)).size!==components.length)throw Error('required components invalid');
 const statuses=['correct','contradiction','missing','unresolved'];
 if(components.some(c=>typeof c.id!=='string'||!c.id||!statuses.includes(c.status)))throw Error('component observation invalid');
 if(components.some(c=>c.status==='contradiction'))return 'defect';
 const correct=components.filter(c=>c.status==='correct').length;
 if(correct===components.length)return 'meets';
 return correct?'partial':'defer';
}
export function uniqueAddress(addresses) {
 if(!Array.isArray(addresses)||addresses.some(a=>!a.id||typeof a.compatible!=='boolean'))throw Error('address evidence invalid');
 const valid=addresses.filter(a=>a.compatible);
 return valid.length===1?{status:'unique',id:valid[0].id}:{status:'unresolved',id:null};
}
