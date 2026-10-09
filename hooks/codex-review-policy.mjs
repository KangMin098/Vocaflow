// hooks/codex-review-policy.mjs — Codex Stop 리뷰의 판정 엔진(정본: Vocaflow-AI-Control/hooks · 설치: ~/.claude/hooks)
//
// 2026-10-09 개선(사용자 지시 「Stop Hook 리뷰 상한 개선」). 이전 판의 결함(감사):
//   1. 왕복 상한에 닿으면 기준선을 HEAD 로 옮겨 **마지막 수정이 리뷰 없이 통과**했다.
//   2. 파일 상한(8) 밖 파일은 「빠졌다」 로그만 남기고 기준선이 넘어가 **영영 리뷰되지 않았다**.
//   3. 리뷰 실패 시 diff 해시를 저장해 다음 Stop 에서 「이미 리뷰함」으로 **통과**했다.
//   4. 같은 결함이 반복돼도 횟수만 셌다. 5. 판정(PASS/BLOCKED/UNKNOWN) 기록이 없었다. 6. 동시 실행 보호가 없었다.
//   7. 사용자 턴마다 왕복 카운터가 0 이 됐다(Codex 호출 수와 수정 횟수를 구분하지 않았다).
//
// 이번 판
//   · MAX_FIX_ROUNDS(기본 3) = **수정 사이클** 수: 차단 리뷰 뒤 새 커밋이 생겨 다시 리뷰할 때만 +1. Codex 호출 수가 아니다.
//   · 상한 도달 → 마지막 코드에 **읽기 전용 최종 리뷰 1회** → REVIEW_PASS / REVIEW_BLOCKED / REVIEW_UNKNOWN 기록. 최종 리뷰는
//     수정 루프로 되돌아가지 않는다(exit 2 없음). 이후 같은 세션·루트의 새 커밋은 1회 리뷰·기록·알림만(post-final, 재귀 없음).
//   · 범위의 모든 파일을 묶음(chunk)으로 리뷰한다. 묶음 상한을 넘으면 그 범위는 REVIEW_UNKNOWN — 조용히 통과시키지 않는다.
//   · 리뷰 실패 = REVIEW_UNKNOWN. 해시를 저장하지 않아 다음 Stop 에 다시 시도한다.
//   · 지적마다 지문(finding_id)을 남기고, 같은 지문이 두 번째 차단 리뷰에 다시 나오면 **원인 분석**으로 전환한다.
//   · 판정은 verdicts.jsonl 에 남는다(커밋 sha · diff 해시 · 원문 경로 · P0/P1 · 수정 횟수) — AI-Control 의 완료 판정이 읽는다.
//   · 세션 잠금(wx + pid)으로 같은 세션의 Stop 훅 중복 실행을 막는다.
// Stop 훅은 **현재 작업 상태만** 판정한다. 다음 작업 선택·새 세션 생성은 하지 않는다(AI-Control 오케스트레이터의 몫).

import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

export const VERDICT = { PASS: 'REVIEW_PASS', BLOCKED: 'REVIEW_BLOCKED', UNKNOWN: 'REVIEW_UNKNOWN' }
export const DEFAULTS = { maxFixRounds: 3, filesPerChunk: 8, maxChunks: 4 }

// codex exec 는 NO_FINDINGS, codex review 는 「No concrete defect(s)… identified/evident」 · 최종 리뷰는 「No remaining P0/P1 defects were confirmed」
// 같은 문장으로 깨끗함을 말한다(실측 2026-10-09 · 두 번째 형식을 못 읽어 최종 리뷰가 UNKNOWN 이 됐다)
export const NO_FINDINGS_RE = /^\s*NO_FINDINGS\s*$|\bno (?:remaining )?(?:concrete |blocking |actionable )?(?:P0\s*(?:\/|or|and|&)\s*P1 |P[01] )?(?:defects?|findings|issues|bugs)\b(?:[^.\n]*\b(?:identified|evident|found|detected|confirmed))?/im

const sha1 = (s) => createHash('sha1').update(String(s)).digest('hex')

// ── 지적 파싱 · 지문 ─────────────────────────────────────────────────────

