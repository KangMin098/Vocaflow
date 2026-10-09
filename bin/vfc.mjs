#!/usr/bin/env node
// bin/vfc.mjs — Vocaflow AI Control CLI (Claude Code · Codex · 사람 공용)
//
// 정본 goals/ 는 읽기 전용이다. 상태(state/*.json)는 이 CLI 로만 바꾼다 — 손으로 고치면 잠금·검증을 우회한다.
// 사용법은 `node bin/vfc.mjs help` 또는 docs/USAGE.md.

import fs from 'node:fs'
import os from 'node:os'
import crypto from 'node:crypto'
import path from 'node:path'
import { p, root, goalsDir, normalizeWorktree } from '../lib/paths.mjs'
import { validateCanon, buildManifest, loadCriteria, MANIFEST } from '../lib/goals.mjs'
import { withState, loadState } from '../lib/state.mjs'
import { listLocks, recover, heartbeat } from '../lib/lock.mjs'
import { atomicWriteJson, readJson, sha256File } from '../lib/fsutil.mjs'
import { findAgentPid } from '../lib/agentpid.mjs'
import * as T from '../lib/tasks.mjs'
import * as P from '../lib/planning.mjs'
import * as UG from '../lib/usergoals.mjs'
import * as CTX from '../lib/context.mjs'
import { measureRuns } from '../lib/perf.mjs'
import { execFileSync } from 'node:child_process'
import { initState } from '../lib/init.mjs'
import { goalLevel } from '../lib/alignment.mjs'
import * as POL from '../lib/policy.mjs'
import * as LIVE from '../lib/liveverify.mjs'

function parse(argv) {
  const pos = []
  const opt = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      const k = a.slice(2)
      const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true
      if (opt[k] === undefined) opt[k] = v
      else opt[k] = [].concat(opt[k], v)
    } else pos.push(a)
  }
  return { pos, opt }
}

const list = (v) => (v === undefined ? [] : [].concat(v).flatMap((s) => String(s).split(',')).map((s) => s.trim()).filter(Boolean))

function out(obj, opt) {
  if (opt.json) console.log(JSON.stringify(obj, null, 2))
  else if (typeof obj === 'string') console.log(obj)
  else console.log(JSON.stringify(obj, null, 2))
}

function fail(e) {
  const code = e instanceof T.RuleError ? e.code : 'ERROR'
  console.error(`거부 [${code}] ${e.message}`)
  if (e.detail) console.error(JSON.stringify(e.detail, null, 2))
  process.exit(e instanceof T.RuleError ? 2 : 1)
}

function sessionFrom(opt) {
  const agent = opt.agent || process.env.VFC_AGENT
  const label = opt.session || process.env.VFC_SESSION
  if (!agent || !label) throw new T.RuleError('NO_SESSION', '--agent <claude|codex|chatgpt|human> 와 --session <라벨> 이 필요하다 (또는 VFC_AGENT · VFC_SESSION)')
  let pid = opt.pid ? Number(opt.pid) : null
  if (!pid) pid = findAgentPid(agent)
  if (!pid && agent !== 'human') throw new T.RuleError('NO_AGENT_PID', `조상 프로세스에서 ${agent} 를 찾지 못했다 — --pid <에이전트 pid> 로 넘겨라 (CLI pid 를 쓰면 잠금이 곧 죽은 소유자가 된다)`)
  return { agent, label, pid: pid ?? process.pid }
}

/** 호출자 owner_id — --owner 가 있으면 그것, 없으면 --by / VFC_OWNER. 선언 기반(로컬 신뢰 모델 — docs/CONCURRENCY.md). */
function caller(opt) {
  return opt.owner || opt.by || process.env.VFC_OWNER || null
}

function requireValidCanon() {
  const r = validateCanon()
  if (!r.ok) throw new T.RuleError('CANON_INVALID', `정본 검증 실패 — 작업 상태를 바꿀 수 없다:\n  ${r.errors.join('\n  ')}`)
  return r
}

