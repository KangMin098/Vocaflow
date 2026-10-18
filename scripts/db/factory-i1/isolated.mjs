// scripts/db/factory-i1/isolated.mjs
//
// Factory I1 배포 패키지 격리 시험 — 실제 PostgreSQL 17 임시 클러스터(embedded-postgres). 개발 DB 에 닿지 않는다.
// 시험하는 것은 「배포 절차」다: 원자성 · 가드(차단 조건) · 허용 목록 · 이력 기록 · 적용 직후 검증 · 커밋 뒤 되돌리기.
// 공급 동작(RLS · 권한 · G2 노출 · 동시성)은 supply-i1-concurrency.mjs --via-deploy 가 같은 배포 파일로 시험한다.
//
//   node scripts/db/factory-i1/isolated.mjs --deps <embedded-postgres · pg 설치 폴더> [--out <json>]
// 통과는 「격리 DB 에서 배포 계약이 성립한다」 뿐 — 실제 개발 DB 적용 성공이 아니다.
import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { loadDeps, startCluster, ROOT } from './isolated-db.mjs'
import { CATALOG_SQL, catalogDiff } from './catalog.mjs'
import { buildAll, verifySegments, sha256 } from './build.mjs'
import { applyStage, runVerify, readPreflight, evaluatePreflight, dryRun, localVersions, offlineCheck, targetOf } from './deploy.mjs'
import { STAGES, ALLOW, SOURCES, PROJECT_REF } from './spec.mjs'

