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
  for (const out of ['No remaining P0/P1 defects were confirmed in the scoped files.', 'No remaining P0/P1 defects were identified in the scoped changes.', 'No remaining P0 or P1 defects were identified in the scoped changes.']) {
    const h = harness({ reviews: [out] })
    assert.equal(h.stop().verdict, VERDICT.PASS, out)
  }
})

// ── RP-2026-10-10.1 (Codex 리뷰 최적화) ────────────────────────────────────
// 파일 diff 가 head 와 무관하게 같도록 바꾼 하네스 — 같은 내용이면 재사용이 걸린다
function stableHarness(opts = {}) {
  const h = harness(opts)
  h.deps.diff = (from, head, fs_) => fs_.map((f) => `diff --git a/${f} b/${f}\n+${h.content?.[f] ?? 'v1'}`).join('\n')
  h.content = {}
  // 기준 커밋 고정(재사용 키에 from 이 들어간다) — h.base 를 바꾸면 다른 기준
  h.base = 'fixedbase0000000000000000000000000000000'
  h.deps.isAncestor = () => false
  h.deps.mergeBase = () => h.base
  return h
}

test('RP1 문장형 깨끗한 답(실측 판독 실패 형식)을 PASS 로 읽는다 · P 표지가 섞이면 지적으로 읽는다', () => {
  for (const out of ['No concrete defects or goal drift were found in the three scoped test changes.', 'No confirmed defects or contradictions of the stated goal were found in the scoped changes.', 'No concrete, actionable defects were identified in the scoped files.']) {
    const h = harness({ reviews: [out] })
    assert.equal(h.stop().verdict, VERDICT.PASS, out)
  }
  const h = harness({ reviews: [`No other defects were found.\n${P1('src/a.ts', 'null deref')}`] })
  assert.equal(h.stop().verdict, VERDICT.BLOCKED)
  const h2 = harness({ reviews: ['I could not see the diff.'] })
  assert.equal(h2.stop().verdict, VERDICT.UNKNOWN, '깨끗하다는 말이 없으면 여전히 판독 불가')
})

test('RP2 같은 파일 diff 를 이미 깨끗하게 본 기록이 있으면 Codex 를 다시 부르지 않는다 · 기록에 정책·재사용 근거', () => {
  const h = stableHarness({ files: ['src/a.ts', 'src/b.ts'], reviews: [CLEAN, CLEAN] })
  assert.equal(h.stop().verdict, VERDICT.PASS)
  assert.equal(h.calls.length, 1)
  // 다른 커밋 · 같은 파일 내용(예: 리베이스 · 다른 세션) → 호출 없이 PASS
  const r = h.stop()
  assert.equal(r.verdict, VERDICT.PASS)
  assert.equal(h.calls.length, 1, '재사용 — Codex 호출 없음')
  const rec = h.records().at(-1)
  assert.equal(rec.policy_version, 'RP-2026-10-10.1')
  assert.equal(rec.codex_calls, 0)
  assert.deepEqual(rec.files_reused.map((x) => x.file).sort(), ['src/a.ts', 'src/b.ts'])
  assert.deepEqual(rec.files.sort(), ['src/a.ts', 'src/b.ts'], 'reviewGate 의 covers 가 재사용 파일도 덮인 것으로 본다')
  // 범위 안 다른 파일이 바뀌면(주변 변경) 범위 해시가 달라져 전부 다시 본다 — 「범위 동일」일 때만 재사용
  h.content['src/b.ts'] = 'v2'
  h.stop()
  assert.deepEqual(h.calls.at(-1).files.sort(), ['src/a.ts', 'src/b.ts'])
})

test('RP3 P0/P1 이 나온 묶음은 재사용 장부에 남기지 않는다 — 고친 뒤 다시 본다', () => {
  const h = stableHarness({ files: ['src/a.ts'], reviews: [P1('src/a.ts', 'bad'), CLEAN] })
  assert.equal(h.stop().verdict, VERDICT.BLOCKED)
  assert.equal(h.stop().verdict, VERDICT.PASS, '같은 내용이어도 다시 리뷰한다(장부에 없다)')
  assert.equal(h.calls.length, 2)
})

