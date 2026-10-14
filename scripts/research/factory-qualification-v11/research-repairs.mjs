// scripts/research/factory-qualification-v11/research-repairs.mjs
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
export const hash = value => crypto.createHash('sha256').update(value).digest('hex');
export function facetDecision({inputAvailable=true, interpretable=false, distortion=false, required=0, correct=0}) {
  if (!inputAvailable || !interpretable) return 'defer';
  if (distortion) return 'defect';
  if (required < 1 || correct < 0 || correct > required) throw new Error('Invalid semantic component counts');
  if (correct === required) return 'meets';
  if (correct > 0) return 'partial';
  return 'defer';
}
export function repairActivity(original, config) {
  const next = structuredClone(original);
  if (next.activity_id !== config.activity_id) throw new Error('Wrong activity');
  for (const edit of config.edits) {
    let target = next;
    if (edit.facet) {
      target = next.analytic_rubric.find(x => x.facet === edit.facet);
      if (!target) throw new Error('Missing rubric facet');
    } else if (edit.container) target = next[edit.container];
    if (!Object.hasOwn(target, edit.field)) throw new Error('Missing old field');
    target[edit.field] = edit.value;
  }
  next.revision = 'FQ1.1-research-repair1';
  next.previous_activity_sha256 = hash(JSON.stringify(original));
  next.repair_issue_ids = config.issue_ids;
  next.repair_scope = 'research artifact only; no human, student, rights or runtime qualification';
  return next;
}
export function run(root, check=false) {
  const read = p => JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
  const bytes = p => fs.readFileSync(path.join(root,p));
  const local = 'scripts/research/factory-qualification-v11/local/';
  const sourcePath = 'scripts/research/csat-reading/local/v15/content-packages-revision2.json';
  const firstPath = 'scripts/research/factory-qualification/local/research-activity-review-first.json';
  const publicPath = 'docs/research/factory-qualification/data/research-activities.json';
  const old = read(sourcePath), first = read(firstPath), prior = read(publicPath);
  if (hash(bytes(sourcePath)) !== 'ae5c1592fae93aad4c22873e57e313ac9fef7421257344c47fb74040d906d3cf') throw new Error('Original source drift');
  if (hash(bytes(firstPath)) !== 'ffa4c17b109bc898ac8f75b16be9c28638a1c9f6d4e67613516fccef6f1e732e') throw new Error('First review drift');
  const config = read(local+'research-repairs-config.json');
  const activities = config.activities.map(c => {
    const original = old.reused_priority_activities.find(a => a.activity_id===c.activity_id);
    if (!original) throw new Error('Original activity absent');
    const sourceRaw = bytes(original.source.path);
    if (hash(sourceRaw)!==original.source.file_sha256) throw new Error('Bound source file drift');
    const raw = JSON.parse(sourceRaw);
    const row = raw.items.find(x => x.id === original.item_id || x.item_id === original.item_id);
    if (!row || hash(JSON.stringify(row))!==original.source.row_sha256) throw new Error('Bound source row drift');
    const findings = prior.issues.filter(x=>c.issue_ids.includes(x.id));
    if (findings.length!==c.issue_ids.length || !first.activities.some(a=>(a.activity_id??a.content_id)===c.activity_id)) throw new Error('Original findings unbound');
    return {original, repaired:repairActivity(original,c), supplied_source:row, findings,
      author_cases:c.author_cases, novel_verification_cases:c.novel_verification_cases,
      remaining_ambiguity:c.remaining_ambiguity};
  });
  const packet = {version:'FQ1.1-research-repair1',population:'synthetic_not_student',
    original_package:{path:sourcePath,sha256:hash(bytes(sourcePath))},first_review:{path:firstPath,sha256:hash(bytes(firstPath))},activities};
  const blind = {version:packet.version,population:packet.population, reviewer_independence:'Separate AI context; not human expert or learner',
    activities:activities.map(a=>({activity_id:a.repaired.activity_id,item_id:a.repaired.item_id,
      repaired:a.repaired,supplied_source:a.supplied_source,
      cases:[...a.author_cases,...a.novel_verification_cases].map(({expected,components,...c})=>c)}))};
  const encode = x => JSON.stringify(x,null,2)+'\n';
  const out = {[local+'research-repairs-packet.json']:encode(packet),[local+'research-repairs-blind.json']:encode(blind)};
  const summary = {version:packet.version,original_package:packet.original_package,first_review:packet.first_review,
    configuration:{path:local+'research-repairs-config.json',sha256:hash(bytes(local+'research-repairs-config.json'))},
    repair_packet:{path:local+'research-repairs-packet.json',sha256:hash(out[local+'research-repairs-packet.json'])},
    blind_packet:{path:local+'research-repairs-blind.json',sha256:hash(out[local+'research-repairs-blind.json'])},
    activities:activities.map(a=>({activity_id:a.repaired.activity_id,item_id:a.repaired.item_id,task_id:a.repaired.task_id,
      old_revision:a.original.revision??'preserved-v14-revision3',new_revision:a.repaired.revision,
      old_activity_sha256:hash(JSON.stringify(a.original)),new_activity_sha256:hash(JSON.stringify(a.repaired)),
      issue_ids:a.repaired.repair_issue_ids,source:a.repaired.source,
      unchanged_facets:a.original.analytic_rubric.filter(r=>JSON.stringify(r)===JSON.stringify(a.repaired.analytic_rubric.find(n=>n.facet===r.facet))).map(r=>r.facet),
      author_cases:a.author_cases.map(c=>({id:c.id,facet:c.facet,state:c.expected})),
      novel_cases:a.novel_verification_cases.map(c=>({id:c.id,facet:c.facet,state:c.expected})),remaining_ambiguity:a.remaining_ambiguity})),
    counts:{activities:activities.length,issues:activities.reduce((n,a)=>n+a.findings.length,0),
      author_cases:activities.reduce((n,a)=>n+a.author_cases.length,0),novel_cases:activities.reduce((n,a)=>n+a.novel_verification_cases.length,0),
      independent_reviews:0,human_reviews:0,learners:0,public_qualified:0,assessment_qualified:0},
    status:'repair artifacts sealed; independent revalidation pending; original first results unchanged'};
  out['docs/research/factory-qualification-v11/data/research-repairs.json']=encode(summary);
  for (const [p,v] of Object.entries(out)) {
    const absolute = path.join(root,p);
    if (check || fs.existsSync(absolute)) {if (!fs.existsSync(absolute)||fs.readFileSync(absolute,'utf8')!==v) throw new Error('Frozen output drift: '+p);}
    else {fs.mkdirSync(path.dirname(absolute),{recursive:true});fs.writeFileSync(absolute,v);}
  }
  return summary;
}
if (process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(run(path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..'),process.argv.includes('--check')).counts));
}
