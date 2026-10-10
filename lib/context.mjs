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

const SECRET_PATH = /(^|\/)\.env|secret|credential|\.pem$|\.key$|\.p12$|\.pfx$|id_rsa|\.npmrc$|\.netrc$/i
// 데이터를 담는 파일(DB 덤프·내보내기·시드)은 목록에도 발췌에도 넣지 않는다 — 학습자 개인정보가 들어 있을 수 있다(Codex 리뷰 P1)
const DATA_PATH = /\.(sql|dump|bak|csv|tsv|jsonl|ndjson|sqlite3?|db|parquet|xlsx?|har)$|(^|\/)(seeds?|dumps?|backups?|exports?|fixtures\/data)\//i
const SECRET_TEXT = [
  /sk-[A-Za-z0-9_-]{16,}/g,
  /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
  /(["']?[A-Za-z0-9_-]*(?:password|passwd|secret|token|api[_-]?key|service[_-]?role|private[_-]?key|access[_-]?key)[A-Za-z0-9_-]*["']?\s*[:=]\s*)(["'][^"'\n]{4,}["']|[^\s,;}"']{4,})/gi,
  /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis):\/\/[^\s"']+/gi,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
  // Supabase 프로젝트 ref(20자) — 운영 식별자라 외부 교환에 내보내지 않는다(실측: AGENTS.md 프로젝트 절에 들어 있었다)
  /(supabase[^\n]{0,24}?)\b[a-z]{20}\b/gi,
  /\b[a-z0-9]{20}\.supabase\.(?:co|in)\b/gi,
]
// 가린 뒤에도 남으면 그 발췌를 통째로 뺀다(fail closed)
const RESIDUAL = /sk-[A-Za-z0-9_-]{16,}|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.|PRIVATE KEY-----|SERVICE_ROLE_KEY\s*[:=]\s*["']?[A-Za-z0-9]/i
const excluded = (p) => SECRET_PATH.test(p) || DATA_PATH.test(p)
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex')

/** 외부 교환(ChatGPT·Work)으로 내보내는 패킷 파일 — 사용자 승인 범위(2026-10-09): 정본·목표·코드 경로·최소 발췌·최근 변경·미확인 가정 */
export const EXPORT_FILES = new Set(['platform-summary.md', 'goal-brief.md', 'existing-features.md', 'recent-changes.md', 'unverified-assumptions.md', 'evidence-manifest.json'])
export const WITHHELD_REASON = {
  'active-work-and-conflicts.md': '다른 작업·owner·로컬 worktree 경로 — 외부 교환 승인 범위 밖(로컬 판단용)',
  'design-decisions.md': '결정 기록 전체 — 외부 교환 승인 범위 밖. 이 목표의 수용 기준은 goal-brief.md, 완료 증거 유무는 unverified-assumptions.md 에 있다',
}

export const productRepo = () => process.env.VFC_PRODUCT_REPO || 'D:/workspace/Vocaflow'
export const contextDir = (ug) => path.join(root(), 'context', ug)

export function redact(text) {
  let s = String(text)
  for (const re of SECRET_TEXT) s = s.replace(re, (m, p1) => (typeof p1 === 'string' && p1 && m.startsWith(p1) ? `${p1}[REDACTED]` : '[REDACTED]'))
  if (RESIDUAL.test(s)) return '[REDACTED — 비밀값으로 보이는 내용이 남아 이 부분을 통째로 뺐다]'
  return s
}

export function globRe(g) {
  let re = ''
  for (let i = 0; i < g.length; i++) {
    const c = g[i]
    if (c === '*' && g[i + 1] === '*') {
      if (g[i + 2] === '/') {
        re += '(?:.*/)?'
        i += 2
      } else {
        re += '.*'
        i += 1
      }
    } else if (c === '*') re += '[^/]*'
    else if (c === '?') re += '[^/]'
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&')
  }
  return new RegExp(`^${re}$`)
}

function gitFactory(repo) {
  return (...a) => execFileSync('git', ['-C', repo, ...a], { encoding: 'utf8', maxBuffer: 64 << 20, stdio: ['ignore', 'pipe', 'ignore'] }).trim()
}

/** 패킷을 만든다(또는 캐시를 돌려준다). 반환 { dir, files[], manifest, cached } */
/**
 * 관련성 발췌 — 파일 전체를 내보내지 않는다. 머리(경로 주석·정책 주석) + export 선언 + 설계 문구의 식별자가 나오는 줄 주변.
 * 줄 번호를 붙여 근거로 인용할 수 있게 한다. 상한 maxLines 줄.
 */
export function relevantExcerpt(text, terms, { head = 25, around = 4, maxLines = 140 } = {}) {
  const lines = text.split('\n')
  const keep = new Set()
  for (let i = 0; i < Math.min(head, lines.length); i++) keep.add(i)
  const hit = (l) => /^\s*export\s/.test(l) || terms.some((t) => l.includes(t))
  lines.forEach((l, i) => {
    if (!hit(l)) return
    for (let j = Math.max(0, i - around); j <= Math.min(lines.length - 1, i + around); j++) keep.add(j)
  })
  const idx = [...keep].sort((a, b) => a - b).slice(0, maxLines)
  const out = []
  let prev = -2
  for (const i of idx) {
    if (i !== prev + 1) out.push('   …')
    out.push(`${String(i + 1).padStart(4)}  ${lines[i]}`)
    prev = i
  }
  return { body: out.join('\n'), kept: idx.length, total: lines.length }
}

/** 설계 문구에서 코드 식별자처럼 보이는 낱말(따옴표 안 · 점/밑줄 포함 · 카멜) */
export function designTerms(design) {
  const text = [design?.summary, design?.design, ...(design?.acceptance || [])].filter(Boolean).join(' ')
  const t = new Set()
  for (const m of text.matchAll(/'([A-Za-z_][\w.]{2,})'|`([A-Za-z_][\w.]{2,})`|\b([a-z]+[A-Z]\w+|[a-z_]+\.[a-z_]+|[A-Za-z]+_[A-Za-z_]+)\b/g)) t.add(m[1] || m[2] || m[3])
  return [...t].filter((x) => x.length >= 4).slice(0, 20)
}

/**
 * 패킷 기준 ref — 목표에 위임된 작업 브랜치가 원격에 있으면 그 브랜치(병합 전 완료 작업이 패킷에 보이게 · Work needs_info 실측 2026-10-10), 아니면 origin/main.
 */
export function contextRefFor(state, ug, git = gitFactory(productRepo())) {
  const g = state.userGoals?.goals?.[ug]
  const br = (g?.delegations || []).at(-1)?.branch
  if (!br) return 'origin/main'
  try {
    git('fetch', '-q', 'origin', br)
    git('rev-parse', '--verify', `origin/${br}`)
    return `origin/${br}`
  } catch {
    return 'origin/main'
  }
}

/** 문서에서 「§N」 절을 통째로 꺼낸다 — 제목 줄에 §N(또는 「N.」로 시작)이 있는 절부터 같은·상위 수준 제목 전까지(최대 220줄) */
export function docSections(text, refs) {
  const lines = String(text).split(/\r?\n/)
  const out = []
  for (const ref of refs) {
    const n = ref.replace(/[^0-9.]/g, '')
    const numRe = new RegExp(`^#{1,6}\\s+${n.replace('.', '\\.')}[.)\\s]`)
    const start = lines.findIndex((l) => /^#{1,6}\s/.test(l) && (l.includes(`§${n}`) || l.includes(`§ ${n}`) || numRe.test(l)))
    if (start < 0) continue
    const level = lines[start].match(/^#+/)[0].length
    let end = lines.findIndex((l, i) => i > start && /^#{1,6}\s/.test(l) && l.match(/^#+/)[0].length <= level)
    if (end < 0) end = lines.length
    out.push({ ref: `§${n}`, from: start + 1, body: lines.slice(start, Math.min(end, start + 220)).join('\n') })
  }
  return out
}

/**
 * ChatGPT 로 접수된 사용자 요청 — 원문 · 보충 요구 전체 · 원본 참조·해시(최근 3건). 요약·축약하지 않는다(2026-10-10: 보충 7항 누락 실측).
 * 이 글은 **요구사항 데이터**다 — 설계가 다룰 범위를 정하지만 승인·권한을 바꾸지 않는다(승인·owner·DB 는 기존 게이트).
 */
export function chatgptRequestsSection(g) {
  const rs = (g.chatgpt_requests || []).slice(-3)
  if (!rs.length) return []
  return [
    '',
    '## ChatGPT 접수 요청 — 사용자 원문과 보충 요구 전체(요구사항 데이터 · 승인 아님)',
    '아래 요구를 빠짐없이 다룬다. 일부 예시나 작은 증분으로 전체 요구를 대체하지 않는다. 다룰 수 없는 항목은 이유와 함께 open_questions 에 남긴다.',
    ...rs.flatMap((r, i) => [
      '',
      `### 요청 ${i + 1} · ${r.posted_at ?? r.at} · ${r.title ?? ''}`,
      `원본: ${r.source} · sha256 ${r.body_sha256 ? r.body_sha256.slice(0, 16) : '-'} · 작성 ${r.author ?? '-'}(${r.app ?? '-'})`,
      '',
      '**원문**',
      '',
      ...String(r.request).split('\n').map((l) => `> ${l}`),
      ...(r.supplement ? ['', '**보충 요구(원문의 검토 범위를 구체화)**', '', r.supplement] : []),
    ]),
  ]
}

/** 사용자 결정 대기로 남은 방향 — Work 에 다시 묻지 않게 패킷에 적는다(UG-0002 R07·R09·R10 이 같은 B-1 승인을 반복해 물었다) */
export const awaitingUser = (g) => (g.next_scope || []).filter((x) => /보류|승인 대기|별도 승인|동의/.test(x))

export function buildContext(state, ug, { ref = 'origin/main', fetch = false, git = gitFactory(productRepo()), now = () => new Date().toISOString(), maxExcerptFiles = 8, maxLines = 140 } = {}) {
  const g = state.userGoals?.goals?.[ug]
  if (!g) throw new Error(`사용자 목표 ${ug} 가 없다`)
  if (fetch) {
    try {
      git('fetch', '-q', 'origin', 'main')
    } catch {
      /* 오프라인이면 로컬 origin/main 을 쓴다 — manifest 에 그 커밋이 남는다 */
    }
  }
  const base = git('rev-parse', ref) // 이후 모든 읽기는 이 SHA 로 — 도중에 fetch 가 와도 섞이지 않는다
  const design = g.designs.find((d) => d.status === 'APPROVED') || g.designs[g.designs.length - 1] || null
  // 설계 경로 + 목표가 지정한 추가 근거 경로(다음 범위 판단에 필요한 기존 구현 — 예: 직접 확인 진단)
  const scope = [...(design?.allowed_paths || []), ...(g.context_extra_paths || [])]
  const tree = git('ls-tree', '-r', base).split('\n').filter(Boolean).map((l) => {
    const [meta, p] = l.split('\t')
    return { path: p, blob: meta.split(' ')[2] }
  })
  const res = scope.map(globRe)
  const related = tree.filter((f) => res.some((r) => r.test(f.path)) && !excluded(f.path))
  // 범위 파일의 형제 테스트(__tests__/<이름>.test.*) — 범위에 없어도 「무엇이 이미 검증되는가」를 보여 준다
  const stems = new Set(related.map((f) => path.posix.basename(f.path).replace(/\.[^.]+$/, '')))
  const tests = tree.filter((f) => /(__tests__|\.test\.|\.spec\.)/.test(f.path) && [...stems].some((s) => path.posix.basename(f.path).startsWith(`${s}.`)) && !excluded(f.path))
  const tasks = state.taskQueue.tasks
  const overlaps = (t) => (t.allowed_paths || []).some((p) => res.some((r) => r.test(p)) || related.some((f) => globRe(p).test(f.path)))
  const relTasks = tasks.filter((t) => t.user_goal_id === ug || overlaps(t))
  const key = sha(JSON.stringify({ excerpt_rule: 'relevant-v2', next_scope: g.next_scope || [], chatgpt_requests: (g.chatgpt_requests || []).map((r) => r.body_sha256 ?? r.source), export_rule: 'v1', base, design: design ? [design.version, design.status, design.summary, design.contract_hash] : null, scope, tasks: relTasks.map((t) => [t.task_id, t.status, t.verified_commit ?? null]) }))
  const dir = contextDir(ug)
  const mf = path.join(dir, 'evidence-manifest.json')
  if (fs.existsSync(mf)) {
    try {
      const prev = JSON.parse(fs.readFileSync(mf, 'utf8'))
      // 캐시 적중이라도 패킷 파일이 다 있어야 쓴다 — 빠졌으면 다시 만든다(첨부 단계에서 요청이 막히지 않게)
      if (prev.cache_key === key && prev.files_written.every((n) => fs.existsSync(path.join(dir, n)))) return { dir, files: [...prev.files_written, 'evidence-manifest.json'], manifest: prev, cached: true }
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
    agents = git('show', `${base}:AGENTS.md`)
  } catch {
    agents = ''
  }
  const proj = (agents.match(/## 프로젝트\n([\s\S]*?)\n## /) || [])[1] || '(AGENTS.md 「프로젝트」 절을 찾지 못했다)'
  files.push(write('platform-summary.md', [`# 플랫폼 요약 — doc_claim (AGENTS.md @ ${base.slice(0, 9)})`, '', proj.trim(), '', `정본 버전: ${doc.version ?? doc.canon_version ?? doc.schema_version ?? '?'}`, '', '## 이 목표가 묶인 정본 기준', ...canon.flatMap((c) => [`- ${c.id} 「${c.title}」`, ...(c.acceptance || []).map((a) => `  - ${a.criterion_id}: ${a.condition}`)])].join('\n')))

  // L2
  files.push(write('goal-brief.md', [`# ${ug} 「${g.title}」 (thread ${g.thread_id} · 프로필 ${g.profile} · 시작 ${g.origin})`, '', design ? `현재 설계 v${design.version} (${design.status}): ${design.summary}` : '설계 없음', '', '## 수용 기준(설계)', ...(design?.acceptance || []).map((a, i) => `- [${i}] ${a}`), '', '## 보존 계약', ...(design?.preserved_contracts || []).map((a) => `- ${a}`), '', `## 수정 허용 경로\n${scope.map((s) => `- ${s}`).join('\n') || '- (없음)'}`, '', '## 사용자 방향(next_scope)', ...((g.next_scope || []).map((x) => `- ${x}`)), '', '## 사용자 결정 대기 — 다시 묻지 말고 이번 설계 범위에서 뺀다(결정이 나면 AI-Control 이 다시 요청한다)', ...(awaitingUser(g).length ? awaitingUser(g).map((x) => `- ${x}`) : ['- 없음']), ...chatgptRequestsSection(g)].join('\n')))
  const terms = designTerms(design)
  const excerpt = related.slice(0, maxExcerptFiles).map((f) => {
    let ex = { body: '(읽기 실패)', kept: 0, total: 0 }
    try {
      ex = relevantExcerpt(git('show', `${base}:${f.path}`), terms, { maxLines })
    } catch {
      /* 읽기 실패 표시 */
    }
    return `### ${f.path} — code_verified (blob ${f.blob.slice(0, 9)} · 발췌 ${ex.kept}/${ex.total}줄 · 머리+export+설계 식별자 주변 · 줄 번호는 원본)\n\n\`\`\`\n${ex.body}\n\`\`\``
  })
  // 호출부 — 설계 경로 모듈을 import 하는 파일(경로만). 「렌더링 컴포넌트·호출부가 어디냐」 재질의를 막는다(UG-0002 R05 실측)
  const callers = []
  for (const f of related.filter((x) => (design?.allowed_paths || []).some((p) => globRe(p).test(x.path)) && /\.(ts|tsx)$/.test(x.path) && !/__tests__|\.test\./.test(x.path)).slice(0, 6)) {
    const stem = path.posix.basename(f.path).replace(/\.[^.]+$/, '')
    let hits = []
    try {
      hits = git('grep', '-l', '-E', `from ['"][^'"]*/${stem}['"]`, base, '--', 'apps/web/src').split('\n').filter(Boolean)
    } catch {
      hits = [] // git grep 은 결과가 없으면 exit 1
    }
    for (const h of hits) {
      const p = h.slice(base.length + 1)
      if (p !== f.path && !/__tests__|\.test\./.test(p) && !callers.some((c) => c.caller === p && c.module === f.path)) callers.push({ module: f.path, caller: p })
    }
  }
  // 사용자 방향이 문서 절(§N)을 가리키면 범위 문서에서 그 절을 통째로 — 발췌 상한(앞 N개 파일) 때문에 정본 절이 빠지던 문제(UG-0002 R11 실측)
  const refs = [...new Set((g.next_scope || []).join(' ').match(/§\s?\d+(?:\.\d+)?/g) || [])]
  const sections = []
  for (const f of refs.length ? related.filter((x) => /\.md$/i.test(x.path)) : []) {
    try {
      for (const sct of docSections(git('show', `${base}:${f.path}`), refs)) sections.push(`### ${f.path} ${sct.ref} (줄 ${sct.from}~ · doc_claim)\n\n${sct.body}`)
    } catch {
      /* 읽기 실패 */
    }
  }
  files.push(write('existing-features.md', [`# 관련 코드 (main ${base.slice(0, 9)}) — 범위 파일 ${related.length}개${related.length > maxExcerptFiles ? ` · 앞 ${maxExcerptFiles}개만 발췌(각 ${maxLines}줄)` : ''}`, '', ...related.map((f) => `- ${f.path}`), '', '## 관련 테스트 파일 (존재 = code_verified · 통과 여부는 test_verified 절)', ...(tests.length ? tests.map((f) => `- ${f.path}`) : ['- 없음 — 이 범위는 테스트가 없다(unverified)']), '', '## 호출부 — 설계 경로 모듈을 import 하는 파일(경로만 · code_verified)', ...(callers.length ? callers.slice(0, 20).map((c) => `- ${c.caller} → ${c.module}`) : ['- 없음']), ...(refs.length ? ['', `## 사용자 방향이 가리키는 문서 절 ${refs.join(' ')}`, ...(sections.length ? sections : ['- 범위 문서에서 해당 절을 찾지 못했다(unverified)'])] : []), '', ...excerpt].join('\n')))
  const verified = relTasks.filter((t) => t.status === 'COMPLETED')
  files.push(write('design-decisions.md', [`# 결정·검증 기록`, '', '## test_verified — 완료 작업의 통과 증거', ...(verified.length ? verified.map((t) => `- ${t.task_id} ${t.title} · commit ${t.verified_commit ?? '-'} · 리뷰 ${t.review_record ?? '-'}${t.revalidate_required ? ' · ⚠ 재검증 필요' : ''}`) : ['- 없음']), '', '## 결정 기록(사용자 APPROVED 만 확정 · 나머지는 제안)', ...state.decisionLog.entries.filter((e) => e.ug_ref === ug || (e.affects_goal_ids || []).some((x) => g.canon_goal_ids.includes(x)) || String(e.summary || '').includes(ug)).slice(-15).map((e) => `- ${e.decision_id} [${e.status}] ${String(e.summary).slice(0, 160)}`)].join('\n')))

  // L3
  let log = ''
  try {
    log = scope.length ? git('log', base, '-n', '15', '--format=%h %ad %s', '--date=short', '--', ...scope.map((s) => `:(glob)${s}`)) : ''
  } catch {
    log = ''
  }
  files.push(write('recent-changes.md', [`# 최근 변경 — main HEAD ${base}`, '', '## 범위 파일을 바꾼 커밋(최근 15)', log || '- 없음'].join('\n')))
  const active = tasks.filter((t) => ['READY', 'IN_PROGRESS', 'REVIEW', 'BLOCKED', 'WAITING_CHATGPT'].includes(t.status) && overlaps(t))
  files.push(write('active-work-and-conflicts.md', [`# 활성 작업 · 소유권 · 충돌 가능성`, '', ...(active.length ? active.map((t) => `- ${t.task_id} [${t.status}] ${t.title} · owner ${t.owner_id} · worktree ${t.worktree ?? '-'}${t.user_goal_id ? ` · ${t.user_goal_id} v${t.design_version}` : ''}`) : ['- 같은 범위를 쓰는 활성 작업 없음']), '', '## 소유자 worktree', ...Object.values(state.ownership.owners).flatMap((o) => o.worktrees.map((w) => `- ${o.owner_id}: ${w.path} (${w.branch ?? '-'})`))].join('\n')))
  const covered = new Set(verified.filter((t) => t.user_goal_id === ug && t.design_version === design?.version && !t.revalidate_required).flatMap((t) => t.design_acceptance || []))
  const assumptions = (design?.acceptance || []).map((a, i) => (covered.has(i) ? null : `- [${i}] ${a} — 아직 통과 증거 없음`)).filter(Boolean)
  files.push(write('unverified-assumptions.md', ['# 아직 확인하지 못한 것 — unverified', '', ...(assumptions.length ? assumptions : ['- 설계 수용 기준은 모두 통과 증거가 있다']), ...(tests.length ? [] : ['- 범위 코드에 테스트 파일이 없다 — 현재 동작은 코드 읽기로만 안다']), '- DB 실데이터·운영 상태는 이 패킷에 없다(자동 경로는 DB 에 접속하지 않는다)', '', '## 이미 검증된 것 — 이 목표의 완료 작업 · 검증 커밋 · 실행 명령 · 결과(「어느 커밋에 있나 · 결과가 뭐냐」 재질의 방지 — UG-0002 R02·R04·R08 실측)', ...(verified.filter((t) => t.user_goal_id === ug).length ? verified.filter((t) => t.user_goal_id === ug).flatMap((t) => [`- ${t.task_id} ${t.title} · 설계 v${t.design_version} · 검증 커밋 ${t.verified_commit ?? '-'}${t.revalidate_required ? ' · ⚠ 재검증 필요' : ''}`, ...(t.evidence || []).filter((e) => e.run_seq === t.run_seq).map((e) => `  - ${e.type} · ${String(e.command_or_protocol).slice(0, 220)} → ${e.result} · skip ${e.skip_count ?? 0}${e.commit ? ` · commit ${e.commit}` : ''}`)]) : ['- 없음'])].join('\n')))

  const manifest = {
    schema: 'vfc-context/1',
    ug,
    thread_id: g.thread_id,
    canon_version: doc.version ?? doc.canon_version ?? doc.schema_version ?? null,
    base_commit: base,
    ref,
    generated_at: now(),
    design_version: design?.version ?? null,
    contract_hash: design?.contract_hash ?? null,
    cache_key: key,
    source_files: related.map((f) => ({ path: f.path, blob: f.blob })).concat(tests.map((f) => ({ path: f.path, blob: f.blob, kind: 'test' })), tree.filter((f) => f.path === 'AGENTS.md').map((f) => ({ path: f.path, blob: f.blob, kind: 'platform_doc' }))),
    // 비밀 경로는 이름도 남기지 않고 개수만 · 데이터 파일은 경로만(내용 없음)
    excluded: { secret_paths: tree.filter((f) => res.some((r) => r.test(f.path)) && SECRET_PATH.test(f.path)).length, data_paths: tree.filter((f) => res.some((r) => r.test(f.path)) && !SECRET_PATH.test(f.path) && DATA_PATH.test(f.path)).map((f) => f.path) },
    classes: { 'platform-summary.md': 'doc_claim', 'goal-brief.md': 'design', 'existing-features.md': 'code_verified', 'design-decisions.md': 'test_verified+decisions', 'recent-changes.md': 'code_verified', 'active-work-and-conflicts.md': 'state', 'unverified-assumptions.md': 'unverified' },
    files_written: files,
    exported_files: files.filter((f) => EXPORT_FILES.has(f)).concat(['evidence-manifest.json']),
    withheld_files: files.filter((f) => !EXPORT_FILES.has(f)).map((f) => ({ file: f, reason: WITHHELD_REASON[f] || '외부 교환 대상 아님' })),
    redaction: 'secret-like paths skipped · key/token/password/DB-URL patterns masked',
  }
  fs.writeFileSync(mf, JSON.stringify(manifest, null, 2))
  return { dir, files: [...files, 'evidence-manifest.json'], manifest, cached: false }
}

/** 새 설계(ChatGPT)를 main 코드와 대조: 범위 경로가 실제로 있는가(새 파일이면 상위 폴더라도 있는가). Claude 정합성 검토의 기계 부분. */
export function checkDesignAgainstCode(design, { ref = 'origin/main', git = gitFactory(productRepo()) } = {}) {
  let tree = []
  try {
    tree = git('ls-tree', '-r', '--name-only', git('rev-parse', ref)).split('\n')
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
