// lib/context.mjs — 목표별 최신 컨텍스트 패킷(Context Sync · WF-S9)
//
// ChatGPT 가 현재 플랫폼을 모른 채 설계하지 않도록, 설계 요청 때 그 목표에 필요한 정보만 골라 패킷으로 붙인다.
//   L1 플랫폼 핵심   AGENTS.md 「프로젝트」 절(main 기준) · 정본 버전 · 목표 정본 기준
//   L2 목표 관련     설계 범위(allowed_paths)의 main 파일 목록·발췌·관련 테스트 · 검증된 작업 증거 · 결정 기록
//   L3 최신 변경     main HEAD · 범위 파일의 최근 커밋 · 활성 작업·소유자·잠금(충돌 가능성)
// 모든 사실에 출처 등급을 붙인다: code_verified(main 커밋에서 직접 읽음) · test_verified(완료 작업의 통과 증거) ·
//   doc_claim(문서의 주장) · unverified(아직 확인 못 한 가정). 근거 약한 설계가 확정안으로 오르는 것을 막는다.
// 캐시: base_commit + 설계 계약 해시 + 관련 작업 상태가 같으면 다시 만들지 않는다. main 이 움직이면 새로 만든다.
// 비밀값: .env·키·인증서 경로는 읽지 않고, 발췌에서 키 모양 문자열을 가린다. DB 에 접속하지 않는다.

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { root } from './paths.mjs'
import { loadCriteria } from './goals.mjs'

const SECRET_PATH = /(^|\/)\.env|secret|credential|\.pem$|\.key$|\.p12$|id_rsa/i
const SECRET_TEXT = [/sk-[A-Za-z0-9_-]{16,}/g, /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, /((?:password|passwd|secret|token|api[_-]?key|service_role)\s*[:=]\s*)["']?[^"'\s]{6,}/gi, /postgres(?:ql)?:\/\/[^\s"']+/gi]
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex')

export const productRepo = () => process.env.VFC_PRODUCT_REPO || 'D:/workspace/Vocaflow'
export const contextDir = (ug) => path.join(root(), 'context', ug)

export function redact(text) {
  let s = String(text)
  for (const re of SECRET_TEXT) s = s.replace(re, (m, p1) => (p1 ? `${p1}[REDACTED]` : '[REDACTED]'))
  return s
}