/** Codex 출력에서 [P0]~[P3] 지적을 꺼낸다. 형식: 「[P1] path:line — 결함 — 고침」 또는 「- [P1] 제목 — path:line ...」 */
export function parseFindings(out, ctx = {}) {
  const findings = []
  const lines = String(out ?? '').split('\n')
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/\[(P[0-3])\]\s*(.*)$/)
    if (!m) continue
    // 「[P1]」 만 있는 줄이면 다음 비지 않은 줄이 설명이다(Codex 리뷰 P1: 버리면 차단이 PASS 가 됐다)
    let text = m[2].trim()
    if (!text) text = (lines.slice(i + 1).find((l) => l.trim() && !/\[P[0-3]\]/.test(l)) || '').trim()
    // codex review 는 절대경로를 8.3 이름의 URL 인코딩(ADMINI%7E1)으로 낸다 — %·~ 를 경로 글자로 받고 루트 기준 상대경로로 바꾼다(실측 2026-10-09)
    const loc = text.match(/([A-Za-z]:)?[\w./\\%~-]+\.(?:m?[jt]sx?|cjs|mjs|py|sql|css|md|json|ya?ml|sh|ps1)(?::(\d+)(?:-\d+)?)?/)
    const file = loc ? relToRoot(loc[0].replace(/:\d+(?:-\d+)?$/, ''), ctx.root) : null
    const line = loc?.[2] ? Number(loc[2]) : null
    const summary = text.replace(loc?.[0] ?? '', '').replace(/^[\s—–:-]+/, '').slice(0, 300)
    findings.push({ severity: m[1], affected_file: file, relevant_line: line, defect_summary: summary, related_goal_id: ctx.goal_id ?? null, current_work_scope: ctx.scope ?? null })
  }
  for (const f of findings) f.finding_id = `F-${fingerprint(f).slice(0, 10)}`
  return findings
}

/** 출력에 있는 P0·P1 표지 수 — 판독한 차단 지적 수보다 많으면 판독 실패(UNKNOWN)로 본다 */
export const blockingMarkers = (out) => (String(out ?? '').match(/\[P[01]\]/g) || []).length

const longName = (p) => {
  try {
    return fs.realpathSync.native(p).replace(/\\/g, '/')
  } catch {
    return p.replace(/\\/g, '/')
  }
}

