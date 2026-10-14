// scripts/research/factory-qualification/gold-comparison.mjs
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const read=p=>fs.readFileSync(path.join(root,p));
const json=p=>JSON.parse(read(p).toString('utf8'));
const sha=p=>crypto.createHash('sha256').update(read(p)).digest('hex');
const authorPath='scripts/research/factory-qualification/local/gold-countercases-first.json';
const criticPath='scripts/research/factory-qualification/local/gold-critic-first.json';
const author=json(authorPath),critic=json(criticPath);
if(sha(criticPath)!=='c77f5e6ad750f735b31827b91a080045af3bc4be752ab58c116ba625ac4d0f8a')throw Error('critic seal changed');
if(author.version!==critic.version||critic.inputs.blind_input_sha256!==sha('scripts/research/factory-qualification/local/gold-blind-input.json'))throw Error('input/version mismatch');
const states=['meets','partial','defect','defer'];
const confusion=states.map(()=>states.map(()=>0));
const differences=[];let procedureMatches=0;
for(const c of author.cases){
 const d=critic.cases.find(x=>x.id===c.id);if(!d||d.task!==c.task||d.facets.length!==4)throw Error('critic case contract');
 for(const [facet,a] of Object.entries(c.expected)){const entry=d.facets.find(x=>x.facet===facet);if(!entry||!states.includes(entry.state))throw Error('critic facet contract');const b=entry.state;confusion[states.indexOf(a)][states.indexOf(b)]++;if(a!==b)differences.push({response_id:c.id,facet,author:a,critic:b,author_reason:c.reason,critic_reason:entry.reason});}
 if(c.eligibility===d.procedural_eligibility.state)procedureMatches++;
}
const n=confusion.flat().reduce((a,b)=>a+b,0),matches=confusion.reduce((a,row,i)=>a+row[i],0);
const rows=confusion.map(x=>x.reduce((a,b)=>a+b,0)),cols=states.map((_,j)=>confusion.reduce((a,row)=>a+row[j],0));
const pe=rows.reduce((s,a,i)=>s+a*cols[i],0)/(n*n),po=matches/n;
const analysis=[
 {id:'R1',response_ids:['g01'],facets:['units'],status:'author_component_omission_acknowledged',resolution:'A directly observable unit/indicator component was overlooked by author. Critic proper-subset reading is supported under existing G1/G3. First labels remain unchanged.'},
 {id:'R2',response_ids:['g04'],facets:['comparison','conjunction'],status:'referent_rule_precision_unresolved',resolution:'Exact numeric identifiers can uniquely address supplied source rows, but role/source disambiguation and clause reference must be explicit. Critic has a plausible reading; original rule does not fully formalize numeric binding. Revision2 proposal records required address evidence; no consensus labels substituted.'},
 {id:'R3',response_ids:['g06'],facets:['boundary'],status:'dependency_map_underspecified',resolution:'Invalid empirical grounds also bear on the separately required indicator-distinction boundary component. Critic defect is logically supported when that component uses global reasoning. Author had limited attribution to explicit boundary sentence; scope not frozen. Revision2 proposes complete dependency registration, not retroactive agreement.'}
];
const privateOut={version:'FQ1-gold1-post-seal-reconciliation',author:{path:authorPath,sha256:sha(authorPath)},critic:{path:criticPath,sha256:sha(criticPath),sealed_at_utc:critic.sealed_at_utc},differences,analysis,firsts_unchanged:true};
const privateOutput='scripts/research/factory-qualification/local/gold-reconciliation.json';
const output='docs/research/factory-qualification/data/gold-comparison.json';
const result={version:privateOut.version,author:privateOut.author,critic:privateOut.critic,private_reconciliation:{path:privateOutput,sha256:null},meaning:{responses:10,facets:n,matches,agreement:po,kappa:(po-pe)/(1-pe),author_counts:Object.fromEntries(states.map((s,i)=>[s,rows[i]])),critic_counts:Object.fromEntries(states.map((s,i)=>[s,cols[i]])),disagreement_count:differences.length,disagreement_response_count:new Set(differences.map(x=>x.response_id)).size,disagreements:differences.map(({response_id,facet})=>({response_id,facet})),interpretation:'Descriptive AI author-versus-blind-critic agreement on 10 synthetic responses; 40 facets are dependent observations. No Gold accuracy, human reliability or student effect inferred.'},procedure:{responses:10,matches:procedureMatches,agreement:procedureMatches/10,eligible:0,ineligible:1,defer:9},analysis:analysis.map(({resolution,...metadata})=>metadata),firsts_unchanged:true,actual_students:0,human_reviewers:0,assessment_qualified:0,public_qualified:0};
const encodedPrivate=JSON.stringify(privateOut,null,2)+'\n';
const checking=process.argv.includes('--check')||process.argv.includes('--redact-public');
if(checking){if(read(privateOutput).toString('utf8')!==encodedPrivate)throw Error('private reconciliation differs');}
else{if(fs.existsSync(path.join(root,privateOutput))||fs.existsSync(path.join(root,output)))throw Error('refuse overwrite');fs.writeFileSync(path.join(root,privateOutput),encodedPrivate);}
result.private_reconciliation.sha256=sha(privateOutput);
const encoded=JSON.stringify(result,null,2)+'\n';
if(process.argv.includes('--redact-public')){const draft='scripts/research/factory-qualification/local/gold-comparison-public-draft.json';if(fs.existsSync(path.join(root,draft)))throw Error('redaction already recorded');fs.writeFileSync(path.join(root,draft),read(output));fs.writeFileSync(path.join(root,output),encoded);console.log('Public draft preserved privately; public individual resolution prose removed');}
else if(checking){if(read(output).toString('utf8')!==encoded)throw Error('public aggregate differs');console.log('gold comparison firsts and reconciliation verified');}
else {fs.writeFileSync(path.join(root,output),encoded);console.log(JSON.stringify({n,matches,kappa:result.meaning.kappa,disagreement_count:differences.length,sha256:sha(output)}));}
