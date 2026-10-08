#!/usr/bin/env node
// bin/vfc.mjs — Vocaflow AI Control CLI (Claude Code · Codex · 사람 공용)
//
// 정본 goals/ 는 읽기 전용이다. 상태(state/*.json)는 이 CLI 로만 바꾼다 — 손으로 고치면 잠금·검증을 우회한다.
// 사용법은 `node bin/vfc.mjs help` 또는 docs/USAGE.md.

import fs from 'node:fs'
import path from 'node:path'
import { p, root, goalsDir, normalizeWorktree } from '../lib/paths.mjs'
import { validateCanon, buildManifest, loadCriteria, MANIFEST } from '../lib/goals.mjs'
import { withState, loadState } from '../lib/state.mjs'
import { listLocks, recover, heartbeat } from '../lib/lock.mjs'
import { atomicWriteJson, readJson, sha256File } from '../lib/fsutil.mjs'
import { findAgentPid } from '../lib/agentpid.mjs'
import * as T from '../lib/tasks.mjs'
import * as P from '../lib/planning.mjs'
import { initState } from '../lib/init.mjs'

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
  task add --file spec.json [--by owner]  필수: goal_id(L3) title description priority owner_id allowed_paths forbidden_paths acceptance
  task list [--status S] [--owner O] | task show <id>
  task approve <id> --by user --ref "근거" [--sql-sha256 H]
  task start <id> --owner O --agent A --session L [--pid N]
  task evidence <id> --file ev.json --by O  ev: type command_or_protocol result skip_count artifact_path_or_url observed_at covers[]
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
  planning request --topic .. --question-file q.md [--goals VG-..] [--attach f1,f2] --by O
  planning validate <REQ-id>
  planning import <REQ-id>                검증 통과 시 DECISION_LOG 에 PROPOSED/OPEN_QUESTION 으로만 기록
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
        if (!d || d.status !== 'APPROVED' || d.approved_by !== 'user' || d.kind !== 'canon_change') throw new T.RuleError('RESEAL_NOT_APPROVED', `결정 ${opt.decision} 가 사용자 APPROVED canon_change 가 아니다`)
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
    case 'task approve':
      return out(withState((s) => T.recordApproval(s, pos[0], { by: opt.by, reference: opt.ref, kinds: opt.kinds ? list(opt.kinds) : undefined, sql_sha256: opt['sql-sha256'] }), { event: 'task.approve', task: pos[0], by: opt.by }), opt)
    case 'task assign-worktree':
      return out(withState((s) => T.assignWorktree(s, pos[0], { caller: caller(opt), worktree: pos[1], branch: opt.branch }), { event: 'task.assign_worktree', task: pos[0], by }), opt)
    case 'task start': {
      requireValidCanon()
      const sess = sessionFrom(opt)
      const t = withState(
        (s, ctx) => {
          const owner = s.ownership.owners[opt.owner]
          if (owner && (!owner.current_session || owner.current_session.label !== sess.label)) T.bindSession(s, opt.owner, sess)
          return T.startTask(s, pos[0], { owner_id: opt.owner, session: sess, pid: sess.pid }, ctx)
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

    case 'planning request': {
      const r = requireValidCanon()
      const question = opt['question-file'] ? fs.readFileSync(opt['question-file'], 'utf8') : opt.question
      const req = P.createRequest({ topic: opt.topic, question, goal_ids: list(opt.goals), attachments: list(opt.attach), canon_version: r.facts.canon_version, created_by: by, context: opt.context })
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
      const v = P.validateResponse(resp, { expectRequestId: id })
      if (!v.ok) throw new T.RuleError('BAD_RESPONSE', `응답 검증 실패:\n  ${v.errors.join('\n  ')}`)
      if (sub === 'validate') return out({ ok: true, request_id: id, verdict: resp.verdict, findings: resp.findings.length, proposals: resp.proposed_decisions.length }, opt)
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
          const entries = P.toDecisionEntries(resp, rel).map((e) => T.logDecision(s, { ...e, response_sha256: hash, by }))
          s.decisionLog.imported_responses[id] = { sha256: hash, at: new Date().toISOString(), decision_ids: entries.map((e) => e.decision_id) }
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
