#!/usr/bin/env node
// agents/scripts/check.mjs
//
// 두 에이전트 설정의 불변식 검사 — CI(.github/workflows/ci.yml)와 커밋 전 훅(guard.mjs)이 부른다.
//   D1  CLAUDE.md 첫 줄 "@AGENTS.md" · 두 파일 간 중복 줄 0 · AGENTS.md ≤ 200줄 · ≤ 32 KiB
//   D2  mcp 생성물 드리프트 0 (sync.mjs --check 와 같은 판정)
//   D3  에이전트 설정 파일 전체에서 비밀값 패턴 0
//   D9  README 안내 · router.md · .gitignore 로컬 전용 항목
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

export const DUP_WINDOW = 20

/**
 * 중복 판정용 산문. 코드 스팬(명령·경로 인용)과 링크 주소·마크다운 장식을 걷어낸다 —
 * CLAUDE.md 가 AGENTS.md 와 같은 명령을 **인용**하는 것은 중복이 아니고, 같은 **규칙 문장**을 다시 쓰는 것이 중복이다.
 */
function prose(line) {
  return line
    .replace(/`[^`]*`/g, ' ')
    .replace(/\]\([^)]*\)/g, ']')
    .replace(/[*_>#|[\]「」"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * CLAUDE.md(첫 줄 import 제외)의 각 줄에서 DUP_WINDOW(20)자 창을 밀며 AGENTS.md 산문에 그대로 있는지 본다.
 * 줄 전체 복사뿐 아니라 규칙 한 구절을 옮겨 쓴 것도 잡는다. 반환: 겹친 구절 목록.
 */
export function duplicates(agents, claude) {
  const hay = lf(agents).split('\n').map(prose).join('\n')
  const out = []
  for (const line of lf(claude).split('\n').slice(1).map(prose)) {
    for (let k = 0; k + DUP_WINDOW <= line.length; k++) {
      const w = line.slice(k, k + DUP_WINDOW)
      if (w.replace(/[^\p{L}\p{N}]/gu, '').length < DUP_WINDOW * 0.6) continue
      if (hay.includes(w)) {
        out.push(line)
        break
      }
    }
  }
  return out
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
    const dup = duplicates(agents, claude)
    add('D1', 'AGENTS.md ↔ CLAUDE.md 중복 0', dup.length === 0, dup.length ? dup.slice(0, 5).join(' / ') : '0')
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
  add('D9', 'agents/router.md 존재', fs.existsSync(rel('agents', 'router.md')))
  const readme = readText(rel('README.md')) ?? ''
  add('D9', 'README 「두 에이전트로 일하는 법」', /두 에이전트로 일하는 법/.test(readme))

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
    && JSON.stringify(Object.keys(p.approval_required ?? {}).sort()) === '["data_deletion","db_change"]'
  add('정책 형식(AUTO_CONTINUE · 승인 2종 · 필수 체크 · 자동 병합 스위치)', shape, `v${p.version}`)
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
