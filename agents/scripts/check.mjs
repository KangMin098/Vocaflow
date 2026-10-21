#!/usr/bin/env node
// agents/scripts/check.mjs
//
// 두 에이전트 설정의 불변식 검사 — CI(.github/workflows/ci.yml verify)가 부른다.
//   D1  CLAUDE.md 첫 줄 "@AGENTS.md" · AGENTS.md ≤ 200줄 · ≤ 32 KiB
//   D2  mcp 생성물 드리프트 0 (sync.mjs --check 와 같은 판정)
//   D3  에이전트 설정 파일 전체에서 비밀값 패턴 0
//   D9  .gitignore 로컬 전용 항목 · 드레인 서브에이전트 Codex 짝
//   D11 PR 자동화 정책 정본 존재 · 형식 · AGENTS.md 정책 줄 버전 일치 · 옛 승인 규칙 없음 · DECISIONS 이력
//
//   node agents/scripts/check.mjs            # 표 출력, 실패 시 exit 1
//   node agents/scripts/check.mjs --quiet    # 실패 항목만 출력

import fs from 'node:fs'
import path from 'node:path'
import { ROOT, findSecrets, isMain, lf, readText, rel } from './lib.mjs'
import { plan } from './sync.mjs'

export const AGENTS_MAX_LINES = 200
export const AGENTS_MAX_BYTES = 32 * 1024
export const GITIGNORE_LOCAL = ['.claude/settings.local.json', '.agent-handoff/', '.agent-lock', '.agent-logs/']

// #122의 기존 라쳇을 보존한다. 새로운 승인/세션 시작 절차를 추가하지 않는다.
export const KNOWN_DUPLICATE_MIGRATION_VERSIONS = new Set([
  '20260606140000', '20260608120000', '20260614130000', '20260614200000', '20260614220000', '20260614230000',
  '20260708120000', '20260712160000', '20260712165000', '20260712170000', '20260712180000', '20260713100000',
  '20260808240000', '20260809120000', '20260830170000', '20260906030000', '20260924150000',
])

export function duplicateMigrationVersions(names, known = KNOWN_DUPLICATE_MIGRATION_VERSIONS) {
  const byVersion = new Map()
  for (const name of names) {
    const match = name.match(/^(\d{8})_?(\d{6})?_.+\.sql$/)
    if (!match) continue
    const version = match[1] + (match[2] ?? '')
    byVersion.set(version, [...(byVersion.get(version) ?? []), name])
  }
  return [...byVersion].filter(([version, files]) => files.length > 1 && !known.has(version)).map(([, files]) => files)
}

/** 에이전트가 읽는 설정·지시 파일 전부 */
function agentConfigFiles() {
  const fixed = ['AGENTS.md', 'CLAUDE.md', '.mcp.json', '.claude/settings.json', 'apps/web/CLAUDE.md', 'apps/mobile/CLAUDE.md', 'packages/design-tokens/CLAUDE.md']
  const walk = (dir) => {
    const abs = rel(dir)
    if (!fs.existsSync(abs)) return []
    return fs.readdirSync(abs, { withFileTypes: true }).flatMap((d) => {
      const p = `${dir}/${d.name}`
      if (d.isDirectory()) return d.name === 'node_modules' ? [] : walk(p)
      return /\.(md|json|toml|rules|mjs|sh)$/.test(d.name) ? [p] : []
    })
  }
  return [...fixed, ...walk('agents'), ...walk('.codex'), ...walk('.claude/agents'), ...walk('.claude/commands')].filter((p) =>
    fs.existsSync(rel(p)),
  )
}

