// scripts/research/csat-reading/v15-source-audit.mjs
// Read-only source inventory. No original, answer values or DB mutations emitted.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
const local='scripts/research/csat-reading/local/v15/';
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const rd=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const snap=rd(local+'source-db-metadata.json');
const main='C:/Users/Administrator/Documents/영어/수능영어기출/수능기출';
const mock='C:/Users/Administrator/Documents/영어/모의평가';
const inspect=(file,visual=false)=>{
 if(!fs.existsSync(file))return {path:file,status:'not_found_in_named_local_path',world_absence_claim:false};
 let text='';try{text=execFileSync(process.execPath,['D:/workspace/Vocaflow/scripts/csat/pdf-cid-text.mjs',file],{encoding:'utf8',stdio:['ignore','pipe','ignore'],maxBuffer:16*1024*1024});}catch{}
 const year=text.match(/(20\d\d)\s*학년도/)?.[1]??null;
 const month=text.match(/(\d{1,2})\s*월\s*모의평가/)?.[1]??null;
 const listening=/듣기\s*평가\s*대본/.test(text);
 const key=!listening&&/정\s*답\s*(표|지)/.test(text);
 const kind=!text?'decode_unresolved':listening?'listening_script':key?'answer_sheet':'question_or_unknown';
 const form=text.match(/(홀수|짝수)\s*형/)?.[1]??null;
 let rows=[];
 if(key){const by=new Map();for(const m of text.matchAll(/(\d{1,2})\s*[①②③④⑤]\s*([23])/g)){const no=Number(m[1]);if(no>=1&&no<=45&&!by.has(no))by.set(no,Number(m[2]));}rows=[...by];}
 return {path:file,sha256:hash(file),bytes:fs.statSync(file).size,header_year:year,header_month:month,header_form:form,kind,table_rows:rows.length||null,table_points:rows.length===45?rows.reduce((a,r)=>a+r[1],0):null,header_inspected:true,visual_inspected:visual,official_download_lineage:'unresolved',answer_values_emitted:false};
};
const exams=snap.rows.map(e=>{
 const isMain=e.kind==='suneung';
 const alternateMain={'2015':'2015_영어영역-홀수.pdf','2016':'2016_영어영역-홀수.pdf','2017':'2017_영어_짝.pdf','2018':'2018_영어_짝.pdf','2019':'2019_영어_짝.pdf','2020':'2020_영어_짝.pdf','2021':'2021_3교시_영어영역_짝.pdf','2022':'2022_영어영역_짝수형.pdf','2025':'2025_영어영역_문제지(짝수형).pdf'};
 const stem=isMain?(alternateMain[e.id]??(e.form?`${e.year}_영어${e.form}-홀수형_문제.pdf`:`${e.year}_영어영역_문제지.pdf`)):`${e.year}${String(e.month).padStart(2,'0')}_영어영역_문제지.pdf`;
 const q=path.join(isMain?main:mock,stem);
 // Do not decode held-out originals. Metadata/file hash only for question pages.
 const question=fs.existsSync(q)?{path:q,sha256:hash(q),status:'file_exists_not_full_content_verified'}:{path:q,status:'not_found_in_named_local_path',world_absence_claim:false};
 const k=isMain?(e.id==='2015'?'2015영어영역_정답표_홀수.pdf':e.form?`${e.year}영어영역_정답표_${e.form}형_홀수형.pdf`:`${e.year}영어영역_정답표.pdf`):`${e.year}${String(e.month).padStart(2,'0')}_영어영역_정답표.pdf`;
 const key=inspect(path.join(isMain?main:mock,k),e.id==='2014A'||e.id==='2014B');
 return {...e,dx_key_status:e.key_rows===45&&e.key_points===100&&e.keyed===45?'db_inventory_complete':'db_inventory_unsupported',question_file:question,named_key_file:key,source_verified_full_exam:false};
});
const out={version:'v1.5',observed_at_utc:'2026-10-14T09:57:58Z',db_query_receipt:{path:local+'source-db-metadata.json',sha256:hash(local+'source-db-metadata.json'),selected_answer_values:false},denominator:'csat_exams organizer=kice; includes invalid M2009 and 2027 mock, not the 2014–2026 research core',counts:{exams:exams.length,body_catalog_exams:exams.filter(e=>e.body_rows).length,db_full_key_exams:exams.filter(e=>e.dx_key_status==='db_inventory_complete').length,db_unsupported_exams:exams.filter(e=>e.dx_key_status==='db_inventory_unsupported').length,diagnosis_ready:exams.filter(e=>e.diagnosis_ready).length},unsupported_ids:exams.filter(e=>e.dx_key_status==='db_inventory_unsupported').map(e=>e.id),exams,official_acquisition:{status:'unresolved',new_official_pdf_downloads:0,attempts:[{url:'https://www.suneung.re.kr/boardCnts/list.do?boardID=1500234&m=0403&s=suneung',result:'official_list_opened_no_historical_attachment_bound'},{url:'https://www.suneung.re.kr/boardCnts/list.do?boardID=1500236&m=0403&s=suneung&searchStr=',result:'official_list_opened_no_historical_attachment_bound'},{url:'https://www.suneung.re.kr/boardCnts/view.do?boardID=1500234&boardSeq=3022261&lev=0',result:'web_tool_inaccessible'},{url:'https://www.suneung.re.kr/boardCnts/list.do?C01=&C02=&C03=&C04=&C05=&C06=&accordionCnts=&boardID=1500234&m=0403&page=11&s=suneung&type=default',result:'web_tool_inaccessible'},{url:'https://www.suneung.re.kr/boardCnts/list.do?C01=&C02=&C03=&C04=&C05=&C06=&accordionCnts=&boardID=1500236&m=0403&page=14&s=suneung&searchStr=&searchType=S&type=default',result:'web_tool_inaccessible'}],inference:'Failed endpoints do not demonstrate source nonexistence.'},prior_v14_status_preserved:{bounded110_key_deferred_pair:'M2206#37~M2306#36',new_original_key_verifications:0},L_contract:{inputs:['same-exam same-form audio with hash/license/lineage','question and visual alternatives','actual response before transcript/hint exposure','audio timestamps replay/speed and hearing/access conditions','transcript separately labeled after-performance support'],observations:['response evidence tied to audio interval','comprehension vs reading-transcript performance','timing/replay behavior'],not_inferable_from_reading:['listening competence','auditory processing speed','audio distractor discrimination']},X_contract:{meaning:'실전 시간 운영 TASK; distinct from old X-* long-passage item codes',inputs:['full exam blueprint and same-form key','all-item response sequence timestamp and revision log','remaining-time checkpoints omission/revisit order','audio playback schedule and test conditions','prior exposure/hints/interruptions accommodations'],observations:['accuracy and pacing jointly','stability across multiple occasions','tradeoff between speed omissions and revision'],not_inferable_from_reading:['whole-test time-management skill','real test stability','student mastery']},prohibited:['DB import or mutation','public original/key redistribution','promote DB metadata complete to official source verified','pool listening-script reading with listening performance'],limitations:['Current DB has no PDF hash/form/official URL fields in csat_dx_answer_key; source is filename only.','Main key filenames not found are local-path failures, not global absence.','2014 regime differs: listening1–22 and reading23–45; do not force current1–17 blueprint.','No new held-out original body read, no human validation, no learner responses.']};
const listeningPath='scripts/csat/data/listening-all.json';
const listening=rd(listeningPath);
out.L_contract={supply_snapshot:{path:listeningPath,sha256:hash(listeningPath),transcript_exam_count:listening.exams.length,transcript_item_count:listening.items.length,main_exam_count:listening.exams.filter(e=>e.origin==='수능').length,mock_exam_count:listening.exams.filter(e=>e.origin==='모평').length,audio_verified_new:0,learner_observations:0},...out.L_contract};
if(out.counts.exams!==30||out.counts.db_full_key_exams!==27)throw Error('Snapshot expectation drift');
const target='docs/research/csat-reading/data/v15/exam-sources.json';
if(process.argv.includes('--check')){const old=rd(target);if(JSON.stringify(old)!==JSON.stringify(out))throw Error('Source inventory drift');console.log('source metadata/hash check passed');}
else{if(fs.existsSync(target))throw Error('Refuse overwrite source audit');fs.writeFileSync(target,JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify(out.counts));}