test('RP4 낮은 effort 의 깨끗함은 높은 effort 요구를 대체하지 않는다', () => {
  const h = stableHarness({ files: ['src/a.ts'], reviews: [CLEAN, CLEAN] })
  h.deps.effort = 'low'
  h.stop()
  h.deps.effort = 'high'
  h.stop()
  assert.equal(h.calls.length, 2, 'low 기록으로 high 리뷰를 건너뛰지 않는다')
  h.deps.effort = 'low'
  h.stop()
  assert.equal(h.calls.length, 2, 'high 기록은 low 요구를 덮는다')
})

test('RP5 목적 파일이 바뀌면 이전 깨끗함을 쓰지 않는다', () => {
  const h = stableHarness({ files: ['src/a.ts'], reviews: [CLEAN, CLEAN] })
  h.stop()
  fs.writeFileSync(path.join(h.root, '.agent-goal.md'), '# 목적\n바뀐 목적\n')
  h.stop()
  assert.equal(h.calls.length, 2)
})

test('RP6 UNKNOWN 재시도는 실패한 묶음만 다시 부른다', () => {
  const files = Array.from({ length: 10 }, (_, i) => `src/f${i}.ts`)
  const h = stableHarness({ files, reviews: [CLEAN, null, CLEAN] })
  assert.equal(h.stop().verdict, VERDICT.UNKNOWN)
  assert.equal(h.calls.length, 2)
  const r = h.stop()
  assert.equal(r.verdict, VERDICT.PASS)
  assert.equal(h.calls.length, 3)
  assert.deepEqual(h.calls.at(-1).files, files.slice(8), '성공한 첫 묶음(8파일)은 재사용')
})

test('RP7 사용량 한도: 걸린 묶음만 같은 실행 안에서 한 번 다시 부른다 · 다시 실패하면 UNKNOWN(PASS 아님) · v1 사이클은 재시도 없음', () => {
  const files = Array.from({ length: 10 }, (_, i) => `src/f${i}.ts`)
  const LIMIT = { ok: false, why: 'Codex 사용량 한도 — 한도가 풀린 뒤 다시' }
  const mk = (q) => {
    const h = stableHarness({ files, reviews: [] })
    const slept = []
    h.deps.sleep = (ms) => slept.push(ms)
    h.deps.review = (fs_, d, kind) => {
      h.calls.push({ files: fs_, kind })
      return q.shift()
    }
    return { h, slept }
  }
  // 첫 묶음 한도 → 둘째 묶음 → 첫 묶음 재시도 성공 = PASS, 쉬지 않음(사이에 다른 묶음이 돌았다)
  let { h, slept } = mk([LIMIT, { ok: true, out: CLEAN }, { ok: true, out: CLEAN }])
  assert.equal(h.stop().verdict, VERDICT.PASS)
  assert.deepEqual(h.calls.map((c) => c.files.length), [8, 2, 8])
  assert.deepEqual(slept, [])
  // 단독 묶음 한도 → 쉬고 재시도 → 또 한도 = UNKNOWN(재시도는 한 번뿐)
  ;({ h, slept } = mk([LIMIT, { ok: true, out: CLEAN }, LIMIT]))
  assert.equal(h.stop().verdict, VERDICT.UNKNOWN)
  assert.equal(h.calls.length, 3)
  assert.equal(slept.length, 0)
  assert.match(h.records().at(-1).failures.join(' '), /한도/)
  // 묶음이 하나뿐이면 쉬고 다시 부른다
  const h1 = stableHarness({ files: ['src/a.ts'], reviews: [] })
  const z = []
  const q1 = [LIMIT, { ok: true, out: CLEAN }]
  h1.deps.sleep = (ms) => z.push(ms)
  h1.deps.review = () => q1.shift()
  assert.equal(h1.stop().verdict, VERDICT.PASS)
  assert.deepEqual(z, [30_000])
})