export function runChecks() {
  const rows = []
  const add = (id, name, ok, detail = '') => rows.push({ id, name, ok, detail })

  // D1
  const agents = readText(rel('AGENTS.md'))
  const claude = readText(rel('CLAUDE.md'))
  if (agents === null || claude === null) {
    add('D1', 'AGENTS.md · CLAUDE.md 존재', false, '파일 없음')
  } else {
    const first = lf(claude).split('\n')[0].trim()
    add('D1', 'CLAUDE.md 첫 줄 = @AGENTS.md', first === '@AGENTS.md', `첫 줄: ${first}`)
    const lines = lf(agents).trimEnd().split('\n').length
    add('D1', `AGENTS.md ≤ ${AGENTS_MAX_LINES}줄`, lines <= AGENTS_MAX_LINES, `${lines}줄`)
    const bytes = Buffer.byteLength(agents)
    add('D1', 'AGENTS.md ≤ 32 KiB (Codex project_doc_max_bytes)', bytes <= AGENTS_MAX_BYTES, `${bytes} B`)
  }

  // D2
  try {
    const drift = plan().filter((p) => !p.ok)
    add('D2', 'MCP 생성물 = mcp.source.json', drift.length === 0, drift.length ? drift.map((d) => d.file).join(', ') : '.mcp.json · .codex/config.toml')
  } catch (e) {
    add('D2', 'MCP 생성물 = mcp.source.json', false, e.message)
  }

  // D3
  const files = agentConfigFiles()
  const hits = files.flatMap((f) =>
    f.includes('__tests__') ? [] : findSecrets(readText(rel(f))).map((h) => `${f}:${h.line} ${h.name}`),
  )
  add('D3', `설정 파일 ${files.length}개 비밀값 0`, hits.length === 0, hits.length ? hits.join(' / ') : '0')

  // D9
  const gi = lf(readText(rel('.gitignore')) ?? '').split('\n').map((l) => l.trim())
  const missing = GITIGNORE_LOCAL.filter((p) => !gi.includes(p))
  add('D9', '.gitignore 로컬 전용 4항목', missing.length === 0, missing.length ? `누락: ${missing.join(', ')}` : GITIGNORE_LOCAL.join(' · '))

  // D9 — 드레인 서브에이전트는 두 에이전트가 같이 쓴다.
  // ⚠️ `.claude/agents/` 에만 만들면 **Codex 는 그 드레인을 못 돌린다.** 조용히 갈라지는 종류의 결함이라
  //    (실측 2026-09-23: `csat-source-judge` 가 Claude 쪽에만 생겼고 아무 검사도 안 걸렸다) 여기서 막는다.
  //    반대 방향은 검사하지 않는다 — `reviewer`·`test-writer` 처럼 Codex 전용 에이전트가 정상적으로 있다.
  const claudeAgents = fs.existsSync(rel('.claude', 'agents'))
    ? fs.readdirSync(rel('.claude', 'agents')).filter((f) => f.endsWith('.md')).map((f) => f.replace(/.md$/, ''))
    : []
  const orphanAgents = claudeAgents.filter((n) => !fs.existsSync(rel('.codex', 'agents', `${n}.toml`)))
  add('D9', `서브에이전트 ${claudeAgents.length}개 Codex 짝 존재`, orphanAgents.length === 0,
    orphanAgents.length ? `Codex 짝 없음: ${orphanAgents.join(', ')}` : claudeAgents.join(' · '))

  const migrationDir = rel('supabase', 'migrations')
  const duplicateVersions = fs.existsSync(migrationDir) ? duplicateMigrationVersions(fs.readdirSync(migrationDir)) : []
  add('D10', '마이그레이션 새 버전 중복 0', duplicateVersions.length === 0,
    duplicateVersions.length ? duplicateVersions.map(files => files.join(' = ')).join(' / ') : '0')

  // D11 — PR 자동화 정책(v1.1 · 2026-10-11). 모든 세션이 같은 정본을 읽어야 한다 — AGENTS.md 의 정책 줄 버전과 JSON 버전이 어긋나면
  //   한쪽 세션은 옛 승인 규칙으로 돈다. DECISIONS 에 그 버전의 이력이 있어야 한다.
  for (const r of policyChecks()) add('D11', r.name, r.ok, r.detail)

  return rows
}

/** D11 — 정책 정본 · AGENTS.md 참조 · 이력 일치(파일만 읽는다 · read 주입으로 테스트) */
export function policyChecks(read = (p) => readText(rel(p))) {
  const out = []
  const add = (name, ok, detail = '') => out.push({ name, ok, detail })
  const raw = read('agents/policies/pr-automation.json')
  let p = null
  try {
    p = raw === null ? null : JSON.parse(raw)
  } catch (e) {
    add('정책 JSON 유효', false, e.message)
    return out
  }
  add('정책 정본 2파일 존재', p !== null && read('agents/policies/PR_AUTOMATION_POLICY.md') !== null, 'agents/policies/PR_AUTOMATION_POLICY.md · pr-automation.json')
  if (!p) return out
  const shape = p.mode === 'AUTO_CONTINUE' && Array.isArray(p.required_checks) && p.required_checks.length > 0 && !!p.merge && typeof p.merge.auto_merge_enabled === 'boolean'
    && ['data_deletion', 'db_change', 'critical_security'].every((key) => typeof p.approval_required?.[key] === 'string' && p.approval_required[key].trim())
    && p.merge.scope_contract_required === true
  add('정책 형식(AUTO_CONTINUE · DB/삭제/중대 보안 승인 · 범위 계약 · 필수 체크)', shape, `v${p.version}`)
  const agents = read('AGENTS.md') ?? ''
  const m = agents.match(/PR_AUTOMATION_POLICY v(\d+(?:\.\d+)*)/)
  add('AGENTS.md 정책 줄 버전 = 정본 버전', !!m && m[1] === p.version, m ? `AGENTS.md v${m[1]} · JSON v${p.version}` : 'AGENTS.md 에 「PR_AUTOMATION_POLICY v…」 줄 없음')
  add('옛 승인 규칙 없음(main 머지 · 파일 ≥30 사용자 확인)', !/main 머지는 사용자 확인|사용자 확인:[^\n]*파일 ≥30/.test(agents))
  add('정책 이력(DECISIONS) 있음', (read('agents/DECISIONS.md') ?? '').includes(`DD-PR-AUTO-${p.version}`), `DD-PR-AUTO-${p.version}`)
  return out
}

function main() {
  const quiet = process.argv.includes('--quiet')
  const rows = runChecks()
  const bad = rows.filter((r) => !r.ok)
  for (const r of quiet ? bad : rows)
    console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.id}  ${r.name}${r.detail ? `  — ${r.detail}` : ''}`)
  if (!quiet) console.log(`\n${rows.length - bad.length}/${rows.length} PASS  (${path.relative(process.cwd(), ROOT) || '.'})`)
  process.exit(bad.length ? 1 : 0)
}

if (isMain(import.meta.url)) main()
