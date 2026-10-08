// docs/csat-learner/g2-draft/review-da627938/probe.mjs
// G2 통합 SQL da627938 심사 표적 프로브(메모리 Postgres). 하네스(../pglite-harness.mjs)의 STUB 을 읽는다 — 같은 폴더에 harness.mjs 로 두고 실행.
// G2 통합 SQL(da627938) 심사용 표적 프로브 — 메모리 Postgres. 공유 DB 무접촉.
import fs from 'node:fs'
import { PGlite } from '@electric-sql/pglite'

const SQL = fs.readFileSync(process.argv[2], 'utf8')
const H = fs.readFileSync(new URL('./harness.mjs', import.meta.url), 'utf8')
const OLD68 = H.match(/const OLD68 = `([^`]+)`/)[1]
const STUB = H.match(/const STUB = `([\s\S]+?)`\n/)[1].replace('${OLD68}', OLD68)
const out = []
const log = (k, v) => {
  out.push({ k, v })
  console.log(`${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
}
const A = '11111111-1111-1111-1111-111111111111'
const u = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`
const db = new PGlite()
await db.exec(STUB)
await db.exec(`insert into auth.users values ('${A}');`)
await db.exec(SQL)
const one = async (q, p) => (await db.query(q, p)).rows[0]
const apply = (mut, sess, stage, help, at, extra = {}) =>
  one(
    'select * from public.learning_session_apply(p_user=>$1,p_mutation=>$2,p_client_session_id=>$3,p_activity=>$4,p_phase=>$5,p_item_ref=>$6,p_stage=>$7,p_step=>0,p_steps=>14,p_help_level=>$8,p_at=>$9,p_explanation_viewed_at=>$10,p_trial_id=>$11)',
    [A, mut, sess, 'theater', extra.phase ?? 'post', extra.item ?? '2026#34', stage, help, at, extra.explain ?? null, extra.trial ?? null],
  )
const record = (mut, sid, at, extra = {}) =>
  one(
    'select * from public.learning_attempt_record(p_user=>$1,p_mutation=>$2,p_session_id=>$3,p_task_key=>$4,p_activity=>null,p_phase=>null,p_help_level=>null,p_item_ref=>null,p_content_hash=>$5,p_response=>$6,p_is_correct=>true,p_sec=>10,p_synthetic=>false,p_trial_id=>$7,p_answered_at=>$8)',
    [A, mut, sid, 'claim-support', 'h', '{}', extra.trial ?? null, at],
  )

// (a) M5a — 늦게 도착한 「더 이른 독립 공개」가 viewed_first 세션을 independent 로 뒤집는가 · 그 뒤의 판단이 독립 첫 시도가 되는가
//     시나리오: 기기 B(온라인) t2 에 「해설 먼저」 공개 → t3 판단 기록. 같은 세션 id 를 가진 기기 A(오프라인)가 t1(<t2) 「독립」 공개를 늦게 올린다.
const S1 = u(100)
let r = await apply(u(1), S1, 'revealed', 'viewed_first', '2026-10-08T06:02:00Z')
await record(u(2), r.session_id, '2026-10-08T06:03:00Z')
let f = await one("select help_level, after_viewed_first from public.learning_first_attempts where item_ref='2026#34'")
log('(a) 늦은 동기화 전 첫 시도', f)
await apply(u(3), S1, 'revealed', 'independent', '2026-10-08T06:01:00Z')
f = await one("select help_level, after_viewed_first from public.learning_first_attempts where item_ref='2026#34'")
const col = await one("select help_level from public.learning_task_attempts where item_ref='2026#34'")
log('(a) 늦은 「더 이른 독립」 공개 뒤 첫 시도', f)
log('(a) 시도 행에 저장된 help_level(기록 시점 값)', col.help_level)

// (b) B8 연결 — 공개와 같은 mutation id(stableUuid(session,'reveal'))로 해설 시각을 보내면 저장되는가
const S2 = u(200)
const REVEAL = u(10)
r = await apply(REVEAL, S2, 'revealed', 'independent', '2026-10-08T07:00:00Z', { item: '2026#35' })
const b1 = await apply(REVEAL, S2, 'revealed', 'independent', '2026-10-08T07:00:00Z', { item: '2026#35', explain: '2026-10-08T07:05:00Z' })
const ev1 = await one('select explanation_viewed_at from public.learning_sessions where id=$1', [r.session_id])
log('(b) 공개 id 재사용 + 해설 시각 → outcome', b1.outcome)
log('(b) 저장된 해설 시각', ev1.explanation_viewed_at)
const b2 = await apply(u(11), S2, 'revealed', 'independent', '2026-10-08T07:05:00Z', { item: '2026#35', explain: '2026-10-08T07:05:00Z' })
const ev2 = await one('select explanation_viewed_at, help_level from public.learning_sessions where id=$1', [r.session_id])
log('(b) 새 id 로 해설 시각 → outcome', b2.outcome)
log('(b) 저장된 해설 시각 · 도움 수준', ev2)

// (c) 분석 완료 표본 세션에 늦은 해설 시각 → 예외 · 원장 롤백 → 재시도도 같은 예외(영구 실패)인가
const T = '33333333-3333-3333-3333-333333333333'
await db.query("insert into public.knowledge_trials (id, status, synthetic) values ($1, 'running', false)", [T])
const S3 = u(300)
r = await apply(u(20), S3, 'revealed', 'independent', '2026-10-08T08:00:00Z', { item: '2026#36', trial: T })
await record(u(21), r.session_id, '2026-10-08T08:01:00Z', { trial: T })
await db.query("update public.knowledge_trials set status='analyzed' where id=$1", [T]).catch((e) => log('(c) analyzed 전환(최소 표본 1 · 사전 없음 → 거부 예상)', e.message.slice(0, 60)))
await db.query('alter table public.knowledge_trials disable trigger knowledge_trials_analyzed_guard')
await db.query("update public.knowledge_trials set status='analyzed' where id=$1", [T])
await db.query('alter table public.knowledge_trials enable trigger knowledge_trials_analyzed_guard')
for (const n of [1, 2]) {
  try {
    await apply(u(22), S3, 'revealed', 'independent', '2026-10-08T08:00:00Z', { item: '2026#36', explain: '2026-10-08T08:05:00Z' })
    log(`(c) 늦은 해설 시각 ${n}회차`, 'applied')
  } catch (e) {
    log(`(c) 늦은 해설 시각 ${n}회차`, `예외: ${e.message.slice(0, 50)}`)
  }
}
log('(c) 원장에 남은 그 mutation', (await one('select count(*)::int n from public.learning_mutations where client_mutation_id=$1', [u(22)])).n)

// (d) 지금의 direct 경로 행(세션 없음 · help_level 열 NULL)은 효과 게이트에서 독립으로 세지 않는가
await db.query("insert into public.learning_task_attempts (user_id, task_key, phase, item_ref, response) values ($1,'claim-support','pre','2026#37', '{\"help_level\":\"independent\"}')", [A])
log('(d) direct 행의 실효 help_level(첫 시도 뷰)', (await one("select help_level from public.learning_first_attempts where item_ref='2026#37'")).help_level)

fs.writeFileSync(process.argv[3], JSON.stringify(out, null, 2))