test('RP8 열린 v1 수정 사이클은 v1 로 끝내고(소급 금지), 사이클이 닫히면 새 판으로 올린다', () => {
  const h = stableHarness({ files: ['src/a.ts'], reviews: [] })
  // v1 판이 남긴 상태: 차단 대기 중 · policy_version 없음
  const sf = path.join(h.stateDir, 's1.json')
  const st = JSON.parse(fs.readFileSync(sf, 'utf8'))
  st.roots[h.root] = { fix_rounds: 1, pending_block: { head: 'old', finding_ids: [] }, seen: {}, final: null, history: [] }
  fs.writeFileSync(sf, JSON.stringify(st))
  const sentence = 'No concrete regressions or contradictions of the stated goal were identified in the scoped changes.'
  h.queue.push(sentence)
  assert.equal(h.stop().verdict, VERDICT.UNKNOWN, 'v1 판독 — 문장형 답은 판독 실패 그대로')
  assert.equal(h.records().at(-1).policy_version, 'RP-v1')
  h.queue.push(CLEAN)
  assert.equal(h.stop().verdict, VERDICT.PASS)
  assert.equal(h.records().at(-1).policy_version, 'RP-v1', '사이클을 닫는 리뷰까지 v1')
  h.content['src/a.ts'] = 'v2'
  h.queue.push(sentence)
  assert.equal(h.stop().verdict, VERDICT.PASS, '다음 사이클부터 새 판')
  assert.equal(h.records().at(-1).policy_version, 'RP-2026-10-10.1')
})

test('RP9 유휴 루트(열린 사이클 없음)의 v1 상태는 다음 리뷰부터 새 판', () => {
  const h = stableHarness({ files: ['src/a.ts'], reviews: ['No concrete defects were identified.'] })
  const sf = path.join(h.stateDir, 's1.json')
  const st = JSON.parse(fs.readFileSync(sf, 'utf8'))
  delete st.roots[h.root].policy_version
  fs.writeFileSync(sf, JSON.stringify(st))
  assert.equal(h.stop().verdict, VERDICT.PASS)
  assert.equal(h.records().at(-1).policy_version, 'RP-2026-10-10.1')
})

test('RP10 리뷰를 못 했다는 문장은 깨끗한 답이 아니다(UNKNOWN 유지)', () => {
  for (const out of ['No review was performed; defects could not be identified.', 'No defects were identified because the diff was not provided.', 'I was unable to inspect the files. No issues found.']) {
    const h = harness({ reviews: [out] })
    assert.equal(h.stop().verdict, VERDICT.UNKNOWN, out)
  }
})

test('RP11 재시도 직전에 시간이 모자라면 부르지 않고 UNKNOWN', () => {
  const files = Array.from({ length: 10 }, (_, i) => `src/f${i}.ts`)
  const h = stableHarness({ files, reviews: [] })
  let now = 0
  h.deps.now = () => now
  const q = [{ ok: false, why: 'Codex 사용량 한도' }, { ok: true, out: CLEAN }]
  h.deps.review = (fs_) => {
    h.calls.push({ files: fs_ })
    const r = q.shift()
    now += 200_000 // 묶음마다 200초
    return r
  }
  assert.equal(h.stop().verdict, VERDICT.UNKNOWN)
  assert.equal(h.calls.length, 2, '400초 지점에서는 재시도하지 않는다')
  assert.match(h.records().at(-1).failures.join(' '), /재시도할 시간이 없다/)
})

test('RP12 기준 커밋이 다르면(다른 worktree·리베이스) 같은 diff 라도 재사용하지 않는다 · 미수행 표현은 깨끗함 아님', () => {
  const h = stableHarness({ files: ['src/a.ts'], reviews: [CLEAN, CLEAN] })
  h.stop()
  h.base = 'otherbase000000000000000000000000000000'
  h.stop()
  assert.equal(h.calls.length, 2)
  const u = harness({ reviews: ['No regressions were identified because the review was skipped.'] })
  assert.equal(u.stop().verdict, VERDICT.UNKNOWN)
})