/** 지적 경로 → 루트 기준 상대경로(루트 밖이거나 해석 불가면 정규화한 원래 경로) */
export function relToRoot(p, root) {
  const raw = String(p).replace(/\\/g, '/')
  if (!root || !/^[A-Za-z]:\//.test(raw)) return raw.replace(/^\.\//, '')
  const r = longName(String(root).replace(/\\/g, '/')).replace(/\/$/, '')
  // 원래 경로와 %7E→~ 복원 경로를 둘 다 긴 이름으로 펴서 루트와 대조한다
  for (const cand of [raw, raw.replace(/%7E/gi, '~')]) {
    const abs = longName(cand)
    if (abs.toLowerCase().startsWith(r.toLowerCase() + '/')) return abs.slice(r.length + 1)
  }
  return raw
}

/** 같은 결함을 알아보는 지문 — 줄 번호·숫자·공백 차이는 무시(수정하면 줄이 움직인다) */
export function fingerprint(f) {
  const norm = String(f.defect_summary || '')
    .toLowerCase()
    .replace(/\d+/g, '#')
    .replace(/[^\p{L}\p{N}#]+/gu, ' ')
    .trim()
    .split(' ')
    .slice(0, 12)
    .join(' ')
  return sha1(`${f.severity}|${(f.affected_file || '').toLowerCase()}|${norm}`)
}

/** .agent-goal.md 에서 주 목표 id 와 작업 단위 이름(있으면) */
export function goalContext(root) {
  try {
    const t = fs.readFileSync(path.join(root, '.agent-goal.md'), 'utf8')
    return { goal_id: (t.match(/VG-L\d-[A-Z0-9-]+/) || [])[0] ?? null, scope: (t.split('\n').find((l) => l.startsWith('# ')) || '').replace(/^#\s*/, '').slice(0, 120) || null }
  } catch {
    return { goal_id: null, scope: null }
  }
}

// ── 세션 잠금 ────────────────────────────────────────────────────────────

function pidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false
  try {
    process.kill(pid, 0)
    return true
  } catch (e) {
    return e.code === 'EPERM'
  }
}

/** 같은 세션의 Stop 훅이 겹치면 뒤엣것은 아무것도 하지 않는다. 죽은 잠금은 이름을 바꿔 치운 뒤 다시 'wx'. */
export function acquireSessionLock(stateDir, sessionId, pid = process.pid) {
  const dir = path.join(stateDir, 'locks')
  fs.mkdirSync(dir, { recursive: true })
  const f = path.join(dir, `${sessionId}.lock`)
  const token = `${pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`
  for (let i = 0; i < 2; i++) {
    const tmp = `${f}.${token}.tmp`
    fs.writeFileSync(tmp, JSON.stringify({ pid, token, at: new Date().toISOString() }))
    try {
      // link 는 대상이 있으면 EEXIST — 내용이 이미 쓰인 파일이 한 번에 나타난다(빈 잠금 창이 없다)
      fs.linkSync(tmp, f)
      fs.rmSync(tmp, { force: true })
      return {
        ok: true,
        release: () => {
          try {
            if (JSON.parse(fs.readFileSync(f, 'utf8')).token === token) fs.rmSync(f, { force: true })
          } catch {
            /* 이미 없다 */
          }
        },
      }
    } catch (e) {
      fs.rmSync(tmp, { force: true })
      if (e.code !== 'EEXIST') throw e
      let holder = null
      try {
        holder = JSON.parse(fs.readFileSync(f, 'utf8'))
      } catch {
        holder = null
      }
      if (!holder) {
        // 읽을 수 없는 잠금 = 다른 판이 쓰는 중일 수 있다 — 60초 안이면 점유로 본다
        let age = Infinity
        try {
          age = Date.now() - fs.statSync(f).mtimeMs
        } catch {
          continue
        }
        if (age < 60_000) return { ok: false, holder: { pid: null, unreadable: true } }
      } else if (pidAlive(holder.pid)) return { ok: false, holder }
      try {
        fs.renameSync(f, `${f}.${Date.now()}.${pid}.dead`)
      } catch {
        /* 다른 쪽이 먼저 치웠다 */
      }
    }
  }
  return { ok: false, holder: null }
}

// ── 상태 · 판정 기록 ─────────────────────────────────────────────────────

export function loadState(stateDir, sessionId) {
  try {
    const s = JSON.parse(fs.readFileSync(path.join(stateDir, `${sessionId}.json`), 'utf8'))
    return { heads: {}, roots: {}, ...s }
  } catch {
    return { heads: {}, roots: {} }
  }
}

function saveState(stateDir, sessionId, s) {
  const f = path.join(stateDir, `${sessionId}.json`)
  const tmp = `${f}.${process.pid}.tmp`
  fs.writeFileSync(tmp, JSON.stringify({ ...s, at: new Date().toISOString() }))
  fs.renameSync(tmp, f)
}

export function recordVerdict(stateDir, rec) {
  fs.appendFileSync(path.join(stateDir, 'verdicts.jsonl'), JSON.stringify(rec) + '\n')
}

function saveRaw(stateDir, kind, head, out) {
  const dir = path.join(stateDir, 'reviews')
  fs.mkdirSync(dir, { recursive: true })
  const f = path.join(dir, `${new Date().toISOString().replace(/[:.]/g, '-')}-${kind}-${String(head).slice(0, 9)}.txt`)
  fs.writeFileSync(f, String(out ?? ''))
  return f.replace(/\\/g, '/')
}

// ── 오탐 선언 · 범위 대조 ─────────────────────────────────────────────────

/**
 * 오탐 선언: 작업 루트의 .codex-review-fp.json = [{ finding_id, rationale }].
 * 선언만으로 차단이 풀리지 않는다 — **현재 작업 범위(이번 리뷰 범위 파일)와 대조**해
 *   · 지적 파일이 범위 밖이면 수용(근거: 범위 파일 목록) — 차단 루프는 멈추지만 판정은 REVIEW_UNKNOWN(PASS 아님 · 사람 확인)
 *   · 범위 안이면 거부 — 차단 유지(불편하다는 이유로 P0/P1 을 넘기지 않는다)
 * 판단 근거는 수용·거부 모두 판정 기록(false_positives)에 남는다.
 */
export function applyFalsePositives(findings, { root, scopeFiles, read = (p) => fs.readFileSync(p, 'utf8') }) {
  let decl = []
  try {
    decl = JSON.parse(read(path.join(root, '.codex-review-fp.json')))
  } catch {
    decl = []
  }
  const scope = new Set(scopeFiles.map((x) => x.toLowerCase()))
  const evidence = []
  const accepted = new Set()
  for (const d of Array.isArray(decl) ? decl : []) {
    const f = findings.find((x) => x.finding_id === d.finding_id)
    if (!f) continue
    const file = (f.affected_file || '').toLowerCase()
    const inScope = !file || [...scope].some((p) => file === p || file.endsWith('/' + p) || p.endsWith('/' + file))
    const ok = !!String(d.rationale || '').trim() && !inScope
    if (ok) accepted.add(f.finding_id)
    evidence.push({ finding_id: f.finding_id, severity: f.severity, affected_file: f.affected_file, rationale: d.rationale ?? null, accepted: ok, reason: ok ? '지적 파일이 현재 작업 범위 밖' : !String(d.rationale || '').trim() ? '근거 없음' : '지적 파일이 현재 작업 범위 안 — 차단 유지', scope_files: scopeFiles })
  }
  return { evidence, accepted }
}

// ── 범위 리뷰(묶음) ──────────────────────────────────────────────────────

/** 범위의 모든 파일을 묶음으로 리뷰. 하나라도 실패하거나 묶음 상한을 넘으면 unknown 사유를 남긴다. */
function reviewRange({ files, from, head, deps, cfg, kind, ctx }) {
  const chunks = []
  for (let i = 0; i < files.length; i += cfg.filesPerChunk) chunks.push(files.slice(i, i + cfg.filesPerChunk))
  const reviewed = chunks.slice(0, cfg.maxChunks)
  const overflow = chunks.slice(cfg.maxChunks).flat()
  const findings = []
  const raws = []
  const failures = []
  let diffAll = ''
  for (const c of reviewed) {
    const diff = deps.diff(from, head, c)
    // diff 를 못 읽었거나 비었으면 리뷰한 것이 없다 — 통과가 아니라 판정 불가(Codex 리뷰 P1: 빈 문자열이 PASS·clean 이 됐다)
    if (diff == null || !String(diff).trim()) {
      failures.push(`diff 수집 실패 또는 빈 diff(${c.join(', ')})`)
      continue
    }
    diffAll += diff
    const r = deps.review(c, diff, kind)
    if (!r.ok) {
      failures.push(r.why || 'review failed')
      raws.push(saveRaw(deps.stateDir, `${kind}-failed`, head, `${r.why || 'review failed'}\n${r.out ?? ''}`))
      continue
    }
    raws.push(saveRaw(deps.stateDir, kind, head, r.out))
    const parsed = parseFindings(r.out, ctx)
    if (blockingMarkers(r.out) > parsed.filter((x) => ['P0', 'P1'].includes(x.severity)).length) failures.push('P0/P1 표지를 지적으로 판독하지 못했다')
    // 지적도 「지적 없음」 표지도 없는 출력(예: 「변경을 볼 수 없었다」)은 리뷰가 아니다 — PASS 로 세지 않는다
    else if (!parsed.length && !NO_FINDINGS_RE.test(String(r.out))) failures.push('리뷰 출력을 판독하지 못했다(지적도 「지적 없음」 도 없다)')
    findings.push(...parsed)
  }
  const fp = applyFalsePositives(findings, { root: ctx.root, scopeFiles: files, read: deps.readFile })
  for (const f of findings) if (fp.accepted.has(f.finding_id)) f.false_positive = true
  return { findings, raws, failures, overflow, false_positives: fp.evidence, diff_hash: sha1(diffAll), files_reviewed: reviewed.flat().length, files: reviewed.flat() }
}

const isBlocking = (f) => ['P0', 'P1'].includes(f.severity) && !f.false_positive

function verdictOf(rr) {
  if (rr.failures.length || rr.overflow.length) return VERDICT.UNKNOWN
  if (rr.findings.some(isBlocking)) return VERDICT.BLOCKED
  // 오탐 선언은 차단 루프만 멈춘다 — 범위 밖 판단은 자기 선언이라 통과 근거가 아니다(사람이 본다)
  if (rr.findings.some((f) => ['P0', 'P1'].includes(f.severity) && f.false_positive)) return VERDICT.UNKNOWN
  return VERDICT.PASS
}

const fpOnly = (rr) => !rr.failures.length && !rr.overflow.length && !rr.findings.some(isBlocking) && rr.findings.some((f) => f.false_positive)

function fmtFindings(fs_) {
  return fs_
    .filter(isBlocking)
    .map((f) => `- ${f.finding_id} [${f.severity}] ${f.affected_file ?? ''}${f.relevant_line ? `:${f.relevant_line}` : ''} — ${f.defect_summary}`)
    .join('\n')
}

// ── 본체 ─────────────────────────────────────────────────────────────────

/**
 * ctx: { sessionId, root, head, touched: string[] }
 * deps: { stateDir, isAncestor(a,b), mergeBase(a,b), diffNames(from,head), diff(from,head,files), review(files,diff,kind)→{ok,out,why}, log(msg) }
 * 반환: { exit: 0|2, stdout?, stderr?, verdict?, log }
 */
export function runStopReview(ctx, deps, cfgIn = {}) {
  const cfg = { ...DEFAULTS, ...cfgIn }
  const log = (m) => deps.log?.(m)
  const lock = acquireSessionLock(deps.stateDir, ctx.sessionId, deps.pid ?? process.pid)
  if (!lock.ok) {
    log(`pass: concurrent Stop hook for session (holder pid ${lock.holder?.pid ?? '?'}) — skipped`)
    return { exit: 0, log: 'concurrent' }
  }
  try {
    return inner(ctx, deps, cfg, log)
  } finally {
    lock.release()
  }
}

function inner(ctx, deps, cfg, log) {
  const { sessionId, root, head } = ctx
  const state = loadState(deps.stateDir, sessionId)
  const R = (state.roots[root] ||= { fix_rounds: 0, pending_block: null, seen: {}, final: null, history: [] })
  const persist = () => saveState(deps.stateDir, sessionId, state)
  const advance = () => {
    state.heads[root] = head
    R.fix_rounds = 0
    R.pending_block = null
    R.seen = {}
    R.seen_locs = []
    persist()
  }
  const base = state.heads[root]
  if (!base) {
    state.heads[root] = head
    persist()
    log(`pass: baseline ${head.slice(0, 9)} · root=${root}`)
    return { exit: 0, log: 'baseline' }
  }
  if (base === head) return { exit: 0, log: 'no new commits' }
  let from = base
  if (!deps.isAncestor(base, head)) from = deps.mergeBase(base, head)
  if (!from) {
    advance()
    log(`pass: base ${base.slice(0, 9)} unreachable — rebaselined`)
    return { exit: 0, log: 'base unreachable — rebaselined' }
  }
  const touched = new Set(ctx.touched)
  const names = deps.diffNames(from, head)
  if (names == null) {
    const rec = mkRecord({ root, head, from, rr: { findings: [], raws: [], failures: ['변경 파일 목록 수집 실패'], overflow: [], false_positives: [], diff_hash: null, files_reviewed: 0, files: [] }, v: VERDICT.UNKNOWN, kind: 'stop', R })
    recordVerdict(deps.stateDir, rec)
    log(`review UNKNOWN head=${head.slice(0, 9)} diff names failed`)
    return { exit: 0, verdict: VERDICT.UNKNOWN, stdout: JSON.stringify({ systemMessage: '[Codex 리뷰 판정 불가] REVIEW_UNKNOWN — 변경 파일 목록을 읽지 못했다. 통과가 아니다.' }), log: 'unknown' }
  }
  const files = names.filter((f) => touched.has(f))
  if (!files.length) {
    advance()
    log(`pass: new commits but no files from this session · ${from.slice(0, 9)}..${head.slice(0, 9)}`)
    return { exit: 0, log: 'no session files in range' }
  }
  const gctx = { ...goalContext(root), root }

  // 최종 판정 이후(post-final): 새 커밋은 1회 리뷰·기록·알림만 — 수정 루프로 되돌아가지 않는다(재귀 방지)
  if (R.final) {
    // 최종 판정을 낸 head 또는 이미 기록한 후속 head — 다시 리뷰하면 커밋 변화 없이 판정이 뒤집힌다(Codex 리뷰 P1)
    if (R.final.head === head || R.final.followup_head === head) return { exit: 0, verdict: R.final.verdict, log: 'final verdict stands for this head' }
    const rr = reviewRange({ files, from, head, deps, cfg, kind: 'post_final', ctx: gctx })
    const v = verdictOf(rr)
    const rec = mkRecord({ root, head, from, rr, v, kind: 'post_final', R })
    recordVerdict(deps.stateDir, rec)
    // 성공한 리뷰만 얼린다 — 실패·예산 초과(UNKNOWN + failures)는 같은 head 에서 다음 Stop 에 다시 시도(여전히 exit 0)
    if (!rr.failures.length) R.final.followup_head = head
    R.history.push(rec)
    if (v === VERDICT.PASS) {
      R.final = null // 차단이 풀렸다 — 정상 모드로 복귀
      advance()
      deps.onPass?.(files)
    } else persist()
    log(`post-final review ${v} head=${head.slice(0, 9)}`)
    return { exit: 0, verdict: v, stdout: JSON.stringify({ systemMessage: `[Codex 최종 이후 리뷰] ${v} · ${head.slice(0, 9)} · ${rr.findings.filter(isBlocking).length} P0/P1 — 자동 수정 루프는 다시 시작하지 않습니다. 기록: verdicts.jsonl` }), log: 'post_final' }
  }

  // 수정 사이클 계산: 직전 리뷰가 차단이었고 그 뒤 새 커밋이 생겼으면 수정 1회
  if (R.pending_block && R.pending_block.head !== head) {
    R.fix_rounds += 1
    R.pending_block = null // 한 번만 센다 — 이 head 의 리뷰가 실패(UNKNOWN)해 다음 Stop 에 다시 와도 두 번 세지 않는다
    persist()
  }

  if (R.fix_rounds >= cfg.maxFixRounds) {
    // 상한 — 마지막 코드에 읽기 전용 최종 리뷰 1회. 결과를 기록하고 멈춘다(exit 2 없음)
    const rr = reviewRange({ files, from, head, deps, cfg, kind: 'final', ctx: gctx })
    const v = verdictOf(rr)
    const rec = mkRecord({ root, head, from, rr, v, kind: 'final', R })
    recordVerdict(deps.stateDir, rec)
    R.history.push(rec)
    // 실패한 최종 리뷰는 판정으로 얼리지 않는다(Codex 리뷰 P1) — fix_rounds 는 상한에 머물러 다음 Stop 도 읽기 전용 최종 리뷰다
    R.final = rr.failures.length ? null : { verdict: v, head, at: rec.at }
    if (v === VERDICT.PASS) {
      R.final = null
      advance()
      deps.onPass?.(files)
    } else persist()
    log(`final review ${v} after ${R.fix_rounds} fix rounds head=${head.slice(0, 9)}`)
    const p01 = fmtFindings(rr.findings)
    const msg =
      v === VERDICT.PASS
        ? `[Codex 최종 리뷰] REVIEW_PASS — 수정 ${cfg.maxFixRounds}회 뒤 마지막 코드(${head.slice(0, 9)})에 P0/P1 없음.`
        : v === VERDICT.BLOCKED
          ? `[Codex 최종 리뷰] REVIEW_BLOCKED — 수정 ${cfg.maxFixRounds}회 뒤에도 P0/P1 이 남았다(${head.slice(0, 9)}). 이 작업은 완료·병합·배포 금지. 자동 수정 루프는 멈췄다:\n${p01}`
          : `[Codex 최종 리뷰] REVIEW_UNKNOWN — 판정 불가(${[...rr.failures, rr.overflow.length ? `파일 ${rr.overflow.length}개 미검토` : ''].filter(Boolean).join(' · ')}). 통과가 아니다.`
    return { exit: 0, verdict: v, stdout: JSON.stringify({ systemMessage: msg }), log: 'final' }
  }

  if (R.fp_hold === head) return { exit: 0, verdict: VERDICT.UNKNOWN, log: 'fp hold — 사람 확인 대기' }
  // 정상 리뷰
  const rr = reviewRange({ files, from, head, deps, cfg, kind: 'stop', ctx: gctx })
  const v = verdictOf(rr)
  const rec = mkRecord({ root, head, from, rr, v, kind: 'stop', R })
  recordVerdict(deps.stateDir, rec)
  R.history.push(rec)
  if (v === VERDICT.UNKNOWN) {
    // 실패·미검토 범위는 통과가 아니다 — 해시를 저장하지 않아 다음 Stop 에 다시 시도한다.
    // 오탐 선언만 남은 경우는 다시 리뷰해도 같다 — 이 head 는 사람 확인 대기로 둔다(기준선은 그대로)
    if (fpOnly(rr)) R.fp_hold = head
    persist()
    log(`review UNKNOWN head=${head.slice(0, 9)} failures=${rr.failures.length} overflow=${rr.overflow.length}`)
    return { exit: 0, verdict: v, stdout: JSON.stringify({ systemMessage: `[Codex 리뷰 판정 불가] REVIEW_UNKNOWN — ${[...rr.failures, rr.overflow.length ? `파일 ${rr.overflow.length}개 미검토(묶음 상한)` : ''].filter(Boolean).join(' · ')} — 통과가 아니다. 다음 Stop 에서 다시 시도한다.` }), log: 'unknown' }
  }
  if (v === VERDICT.PASS) {
    advance()
    deps.onPass?.(files)
    log(`review PASS head=${head.slice(0, 9)} files=${rr.files_reviewed}`)
    return { exit: 0, verdict: v, log: 'pass' }
  }
  // 차단: 같은 지문이 이전 차단 리뷰에도 있었으면 원인 분석으로 전환
  const blocking = rr.findings.filter(isBlocking)
  // 반복 = 같은 지문 또는 같은 파일 ±5줄의 같은 등급 지적. Codex 는 같은 결함을 매번 다른 말로 쓴다
  // (실측: 「adult threshold」 → 「adult classification」) — 문구 지문만으로는 반복을 놓친다
  const locs = (R.seen_locs ||= [])
  const near = (f) => locs.some((l) => l.severity === f.severity && l.file === (f.affected_file || '').toLowerCase() && f.relevant_line != null && l.line != null && Math.abs(l.line - f.relevant_line) <= 5)
  const repeated = blocking.filter((f) => (R.seen[f.finding_id] || 0) >= 1 || near(f))
  for (const f of blocking) {
    R.seen[f.finding_id] = (R.seen[f.finding_id] || 0) + 1
    if (f.affected_file) locs.push({ severity: f.severity, file: f.affected_file.toLowerCase(), line: f.relevant_line })
  }
  R.pending_block = { head, finding_ids: blocking.map((f) => f.finding_id) }
  persist()
  log(`review BLOCKED head=${head.slice(0, 9)} p01=${blocking.length} repeated=${repeated.length} fix_rounds=${R.fix_rounds}`)
  const header = `[Codex 리뷰 · ${from.slice(0, 9)}..${head.slice(0, 9)} · 수정 ${R.fix_rounds}/${cfg.maxFixRounds}회] REVIEW_BLOCKED — 차단 지적(P0·P1):\n${fmtFindings(rr.findings)}`
  const rootCause = repeated.length
    ? `\n\n⚠ 같은 결함이 반복됐다(${repeated.map((f) => f.finding_id).join(', ')}). 땜질 커밋을 더 하지 말고 **원인 분석**부터: 왜 이전 수정이 이 결함을 없애지 못했는지(가정·테스트 빈틈·범위)를 적고, 그 원인을 고친 뒤 커밋하라. 오탐이면 현재 작업 승인 범위(.agent-goal.md)와 대조한 근거를 남겨라.`
    : ''
  return {
    exit: 2,
    verdict: v,
    stderr: `${header}${rootCause}\n\n실제 결함이면 고쳐 커밋한다. 오탐이면 현재 작업 범위와 대조한 근거를 한 줄로 남긴다(불편하다는 이유로 넘기지 않는다). P2·P3 는 차단하지 않는다.`,
    log: repeated.length ? 'blocked_root_cause' : 'blocked',
  }
}

function mkRecord({ root, head, from, rr, v, kind, R }) {
  return {
    at: new Date().toISOString(),
    root: String(root).replace(/\\/g, '/'),
    head,
    range: `${from}..${head}`,
    diff_hash: rr.diff_hash,
    kind,
    verdict: v,
    fix_rounds: R.fix_rounds,
    files_reviewed: rr.files_reviewed,
    files: rr.files,
    files_unreviewed: rr.overflow.length,
    failures: rr.failures,
    p0_p1: rr.findings.filter(isBlocking),
    false_positives: rr.false_positives,
    raw_paths: rr.raws,
    tests: 'not_run_by_hook — 테스트 증거는 작업 증거(AI-Control)가 담는다',
  }
}
