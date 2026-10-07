// scripts/csat/__tests__/chart-protocol.test.mjs
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import test from 'node:test'
import {pathToFileURL,fileURLToPath} from 'node:url'
// Optional isolated PostgreSQL. Never connects to a shared DB or reads credentials.
// Set CSAT_PGLITE_MODULE to an installed @electric-sql/pglite entry point.
const modulePath=process.env.CSAT_PGLITE_MODULE
test('chart input, observation and publication protocol in isolated PostgreSQL', {skip:!modulePath}, async () => {
const {PGlite}=await import(pathToFileURL(path.resolve(modulePath)).href)
const root=fileURLToPath(new URL('../../../',import.meta.url))
const pg=await PGlite.create()
try {
await pg.exec(`
create role anon; create role authenticated; create role service_role bypassrls;
create table public.csat_exams(id text primary key,organizer text);
create table public.csat_items(id text primary key,exam_id text,no int,type_id text,stem text,passage text,choices jsonb,answer integer,answers integer[]);
create table public.csat_item_analyses(id uuid primary key default gen_random_uuid(),item_id text references csat_items(id),type_id text,version int default 1,status text default 'in_review',analyst_run text,measured_ability text,design_intent text,answer_locus jsonb,choice_analysis jsonb,solve_procedure jsonb,time_budget_sec int,difficulty jsonb,required_vocab text[],answer_unknown boolean default false,updated_at timestamptz default now(),created_at timestamptz default clock_timestamp());
create table public.csat_analysis_reviews(id uuid primary key default gen_random_uuid(),analysis_id uuid,persona text,verdict text);
create table public.csat_review_followups(id uuid primary key default gen_random_uuid(),item_id text,source text unique,status text,severity text,finding text,date date);
`)
const prior=['20260928141215_csat_hakpyeong_independent_review_gate.sql','20260928141253_csat_hakpyeong_gate_hygiene.sql','20260928143924_csat_hakpyeong_rereview_link.sql','20260928152323_csat_item_units.sql','20260930190349_csat_review_stamp_at_reveal.sql','20261004030416_csat_blind_protocol_holds.sql']
for(const file of prior){
 try{await pg.exec(fs.readFileSync(path.join(root,'supabase/migrations',file),'utf8'))}
 catch(error){throw new Error(`Baseline ${file}: ${error.message}`)}
}
try{await pg.exec(fs.readFileSync(path.join(root,'supabase/migrations/20261004234255_csat_chart_review_assets.sql'),'utf8'))}
catch(error){throw new Error(`Chart migration: ${error.message}`)}
console.log('SQL baseline and pending migration compile in isolated PostgreSQL')
const checks=[]
const query=(sql,params)=>pg.query(sql,params)
const one=async(sql,params)=>(await query(sql,params)).rows[0]
const reject=async(label,sql,params,match)=>{await assert.rejects(()=>query(sql,params),match);checks.push(label)}
await pg.exec(`insert into csat_exams values('H2603G3','edu_office'),('2026','kice');
insert into csat_items values('H2603G3#25','H2603G3',25,'R-CHART','Chart task','A fictional chart passage.','["one","two","three","four","five"]',2,array[2]),
('H2603G3#18','H2603G3',18,'R-BLANK','Blank task','Another fictional source.','["one","two","three","four","five"]',1,array[1]),
('2026#25','2026',25,'R-CHART','KICE task','An unchanged source.','["one","two","three","four","five"]',3,array[3]);`)
const chart='H2603G3#25'
let analysis=(await one("insert into csat_item_analyses(item_id,type_id,analyst_run) values($1,'R-CHART','author-chart-probe') returning id",[chart])).id
const newBoundAnalysis=async(hash,version=3)=>{
 const id=(await one("insert into csat_item_analyses(item_id,type_id,analyst_run,units_version,units_hash) values($1,'R-CHART','author-chart-probe',$2,$3) returning id",[chart,version,hash])).id
 await query('select csat_review_visual_bind_analysis($1,csat_item_input_hash($2))',[id,chart])
 return id
}
const beforeImage=(await one('select created_at from csat_item_analyses where id=$1',[analysis])).created_at
const kiceBefore=(await one("select csat_item_input_hash('2026#25') hash")).hash
const textHash=(await one('select csat_item_text_input_hash($1) hash',[chart])).hash
const png='89504e470d0a1a0a'+Buffer.from('fictional-image-v1').toString('hex')
const asset=(await one("insert into csat_review_visual_assets(item_id,source_input_hash,pdf_sha256,pdf_page,image_png,inspected_by,inspection_note) values($1,$2,$3,4,decode($4,'hex'),'parent-chart-probe','I directly inspected the fictional graph and its complete legend for this test.') returning id,image_sha256",[chart,textHash,'a'.repeat(64),png]))
await query('insert into csat_review_visual_heads(item_id,asset_id) values($1,$2)',[chart,asset.id])
const registration=[chart,textHash,'a'.repeat(64),4,Buffer.from(png,'hex').toString('base64'),'parent-chart-probe','I directly inspected the fictional graph and its complete legend for this test.']
for(let i=0;i<2;i++)assert.equal((await one('select csat_review_visual_register($1,$2,$3,$4,$5,$6,$7) id',registration)).id,asset.id)
assert.equal((await one('select count(*)::int n from csat_review_visual_assets')).n,1);checks.push('atomic registration reuses exact immutable asset')
await reject('registration rejects stale text proof','select csat_review_visual_register($1,$2,$3,$4,$5,$6,$7)',[chart,'0'.repeat(64),...registration.slice(2)],/텍스트 입력/)
assert.notEqual((await one('select csat_item_input_hash($1) hash',[chart])).hash,textHash);checks.push('chart image changes the input hash')
assert.equal((await one("select csat_item_input_hash('2026#25') hash")).hash,kiceBefore);checks.push('KICE input hash unchanged')
await query("insert into csat_item_units(item_id,units_version,input_hash,units,units_hash) values($1,3,csat_item_input_hash($1),'[{\"n\":1}]',$2)",[chart,'b'.repeat(64)])
await query('update csat_item_analyses set units_version=3,units_hash=$2 where id=$1',[analysis,'b'.repeat(64)])
assert.equal((await one('select csat_chart_analysis_ready($1) ready',[analysis])).ready,false);checks.push('analysis predating the chart image is not exported for review')
await reject('pre-image analysis cannot be bound to a later image','select csat_review_visual_bind_analysis($1,csat_item_input_hash($2))',[analysis,chart],/분석 재작성 먼저/)
await reject('review creation refuses a pre-image analysis',"insert into csat_review_runs(item_id,analysis_id,role,persona,agent_run) values($1,$2,'reviewer','setter','chart-stale-analysis-start')",[chart,analysis],/분석 재작성 먼저/)
analysis=await newBoundAnalysis('b'.repeat(64))
await query('select csat_review_visual_bind_analysis($1,csat_item_input_hash($2))',[analysis,chart])
assert.equal((await one('select count(*)::int n from csat_review_visual_analysis_bindings')).n,1);checks.push('binding exact replay creates no extra provenance rows')
await reject('binding cannot be rewritten','update csat_review_visual_analysis_bindings set input_hash=$2 where analysis_id=$1',[analysis,'e'.repeat(64)],/불변/)
await reject('binding cannot be deleted','delete from csat_review_visual_analysis_bindings where analysis_id=$1',[analysis],/불변/)
await reject('non-chart asset rejected',"insert into csat_review_visual_assets(item_id,source_input_hash,pdf_sha256,pdf_page,image_png,inspected_by,inspection_note) values('H2603G3#18',csat_item_text_input_hash('H2603G3#18'),$1,4,decode($2,'hex'),'parent-chart-probe','I directly inspected the fictional graph and its complete legend for this test.')",['a'.repeat(64),png],/학평 도표/)
await reject('asset cannot be overwritten','update csat_review_visual_assets set pdf_page=5 where id=$1',[asset.id],/불변/)
await reject('asset cannot be deleted','delete from csat_review_visual_assets where id=$1',[asset.id],/불변/)
await reject('image head cannot be deleted','delete from csat_review_visual_heads where item_id=$1',[chart],/삭제/)
await reject('publication requires three actual reviewers',"update csat_item_analyses set status='published' where id=$1",[analysis],/독립 검수 3인/)
const observation='The image shows three fictional generations with distinct bars; I compared the legend and each marked value before solving.'
const runs=[]
for(const persona of ['setter','analyst','tutor']){
 const run=(await one("insert into csat_review_runs(item_id,analysis_id,role,persona,agent_run) values($1,$2,'reviewer',$3,$4) returning id",[chart,analysis,persona,'chart-probe-'+persona])).id
 runs.push(run)
 if(persona==='setter')await reject('observation before receiving image rejected','select csat_review_visual_ack($1,$2,$3,$4)',[run,asset.id,asset.image_sha256,observation],/먼저 받아/)
 const visual=await one('select * from csat_review_visual_input($1)',[run]);assert.equal(visual.asset_id,asset.id)
 if(persona==='setter'){
  assert.equal(visual.item.passage,'A fictional chart passage.');assert.deepEqual(visual.item.choices,['one','two','three','four','five']);assert.equal(visual.units_hash,'b'.repeat(64));assert.equal(visual.units.units_version,3);checks.push('text choices units and image are delivered as one bound snapshot')
  assert.equal(Object.hasOwn(visual.item,'answer'),false);assert.equal(Object.hasOwn(visual.item,'analysis'),false);checks.push('bound visual snapshot never reveals the answer or analysis')
 }
 assert.equal(Buffer.from(visual.image_base64.replace(/\s/g,''),'base64').toString('hex'),png)
 if(persona==='setter'){
  await reject('solve without pre-solve image observation rejected','select csat_review_solve($1,2::smallint,$2)',[run,'A sufficiently detailed fictional solve note about the chart.'],/관찰 근거/)
  await reject('wrong image hash rejected','select csat_review_visual_ack($1,$2,$3,$4)',[run,asset.id,'c'.repeat(64),observation],/해시/)
 }
 await query('select csat_review_visual_ack($1,$2,$3,$4)',[run,asset.id,asset.image_sha256,observation])
 await query('select csat_review_visual_ack($1,$2,$3,$4)',[run,asset.id,asset.image_sha256,observation])
 if(persona==='setter'){
  await reject('observation cannot change','select csat_review_visual_ack($1,$2,$3,$4)',[run,asset.id,asset.image_sha256,observation+' changed'],/기존/)
  await reject('damaged solve note rejected','select csat_review_solve($1,2::smallint,$2)',[run,'A long enough corrupted note with a C1 control \u0080.'],/읽을 수/)
 }
 await query('select csat_review_solve($1,2::smallint,$2)',[run,'I compared the fictional bars with each choice and selected the second statement.'])
 if(persona==='setter')await reject('new image input after solve rejected','select * from csat_review_visual_input($1)',[run],/풀이 전에/)
 await query('select * from csat_review_reveal($1)',[run])
 await query("insert into csat_independent_reviews(analysis_id,review_run_id,persona,verdict,findings) values($1,$2,$3,'pass','[]')",[analysis,run,persona])
 if(persona==='analyst')await reject('two approvals cannot publish',"update csat_item_analyses set status='published' where id=$1",[analysis],/독립 검수 3인/)
}
await query('update csat_item_analyses set created_at=$2 where id=$1',[analysis,beforeImage])
await reject('three observed-image passes cannot publish a pre-image analysis',"update csat_item_analyses set status='published' where id=$1",[analysis],/分析|분석 재작성 먼저/)
await query('update csat_item_analyses set created_at=clock_timestamp() where id=$1',[analysis])
assert.equal((await one('select csat_chart_analysis_ready($1) ready',[analysis])).ready,true);checks.push('post-image analysis with current units is ready for review')
await query("update csat_item_analyses set status='published' where id=$1",[analysis]);checks.push('three independent observed-image approvals publish')
await reject('receipt cannot be overwritten','update csat_review_visual_receipts set observation=$2 where run_id=$1',[runs[0],observation+' altered'],/불변/)
await reject('receipt cannot be deleted','delete from csat_review_visual_receipts where run_id=$1',[runs[0]],/불변/)
const rereview=(await one("insert into csat_review_runs(item_id,analysis_id,role,persona,agent_run,kind,parent_run_id) values($1,$2,'reviewer','setter','chart-rereview-probe','rereview',$3) returning id",[chart,analysis,runs[0]])).id
await query('select * from csat_review_reveal($1)',[rereview]);checks.push('valid unchanged image parent supports rereview')
await reject('rereview cannot create a new blind observation','select csat_review_visual_ack($1,$2,$3,$4)',[rereview,asset.id,asset.image_sha256,observation],/풀이 확정/)
const fresh=(await one("insert into csat_review_runs(item_id,analysis_id,role,persona,agent_run) values($1,$2,'reviewer','setter','chart-old-image-probe') returning id",[chart,analysis])).id
await query('select * from csat_review_visual_input($1)',[fresh])
await query('select csat_review_visual_ack($1,$2,$3,$4)',[fresh,asset.id,asset.image_sha256,observation])
const revised=(await one("insert into csat_review_visual_assets(item_id,source_input_hash,pdf_sha256,pdf_page,image_png,inspected_by,inspection_note) values($1,$2,$3,4,decode($4,'hex'),'parent-chart-probe','I directly inspected the fictional graph and its complete legend for this test.') returning id",[chart,textHash,'a'.repeat(64),png+'00'])).id
await query('update csat_review_visual_heads set asset_id=$2 where item_id=$1',[chart,revised])
assert.equal((await one('select status from csat_item_analyses where id=$1',[analysis])).status,'in_review');checks.push('image revision immediately holds publication')
await reject('a lost old registration response cannot revert a newer image','select csat_review_visual_register($1,$2,$3,$4,$5,$6,$7)',registration,/충돌/)
assert.equal((await one('select asset_id from csat_review_visual_heads where item_id=$1',[chart])).asset_id,revised)
await reject('new registration cannot overwrite an unacknowledged current head','select csat_review_visual_register($1,$2,$3,$4,$5,$6,$7,$8)',[...registration.slice(0,6),'I directly inspected this new fictional image but have not bound the current head.',null],/충돌/)
await reject('a delivered old image cannot be silently replaced in the same blind run','select * from csat_review_visual_input($1)',[fresh],/바뀌었다/)
await reject('old image observation cannot solve','select csat_review_solve($1,2::smallint,$2)',[fresh,'A sufficiently detailed fictional solve note about the old chart.'],/관찰 근거/)
assert.equal((await one('select csat_blind_protocol_valid($1) valid',[runs[0]])).valid,false);checks.push('image revision invalidates former blind parent')
await reject('old-image parent cannot be reused',"insert into csat_review_runs(item_id,analysis_id,role,persona,agent_run,kind,parent_run_id) values($1,$2,'reviewer','setter','chart-old-parent-probe','rereview',$3)",[chart,analysis,runs[0]],/유효하지|분석 재작성 먼저/)
await reject('old approvals cannot republish',"update csat_item_analyses set status='published' where id=$1",[analysis],/근거 단위|독립 검수|분석 재작성 먼저/)
await query('update csat_review_visual_heads set asset_id=$2 where item_id=$1',[chart,asset.id])
assert.equal((await one('select csat_current_units_hash($1) hash',[chart])).hash,null);checks.push('image A-B-A cannot revive the old unit snapshot')
assert.equal((await one('select csat_blind_protocol_valid($1) valid',[runs[0]])).valid,false);checks.push('returning to an old image never revives former approvals')
await reject('returning to an old image cannot reuse the old delivery','select * from csat_review_visual_input($1)',[fresh],/바뀌었다/)
await reject('returning to an old image cannot reuse the old observation','select csat_review_visual_ack($1,$2,$3,$4)',[fresh,asset.id,asset.image_sha256,observation],/기존 도표/)
await query("insert into csat_item_units(item_id,units_version,input_hash,units,units_hash) values($1,3,csat_item_input_hash($1),'[{\"n\":1}]',$2)",[chart,'b'.repeat(64)])
assert.equal((await one('select csat_chart_analysis_ready($1) ready',[analysis])).ready,false);checks.push('identical boundary hash cannot revive an old image analysis binding')
await reject('analysis cannot be rebound after image A-B-A','select csat_review_visual_bind_analysis($1,csat_item_input_hash($2))',[analysis,chart],/분석 재작성 먼저|바꾸지 않는다/)
analysis=await newBoundAnalysis('b'.repeat(64))
const textFresh=(await one("insert into csat_review_runs(item_id,analysis_id,role,persona,agent_run) values($1,$2,'reviewer','setter','chart-text-revision-probe') returning id",[chart,analysis])).id
await query('select * from csat_review_visual_input($1)',[textFresh])
await query('select csat_review_visual_ack($1,$2,$3,$4)',[textFresh,asset.id,asset.image_sha256,observation])
await query('select csat_review_solve($1,2::smallint,$2)',[textFresh,'I directly checked the fictional image before making this independent new solution.'])
assert.equal((await one('select csat_blind_protocol_valid($1) valid',[textFresh])).valid,true)
await query("update csat_items set passage='A changed fictional passage.' where id=$1",[chart])
assert.equal((await one('select csat_current_chart_asset($1) id',[chart])).id,null);checks.push('text revision invalidates the image binding')
await query("update csat_items set passage='A fictional chart passage.' where id=$1",[chart])
assert.equal((await one('select csat_blind_protocol_valid($1) valid',[textFresh])).valid,false);checks.push('text A-B-A never revives earlier chart evidence')
assert.equal((await one('select csat_current_units_hash($1) hash',[chart])).hash,null);checks.push('text A-B-A cannot revive the old unit snapshot')
await query("insert into csat_item_units(item_id,units_version,input_hash,units,units_hash) values($1,3,csat_item_input_hash($1),'[{\"n\":1}]',$2)",[chart,'b'.repeat(64)])
analysis=await newBoundAnalysis('b'.repeat(64))
const startA=(await one("insert into csat_review_runs(item_id,analysis_id,role,persona,agent_run) values($1,$2,'reviewer','setter','chart-start-A-deliver-B') returning id",[chart,analysis])).id
await query("update csat_items set passage='A changed fictional passage.' where id=$1",[chart])
const sourceB=(await one('select csat_item_text_input_hash($1) hash',[chart])).hash
const imageB=(await one('select csat_review_visual_register($1,$2,$3,$4,$5,$6,$7,$8) id',[chart,sourceB,'a'.repeat(64),4,Buffer.from(png+'bb','hex').toString('base64'),'parent-new-text-probe','I directly checked this fictional new-text chart and every legend and number.',asset.id])).id
await query("insert into csat_item_units(item_id,units_version,input_hash,units,units_hash) values($1,3,csat_item_input_hash($1),'[{\"n\":1,\"text\":\"A changed fictional passage.\"}]',$2)",[chart,'c'.repeat(64)])
const deliveredB=await one('select * from csat_review_visual_input($1)',[startA]);assert.equal(deliveredB.item.passage,'A changed fictional passage.');assert.equal(deliveredB.asset_id,imageB);assert.equal(deliveredB.input_hash,(await one('select csat_item_input_hash($1) hash',[chart])).hash);checks.push('a start on old text receives the complete new text with its new image')
await query("insert into csat_item_units(item_id,units_version,input_hash,units,units_hash) values($1,4,csat_item_input_hash($1),'[{\"n\":1}]',$2)",[chart,'d'.repeat(64)])
await reject('changed units after image delivery cannot become a new solve observation','select csat_review_visual_ack($1,$2,$3,$4)',[startA,imageB,deliveredB.image_sha256,observation],/먼저 받아/)
await pg.exec('set role anon')
await reject('anonymous cannot read private image bytes','select image_png from csat_review_visual_assets',[],/permission denied/)
await pg.exec('reset role')
await pg.exec('set role authenticated')
await reject('authenticated cannot use service visual input RPC','select * from csat_review_visual_input($1)',[fresh],/permission denied/)
await pg.exec('reset role')
await pg.exec('set role service_role')
await reject('service role cannot bypass the image-hash acknowledgement RPC','insert into csat_review_visual_receipts(run_id,asset_id,input_hash,observation) values($1,$2,csat_item_input_hash($3),$4)',[fresh,asset.id,chart,observation],/permission denied/)
await reject('service role cannot bypass atomic registration by updating the head','update csat_review_visual_heads set asset_id=$2 where item_id=$1',[chart,revised],/permission denied/)
await reject('service role cannot truncate immutable assets','truncate csat_review_visual_assets',[],/permission denied/)
await reject('service role cannot forge analysis provenance','insert into csat_review_visual_analysis_bindings(analysis_id,asset_id,input_hash,units_hash,analyst_run) values($1,$2,$3,$4,$5)',[analysis,asset.id,'a'.repeat(64),'b'.repeat(64),'forged-author'],/permission denied/)
await pg.exec('reset role')
const result={scope:'isolated PostgreSQL only',checks:checks.length,passed:checks,production_changes:0}
assert.equal(result.checks,56)
console.log(JSON.stringify(result))
}finally{await pg.close()}
})
