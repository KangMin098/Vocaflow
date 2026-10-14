// scripts/research/csat-reading/v13-principle-review.mjs
// Source-bound single-AI manual judgments; automation validates identities, never infers source validity.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const r=p=>JSON.parse(fs.readFileSync(p,'utf8')),sha=x=>createHash('sha256').update(x).digest('hex');
const base='docs/research/csat-reading/',out=base+'data/v13/',local='scripts/research/csat-reading/local/';
const selection=r(out+'principle-selection.json'),comparePath='apps/web/src/lib/csat/compare-v3-data.json',inquiryPath='apps/web/src/lib/csat/inquiry-data.json',compare=r(comparePath),inquiry=r(inquiryPath);
if(selection.selected.length!==1||selection.selected[0].pair_id!=='2014A#36~2014B#37')throw Error('Selection drift');
const pair=compare.pairs[selection.selected[0].pair_id];
if(sha(JSON.stringify(pair.principle))!==selection.selected[0].principle_sha256)throw Error('Principle drift');
const extracted=r(local+'main-20261014/source-extracted-main.json');
const raw=r(local+'snapshots/20261012-r0/db-corpus.json');
const endpoints=['2014A#36','2014B#37'].map(id=>{
 const db=raw.items.find(i=>i.id===id),exam=id.split('#')[0],q=extracted.files.find(f=>f.exam===exam&&!f.filename.includes('정답')),key=extracted.files.find(f=>f.exam===exam&&f.filename.includes('정답'));
 const pdfRoot='C:/Users/Administrator/Documents/영어/수능영어기출/수능기출/';
 for(const f of[q,key])if(sha(fs.readFileSync(pdfRoot+f.filename))!==f.sha256)throw Error('PDF drift');
 const cleaned={id,stem:db.stem,passage:db.passage.replace(/ \(A\) \(B\)$/,'').replace('In Siberia, ______ (B)','In Siberia, (B)'),choices:db.choices,answer:db.answer,pdf:q.filename,pdf_sha256:q.sha256,key_pdf:key.filename,key_sha256:key.sha256,form:exam.at(-1)+'형 홀수형'};
 const target=local+'v13/principle-'+exam+'-input.json';
 const bytes=JSON.stringify(cleaned,null,2)+'\n';if(fs.existsSync(target)&&fs.readFileSync(target,'utf8')!==bytes)throw Error('Private original overwrite');fs.writeFileSync(target,bytes);
 return {id,input_path:target,input_sha256:sha(bytes),question:{filename:q.filename,sha256:q.sha256,page:exam==='2014A'?7:6,form:cleaned.form},key:{filename:key.filename,sha256:key.sha256,page:1,number:db.no,answer:2,visual_row_checked:true},field_complete:{body:true,stem:true,all_five_options:true,blank_and_column_mapping:true,glosses:true},new_visual_review:true,changes:['보기 열 제목을 본문 밖으로 분리',...(exam==='2014B'?['원천 추출의 빈칸 밑줄 중복 제거']:[])],public_inquiry:{units_hash:inquiry.items[id].units_hash,item_sha256:sha(JSON.stringify(inquiry.items[id])),compare_binding:pair.binding[exam==='2014A'?'left':'right']}};
});
const review={version:'v1.3',reviewer:'one AI context, source PDFs and identical-form answer sheets directly inspected; prior v1.2 development evidence exposed; not independent confirmation',selected_pair:pair.left+'~'+pair.right,source:{compare:{path:comparePath,sha256:sha(fs.readFileSync(comparePath))},inquiry:{path:inquiryPath,sha256:sha(fs.readFileSync(inquiryPath))},selection_sha256:sha(fs.readFileSync(out+'principle-selection.json'))},endpoints,source_comparison_status:'both_originals_and_same_form_keys_checked',logic_status:'supported_with_narrowed_conditions',promotion:'R1',original_principle_not_changed:true,
 shared_performance:'두 칸의 결합 후보를 각 위치의 명제 관계와 대조한다. 첫 칸이 참이라고 두 번째 칸까지 적합해지는 것은 아니다.',
 endpoint_paths:[
 {id:'2014A#36',A:{information:'고 자기감시의 사회적 신호 조정 진술→회의 발언 모방 사례',relation:'general_to_instance',allows:[1,2]},B:{information:'고 집단의 타인 인상 관리→저 집단의 사회적 신호 둔감',relation:'contrast',allows:[2,4]},intersection:[2],all5:[{n:1,A:'fits',B:'fails'},{n:2,A:'fits',B:'fits'},{n:3,A:'fails',B:'fails'},{n:4,A:'fails',B:'fits'},{n:5,A:'fails',B:'fails'}],minimum_scope_note:'A는 직전 일반진술/사례, B는 직전의 타인 인상 관리/저 집단 비민감 진술이 대조를 허용한다. 모든 문장 이해량을 이 국소 경로와 동일시하지 않는다.'},
 {id:'2014B#37',A:{information:'자원 자체의 지질학적 형성/고정성→기후가 생산·탐사 접근성을 바꿀 가능성',relation:'qualified_contrast',allows:[1,2]},B:{information:'기후 조건이 접근성에 영향을 준다는 진술→시베리아의 극한 환경 탐사·생산·전달 사례',relation:'general_to_instance',allows:[2,3]},intersection:[2],all5:[{n:1,A:'fits',B:'fails'},{n:2,A:'fits',B:'fits'},{n:3,A:'fails',B:'fits'},{n:4,A:'fails',B:'fails'},{n:5,A:'fails',B:'fails'}],minimum_scope_note:'B는 직전 문장의 자원/접근성 구분을 보존한 채 시베리아 사례를 연결한다. 자원 자체가 영향받지 않음과 접근 가능성이 영향받음은 같은 대상의 사실적 모순이 아니다.'}],
 conditions:['첫 칸 적합성이 실제 의미 관계로 먼저 판정됨','남은 후보의 두 번째 칸이 구별 가능한 다른 관계를 제안함','인접 문장에 필요한 선행 대상과 관계 정보가 실제 포함됨','두 칸의 적합 후보 교집합이 하나임'],
 counterexamples:[{kind:'actual_same_items',why:'2014A의 B만 보면2/4,2014B의 B만 보면2/3이 남는다. 나머지 칸 판정이 전체 정답 독립 판정과 같다는 확대 해석은 반박된다.'},{kind:'minimal_model_not_actual_exam',why:'두 후보가 A도 B도 같은 연결사라면 A 중복만으로 나머지 칸 배제를 보장하지 않는다. 원래 when_applies의 A 중복 조건은 충분조건이 아니다.'},{kind:'scope_boundary',why:'직전 지시어의 선행 명제가 더 앞에 있으면 앞뒤 문장만이라는 정보 예산은 부족해진다. 이것은 논리적 범위 경계이며 새 실기출 재현 수로 세지 않는다.'}],
 narrowed_principle:'각 칸의 의미 관계를 각각 검토할 수 있고 남은 후보의 다른 칸이 구별되는 경우, 두 적합 집합의 교집합으로 결합 후보를 결정할 수 있다.',
 binding_status:'public pair/inquiry complete object hashes recorded; legacy short units/inquiry hashes retained, not rewritten or claimed equivalent to restored source SHA',
 summary:{bounded_denominator:110,metadata_eligible:1,selected:1,both_originals_checked:1,logical_support_narrowed:1,unchanged_full_original_wording_confirmed:0,unresolved_selected:0,unreviewed:109,student_transfer_trials:0,teaching_effect_trials:0},
 limitations:['공식 다운로드 거래·권리 계보 미복원','AI 단일 문맥 개발자료 재검토이며 인간 전문가 검수가 아님','R2공개·R3채점과제·R4학생전이·R5효과 승격 없음']};
const path=out+'principle-review.json';if(fs.existsSync(path))throw Error('No first review overwrite');fs.writeFileSync(path,JSON.stringify(review,null,2)+'\n');
const ledger={version:'v1.3',items:selection.ledger.map(i=>({...i,status:i.pair_id===review.selected_pair?'both_source_checked_narrowed_R1':i.status,reviewed:i.pair_id===review.selected_pair})),summary:review.summary};fs.writeFileSync(out+'principle-ledger.json',JSON.stringify(ledger,null,2)+'\n');console.log(JSON.stringify(review.summary));