const HELP = `vfc — Vocaflow AI Control

정본
  goals validate [--json]                 정본 10개 항목 검증(파일·버전·승인·계층·중복·관계·스키마·범위·CSAT 축소·충돌)
  goals seal --decision <DL-id>           CANON_MANIFEST.json 작성(최초 1회 · 재봉인은 결정 기록 필수)
  goals list [--level N]                  목표 목록과 현재 상태

상태
  init                                    상태 파일 초기화(멱등 — 있는 항목은 건드리지 않는다)
  decision add --status RECORDED|PROPOSED|OPEN_QUESTION --kind K --summary .. [--goals VG-..] [--source ..] [--request REQ-..] --by O
  checkpoint [--label L]                  state/*.json 스냅샷 → runtime/checkpoints/<시각>-<L>/
  status [--json]                         요약: 목표 상태 분포 · 작업 · 잠금 · 열린 결정
  goal set <id> --status S --evidence <path>[,..] --by <owner> [--gate] [--note ..]

소유권
  owner add <owner_id> --purpose ".." [--agents claude,codex] [--db dev:ref [--decision <APPROVED id>]]
  owner bind-worktree <owner_id> <path> [--branch b]
  owner unbind-worktree <owner_id> <path>
  owner bind-session <owner_id> --agent A --session LABEL [--pid N]
  owner list

작업
  task add --file spec.json [--by owner]  필수: goal_id(L3) title description priority owner_id allowed_paths forbidden_paths acceptance impact
                                          impact: current_gap · expected_impact(closes|advances|prerequisite) · evidence_required[] · [acceptance_ids parent_goal_id next_dependency out_of_scope dependency_type unblocks] · kind independent 면 user_request_ref
  task check --file spec.json             task add 와 같은 검사(영향 계약·갭·중복·재구현)만 — 상태를 바꾸지 않는다
  verify live <UG> --test <apps/web/...live.test.ts> --acceptance i,j [--worktree wt] [--check]   읽기 전용 개발 DB 검증(정책 위임 · 해시 결속 · 건너뜀≠PASS)
  goal level <VG-…>                       TASK_COMPLETED · GOAL_PARTIAL · GOAL_VERIFIED · USER_ACCEPTED(사용자 결정만)
  task list [--status S] [--owner O] | task show <id>
  task approve <id> --by user --ref "근거" [--sql-sha256 H]   DB 쓰기 승인은 사람의 대화형 터미널에서만
  approve --kind design_approval|goal_delegation|goal_acceptance|db_write|canon_change [--policy-file p.json] --summary "UG-… accept" [--ref ..] [--goals VG-..] [--paths a,b] [--new-canon-version v]
                                          design_approval(「UG-…@vN」)은 다음 오케스트레이터 반복이 자동 적용·작업 재개
                                          신뢰 승인 입력(대화형 터미널 · 에이전트 밖 · 화면의 확인 코드 입력) — 강한 승인의 유일한 근거
  task start <id> --owner O --agent A --session L [--pid N]
  task evidence <id> --file ev.json --by O  ev: type command_or_protocol result skip_count artifact_path_or_url observed_at covers[]
  task set-acceptance <id> --file acc.json --decision <APPROVED DL-id> --by O   READY 에서만 · 옛 조건은 history
  task assign-worktree <id> <path> --by O [--branch b]   작업 위치(owner 에 묶인 worktree 만)
  task submit <id> --by O                 이번 run 증거 ≥1 필요 · 잠금은 커밋 후 반납
  task complete <id> --by R --review verification/reviews/<파일>   R = 등록된 다른 owner
  task reject <id> --by R --reason .. --review verification/reviews/<파일>
  task block <id> --by O --reason .. [--external] | task unblock <id> --by O | task fail <id> --by O --reason ..
  task reap                               죽은 실행의 IN_PROGRESS 작업 → BLOCKED · 잠금 정리
  task heartbeat <id>                     실행 중 작업의 잠금 heartbeat 갱신

잠금
  lock list | lock recover <name>         recover 는 stale 판정일 때만 — 살아 있는 남의 잠금은 거부

ChatGPT (파일 교환 · API 없음)
  planning request --topic .. --question-file q.md [--kind review|plan] [--task T-..] [--goals VG-..] [--attach f1,f2] --by O
  planning validate <REQ-id>
  planning import <REQ-id> [--record-conflict]   검증 통과 시 PROPOSED/OPEN_QUESTION 으로만 · requires_user_approval≠true 제안은 approval_conflict 로 기록(관련 작업 실행 차단)

사용자 지정 목표 (WF-S7 · docs/USER_GOALS.md)
  ugoal start --from chatgpt --file <goal.md> --by O          ChatGPT 가 준 vfc-goal 블록 → 목표 + 설계 v1 PROPOSED
  ugoal start --from claude --title .. --goals VG-.. [--profile FAST|BALANCED|DEEP|CRITICAL] [--design-file d.json] --by O
  ugoal draft <UG> --design-file d.json --by O               설계 없는 목표에 Claude 초안(DRAFT, 승인 아님) — 패킷 범위용
  ugoal request-design <UG> [--issue-file issue.json] [--commit sha] --by O   ChatGPT 설계 요청서(thread) · 재질의 예산 적용
  ugoal intake [--min-age-ms 2000] --by O                     planning/responses 의 thread 응답을 원자적으로 인수(검증·중복 차단·버전 대조)
  ugoal approve <UG> --design N --decision <DL> [--paths a,b] [--db-decision <DL>] --by O
                                                              결정은 사용자 APPROVED 이고 summary/reference 에 「UG-…@vN」(DB 는 「UG-…@vN db」)
  ugoal task add <UG> --file spec.json --by O                 승인 설계 범위 안 작업(spec.design_acceptance=[설계 수용 기준 번호]) · 승인 전이면 초안
  ugoal activate <UG> | ugoal deactivate | ugoal mode USER_GOAL|PLATFORM_AUTO
  ugoal pause <UG> | ugoal resume <UG> | ugoal accept <UG> --decision <DL> --by O   결정은 사용자가 직접 기록한 APPROVED 「UG-… accept」
  ugoal list | ugoal status <UG> | ugoal route <UG>
  ugoal context <UG> [--fetch]                                최신 컨텍스트 패킷(context/<UG>/ · main 기준 · 캐시) — request-design 이 자동으로 붙인다(--no-context 로 끔)
  ugoal cancel-request <UG> <REQ> --reason ".." --by O        응답 전 요청 라운드 취소(게시 전 패킷 수정 등)
  ugoal link <UG> --surface chat|work|event_task|desktop_work [--url https://chatgpt.com/…]   사람용 참조(라우팅 키 아님)
  perf report [--since 2026-10-09] [--json]                   오케스트레이터 단계별 소요 시간·비용
`

