// scripts/research/csat-reading/v14-principle-redact.mjs
import fs from 'node:fs';
import crypto from 'node:crypto';
const base='docs/research/csat-reading/',privateRoot='scripts/research/csat-reading/local/v14/';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const manifestPath=base+'data/v14/principle-redaction.json';
if(fs.existsSync(manifestPath))throw Error('Prepublication redaction already recorded');
fs.mkdirSync(privateRoot,{recursive:true});
const sources=[['data/v14/principle-cross-review.json','principle-cross-first.json'],['V14-CROSS.md','principle-cross-doc-first.md'],['../'.repeat(3)+'scripts/research/csat-reading/v14-principle-build.mjs','principle-builder-first.mjs']];
const receipts=sources.map(([relative,dest])=>{const path=base+relative,bytes=fs.readFileSync(path),saved=privateRoot+dest;if(fs.existsSync(saved)){if(hash(fs.readFileSync(saved))!==hash(bytes))throw Error('Private first copy drift');}else fs.writeFileSync(saved,bytes);return {original_path:path,private_path:saved,first_sha256:hash(bytes)};});
const full=JSON.parse(fs.readFileSync(privateRoot+'principle-cross-first.json','utf8'));
const abstract=[
 {claim:'글 의미의 구별과 범위를 보존한 후보 대응',counter:'소재 대립만으로 판단 방향·강도·대표 범위가 확정되지 않는다.',conditions:'전체 글 대표와 빈칸 삽입 명제의 판단 대상을 분리한다.'},
 {claim:'선행 정보와 후행 관계를 배열 제약으로 사용',counter:'지시 선행성 하나를 만족하는 대안이 남을 수 있다.',conditions:'주어진 문장·블록 라벨·전후 연결과 배열 연산을 정보 예산에 포함한다.'},
 {claim:'본문 내용 성립과 발문 극성을 분리',counter:'불일치 과제의 선택 규칙을 일치 과제에 적용할 수 없다.',conditions:'주체·기간·수량·장소 의미와 정답 탐지/전체 검수를 별도 판정한다.'},
 {claim:'어휘 의미와 완성 명제의 문맥 역할을 분리',counter:'조건을 인과로 승격하거나 상대적 문맥 적합성을 세계 참거짓으로 바꾸면 안 된다.',conditions:'용례 판단과 빈칸 삽입의 수행 및 범위 차이를 유지한다.'}
];
const publicData={version:'v1.4-public-metadata-revision',revision:'prepublication privacy redaction; private first submission preserved by SHA256; not a scientific judgment correction',first_sha256:receipts[0].first_sha256,registration_sha256:full.registration_sha256,method:full.method,cases:full.cases.map((c,n)=>({id:c.id,ids:c.ids,category:c.category,status:c.status,...abstract[n],source_refs:c.source_refs.map(s=>Object.fromEntries(['id','type_id','input_file_sha256','input_object_sha256','source_binding','source_audit','source_audit_file_sha256','new_v14_question_image_reread','new_v14_key_image_reread','new_pdf_download','question_image_sha256','key_image_sha256','read_fields','source_complete','public_rights'].map(k=>[k,s[k]]).concat([['pdf',{sha256:s.pdf.sha256,paper_form:s.pdf.paper_form,pages:s.pdf.pages??[s.pdf.page]}],['key_pdf',{sha256:s.key_pdf.sha256,paper_form:s.key_pdf.paper_form,page:s.key_pdf.page}]]))),verdict:c.verdict,stronger_claim_result:c.stronger_claim_result,student_transfer:c.student_transfer,latent_task_independence:c.latent_task_independence,human_review:false,public_learning_use:false})),summary:full.summary,private_details:'original text targets, option-by-option reasoning, keys and full scope bindings are retained only in ignored local/v14 first record'};
fs.writeFileSync(base+'data/v14/principle-cross-review.json',JSON.stringify(publicData,null,2)+'\n');
fs.writeFileSync(manifestPath,JSON.stringify({version:'v1.4-prepublication-redaction',reason:'User §8 prohibits original passages and answers in public Git.',previous_first_records_edited:false,public_uncommitted_draft_replaced:true,private_first_receipts:receipts,removed_fields:['official_answer_observed','option_analysis','detailed support/targets/information_scope','private file paths and render paths'],redacted_public_sha256:hash(fs.readFileSync(base+'data/v14/principle-cross-review.json')),historical_v13_modified:false},null,2)+'\n');
console.log(JSON.stringify({private_first_preserved:true,redacted_cross_pairs:4,removed_answer_values:8}));
