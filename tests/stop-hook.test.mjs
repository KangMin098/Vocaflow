// tests/stop-hook.test.mjs — Codex Stop 훅 판정 엔진(hooks/codex-review-policy.mjs) 회귀
// 「Stop Hook 리뷰 상한 개선」(2026-10-09) 테스트 1~8 · 12 · 13. git·Codex 는 가짜 deps 로 대체한다(실제 Codex 호출 없음).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { runStopReview, parseFindings, VERDICT } from '../hooks/codex-review-policy.mjs'

const P1 = (file, what) => `[P1] ${file}:12 — ${what} — fix it`
const CLEAN = 'NO_FINDINGS'

/** 시나리오 하네스: reviews 는 Codex 응답 큐(문자열 = 출력, null = 실패) */
function harness({ files = ['src/a.ts'], reviews = [], cfg = {} } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sh-root-'))
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sh-state-'))
  const calls = []
  const logs = []
  const queue = [...reviews]
  const deps = {
    stateDir,
    log: (m) => logs.push(m),
    isAncestor: () => true,
    mergeBase: (a) => a,
    diffNames: () => files,
    diff: (from, head, fs_) => `diff ${from}..${head} ${fs_.join(',')}`,
    review: (fs_, diff, kind) => {
      calls.push({ files: fs_, kind })
      const out = queue.shift()
      if (out === undefined) throw new Error(`예상 밖 Codex 호출(${kind})`)
      return out === null ? { ok: false, why: 'codex 실패(테스트)' } : { ok: true, out }
    },
  }
  let n = 0
  const stop = (head = `c${String(++n).padStart(39, '0')}`) => ({ head, ...runStopReview({ sessionId: 's1', root, head, touched: files }, deps, cfg) })
  const records = () => (fs.existsSync(path.join(stateDir, 'verdicts.jsonl')) ? fs.readFileSync(path.join(stateDir, 'verdicts.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l)) : [])
  stop('base000000000000000000000000000000000000') // 첫 실행 = 기준선
  n = 0
  return { root, stateDir, deps, calls, logs, stop, records, queue }
}

function assertRecordShape(r) {
  for (const k of ['at', 'head', 'range', 'diff_hash', 'kind', 'verdict', 'fix_rounds', 'p0_p1', 'raw_paths', 'tests']) assert.ok(k in r, `판정 기록에 ${k}`)
  assert.ok(Object.values(VERDICT).includes(r.verdict))
}

test('SH1 지적 없음 → 한 번에 REVIEW_PASS · 기준선 이동', () => {
  const h = harness({ reviews: [CLEAN] })
  const r = h.stop()
  assert.equal(r.exit, 0)
  assert.equal(r.verdict, VERDICT.PASS)
  const [rec] = h.records()
  assertRecordShape(rec)
  assert.equal(rec.head, r.head)
  assert.equal(rec.fix_rounds, 0)
  assert.equal(h.stop(r.head).log, 'no new commits', '같은 HEAD 는 다시 리뷰하지 않는다')
})

test('SH2 차단 → 수정 2회 → PASS (수정 사이클만 센다)', () => {
  const h = harness({ reviews: [P1('src/a.ts', 'null deref'), P1('src/a.ts', 'off by one in loop'), CLEAN] })
  assert.equal(h.stop().exit, 2)
  assert.equal(h.stop().exit, 2)
  const r = h.stop()
  assert.equal(r.verdict, VERDICT.PASS)
  assert.deepEqual(h.records().map((x) => x.fix_rounds), [0, 1, 2])
  assert.equal(h.calls.length, 3)
})

test('SH3·4 수정 3회에 닿으면 읽기 전용 최종 리뷰 1회 → REVIEW_PASS', () => {
  const h = harness({ reviews: [P1('src/a.ts', 'a'), P1('src/a.ts', 'bb'), P1('src/a.ts', 'ccc'), CLEAN] })
  for (let i = 0; i < 3; i++) assert.equal(h.stop().exit, 2)
  const r = h.stop()
  assert.equal(r.exit, 0, '최종 리뷰는 수정 루프로 되돌리지 않는다')
  assert.equal(r.verdict, VERDICT.PASS)
  assert.equal(h.calls.at(-1).kind, 'final')
  const rec = h.records().at(-1)
  assert.equal(rec.kind, 'final')
  assert.equal(rec.fix_rounds, 3)
  assert.match(JSON.parse(r.stdout).systemMessage, /REVIEW_PASS/)
})

test('SH5 상한 뒤 최종 리뷰가 P1 → REVIEW_BLOCKED 기록 · exit 0 · 완료 금지 안내', () => {
  const h = harness({ reviews: [P1('src/a.ts', 'a'), P1('src/a.ts', 'bb'), P1('src/a.ts', 'ccc'), P1('src/a.ts', 'still broken')] })
  for (let i = 0; i < 3; i++) h.stop()
  const r = h.stop()
  assert.equal(r.exit, 0)
  assert.equal(r.verdict, VERDICT.BLOCKED)
  assert.match(JSON.parse(r.stdout).systemMessage, /완료·병합·배포 금지/)
  const rec = h.records().at(-1)
  assert.equal(rec.verdict, VERDICT.BLOCKED)
  assert.equal(rec.p0_p1.length, 1)
  assert.ok(rec.p0_p1[0].finding_id && rec.p0_p1[0].affected_file === 'src/a.ts' && rec.p0_p1[0].relevant_line === 12)
  assert.equal(rec.raw_paths.length, 1)
  assert.ok(fs.existsSync(rec.raw_paths[0]), 'Codex 원문이 남는다')
})

test('SH6 리뷰 실패 = REVIEW_UNKNOWN · 기준선 유지 · 다음 Stop 에 재시도 · 수정 횟수 이중 계산 없음', () => {
  const h = harness({ reviews: [P1('src/a.ts', 'a'), null, CLEAN] })
  const c1 = h.stop()
  assert.equal(c1.exit, 2)
  const head2 = 'c2'.padEnd(40, '0')
  const u = h.stop(head2)
  assert.equal(u.exit, 0)
  assert.equal(u.verdict, VERDICT.UNKNOWN)
  assert.match(JSON.parse(u.stdout).systemMessage, /통과가 아니다/)
  const again = h.stop(head2)
  assert.equal(again.verdict, VERDICT.PASS, '같은 head 를 다시 리뷰한다(「이미 리뷰함」 통과 없음)')
  assert.deepEqual(h.records().map((x) => [x.verdict, x.fix_rounds]), [[VERDICT.BLOCKED, 0], [VERDICT.UNKNOWN, 1], [VERDICT.PASS, 1]])
})

test('SH6b 묶음 상한을 넘는 파일 = REVIEW_UNKNOWN(조용한 통과 없음)', () => {
  const files = Array.from({ length: 5 }, (_, i) => `src/f${i}.ts`)
  const h = harness({ files, reviews: [CLEAN, CLEAN], cfg: { filesPerChunk: 2, maxChunks: 2 } })
  const r = h.stop()
  assert.equal(r.verdict, VERDICT.UNKNOWN)
  assert.equal(h.records()[0].files_unreviewed, 1)
})

test('SH7 같은 지적이 반복되면 원인 분석으로 전환', () => {
  const same = P1('src/a.ts', 'race on lock file at line 12')
  const h = harness({ reviews: [same, same.replace(':12', ':40')] })
  const a = h.stop()
  assert.doesNotMatch(a.stderr, /원인 분석/)
  const b = h.stop()
  assert.equal(b.exit, 2)
  assert.match(b.stderr, /같은 결함이 반복됐다/)
  assert.match(b.stderr, /원인 분석/)
  assert.equal(b.log, 'blocked_root_cause')
  const [f1] = parseFindings(same)
  for (const k of ['finding_id', 'severity', 'affected_file', 'relevant_line', 'defect_summary', 'related_goal_id', 'current_work_scope']) assert.ok(k in f1, k)
})

test('SH8 오탐 선언은 현재 작업 범위와 대조 — 범위 밖만 수용, 범위 안은 차단 유지, 근거는 기록', () => {
  const out = P1('lib/other.ts', 'unrelated legacy bug')
  const inScope = P1('src/a.ts', 'real bug here')
  const [fo] = parseFindings(out)
  const [fi] = parseFindings(inScope)
  const h = harness({ reviews: [`${out}\n${inScope}`, `${out}\n${inScope}`] })
  fs.writeFileSync(path.join(h.root, '.codex-review-fp.json'), JSON.stringify([{ finding_id: fo.finding_id, rationale: '이 작업이 만지지 않은 파일' }, { finding_id: fi.finding_id, rationale: '불편함' }]))
  const r = h.stop()
  assert.equal(r.verdict, VERDICT.BLOCKED, '범위 안 P1 은 선언만으로 풀리지 않는다')
  const rec = h.records()[0]
  assert.deepEqual(rec.p0_p1.map((x) => x.finding_id), [fi.finding_id])
  const ev = Object.fromEntries(rec.false_positives.map((x) => [x.finding_id, x]))
  assert.equal(ev[fo.finding_id].accepted, true)
  assert.equal(ev[fi.finding_id].accepted, false)
  assert.match(ev[fi.finding_id].reason, /범위 안/)
  assert.deepEqual(ev[fo.finding_id].scope_files, ['src/a.ts'])
})

test('SH12 최종 리뷰 뒤 새 커밋은 1회 기록·알림만 — exit 2 재귀 없음', () => {
  const h = harness({ reviews: [P1('src/a.ts', 'a'), P1('src/a.ts', 'bb'), P1('src/a.ts', 'ccc'), P1('src/a.ts', 'dddd'), P1('src/a.ts', 'eeeee')] })
  for (let i = 0; i < 3; i++) h.stop()
  assert.equal(h.stop().verdict, VERDICT.BLOCKED)
  const post = h.stop()
  assert.equal(post.exit, 0)
  assert.equal(post.log, 'post_final')
  assert.equal(h.calls.at(-1).kind, 'post_final')
  const callsBefore = h.calls.length
  const same = h.stop(post.head)
  assert.equal(same.exit, 0)
  assert.equal(h.calls.length, callsBefore, '같은 head 는 다시 부르지 않는다')
  assert.ok(h.records().every((x) => x.kind !== 'stop' || x.fix_rounds <= 3))
})

test('SH13 같은 세션 Stop 훅 중복 실행 차단(살아 있는 잠금) · 죽은 잠금은 회수', async () => {
  const h = harness({ reviews: [CLEAN] })
  const holder = spawn(process.execPath, ['-e', 'setTimeout(()=>{},60000)'], { stdio: 'ignore' })
  try {
    fs.mkdirSync(path.join(h.stateDir, 'locks'), { recursive: true })
    fs.writeFileSync(path.join(h.stateDir, 'locks', 's1.lock'), JSON.stringify({ pid: holder.pid }))
    const r = h.stop()
    assert.equal(r.exit, 0)
    assert.equal(r.log, 'concurrent')
    assert.equal(h.calls.length, 0, '겹친 실행은 Codex 를 부르지 않는다')
  } finally {
    holder.kill()
  }
  await new Promise((r) => setTimeout(r, 300))
  const r2 = h.stop()
  assert.equal(r2.verdict, VERDICT.PASS, '죽은 잠금은 회수하고 진행')
})

test('SH7b 실측 형식 — 8.3 URL 인코딩 절대경로를 루트 상대로, 다른 문구의 같은 위치 지적도 반복으로 본다', () => {
  const h = harness({ reviews: [] })
  fs.mkdirSync(path.join(h.root, 'src'), { recursive: true })
  fs.writeFileSync(path.join(h.root, 'src', 'a.ts'), 'x')
  const abs = path.join(h.root, 'src', 'a.ts').replace(/~/g, '%7E')
  const out1 = `- [P1] Include age 18 in the adult threshold — ${abs}:4-4`
  const out2 = `- [P1] Include age 18 in the adult classification — ${abs}:5-5`
  const [f] = parseFindings(out1, { root: h.root })
  assert.equal(f.affected_file, 'src/a.ts')
  assert.equal(f.relevant_line, 4)
  h.queue.push(out1, out2)
  assert.equal(h.stop().exit, 2)
  const b = h.stop()
  assert.equal(b.log, 'blocked_root_cause', '문구가 달라도 같은 파일 근처 같은 등급이면 반복')
})

test('SH6c 판독 불가 출력은 UNKNOWN · codex review 의 깨끗한 문장은 PASS', () => {
  const h = harness({ reviews: ['I could not inspect the changes in this sandbox.'] })
  assert.equal(h.stop().verdict, VERDICT.UNKNOWN)
  const h2 = harness({ reviews: ['The implementation satisfies the goal. No concrete defects or goal drift were identified in the supplied diff.'] })
  assert.equal(h2.stop().verdict, VERDICT.PASS)
})

test('SH12b 최종 리뷰 실패는 얼리지 않는다 — 같은 head 에서 읽기 전용 최종 리뷰 재시도', () => {
  const h = harness({ reviews: [P1('src/a.ts', 'a'), P1('src/a.ts', 'bb'), P1('src/a.ts', 'ccc'), null, CLEAN] })
  for (let i = 0; i < 3; i++) h.stop()
  const u = h.stop()
  assert.equal(u.verdict, VERDICT.UNKNOWN)
  assert.equal(u.exit, 0)
  const again = h.stop(u.head)
  assert.equal(again.exit, 0)
  assert.equal(again.verdict, VERDICT.PASS)
  assert.equal(h.calls.at(-1).kind, 'final')
})

test('SH6d 최종 리뷰 실측 문장 「No remaining P0/P1 defects were confirmed」 = PASS', () => {
  for (const out of ['No remaining P0/P1 defects were confirmed in the scoped files.', 'No remaining P0/P1 defects were identified in the scoped changes.']) {
    const h = harness({ reviews: [out] })
    assert.equal(h.stop().verdict, VERDICT.PASS, out)
  }
})