function main() {
  const argv = process.argv.slice(2)
  const cmd = argv[0]
  // init · status · help 처럼 하위 명령이 없는 명령은 둘째 인자가 옵션(--by 등)일 수 있다
  const hasSub = argv[1] !== undefined && !argv[1].startsWith('--') && !['init', 'status', 'help', 'checkpoint'].includes(cmd)
  const sub = hasSub ? argv[1] : undefined
  const { pos, opt } = parse(argv.slice(hasSub ? 2 : 1))
  const by = opt.by || process.env.VFC_OWNER || 'unknown'
  switch (`${cmd} ${sub ?? ''}`.trim()) {
    case 'help':
    case '':
      return console.log(HELP)

    case 'goals validate': {
      const r = validateCanon()
      if (opt.json) {
        out(r, opt)
        process.exit(r.ok ? 0 : 1)
      }
      console.log(`정본 검증: ${r.ok ? 'PASS' : 'FAIL'}  (errors ${r.errors.length} · warnings ${r.warnings.length})`)
      console.log(JSON.stringify(r.facts, null, 2))
      for (const e of r.errors) console.log(`  ERROR ${e}`)
      for (const w of r.warnings) console.log(`  WARN  ${w}`)
      process.exit(r.ok ? 0 : 1)
    }
    case 'goals seal': {
      const manPath = path.join(goalsDir(), MANIFEST)
      if (fs.existsSync(manPath)) {
        if (!opt.decision) throw new T.RuleError('ALREADY_SEALED', '이미 봉인됐다 — 재봉인은 --decision <사용자 APPROVED 정본 변경 결정 id> 와 함께')
        const d = loadState().state.decisionLog.entries.find((e) => e.decision_id === opt.decision)
        if (!T.isTrustedUserDecision(d) || d.kind !== 'canon_change') throw new T.RuleError('RESEAL_NOT_APPROVED', `결정 ${opt.decision} 가 대화형 터미널로 기록한 사용자 APPROVED canon_change 가 아니다(vfc approve --kind canon_change)`)
        if (!d.new_canon_version) throw new T.RuleError('RESEAL_NOT_APPROVED', '정본 변경 결정에 new_canon_version 이 없다')
      }
      const r = validateCanon()
      const blocking = r.errors.filter((e) => !e.startsWith('[seal]'))
      if (blocking.length) throw new T.RuleError('CANON_INVALID', blocking.join('; '))
      if (opt.decision) {
        const d = loadState().state.decisionLog.entries.find((e) => e.decision_id === opt.decision)
        if (d.new_canon_version !== r.facts.canon_version) throw new T.RuleError('RESEAL_NOT_APPROVED', `정본 버전 ${r.facts.canon_version} ≠ 결정의 new_canon_version ${d.new_canon_version}`)
      }
      const man = { schema: 'vfc-canon-manifest/1', canon_version: r.facts.canon_version, approved_at: r.facts.approved_at, sealed_at: new Date().toISOString(), sealed_by: by, reseal_decision: opt.decision ?? null, source: opt.source ?? null, files: buildManifest() }
      atomicWriteJson(manPath, man)
      return out(man, opt)
    }
    case 'goals list': {
      const doc = loadCriteria()
      const { state } = loadState()
      const rows = doc.criteria.filter((c) => opt.level === undefined || String(c.level) === String(opt.level)).map((c) => ({ id: c.id, level: c.level, phase: c.phase, r0: c.blocking_for_R0, status: state.goalStatus.goals[c.id]?.status ?? '(init 필요)', title: c.title }))
      if (opt.json) return out(rows, opt)
      for (const r of rows) console.log(`${r.id.padEnd(26)} L${r.level} ${String(r.phase).padEnd(9)} ${r.r0 ? 'R0' : '  '} ${String(r.status).padEnd(24)} ${r.title}`)
      return
    }

    case 'init': {
      requireValidCanon()
      const seed = readJson(opt.seed || process.env.VFC_SEED || path.join(path.dirname(goalsDir()), 'seed', 'seed.json'))
      const res = withState((s) => initState(s, seed), { event: 'state.init', by })
      return out(res, opt)
    }
    case 'status': {
      const { state, recovered } = loadState()
      const count = (arr, k) => arr.reduce((m, x) => ((m[x[k]] = (m[x[k]] || 0) + 1), m), {})
      const summary = {
        root: root(),
        canon_version: state.goalStatus.canon_version,
        goals: count(Object.values(state.goalStatus.goals), 'status'),
        templates: Object.fromEntries(Object.entries(state.goalStatus.templates || {}).map(([k, v]) => [k, `${v.status}(${v.instances.length})`])),
        release_gates: Object.fromEntries(Object.entries(state.goalStatus.release_gates).map(([k, v]) => [k, v.status])),
        tasks: count(state.taskQueue.tasks, 'status'),
        active: state.activeTasks.tasks,
        locks: listLocks().map((l) => ({ name: l.name, owner: l.meta?.owner_id, session: l.meta?.session, state: l.judgement.state })),
        open_decisions: state.decisionLog.entries.filter((e) => ['PROPOSED', 'OPEN_QUESTION'].includes(e.status)).map((e) => `${e.decision_id} ${e.status} ${e.summary}`),
        recovered_from_bak: recovered,
      }
      return out(summary, opt)
    }
    case 'goal set': {
      requireValidCanon()
      const r = withState((s) => T.setGoalStatus(s, pos[0], { status: opt.status, evidence_paths: list(opt.evidence), note: opt.note, by, kind: opt.gate ? 'gate' : 'goal' }), { event: 'goal.set', id: pos[0], status: opt.status, by })
      return out(r, opt)
    }

    case 'owner add':
      return out(withState((s) => T.ensureOwner(s, pos[0], { purpose: opt.purpose, agent_kinds: opt.agents ? list(opt.agents) : undefined, db_scopes: opt.db !== undefined ? list(opt.db) : undefined, db_change_decision: opt.decision }), { event: 'owner.add', owner: pos[0], by }), opt)
    case 'owner bind-worktree':
      return out(withState((s) => T.bindWorktree(s, pos[0], pos[1], opt.branch), { event: 'owner.bind_worktree', owner: pos[0], worktree: normalizeWorktree(pos[1]), by }), opt)
    case 'owner unbind-worktree':
      return out(withState((s) => T.unbindWorktree(s, pos[0], pos[1]), { event: 'owner.unbind_worktree', owner: pos[0], by }), opt)
    case 'owner bind-session': {
      const sess = { agent: opt.agent, label: opt.session, pid: opt.pid ? Number(opt.pid) : null }
      return out(withState((s) => T.bindSession(s, pos[0], sess), { event: 'owner.bind_session', owner: pos[0], session: sess.label, by }), opt)
    }
    case 'owner list':
      return out(loadState().state.ownership.owners, opt)

    case 'task check': {
      // 상태 사본에 addTask 를 돌려 보고 버린다 — 실제 상태·journal 은 바뀌지 않는다. 정본 검사는 task add 와 같게
      requireValidCanon()
      const spec = readJson(opt.file)
      spec.created_by = by
      const copy = structuredClone(loadState().state)
      const t = T.addTask(copy, spec)
      return out({ ok: true, would_create: t.task_id, impact: t.impact, criterion_claims: t.criterion_claims }, opt)
    }
    case 'verify live': {
      // 읽기 전용 개발 DB 검증 — 목표 정책(db_read_dev · live_test_user · read_only_attestation)이 있어야 한다. --check 는 실행 전 검사만
      const ug = pos[0]
      const s0 = loadState().state
      const g = UG.findGoal(s0, ug)
      const pol = g.execution_policy
      const dlg = (g.delegations || []).at(-1)
      const worktree = opt.worktree || dlg?.worktree
      if (!worktree) throw new T.RuleError('MISSING_FIELD', '--worktree 가 필요하다')
      const testRel = opt.test
      const pre = LIVE.preflight(pol, worktree, testRel)
      // 정적 검사는 참고용이다(정규식 파서는 우회 가능 — Codex 3회 연속 P1). 실행 게이트는 사용자가 이 실행(closure sha · 커밋)에 대해 대화형으로 기록한 live_run 승인
      const closureSha = crypto.createHash('sha256').update(JSON.stringify(pre.closure.map((c) => [c.path, c.sha256]))).digest('hex')
      const headNow = execFileSync('git', ['-C', worktree, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
      if (opt.check || !pre.ok) return out({ ug, test: testRel, commit: headNow, closure_sha: closureSha, approve_with: `vfc approve --kind live_run --summary "${ug}@live" --closure-sha ${closureSha} --commit ${headNow}`, preflight: { ok: pre.ok, advisory: true, why: pre.why, closure: pre.closure.map((c) => ({ path: c.path, writes: c.writes, sha256: c.sha256 })) } }, opt)
      const runApproval = s0.decisionLog.entries.find((e) => e.decision_id === opt.decision)
      if (!T.isTrustedUserDecision(runApproval) || runApproval.kind !== 'live_run' || !String(runApproval.summary || '').includes(`${ug}@live`)) throw new T.RuleError('TRUST_REQUIRED', `live 실행은 이 실행에 대한 대화형 live_run 승인(--decision)이 필요하다 — --check 의 approve_with 명령을 사용자가 실행`)
      if (runApproval.closure_sha !== closureSha || runApproval.commit !== headNow) throw new T.RuleError('APPROVAL_MISMATCH', `승인 ${opt.decision} 의 closure·커밋이 지금과 다르다 — 코드가 바뀌었으면 다시 승인`)
      if (runApproval.used_at) throw new T.RuleError('APPROVAL_USED', `승인 ${opt.decision} 는 이미 한 번 쓰였다(실행마다 새 승인)`)
      const appr = UG.approvedDesign(g)
      if (!appr) throw new T.RuleError('APPROVAL_REQUIRED', `${ug} 승인된 설계 없음`)
      const head = execFileSync('git', ['-C', worktree, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
      const dirty = () => execFileSync('git', ['-C', worktree, 'status', '--porcelain'], { encoding: 'utf8' }).split('\n').filter((l) => l.trim() && !/\.vfc-runs\//.test(l))
      // 커밋 안 된 코드로 돈 결과를 커밋에 붙이지 않는다 — 깨끗한 worktree 에서만 · 실행 뒤에도 HEAD·작업 트리 그대로여야 PASS 를 기록
      if (dirty().length) throw new T.RuleError('DIRTY_WORKTREE', `커밋 안 된 변경이 있다(${dirty().slice(0, 3).join(' | ')}) — 검증은 커밋된 코드로만`)
      const res = LIVE.runLive({ worktree, testRel, liveUser: pol.live_test_user, envFile: opt['env-file'] || path.join(CTX.productRepo(), 'apps', 'web', '.env.local') })
      const headAfter = execFileSync('git', ['-C', worktree, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
      if (res.status === 'PASS' && (headAfter !== head || dirty().length)) Object.assign(res, { status: 'UNVERIFIED', reason: '실행 중 HEAD 또는 작업 트리가 바뀌었다 — 결과를 커밋에 결속할 수 없다' })
      const rec = { at: new Date().toISOString(), test: testRel, commit: head, design_version: appr.version, acceptance: list(opt.acceptance).map(Number), status: res.status, counts: res.counts, reason: res.reason, ms: res.ms, closure_sha: crypto.createHash('sha256').update(JSON.stringify(pre.closure.map((c) => [c.path, c.sha256]))).digest('hex') }
      fs.mkdirSync(path.join(root(), 'verification', 'live'), { recursive: true })
      fs.writeFileSync(path.join(root(), 'verification', 'live', `${ug}-${rec.at.replace(/[:.]/g, '-')}.json`), JSON.stringify(rec, null, 2))
      withState((s) => {
        const gg = UG.findGoal(s, ug)
        gg.live_verifications = [...(gg.live_verifications || []), { ...rec, run_approval: opt.decision }]
        const d = s.decisionLog.entries.find((e) => e.decision_id === opt.decision)
        if (d) d.used_at = rec.at
      }, { event: 'usergoal.live_verify', ug, status: rec.status, by })
      return out(rec, opt)
    }
    case 'goal level':
      return out(goalLevel(loadState().state, pos[0]), opt)
    case 'task add': {
      requireValidCanon()
      const spec = readJson(opt.file)
      spec.created_by = by
      return out(withState((s) => T.addTask(s, spec), { event: 'task.add', by }), opt)
    }
    case 'task list': {
      const ts = loadState().state.taskQueue.tasks.filter((t) => (!opt.status || t.status === opt.status) && (!opt.owner || t.owner_id === opt.owner))
      if (opt.json) return out(ts, opt)
      for (const t of ts) console.log(`${t.task_id} ${t.status.padEnd(11)} ${t.priority} ${t.owner_id.padEnd(20)} ${t.goal_id.padEnd(14)} ${t.title}`)
      return
    }
    case 'task show':
      return out(loadState().state.taskQueue.tasks.find((t) => t.task_id === pos[0]) ?? `작업 ${pos[0]} 없음`, opt)
    case 'task approve': {
      const via = T.approvalChannel()
      return out(withState((s) => T.recordApproval(s, pos[0], { by: opt.by, reference: opt.ref, kinds: opt.kinds ? list(opt.kinds) : undefined, sql_sha256: opt['sql-sha256'], via }), { event: 'task.approve', task: pos[0], by: opt.by, via }), opt)
    }
    case 'approve': {
      // 신뢰 승인 입력 — 에이전트 프로세스(TTY 없음 · CLAUDECODE/VFC_AGENT)는 여기를 통과하지 못한다
      const via = T.approvalChannel()
      if (via !== 'tty') throw new T.RuleError('TRUST_REQUIRED', `vfc approve 는 사람의 대화형 터미널에서만 실행된다(현재 ${via}) — 에이전트가 대신 실행할 수 없다`)
      const KINDS = ['design_approval', 'goal_delegation', 'goal_acceptance', 'db_write', 'canon_change', 'live_run']
      if (opt.kind === 'live_run' && (!/^[0-9a-f]{64}$/.test(opt['closure-sha'] || '') || !/^[0-9a-f]{40}$/.test(opt.commit || ''))) throw new T.RuleError('MISSING_FIELD', 'live_run 은 --closure-sha <64hex> --commit <40hex> (vfc verify live --check 출력)')
      // 목표 단위 위임: 정책 파일 내용을 결정에 그대로 싣고 sha256 으로 결속 — 승인 뒤 파일을 바꿔도 결정 내용은 그대로
      let policy = null
      if (opt.kind === 'goal_delegation') {
        if (!opt['policy-file']) throw new T.RuleError('MISSING_FIELD', 'goal_delegation 은 --policy-file 이 필요하다')
        policy = readJson(opt['policy-file'])
        const errs = POL.validatePolicy(policy)
        if (errs.length) throw new T.RuleError('BAD_POLICY', errs.join('; '))
        if (!String(opt.summary || '').includes(`${policy.goal_id}@policy`)) throw new T.RuleError('BAD_SUMMARY', `--summary 에 「${policy.goal_id}@policy」 가 있어야 한다`)
        process.stderr.write(`\n[목표 위임 정책] ${policy.goal_id} · 위험 상한 ${policy.risk_level} · 코드 영역 ${policy.allowed_code_areas.join(', ')} · 능력 ${policy.allowed_capabilities.join(', ')} · 제외 ${policy.excluded_operations.join(', ')} · 비용 ${policy.max_cost_usd}$ · 시간 ${policy.max_runtime_min}분 · 병합 ${policy.merge_policy}\n`)
      }
      if (!KINDS.includes(opt.kind)) throw new T.RuleError('BAD_KIND', `--kind 는 ${KINDS.join('|')}`)
      if (!opt.summary) throw new T.RuleError('MISSING_FIELD', '--summary 가 필요하다(예: 「UG-0001 accept」 · 「UG-0001@v2」 · 「UG-0001@v2 db」)')
      const testCode = process.env.VFC_TTY_FOR_TESTS === '1' ? process.env.VFC_TEST_CODE : null
      const code = testCode || crypto.randomBytes(3).toString('hex')
      process.stderr.write(`\n[승인] ${opt.kind} — ${opt.summary}\n근거: ${opt.ref || '(없음)'}\n확인하려면 코드 ${code} 를 입력하고 Enter: `)
      const buf = Buffer.alloc(256)
      let line = ''
      for (;;) {
        let n = 0
        try {
          n = fs.readSync(0, buf, 0, buf.length, null)
        } catch (e) {
          if (e.code === 'EAGAIN') continue
          throw e
        }
        if (!n) break
        line += buf.toString('utf8', 0, n)
        if (line.includes('\n')) break
      }
      if (line.trim() !== code) throw new T.RuleError('TRUST_CODE_MISMATCH', '확인 코드가 다르다 — 기록하지 않았다')
      const entry = { status: 'APPROVED', kind: opt.kind, summary: opt.summary, approved_by: 'user', reference: opt.ref || 'vfc approve(대화형 터미널)', by: 'user', affects_goal_ids: list(opt.goals), ...(opt.paths ? { allowed_paths: list(opt.paths) } : {}), ...(policy ? { policy, policy_sha256: POL.policySha(policy) } : {}), ...(opt.kind === 'live_run' ? { closure_sha: opt['closure-sha'], commit: opt.commit } : {}), attestation: { host: os.hostname(), user: os.userInfo().username, at: new Date().toISOString() }, ...(opt['new-canon-version'] ? { new_canon_version: opt['new-canon-version'] } : {}) }
      return out(withState((s) => T.logDecision(s, entry, { via: 'tty' }), { event: 'decision.approve_tty', kind: opt.kind, by: 'user' }), opt)
    }
    case 'task set-acceptance': {
      const acc = readJson(opt.file)
      return out(withState((s) => T.setAcceptance(s, pos[0], { caller: caller(opt), acceptance: acc, decision_id: opt.decision }), { event: 'task.set_acceptance', task: pos[0], decision: opt.decision, by }), opt)
    }
    case 'task resume-from-plan':
      return out(withState((s) => T.resumeFromPlanning(s, pos[0], { caller: caller(opt), decision_id: opt.decision }), { event: 'task.resume_from_plan', task: pos[0], decision: opt.decision, by }), opt)
    case 'task assign-worktree':
      return out(withState((s) => T.assignWorktree(s, pos[0], { caller: caller(opt), worktree: pos[1], branch: opt.branch }), { event: 'task.assign_worktree', task: pos[0], by }), opt)
    case 'task start': {
      requireValidCanon()
      const sess = sessionFrom(opt)
      const t = withState(
        (s, ctx) => {
          const owner = s.ownership.owners[opt.owner]
          if (owner && (!owner.current_session || owner.current_session.label !== sess.label)) T.bindSession(s, opt.owner, sess)
          const started = T.startTask(s, pos[0], { owner_id: opt.owner, session: sess, pid: sess.pid }, ctx)
          // 세션 인계의 리뷰 기준 — 죽은 세션이 커밋을 남기면 이 기준과 달라져 자동 재개하지 않는다(Codex P1)
          if (started.worktree) {
            try {
              started.run.start_head = execFileSync('git', ['-C', started.worktree, 'rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
            } catch {
              started.run.start_head = null
            }
          }
          return started
        },
        { event: 'task.start', task: pos[0], owner: opt.owner, session: sess.label },
      )
      return out(t, opt)
    }
    case 'task evidence': {
      const ev = readJson(opt.file)
      return out(withState((s) => T.addEvidence(s, pos[0], ev, { caller: caller(opt) }), { event: 'task.evidence', task: pos[0], by }), opt)
    }
    case 'task submit':
      return out(withState((s, ctx) => T.submitForReview(s, pos[0], { caller: caller(opt) }, ctx), { event: 'task.submit', task: pos[0], by }), opt)
    case 'task complete':
      if (opt.reviewer && opt.reviewer !== (opt.by || process.env.VFC_OWNER)) throw new T.RuleError('REVIEWER_MISMATCH', '--reviewer 는 명령을 실행하는 owner(--by) 자신이어야 한다')
      return out(withState((s) => T.completeTask(s, pos[0], { caller: caller(opt), review_path: opt.review }), { event: 'task.complete', task: pos[0], by }), opt)
    case 'task reject':
      return out(withState((s) => T.rejectReview(s, pos[0], { caller: caller(opt), reason: opt.reason, review_path: opt.review }), { event: 'task.reject', task: pos[0], by }), opt)
    case 'task block':
      return out(withState((s, ctx) => T.blockTask(s, pos[0], { caller: caller(opt), reason: opt.reason, external: !!opt.external }, ctx), { event: 'task.block', task: pos[0], by }), opt)
    case 'task unblock':
      return out(withState((s) => T.unblockTask(s, pos[0], { caller: caller(opt), note: opt.note }), { event: 'task.unblock', task: pos[0], by }), opt)
    case 'task fail':
      return out(withState((s, ctx) => T.failTask(s, pos[0], { caller: caller(opt), reason: opt.reason }, ctx), { event: 'task.fail', task: pos[0], by }), opt)
    case 'task reap':
      return out(withState((s, ctx) => T.reapAbandoned(s, { by }, ctx), { event: 'task.reap', by }), opt)
    case 'task heartbeat': {
      const t = loadState().state.taskQueue.tasks.find((x) => x.task_id === pos[0])
      if (!t?.run?.locks?.length) throw new T.RuleError('NOT_RUNNING', `${pos[0]} 는 실행 중이 아니다`)
      return out(t.run.locks.map((l) => ({ name: l.name, ...heartbeat(l.name, l.token) })), opt)
    }

    case 'decision resolve-conflict': {
      // approval_conflict 를 닫는다 — 사용자 APPROVED 결정(--decision)이 근거여야 한다. ChatGPT 응답은 근거가 아니다.
      return out(
        withState((s) => {
          const c = s.decisionLog.entries.find((e) => e.decision_id === pos[0])
          if (!c || c.kind !== 'approval_conflict' || c.status !== 'OPEN_QUESTION') throw new T.RuleError('BAD_DECISION', `${pos[0]} 는 열린 approval_conflict 가 아니다`)
          const d = s.decisionLog.entries.find((e) => e.decision_id === opt.decision)
          if (!d || d.status !== 'APPROVED' || d.approved_by !== 'user') throw new T.RuleError('APPROVAL_REQUIRED', `충돌 해소에는 사용자 APPROVED 결정이 필요하다(${opt.decision})`)
          c.status = 'SUPERSEDED'
          c.resolved_by = opt.decision
          c.resolved_at = new Date().toISOString()
          return c
        }, { event: 'decision.resolve_conflict', id: pos[0], by }),
        opt,
      )
    }
    case 'decision add': {
      // RECORDED · PROPOSED · OPEN_QUESTION 만. APPROVED 는 사용자 승인 근거(--approved-by user --ref) 가 있어야 하고 사람이 실행한다
      const entry = { status: opt.status, kind: opt.kind, summary: opt.summary, source: opt.source, by, affects_goal_ids: list(opt.goals) }
      if (opt.status === 'APPROVED') Object.assign(entry, { approved_by: opt['approved-by'], reference: opt.ref })
      if (opt.supersedes) entry.supersedes = opt.supersedes
      if (opt.request) entry.request_id = opt.request // 기획 요청 승인(재개 근거)은 그 요청 id 를 가리켜야 한다
      return out(withState((s) => {
        for (const g of entry.affects_goal_ids) if (!loadCriteria().criteria.some((c) => c.id === g)) throw new T.RuleError('BAD_GOAL', `goal ${g} 는 정본에 없다`)
        if (!entry.summary || !entry.kind) throw new T.RuleError('MISSING_FIELD', '--summary 와 --kind 가 필요하다')
        return T.logDecision(s, entry)
      }, { event: 'decision.add', by }), opt)
    }
    case 'checkpoint': {
      // 상태 뮤텍스 안에서 state/*.json 을 통째로 복사 — 위험 작업 전후 스냅샷 · 복구 기준점
      const dir = withState((st) => {
        const d = path.join(p.checkpoints(), new Date().toISOString().replace(/[:.]/g, '-') + (opt.label ? '-' + String(opt.label).replace(/[^A-Za-z0-9_-]/g, '_') : ''))
        fs.mkdirSync(d, { recursive: true })
        for (const f of fs.readdirSync(p.state()).filter((f) => f.endsWith('.json'))) fs.copyFileSync(path.join(p.state(), f), path.join(d, f))
        return d
      }, { event: 'state.checkpoint', label: opt.label ?? null, by })
      return out({ checkpoint: dir }, opt)
    }
    case 'lock list':
      return out(listLocks(), opt)
    case 'lock recover': {
      const r = recover(pos[0])
      out(r, opt)
      return process.exit(r.ok ? 0 : 2)
    }

    case 'ugoal start': {
      requireValidCanon()
      if (opt.from === 'chatgpt') {
        if (!opt.file) throw new T.RuleError('MISSING_FIELD', '--file <ChatGPT 가 준 목표 파일> 이 필요하다')
        const g = withState((s) => UG.startFromChatGPT(s, { file: opt.file, by }), { event: 'usergoal.start', by })
        return out(UG.summary(loadState().state, g.ug_id), opt)
      }
      if (opt.from === 'claude') {
        const design = opt['design-file'] ? JSON.parse(fs.readFileSync(opt['design-file'], 'utf8')) : null
        const g = withState((s) => UG.startFromClaude(s, { title: opt.title, canon_goal_ids: list(opt.goals), profile: opt.profile || 'BALANCED', design, by }), { event: 'usergoal.start', by })
        return out(UG.summary(loadState().state, g.ug_id), opt)
      }
      throw new T.RuleError('MISSING_FIELD', '--from chatgpt|claude')
    }
    case 'ugoal request-design': {
      const r = requireValidCanon()
      const issue = opt['issue-file'] ? JSON.parse(fs.readFileSync(opt['issue-file'], 'utf8')) : null
      let context = null
      let contextError = null
      if (!opt['no-context']) {
        try {
          context = CTX.buildContext(loadState().state, pos[0], { fetch: !!opt.fetch })
        } catch (e) {
          contextError = e.message // 패킷 실패는 요청을 막지 않는다 — 요청서에 「패킷 없음」 이 적힌다
        }
      }
      const req = UG.requestDesign(withState, pos[0], { context, purpose: issue ? 'design_conflict' : 'design', issue, base_commit: opt.commit || context?.manifest?.base_commit || null, canon_version: r.facts.canon_version, by })
      return out({ request_id: req.id, file: req.file, thread: req.header.thread, context: context ? { dir: context.dir, cached: context.cached, base_commit: context.manifest.base_commit, files: context.files } : null, context_error: contextError }, opt)
    }
    case 'ugoal context': {
      const c = CTX.buildContext(loadState().state, pos[0], { fetch: !!opt.fetch })
      return out({ dir: c.dir, cached: c.cached, base_commit: c.manifest.base_commit, generated_at: c.manifest.generated_at, files: c.files, source_files: c.manifest.source_files.length }, opt)
    }
    case 'ugoal cancel-request':
      return out(withState((s) => UG.cancelRequest(s, pos[0], pos[1], { reason: opt.reason, by }), { event: 'usergoal.cancel_request', by }), opt)
    case 'ugoal link':
      return out(withState((s) => UG.linkSurface(s, pos[0], { surface: opt.surface, url: opt.url || null, by })), opt)
    case 'perf report': {
      const m = measureRuns(loadState().state.orchestrator, { since: opt.since || null })
      if (!opt.json) {
        const min = (ms) => `${(ms / 60000).toFixed(1)}분`
        return out([`실행 ${m.runs} · 벽시계 ${min(m.wall_ms)} · 완료 작업 ${m.completed_tasks} · 작업당 ${m.per_completed_task_ms ? min(m.per_completed_task_ms) : '-'} · 비용 $${m.cost_usd}`, ...Object.entries(m.by_phase).map(([k, v]) => `  ${k.padEnd(12)} ${min(v.ms).padStart(7)} ${String(v.pct).padStart(5)}%`)].join('\n'), opt)
      }
      return out(m, opt)
    }
    case 'ugoal intake': {
      requireValidCanon()
      const headOf = (ug, s) => {
        const t = s.taskQueue.tasks.find((x) => x.user_goal_id === ug && x.worktree)
        if (!t) return null
        try {
          return execFileSync('git', ['-C', t.worktree, 'rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
        } catch {
          return null
        }
      }
      const res = UG.intakeResponses(withState, { by, currentCommitFor: headOf, minAgeMs: opt['min-age-ms'] !== undefined ? Number(opt['min-age-ms']) : undefined })
      // 새 설계 버전은 main 코드와 대조해 기록한다(승인 때 사람이 본다 — 자동 거부는 하지 않는다)
      for (const r of res.filter((x) => x.status === 'applied' && x.design_version)) {
        r.code_check = withState((s) => {
          const d = UG.findGoal(s, r.ug).designs.find((x) => x.version === r.design_version)
          d.code_check = CTX.checkDesignAgainstCode(d)
          return d.code_check
        })
      }
      return out({ processed: res.length, results: res }, opt)
    }
    case 'ugoal approve': {
      const ug = pos[0]
      const r = withState(
        (s) => {
          const a = UG.approveDesign(s, ug, { version: Number(opt.design), decision_id: opt.decision, allowed_paths: list(opt.paths), db_decision_id: opt['db-decision'] || null, by })
          // 승인 전에 쌓인 작업 초안 → 승인 범위 안이면 작업으로(설계 대기 → 자동 재개). 범위 밖 초안은 사유와 함께 돌려준다
          const created = []
          const refused = []
          for (const d of a.drafts) {
            try {
              created.push(T.addTask(s, UG.bindTaskSpec(s, ug, d.spec), { ugBound: true }).task_id)
            } catch (e) {
              refused.push({ title: d.spec.title, reason: e.message })
            }
          }
          return { design_version: a.design.version, contract_changed: a.contract_changed, invalidated: a.invalidated, resumed: a.resumed, created, refused }
        },
        { event: 'usergoal.approve', ug, by },
      )
      return out(r, opt)
    }
    case 'ugoal task': {
      if (pos[0] !== 'add') throw new T.RuleError('BAD_COMMAND', 'ugoal task add <UG> --file spec.json')
      const ug = pos[1]
      const spec = JSON.parse(fs.readFileSync(opt.file, 'utf8'))
      const r = withState(
        (s) => {
          if (!UG.approvedDesign(UG.findGoal(s, ug))) return { draft: UG.addTaskDraft(s, ug, spec, { by }), note: '승인된 설계가 없어 초안으로 보관 — 승인 시 자동 생성' }
          return { task: T.addTask(s, UG.bindTaskSpec(s, ug, spec), { ugBound: true }) }
        },
        { event: 'usergoal.task', ug, by },
      )
      return out(r.task ? { task_id: r.task.task_id, status: r.task.status, design_version: r.task.design_version } : r, opt)
    }
    case 'ugoal activate':
      return out(withState((s) => UG.setActive(s, pos[0], { by })), opt)
    case 'ugoal deactivate':
      return out(withState((s) => UG.setActive(s, null, { by })), opt)
    case 'ugoal mode':
      return out(withState((s) => UG.setMode(s, pos[0])), opt)
    case 'ugoal pause':
    case 'ugoal resume':
      return out(withState((s) => UG.setPaused(s, pos[0], sub === 'pause', { by })), opt)
    case 'ugoal draft':
      return out(withState((s) => UG.addClaudeDraft(s, pos[0], JSON.parse(fs.readFileSync(opt['design-file'], 'utf8')), { by }), { event: 'usergoal.draft', ug: pos[0], by }), opt)
    case 'ugoal accept':
      return out(withState((s) => UG.acceptGoal(s, pos[0], { by, decision_id: opt.decision }).coverage), opt)
    case 'ugoal list': {
      const s = loadState().state
      const U = UG.ugState(s)
      return out({ mode: U.mode, active_goal: U.active_goal, goals: Object.values(U.goals).map((g) => ({ ug_id: g.ug_id, title: g.title, status: g.status, profile: g.profile, route: UG.route(s, g.ug_id).route })) }, opt)
    }
    case 'ugoal status':
      return out(UG.summary(loadState().state, pos[0]), opt)
    case 'ugoal route':
      return out(UG.route(loadState().state, pos[0]), opt)
    case 'planning request': {
      const r = requireValidCanon()
      const question = opt['question-file'] ? fs.readFileSync(opt['question-file'], 'utf8') : opt.question
      if (opt.task && !loadState().state.taskQueue.tasks.some((t) => t.task_id === opt.task)) throw new T.RuleError('NO_TASK', `작업 ${opt.task} 가 없다`)
      const req = P.createRequest({ topic: opt.topic, question, goal_ids: list(opt.goals), attachments: list(opt.attach), canon_version: r.facts.canon_version, created_by: by, context: opt.context, kind: opt.kind || 'review', task_id: opt.task || null })
      withState((s) => T.logDecision(s, { status: 'RECORDED', kind: 'chatgpt_request', summary: `ChatGPT 검토 요청 ${req.id}: ${opt.topic}`, request_id: req.id, by }), { event: 'planning.request', id: req.id, by })
      return out(req, opt)
    }
    case 'planning validate':
    case 'planning import': {
      const id = pos[0]
      const f = P.responseFileFor(id)
      if (!f) throw new T.RuleError('NO_RESPONSE', `planning/responses/${id}.response.md|.json 이 없다`)
      let resp
      try {
        resp = P.extractResponse(fs.readFileSync(f, 'utf8'), f)
      } catch (e) {
        throw new T.RuleError('BAD_RESPONSE', `응답 구조를 읽지 못했다: ${e.message}`)
      }
      // WF-S5 정책: requires_user_approval 이 true 가 아닌 제안을 **고쳐서** 받지 않는다(승인으로 오인될 수 있다).
      // --record-conflict 를 주면 그 제안들을 approval_conflict(OPEN_QUESTION)로 따로 기록하고 나머지만 받는다 —
      // 관련 작업은 사람이 충돌을 풀 때까지 실행되지 않는다(lib/feasibility.mjs no_approval_conflict).
      // 원문 파일은 그대로 보관한다(sha256 은 원문 기준). 옛 --normalize-approval 은 폐지했다.
      if (P.readRequestHeader(id)?.thread) throw new T.RuleError('USE_UGOAL_INTAKE', `${id} 는 사용자 목표 thread 요청이다 — vfc ugoal intake 로 인수한다(설계 버전·라운드 반영)`)
      if (opt['normalize-approval']) throw new T.RuleError('DEPRECATED', '--normalize-approval 은 폐지됐다(WF-S5): 값을 고쳐 받지 않는다 — --record-conflict 로 충돌을 기록하라')
      const conflicts = []
      if (opt['record-conflict']) {
        resp.proposed_decisions = (resp.proposed_decisions || []).filter((d, i) => {
          if (d && d.requires_user_approval !== true) {
            conflicts.push({ index: i, value: d.requires_user_approval, decision: d })
            return false
          }
          return true
        })
      }
      const normalized = []
      const v = P.validateResponse(resp, { expectRequestId: id })
      if (!v.ok) throw new T.RuleError('BAD_RESPONSE', `응답 검증 실패:\n  ${v.errors.join('\n  ')}`)
      if (sub === 'validate') return out({ ok: true, request_id: id, verdict: resp.verdict, findings: resp.findings.length, proposals: resp.proposed_decisions.length, conflicts: conflicts.length }, opt)
      fs.mkdirSync(p.archive(), { recursive: true })
      const dest = path.join(p.archive(), path.basename(f))
      const hash = sha256File(f)
      const archiveFiles = () => {
        // 커밋 후 이동 — 여기서 죽거나 rename 이 실패해도 다음 import 가 「이미 기록됨」을 알아보고 이동만 다시 한다
        if (fs.existsSync(f)) fs.renameSync(f, fs.existsSync(dest) ? `${dest}.${Date.now()}.dup` : dest)
        const req = path.join(p.requests(), `${id}.md`)
        if (fs.existsSync(req)) fs.renameSync(req, path.join(p.archive(), `${id}.md`))
      }
      const res = withState(
        (s, ctx) => {
          const prev = s.decisionLog.imported_responses[id]
          if (prev) {
            ctx.afterCommit(archiveFiles)
            if (prev.sha256 === hash) return { already: true, prev }
            throw new T.RuleError('ALREADY_IMPORTED', `${id} 응답은 이미 가져왔다(다른 내용 sha256 ${prev.sha256.slice(0, 12)}…) — 새 검토는 새 요청으로`)
          }
          const rel = path.relative(root(), dest).split(path.sep).join('/')
          const header = P.readRequestHeader(id)
          const entries = P.toDecisionEntries(resp, rel).map((e) => T.logDecision(s, { ...e, response_sha256: hash, by, ...(normalized.length ? { normalized } : {}) }))
          for (const c of conflicts) {
            entries.push(
              T.logDecision(s, {
                status: 'OPEN_QUESTION',
                kind: 'approval_conflict',
                source: 'chatgpt',
                request_id: id,
                response_sha256: hash,
                by,
                summary: `ChatGPT 제안 ${c.index} 이 requires_user_approval=${JSON.stringify(c.value)} — 로컬 정책상 모든 ChatGPT 제안은 사용자 승인이 필요하다. 사람이 이 제안을 승인(APPROVED 결정)하거나 기각할 때까지 관련 작업 실행 차단: ${c.decision.summary}`,
                affects_goal_ids: c.decision.affects_goal_ids || [],
                affects_task_ids: header?.task_id ? [header.task_id] : [],
                original_proposal: c.decision,
              }),
            )
          }
          s.decisionLog.imported_responses[id] = { sha256: hash, at: new Date().toISOString(), decision_ids: entries.map((e) => e.decision_id), normalized }
          ctx.afterCommit(archiveFiles)
          return { entries }
        },
        { event: 'planning.import', id, by },
      )
      if (res.already) throw new T.RuleError('ALREADY_IMPORTED', `${id} 응답은 이미 가져왔다(${res.prev.decision_ids.join(',')}) — 보관 이동만 다시 했다`)
      return out({ imported: res.entries.map((e) => `${e.decision_id} ${e.status}`), archived: dest }, opt)
    }
    default:
      console.log(HELP)
      process.exit(1)
  }
}

try {
  main()
} catch (e) {
  fail(e)
}