// ── 반복 차단 · 최종 리뷰 범위(2026-10-10 완료 정체 해소) ────────────────────
test('RP13 같은 파일이 줄이 멀리 떨어져 다시 막히면 원인 분석 안내 · 차단은 유지', () => {
  const h = harness({ files: ['src/a.ts'], reviews: ['[P1] src/a.ts:10 — first edge — fix', '[P1] src/a.ts:200 — another edge — fix'] })
  const r1 = h.stop()
  assert.equal(r1.log, 'blocked')
  const r2 = h.stop()
  assert.equal(r2.exit, 2, '새 P1 은 계속 차단')
  assert.equal(r2.log, 'blocked_same_file')
  assert.match(r2.stderr, /같은 파일이 다시 막혔다\(src\/a\.ts\)/)
})

test('RP14 다른 파일의 새 P1 은 같은 파일 안내 없이 차단', () => {
  const h = harness({ files: ['src/a.ts', 'src/b.ts'], reviews: ['[P1] src/a.ts:10 — x — fix', '[P1] src/b.ts:10 — y — fix'] })
  h.stop()
  const r = h.stop()
  assert.equal(r.log, 'blocked')
})

test('RP15 최종 이후 리뷰는 묶음 상한 6(읽기 전용) — 범위가 커져도 33~48파일은 미검토 UNKNOWN 이 아니다', () => {
  const files = ['src/f0.ts']
  const h = harness({ files, reviews: ['[P1] src/f0.ts:1 — bad — fix', '[P1] src/f0.ts:1 — bad — fix'], cfg: { maxFixRounds: 1 } })
  h.stop()
  h.stop()
  assert.equal(h.records().at(-1).kind, 'final')
  // 최종 판정 뒤 범위가 40파일로 자란다(기준선 고정)
  for (let k = 1; k < 40; k++) files.push(`src/f${k}.ts`)
  for (let k = 0; k < 5; k++) h.queue.push(CLEAN)
  const r = h.stop()
  const rec = h.records().at(-1)
  assert.equal(rec.kind, 'post_final')
  assert.equal(rec.files_unreviewed, 0, '5묶음 모두 본다')
  assert.equal(r.verdict, VERDICT.PASS)
})

test('RP16 미검토 파일이 있어도 검토한 묶음에 P1 이 있으면 BLOCKED(UNKNOWN 에 묻히지 않는다)', () => {
  const files = Array.from({ length: 40 }, (_, i) => `src/f${i}.ts`)
  const h = harness({ files, reviews: ['[P1] src/f0.ts:1 — bad — fix', CLEAN, CLEAN, CLEAN] })
  const r = h.stop()
  assert.equal(r.verdict, VERDICT.BLOCKED)
  assert.equal(r.exit, 2)
})

test('RP17 v1 사이클이 같은 head 에서 UNKNOWN 으로 멈추면 새 판으로 올라가 재사용으로 미검토 파일까지 돈다', () => {
  const files = Array.from({ length: 40 }, (_, i) => `src/f${i}.ts`)
  const h = stableHarness({ files, reviews: [] })
  const sf = path.join(h.stateDir, 's1.json')
  const st = JSON.parse(fs.readFileSync(sf, 'utf8'))
  st.roots[h.root] = { fix_rounds: 1, pending_block: null, seen: {}, final: null, history: [] }
  fs.writeFileSync(sf, JSON.stringify(st))
  const head = 'h'.repeat(40)
  for (let k = 0; k < 4; k++) h.queue.push(CLEAN)
  assert.equal(h.stop(head).verdict, VERDICT.UNKNOWN, 'v1: 4묶음 뒤 8파일 미검토')
  assert.equal(h.records().at(-1).policy_version, 'RP-v1')
  for (let k = 0; k < 5; k++) h.queue.push(CLEAN)
  const r = h.stop(head)
  assert.equal(h.records().at(-1).policy_version, 'RP-2026-10-10.1')
  assert.equal(r.verdict, VERDICT.UNKNOWN, '새 판 첫 회: 4묶음 리뷰 · 장부 기록 · 8파일 남음')
  const r3 = h.stop(head)
  assert.equal(r3.verdict, VERDICT.PASS, '다음 회: 32파일 재사용 + 남은 8파일 1묶음')
  assert.deepEqual(h.calls.at(-1).files.length, 8)
})