const globRe = (g) => new RegExp('^' + g.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*\//g, '(?:.*/)?').replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*') + '$')

function gitFactory(repo) {
  return (...a) => execFileSync('git', ['-C', repo, ...a], { encoding: 'utf8', maxBuffer: 64 << 20, stdio: ['ignore', 'pipe', 'ignore'] }).trim()
}

/** 패킷을 만든다(또는 캐시를 돌려준다). 반환 { dir, files[], manifest, cached } */
export function buildContext(state, ug, { ref = 'origin/main', fetch = false, git = gitFactory(productRepo()), now = () => new Date().toISOString(), maxExcerptFiles = 8, maxLines = 60 } = {}) {
  const g = state.userGoals?.goals?.[ug]
  if (!g) throw new Error(`사용자 목표 ${ug} 가 없다`)
  if (fetch) {
    try {
      git('fetch', '-q', 'origin', 'main')
    } catch {
      /* 오프라인이면 로컬 origin/main 을 쓴다 — manifest 에 그 커밋이 남는다 */
    }
  }
  const base = git('rev-parse', ref)
  const design = g.designs.find((d) => d.status === 'APPROVED') || g.designs[g.designs.length - 1] || null
  const scope = design?.allowed_paths || []
  const tree = git('ls-tree', '-r', ref).split('\n').filter(Boolean).map((l) => {
    const [meta, p] = l.split('\t')
    return { path: p, blob: meta.split(' ')[2] }
  })
  const res = scope.map(globRe)
  const related = tree.filter((f) => res.some((r) => r.test(f.path)) && !SECRET_PATH.test(f.path))
  // 범위 파일의 형제 테스트(__tests__/<이름>.test.*) — 범위에 없어도 「무엇이 이미 검증되는가」를 보여 준다
  const stems = new Set(related.map((f) => path.posix.basename(f.path).replace(/\.[^.]+$/, '')))
  const tests = tree.filter((f) => /(__tests__|\.test\.|\.spec\.)/.test(f.path) && [...stems].some((s) => path.posix.basename(f.path).startsWith(`${s}.`)) && !SECRET_PATH.test(f.path))
  const tasks = state.taskQueue.tasks
  const overlaps = (t) => (t.allowed_paths || []).some((p) => res.some((r) => r.test(p)) || related.some((f) => globRe(p).test(f.path)))
  const relTasks = tasks.filter((t) => t.user_goal_id === ug || overlaps(t))
  const key = sha(JSON.stringify({ base, contract: design?.contract_hash ?? null, scope, tasks: relTasks.map((t) => [t.task_id, t.status, t.verified_commit ?? null]) }))
  const dir = contextDir(ug)
  const mf = path.join(dir, 'evidence-manifest.json')
  if (fs.existsSync(mf)) {
    try {
      const prev = JSON.parse(fs.readFileSync(mf, 'utf8'))
      if (prev.cache_key === key) return { dir, files: prev.files_written, manifest: prev, cached: true }
    } catch {
      /* 깨진 manifest 는 새로 만든다 */
    }
  }
  fs.mkdirSync(dir, { recursive: true })
  const write = (name, body) => {
    fs.writeFileSync(path.join(dir, name), redact(body))
    return name
  }
  const files = []
  const doc = loadCriteria()
  const canon = g.canon_goal_ids.map((id) => doc.criteria.find((c) => c.id === id)).filter(Boolean)

  // L1
  let agents = ''
  try {
    agents = git('show', `${ref}:AGENTS.md`)
  } catch {
    agents = ''
  }
  const proj = (agents.match(/## 프로젝트\n([\s\S]*?)\n## /) || [])[1] || '(AGENTS.md 「프로젝트」 절을 찾지 못했다)'
  files.push(write('platform-summary.md', [`# 플랫폼 요약 — doc_claim (AGENTS.md @ ${base.slice(0, 9)})`, '', proj.trim(), '', `정본 버전: ${doc.version ?? doc.canon_version ?? '?'}`, '', '## 이 목표가 묶인 정본 기준', ...canon.flatMap((c) => [`- ${c.id} 「${c.title}」`, ...(c.acceptance || []).map((a) => `  - ${a.criterion_id}: ${a.condition}`)])].join('\n')))

  // L2
  files.push(write('goal-brief.md', [`# ${ug} 「${g.title}」 (thread ${g.thread_id} · 프로필 ${g.profile} · 시작 ${g.origin})`, '', design ? `현재 설계 v${design.version} (${design.status}): ${design.summary}` : '설계 없음', '', '## 수용 기준(설계)', ...(design?.acceptance || []).map((a, i) => `- [${i}] ${a}`), '', '## 보존 계약', ...(design?.preserved_contracts || []).map((a) => `- ${a}`), '', `## 수정 허용 경로\n${scope.map((s) => `- ${s}`).join('\n') || '- (없음)'}`].join('\n')))
  const excerpt = related.slice(0, maxExcerptFiles).map((f) => {
    let body = ''
    try {
      body = git('show', `${ref}:${f.path}`).split('\n').slice(0, maxLines).join('\n')
    } catch {
      body = '(읽기 실패)'
    }
    return `### ${f.path} — code_verified (blob ${f.blob.slice(0, 9)})\n\n\`\`\`\n${body}\n\`\`\``
  })
  files.push(write('existing-features.md', [`# 관련 코드 (main ${base.slice(0, 9)}) — 범위 파일 ${related.length}개${related.length > maxExcerptFiles ? ` · 앞 ${maxExcerptFiles}개만 발췌(각 ${maxLines}줄)` : ''}`, '', ...related.map((f) => `- ${f.path}`), '', '## 관련 테스트 파일 (존재 = code_verified · 통과 여부는 test_verified 절)', ...(tests.length ? tests.map((f) => `- ${f.path}`) : ['- 없음 — 이 범위는 테스트가 없다(unverified)']), '', ...excerpt].join('\n')))
  const verified = relTasks.filter((t) => t.status === 'COMPLETED')
  files.push(write('design-decisions.md', [`# 결정·검증 기록`, '', '## test_verified — 완료 작업의 통과 증거', ...(verified.length ? verified.map((t) => `- ${t.task_id} ${t.title} · commit ${t.verified_commit ?? '-'} · 리뷰 ${t.review_record ?? '-'}${t.revalidate_required ? ' · ⚠ 재검증 필요' : ''}`) : ['- 없음']), '', '## 결정 기록(사용자 APPROVED 만 확정 · 나머지는 제안)', ...state.decisionLog.entries.filter((e) => e.ug_ref === ug || (e.affects_goal_ids || []).some((x) => g.canon_goal_ids.includes(x)) || String(e.summary || '').includes(ug)).slice(-15).map((e) => `- ${e.decision_id} [${e.status}] ${String(e.summary).slice(0, 160)}`)].join('\n')))

  // L3
  let log = ''
  try {
    log = scope.length ? git('log', ref, '-n', '15', '--format=%h %ad %s', '--date=short', '--', ...scope.map((s) => `:(glob)${s}`)) : ''
  } catch {
    log = ''
  }
  files.push(write('recent-changes.md', [`# 최근 변경 — main HEAD ${base}`, '', '## 범위 파일을 바꾼 커밋(최근 15)', log || '- 없음'].join('\n')))
  const active = tasks.filter((t) => ['READY', 'IN_PROGRESS', 'REVIEW', 'BLOCKED', 'WAITING_CHATGPT'].includes(t.status) && overlaps(t))
  files.push(write('active-work-and-conflicts.md', [`# 활성 작업 · 소유권 · 충돌 가능성`, '', ...(active.length ? active.map((t) => `- ${t.task_id} [${t.status}] ${t.title} · owner ${t.owner_id} · worktree ${t.worktree ?? '-'}${t.user_goal_id ? ` · ${t.user_goal_id} v${t.design_version}` : ''}`) : ['- 같은 범위를 쓰는 활성 작업 없음']), '', '## 소유자 worktree', ...Object.values(state.ownership.owners).flatMap((o) => o.worktrees.map((w) => `- ${o.owner_id}: ${w.path} (${w.branch ?? '-'})`))].join('\n')))
  const covered = new Set(verified.filter((t) => t.user_goal_id === ug && t.design_version === design?.version && !t.revalidate_required).flatMap((t) => t.design_acceptance || []))
  const assumptions = (design?.acceptance || []).map((a, i) => (covered.has(i) ? null : `- [${i}] ${a} — 아직 통과 증거 없음`)).filter(Boolean)
  files.push(write('unverified-assumptions.md', ['# 아직 확인하지 못한 것 — unverified', '', ...(assumptions.length ? assumptions : ['- 설계 수용 기준은 모두 통과 증거가 있다']), ...(tests.length ? [] : ['- 범위 코드에 테스트 파일이 없다 — 현재 동작은 코드 읽기로만 안다']), '- DB 실데이터·운영 상태는 이 패킷에 없다(자동 경로는 DB 에 접속하지 않는다)'].join('\n')))

  const manifest = {
    schema: 'vfc-context/1',
    ug,
    thread_id: g.thread_id,
    canon_version: doc.version ?? doc.canon_version ?? null,
    base_commit: base,
    ref,
    generated_at: now(),
    design_version: design?.version ?? null,
    contract_hash: design?.contract_hash ?? null,
    cache_key: key,
    source_files: related.map((f) => ({ path: f.path, blob: f.blob })).concat(tests.map((f) => ({ path: f.path, blob: f.blob, kind: 'test' }))),
    classes: { 'platform-summary.md': 'doc_claim', 'goal-brief.md': 'design', 'existing-features.md': 'code_verified', 'design-decisions.md': 'test_verified+decisions', 'recent-changes.md': 'code_verified', 'active-work-and-conflicts.md': 'state', 'unverified-assumptions.md': 'unverified' },
    files_written: files,
    redaction: 'secret-like paths skipped · key/token/password/DB-URL patterns masked',
  }
  fs.writeFileSync(mf, JSON.stringify(manifest, null, 2))
  return { dir, files: [...files, 'evidence-manifest.json'], manifest, cached: false }
}

/** 새 설계(ChatGPT)를 main 코드와 대조: 범위 경로가 실제로 있는가(새 파일이면 상위 폴더라도 있는가). Claude 정합성 검토의 기계 부분. */
export function checkDesignAgainstCode(design, { ref = 'origin/main', git = gitFactory(productRepo()) } = {}) {
  let tree = []
  try {
    tree = git('ls-tree', '-r', '--name-only', ref).split('\n')
  } catch {
    return { checked: false, reason: 'main 트리를 읽지 못했다' }
  }
  const dirs = new Set(tree.flatMap((f) => f.split('/').slice(0, -1).map((_, i, a) => a.slice(0, i + 1).join('/'))))
  const issues = []
  for (const p of design.allowed_paths || []) {
    const re = globRe(p)
    if (tree.some((f) => re.test(f))) continue
    const parent = p.replace(/\/?\*.*$/, '').split('/').slice(0, p.includes('*') ? undefined : -1).join('/')
    if (parent && dirs.has(parent)) issues.push({ path: p, kind: 'new_file', note: '아직 없는 파일 — 새로 만드는 설계' })
    else issues.push({ path: p, kind: 'missing', note: '경로도 상위 폴더도 main 에 없다 — 현재 구조와 다를 수 있다' })
  }
  return { checked: true, ref, missing: issues.filter((i) => i.kind === 'missing'), new_files: issues.filter((i) => i.kind === 'new_file') }
}