const argv = process.argv.slice(2)
const opt = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined }
const results = []
const check = (id, name, ok, detail) => { results.push({ id, name, ok: !!ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${id} ${name}  ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`) }

const R = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8')
const DB1 = R(STAGES.db1.path), DB2 = R(STAGES.db2.path)
const D = 'supabase/deploy/factory-i1/'
const RESTORE1 = R(D + 'db1-restore.sql'), RESTORE2 = R(D + 'db2-restore.sql')
const SRC = (id) => R(`supabase/migrations/${SOURCES[id].file}`)
const SHA1 = sha256(Buffer.from(DB1)), SHA2 = sha256(Buffer.from(DB2))

const snap = async (db) => (await db.query(CATALOG_SQL)).rows.map((r) => `${r.k}:${r.name}=${r.fp}`).sort()
const hist = async (db) => (await db.query(`select version, encode(sha256(convert_to(array_to_string(statements, ''), 'UTF8')), 'hex') sha from supabase_migrations.schema_migrations order by version`)).rows
const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i])
const firstDiff = (a, b) => { const sa = new Set(a), sb = new Set(b); return { onlyBefore: a.filter((x) => !sb.has(x)).slice(0, 3), onlyAfter: b.filter((x) => !sa.has(x)).slice(0, 3) } }
const toRows = (lines) => lines.map((l) => { const [kn, ...rest] = l.split('='); const i = kn.indexOf(':'); return { k: kn.slice(0, i), name: kn.slice(i + 1), fp: rest.join('=') } })
async function tryQuery(db, sql) { try { await db.query(sql); return { ok: true } } catch (e) { return { ok: false, err: e.message } } }
async function withClient(pool, fn) { const c = await pool.connect(); try { return await fn(c) } finally { c.release() } }

/** G2 노출 시드 — 학습자 1 · 문항 2 · G2 시도 1쌍(이 쌍이 B 에서는 'none', S 뒤에는 노출이어야 한다) */
async function seed(db) {
  const me = randomUUID()
  await db.query(`insert into auth.users values ($1)`, [me])
  await db.query(`insert into public.csat_items (id, exam_id, no, stem, passage, choices, answer) values ('S#1','S',1,'s','p1','[1]',1), ('S#2','S',2,'s','p2','[1]',1)`)
  await db.query(`insert into public.learning_task_attempts (user_id, item_ref) values ($1, 'S#1')`, [me])
  return me
}

const deps = await loadDeps(opt('--deps'))
const cluster = await startCluster(deps)
console.log(`server_version=${cluster.version}`)
try {
  // ── A. 오프라인 ──────────────────────────────────────────────
  {
    const off = offlineCheck()
    check('A1', '생성물 = 저장소 파일 · 정본 SHA 4종 일치', off.blocks.length === 0, off.blocks.join(' | ') || `db1=${SHA1.slice(0, 12)} db2=${SHA2.slice(0, 12)}`)
    const seg = [...verifySegments(DB1), ...verifySegments(DB2)]
    check('A2', '세그먼트 C·B·S·P 가 원본 바이트 그대로', seg.length === 4 && seg.every((s) => s.ok) && seg.map((s) => s.id).join('') === 'CBSP', seg)
    const i = DB1.indexOf('\n', DB1.indexOf('-- >>> VF-SEGMENT C')) + 200
    const tampered = DB1.slice(0, i) + (DB1[i] === 'X' ? 'Y' : 'X') + DB1.slice(i + 1)
    check('A3', '세그먼트 1바이트 변조 → 검증 실패', verifySegments(tampered).some((s) => !s.ok), verifySegments(tampered))
    const built = buildAll()
    check('A4', 'MANIFEST 의 전체 SHA = 파일 SHA', JSON.parse(built.manifest).stages.db1.sha256 === SHA1 && JSON.parse(built.manifest).stages.db2.sha256 === SHA2, `${SHA1} · ${SHA2}`)
    check('A5', '연결 대상 검사: 다른 프로젝트 · transaction pooler · 비 localhost 격리 거절',
      !targetOf('postgresql://postgres:x@db.otherref0000000000000.supabase.co:5432/postgres').ok
      && !targetOf(`postgresql://postgres.${PROJECT_REF}:x@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres`).ok
      && targetOf(`postgresql://postgres:x@db.${PROJECT_REF}.supabase.co:5432/postgres`).ok
      && !targetOf('postgresql://postgres:x@10.0.0.5:5432/postgres', { isolated: true }).ok, 'ok')
    const remote = R(D + 'checkpoint/remote-history-20261017.txt').split(/\s+/).filter((v) => /^\d{14}$/.test(v))
    const local = localVersions()
    const d1 = dryRun('db1', remote, local)
    check('A6', 'dry-run DB-1: 러너는 정확히 1개 · 차단 없음 · db push 경로는 차단', d1.blocks.length === 0 && d1.runner_applies.length === 1 && d1.db_push_would_include.count > 1, { push: d1.db_push_would_include.count, newer: d1.db_push_would_include.newer_than_remote_max })
    const d1x = dryRun('db1', remote, [...local, { version: '20261018000000', file: '20261018000000_other_session.sql' }])
    check('A7', 'dry-run: 예상 외 신규 migration → DEPLOY_BLOCKED[unexpected-migration]', d1x.blocks.some((b) => b.includes('[unexpected-migration]')), d1x.blocks)
    const d1c = dryRun('db1', remote, [...local, { version: STAGES.db2.version, file: path.basename(STAGES.db2.path) }])
    check('A8', 'dry-run: DB-2 가 supabase/migrations 에 있으면 → DEPLOY_BLOCKED[db2-coupled]', d1c.blocks.some((b) => b.includes('[db2-coupled]')), d1c.blocks)
    const d2 = dryRun('db2', remote, local)
    check('A9', 'dry-run DB-2: 원격에 DB-1 없으면 → DEPLOY_BLOCKED[db1-first]', d2.blocks.some((b) => b.includes('[db1-first]')), d2.blocks)
    const d1h = dryRun('db1', [...remote, STAGES.db1.version], local)
    check('A10', 'dry-run: 이미 적용된 버전 → DEPLOY_BLOCKED[history]', d1h.blocks.some((b) => b.includes('[history]')), d1h.blocks)
  }

  // ── B. 정상 경로: DB-1 → 검증 → DB-2 → 검증 ─────────────────────
  let base, afterDb1
  {
    const db = await cluster.newDb('happy')
    const me = await seed(db)
    base = await snap(db)
    const pre = await withClient(db, readPreflight)
    const blocks = evaluatePreflight('db1', pre)
    check('B1', 'preflight DB-1 차단 없음(격리 DB · 개발 DB 실측과 같은 helper · 이력)', blocks.length === 0, blocks)
    const pre2 = evaluatePreflight('db2', pre)
    check('B2', 'preflight DB-2 를 DB-1 전에 → DEPLOY_BLOCKED[db1-first]', pre2.some((b) => b.includes('[db1-first]')), pre2)
    const r = await withClient(db, (c) => applyStage(c, 'db1', { text: DB1, sha: SHA1, approvedBy: 'isolated-test' }))
    check('B3', 'DB-1 적용 성공 · 에필로그 VF_DEPLOY_OK', r.ok && r.notices.some((n) => n.startsWith('VF_DEPLOY_OK stage=db1')), r.ok ? r.notices.filter((n) => n.startsWith('VF_')) : r.error)
    afterDb1 = await snap(db)
    const d = catalogDiff(toRows(base), toRows(afterDb1))
    const conOk = d.added.filter((x) => x.startsWith('con:') && !ALLOW.db1.added.includes(x)).every((x) => ALLOW.db1.addedConstraintTables.includes(x.slice(4).split('.')[1]))
    const addedNoCon = d.added.filter((x) => ALLOW.db1.added.includes(x) || !x.startsWith('con:'))
    check('B4', 'DB-1 카탈로그 diff = 허용 목록(추가 · 변경 정확히 · 삭제 0)', same(addedNoCon, [...ALLOW.db1.added].sort()) && conOk && d.removed.length === 0 && same(d.changed, [...ALLOW.db1.changed].sort()),
      { added: d.added.length, changed: d.changed, removed: d.removed.length })
    const h = (await hist(db)).find((x) => x.version === STAGES.db1.version)
    check('B5', '이력 1행 · statements sha256 = 파일 sha256(safe-merge 대조식)', h?.sha === SHA1, h)
    const v = await withClient(db, (c) => runVerify(c, 'db1', SHA1))
    check('B6', '적용 직후 검증 SQL 전부 통과(RLS · 권한 · helper · G2 노출)', v.ok, v.rows.filter((x) => !x.ok).length ? v.rows.filter((x) => !x.ok) : v.rows.find((x) => x.check === 'g2_exposure_none_zero'))
    const exp = (await db.query(`select public.supply_learner_exposure('csat_item','S#1',$1) e`, [me])).rows[0].e
    check('B7', 'G2 시도 쌍이 노출로 판정(none 아님)', exp !== 'none', exp)
    const again = evaluatePreflight('db1', await withClient(db, readPreflight))
    check('B8', 'DB-1 재적용 preflight → DEPLOY_BLOCKED[history]·[target]', again.some((b) => b.includes('[history]')) && again.some((b) => b.includes('[target]')), again.length)
    const snapBefore = await snap(db)
    const rr = await withClient(db, (c) => applyStage(c, 'db1', { text: DB1, sha: SHA1, approvedBy: 'isolated-test' }))
    check('B9', 'DB-1 본문 재실행 → 프롤로그가 거절 · 카탈로그 불변', !rr.ok && /DEPLOY_BLOCKED\[history\]/.test(rr.error.message) && same(snapBefore, await snap(db)), rr.error?.message)
    const pre3 = evaluatePreflight('db2', await withClient(db, readPreflight))
    check('B10', 'preflight DB-2(DB-1 뒤) 차단 없음', pre3.length === 0, pre3)
    const r2 = await withClient(db, (c) => applyStage(c, 'db2', { text: DB2, sha: SHA2, approvedBy: 'isolated-test' }))
    check('B11', 'DB-2 적용 성공 · VF_DEPLOY_OK', r2.ok && r2.notices.some((n) => n.startsWith('VF_DEPLOY_OK stage=db2')), r2.ok ? r2.notices.filter((n) => n.startsWith('VF_')) : r2.error)
    const afterDb2 = await snap(db)
    const d2 = catalogDiff(toRows(afterDb1), toRows(afterDb2))
    check('B12', 'DB-2 카탈로그 diff = 허용 목록', same(d2.added, ALLOW.db2.added) && same(d2.changed, [...ALLOW.db2.changed].sort()) && d2.removed.length === 0, d2)
    const v2 = await withClient(db, (c) => runVerify(c, 'db2', SHA2))
    check('B13', 'DB-2 적용 직후 검증 통과', v2.ok, v2.rows.filter((x) => !x.ok))

    // ── E. 커밋 뒤 되돌리기(같은 DB 를 이어서) ─────────────────────
    const blockedDb1 = await tryQuery(db, RESTORE1)
    check('E1', 'DB-2 가 있는 동안 db1-restore → RESTORE_BLOCKED · 불변', !blockedDb1.ok && /RESTORE_BLOCKED DB-2/.test(blockedDb1.err) && same(afterDb2, await snap(db)), blockedDb1.err)
    const rs2 = await tryQuery(db, RESTORE2)
    const afterRs2 = await snap(db)
    check('E2', 'db2-restore → 카탈로그 = DB-1 직후(바이트 수준 · S 의 안전 수정 보존)', rs2.ok && same(afterRs2, afterDb1), rs2.ok ? firstDiff(afterDb1, afterRs2) : rs2.err)
    check('E3', 'db2-restore 뒤 DB-1 검증 다시 통과 · DB-2 이력 행 제거', (await withClient(db, (c) => runVerify(c, 'db1', SHA1))).ok && !(await hist(db)).some((x) => x.version === STAGES.db2.version), 'ok')
    // 원장 행이 있으면 DB-1 되돌리기 거절(추가 전용 원장 보존)
    const admin = randomUUID()
    await db.query(`insert into auth.users values ($1)`, [admin]); await db.query(`insert into public.admins values ($1, 'admin')`, [admin])
    const seeded = await withClient(db, async (c) => {
      await c.query('begin'); await c.query(`select set_config('request.jwt.claim.sub', $1, true)`, [admin])
      const rev = (await c.query(`select public.supply_artifact_revision('csat_item','S#2') r`)).rows[0].r
      try {
        // supply-i1-concurrency.mjs qualifyApprove 와 같은 인자 형식(규칙 버전 FQn.n · hash 64 hex)
        await c.query(`select public.content_qualification_record('FQ1.1','csat_item','S#2',$1,'r.central_meaning','guided_practice',
          '{"A":{"state":"pass"},"B":{"state":"pass"},"C":{"state":"pass"},"D":{"state":"pass"},"E":{"state":"pass"},"F":{"state":"pass"},"G":{"state":"pass"},"H":{"state":"pass"}}'::jsonb,
          's', $2, null, 'g', $2, '{}', '{e}', 'm', null)`, [rev, 'a'.repeat(64)])
        await c.query('commit'); return 'ok'
      } catch (e) { await c.query('rollback'); return e.message }
    })
    const n = (await db.query('select count(*)::int n from public.content_qualification')).rows[0].n
    check('E4a', '시드: 관리자 RPC 로 자격 원장 1행', seeded === 'ok' && n === 1, seeded)
    const withRows = await snap(db)
    const rs1b = await tryQuery(db, RESTORE1)
    check('E4', '원장에 행이 있으면 db1-restore → RESTORE_BLOCKED · 아무것도 지우지 않음', !rs1b.ok && /RESTORE_BLOCKED/.test(rs1b.err) && same(withRows, await snap(db)), rs1b.err)
  }
  {
    const db = await cluster.newDb('restore1')
    await seed(db)
    const b0 = await snap(db)
    await withClient(db, (c) => applyStage(c, 'db1', { text: DB1, sha: SHA1, approvedBy: 'isolated-test' }))
    const rs1 = await tryQuery(db, RESTORE1)
    const after = await snap(db)
    const d = catalogDiff(toRows(b0), toRows(after))
    check('E5', 'db1-restore(빈 원장) → 적용 전 카탈로그 · 남는 변화는 helper search_path 강화 2개뿐', rs1.ok && d.added.length === 0 && d.removed.length === 0 && same(d.changed, [...ALLOW.db1.changed].sort()), rs1.ok ? d : rs1.err)
    check('E6', 'db1-restore 뒤 DB-1 이력 행 제거 · 재적용 가능', !(await hist(db)).some((x) => x.version === STAGES.db1.version)
      && (await withClient(db, (c) => applyStage(c, 'db1', { text: DB1, sha: SHA1, approvedBy: 'isolated-test' }))).ok, 'ok')
  }

  // ── C. 원자성 ───────────────────────────────────────────────
  {
    const db = await cluster.newDb('atomic')
    await seed(db)
    const b0 = await snap(db), h0 = await hist(db)
    const unchanged = async () => same(b0, await snap(db)) && JSON.stringify(h0) === JSON.stringify(await hist(db))

    const r1 = await withClient(db, (c) => applyStage(c, 'db1', { text: DB1, sha: SHA1, approvedBy: 't', injectFailure: 'before-commit' }))
    check('C1', '이력 기록 뒤 커밋 직전 실패 → 카탈로그 · 이력 전부 원상', !r1.ok && await unchanged(), r1.error?.message)

    const mark = '-- <<< VF-SEGMENT S\n'
    const midS = DB1.replace(mark, 'select 1/0;\n' + mark)
    const r2 = await withClient(db, (c) => applyStage(c, 'db1', { text: midS, sha: sha256(Buffer.from(midS)), approvedBy: 't' }))
    check('C2', 'S 끝에서 실패(C · B 실행 뒤) → 전부 원상', !r2.ok && /division by zero/.test(r2.error.message) && await unchanged(), r2.error?.message)

    const extra = DB1.replace('-- <<< VF-SEGMENT B\n', 'create table public.vf_unapproved (x int);\n-- <<< VF-SEGMENT B\n')
    const r3 = await withClient(db, (c) => applyStage(c, 'db1', { text: extra, sha: sha256(Buffer.from(extra)), approvedBy: 't' }))
    check('C3', '허용 목록 밖 객체 추가 → DEPLOY_BLOCKED[allowlist] · 원상', !r3.ok && /DEPLOY_BLOCKED\[allowlist\]/.test(r3.error.message) && /vf_unapproved/.test(r3.error.message) && await unchanged(), r3.error?.message.slice(0, 160))

    const chg = DB1.replace('-- <<< VF-SEGMENT C\n', `alter function public.csat_source_is_eligible(uuid) set search_path to 'public';\n-- <<< VF-SEGMENT C\n`)
    const r4 = await withClient(db, (c) => applyStage(c, 'db1', { text: chg, sha: sha256(Buffer.from(chg)), approvedBy: 't' }))
    check('C4', '허용 밖 기존 객체 변경 → DEPLOY_BLOCKED[allowlist] · 원상', !r4.ok && /DEPLOY_BLOCKED\[allowlist\]/.test(r4.error.message) && /csat_source_is_eligible/.test(r4.error.message) && await unchanged(), r4.error?.message.slice(0, 160))

    const del = DB1.replace('-- <<< VF-SEGMENT S\n', 'drop table public.ineligible_sources;\n-- <<< VF-SEGMENT S\n')
    const r5 = await withClient(db, (c) => applyStage(c, 'db1', { text: del, sha: sha256(Buffer.from(del)), approvedBy: 't' }))
    check('C5', '기존 객체 삭제 → DEPLOY_BLOCKED[allowlist] · 원상', !r5.ok && /DEPLOY_BLOCKED\[allowlist\]/.test(r5.error.message) && await unchanged(), r5.error?.message.slice(0, 160))

    // 독립 검토 P1: 지문 사각지대였던 변화도 막는가
    const blind = {
      C5a: [`alter function public.csat_source_is_eligible(uuid) owner to authenticated;`, '소유자 변경'],
      C5b: [`create or replace view public.user_profiles as select user_id, role from public.admins where role is not null;`, '뷰 재정의'],
      C5c: [`alter default privileges in schema public revoke truncate on tables from authenticated;`, '기본 권한'],
      C5d: [`comment on table public.csat_items is 'x';`, '주석'],
    }
    for (const [id, [stmt, label]] of Object.entries(blind)) {
      const t = DB1.replace('-- <<< VF-SEGMENT S\n', stmt + '\n-- <<< VF-SEGMENT S\n')
      const r = await withClient(db, (c) => applyStage(c, 'db1', { text: t, sha: sha256(Buffer.from(t)), approvedBy: 't' }))
      check(id, `${label} → DEPLOY_BLOCKED[allowlist] · 원상`, !r.ok && /DEPLOY_BLOCKED\[allowlist\]/.test(r.error.message) && await unchanged(), r.error?.message.slice(0, 140))
    }

    // 단순 질의 1회(BEGIN 없음) — MCP · 대부분의 드라이버가 여러 문을 이렇게 보낸다. PostgreSQL 은 암묵 트랜잭션 하나로 묶는다.
    const r6 = await tryQuery(db, DB1 + '\nselect 1/0;\n')
    check('C6', 'BEGIN 없는 단순 질의 1회 + 끝 실패 → 전부 원상(암묵 트랜잭션)', !r6.ok && await unchanged(), r6.err)

    // 비원자 러너: 프롤로그만 먼저 커밋 → 다음 조각 첫 문(트립와이어)이 C 의 DDL 전에 멈춘다
    const cut1 = DB1.indexOf('do $vf$ begin\n  if coalesce(current_setting(\'vf.i1_deploy_xid\'')
    const p1 = await tryQuery(db, DB1.slice(0, cut1))
    const p2 = await tryQuery(db, DB1.slice(cut1))
    check('C7', '비원자 러너(프롤로그만 커밋) → 프롤로그 커밋 실패(커밋 가드) · 다음 조각 트립와이어 · 원상',
      !p1.ok && /DEPLOY_BLOCKED\[atomicity\]/.test(p1.err) && !p2.ok && /DEPLOY_BLOCKED\[atomicity\]/.test(p2.err) && await unchanged(), { p1: p1.err?.slice(0, 80), p2: p2.err?.slice(0, 80) })

    // 비원자 러너: 「프롤로그 + C」 를 한 조각으로 커밋 → 커밋 가드가 그 조각 전체를 롤백
    const cut2 = DB1.indexOf('-- <<< VF-SEGMENT C\n') + '-- <<< VF-SEGMENT C\n'.length
    const q1 = await tryQuery(db, DB1.slice(0, cut2))
    const q2 = await tryQuery(db, DB1.slice(cut2))
    check('C8', '비원자 러너(프롤로그+C 커밋 시도) → 커밋 가드로 C 롤백 · 다음 조각 트립와이어 · 원상',
      !q1.ok && /DEPLOY_BLOCKED\[atomicity\]/.test(q1.err) && !q2.ok && /DEPLOY_BLOCKED\[atomicity\]/.test(q2.err) && await unchanged(), { q1: q1.err?.slice(0, 80), q2: q2.err?.slice(0, 80) })

    // 비원자 러너: C 이후 조각만(프롤로그 없이) — 첫 트립와이어가 막는다
    const r9 = await tryQuery(db, DB1.slice(DB1.indexOf('-- <<< VF-SEGMENT C')))
    check('C9', '프롤로그 없이 중간부터 실행 → DEPLOY_BLOCKED[atomicity] · 원상', !r9.ok && /DEPLOY_BLOCKED\[atomicity\]/.test(r9.err) && await unchanged(), r9.err?.slice(0, 80))

    // DB-2 를 DB-1 없이: 본문 프롤로그가 거절
    const r10 = await tryQuery(db, DB2)
    check('C10', 'DB-1 없이 DB-2 본문 실행 → DEPLOY_BLOCKED · 원상', !r10.ok && /DEPLOY_BLOCKED\[(history|target)\]/.test(r10.err) && await unchanged(), r10.err?.slice(0, 100))

    // DB-1 이력 본문이 패키지와 다르면 DB-2 거절
    await withClient(db, (c) => applyStage(c, 'db1', { text: DB1, sha: SHA1, approvedBy: 't' }))
    await db.query(`update supabase_migrations.schema_migrations set statements = array['-- tampered'] where version = $1`, [STAGES.db1.version])
    const s1 = await snap(db)
    const r11 = await tryQuery(db, DB2)
    check('C11', 'DB-1 이력 sha 불일치 → DB-2 DEPLOY_BLOCKED[history] · 불변', !r11.ok && /DEPLOY_BLOCKED\[history\]/.test(r11.err) && same(s1, await snap(db)), r11.err?.slice(0, 100))
  }

  // ── D. 대조군: S 없이 B 만 올리면 G2 노출 검증이 실패해야 한다(검증 SQL 이 판별력이 있다) ──────────
  {
    const db = await cluster.newDb('baseline')
    const me = await seed(db)
    await db.query(SRC('C') + SRC('B'))
    const e = (await db.query(`select public.supply_learner_exposure('csat_item','S#1',$1) e`, [me])).rows[0].e
    await db.query(`insert into supabase_migrations.schema_migrations (version, name, statements) values ($1, 'x', $2)`, [STAGES.db1.version, [DB1]])
    const v = await withClient(db, (c) => runVerify(c, 'db1', SHA1))
    const g2 = v.rows.find((x) => x.check === 'g2_exposure_none_zero')
    check('D1', 'B 만(기준선) → G2 쌍 none · 검증 g2_exposure_none_zero=false · helper 검증 false', e === 'none' && g2 && !g2.ok && v.rows.find((x) => x.check === 'helper_search_path')?.ok === false, { exposure: e, g2 })
  }

  // ── F. 기존 생성 롤백 파일(PR #280)의 §0–§2(D3 · P) 결과 = db2-restore 결과 = DB-1 직후 카탈로그 ──────────
  {
    const db = await cluster.newDb('legacyrb')
    await seed(db)
    await withClient(db, (c) => applyStage(c, 'db1', { text: DB1, sha: SHA1, approvedBy: 't' }))
    const s1 = await snap(db)
    await withClient(db, (c) => applyStage(c, 'db2', { text: DB2, sha: SHA2, approvedBy: 't' }))
    const legacy = R('supabase/migrations/_pending_workspace_supply_i1_rollback.sql')
    const pOnly = legacy.slice(0, legacy.indexOf('-- §3')) + 'commit;\n'
    const r = await tryQuery(db, pOnly)
    const s2 = await snap(db)
    // 실측(2026-10-17): 본문 md5 는 S 와 같지만 정의자 2개의 search_path 에서 pg_temp 가 빠진다. 그 둘 말고는 같아야 한다.
    const { onlyBefore, onlyAfter } = (() => { const sa = new Set(s1), sb = new Set(s2); return { onlyBefore: s1.filter((x) => !sb.has(x)), onlyAfter: s2.filter((x) => !sa.has(x)) } })()
    const name = (x) => x.slice(0, x.indexOf('='))
    const md5 = (x) => x.slice(x.indexOf('=') + 1).split('|')[0]
    const cfg = (x) => x.slice(x.indexOf('=') + 1).split('|')[1]
    const pairs = onlyBefore.map((b) => [b, onlyAfter.find((a) => name(a) === name(b))])
    const only2 = onlyBefore.length === 2 && onlyAfter.length === 2 && pairs.every(([b, a]) => a && md5(a) === md5(b) && cfg(b).includes('pg_temp') && !cfg(a).includes('pg_temp'))
      && pairs.map(([b]) => name(b).split('(')[0]).sort().join() === 'fn:public.factory_order_open,fn:public.factory_order_transition'
    check('F1', '기존 롤백 §0–§2 만 실행 → 본문은 S 그대로지만 정의자 2개의 search_path 에서 pg_temp 가 빠진다(DB-2 단독 되돌리기는 db2-restore.sql · E2 바이트 일치)',
      r.ok && only2, r.ok ? pairs.map(([b, a]) => ({ fn: name(b).split('(')[0], before: cfg(b), after: a && cfg(a), bodySame: a && md5(a) === md5(b) })) : r.err)
  }
} finally {
  await cluster.stop()
}

const failed = results.filter((r) => !r.ok)
const summary = { package: 'factory-i1-deploy', kind: 'isolated', server_version: cluster.version, db1_sha256: SHA1, db2_sha256: SHA2,
  sources: Object.fromEntries(Object.entries(SOURCES).map(([k, v]) => [k, v.sha256])), pass: results.length - failed.length, total: results.length, results }
if (opt('--out')) fs.writeFileSync(opt('--out'), JSON.stringify(summary, null, 2) + '\n')
console.log(`\n${summary.pass}/${summary.total} PASS (PostgreSQL ${cluster.version} · 격리 · 배포 절차) db1=${SHA1.slice(0, 12)} db2=${SHA2.slice(0, 12)}`)
process.exit(failed.length ? 1 : 0)
