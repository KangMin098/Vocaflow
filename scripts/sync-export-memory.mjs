#!/usr/bin/env node
// scripts/sync-export-memory.mjs
//
// Claude Code 외부 memory (`~/.claude/projects/<encoded>/memory/`) 의 작업 history
// 를 docs/AI_CONTEXT/ 로 mirror + docs/CONTEXT.md 자동 블록 갱신.
//
// 목적: Claude Project (chat) 가 GitHub sync 통해 작업 history 까지 보게 함.
//   memory 는 사용자 머신에만 존재 → repo 에 없음 → Project 가 못 봄 →
//   "지난 작업 정리" 같은 질문에 답 못함. mirror 로 해결.
//
// 사용:
//   node scripts/sync-export-memory.mjs              # mirror 갱신만
//   node scripts/sync-export-memory.mjs --refresh-context  # docs/CONTEXT.md auto 블록도 갱신
//
// 무엇을 옮기나:
//   - memory/project_*.md (작업 milestone 기록)
//   - memory/feedback_*.md (사용자 피드백 룰)
//   - memory/reference_*.md (외부 참조)
//   ※ user_*.md (개인 정보) 는 옮기지 않음.
//
// 안전 가드:
//   - 모든 mirror 파일은 헤더에 "AUTO-GENERATED FROM ..." 표시
//   - 빈 memory dir 면 skip (실패 X)
//   - 이미 mirror 와 source 가 같으면 변경 안 함 (timestamp churn 방지)

import { execSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const REPO_ROOT = path.resolve(__dirname, '..')
const AI_CONTEXT_DIR = path.join(REPO_ROOT, 'docs', 'AI_CONTEXT')
const CONTEXT_MD = path.join(REPO_ROOT, 'docs', 'CONTEXT.md')

const args = new Set(process.argv.slice(2))
const REFRESH_CONTEXT = args.has('--refresh-context')

/**
 * Claude Code 의 memory dir 경로 추정.
 * macOS/Linux: ~/.claude/projects/<encoded-cwd>/memory/
 * Windows: C:\Users\<u>\.claude\projects\<encoded-cwd>\memory\
 */
function resolveMemoryDir() {
  const home = os.homedir()
  const projectsRoot = path.join(home, '.claude', 'projects')
  if (!fs.existsSync(projectsRoot)) return null
  // encoded-cwd 가 폴더명 (예: c--Users-kille-Vocaflow). 정확한 인코딩은 모르나
  // 폴더명 안에 'Vocaflow' 포함된 것 찾기.
  const dirs = fs.readdirSync(projectsRoot, { withFileTypes: true })
  for (const d of dirs) {
    if (!d.isDirectory()) continue
    if (d.name.toLowerCase().includes('vocaflow')) {
      const memDir = path.join(projectsRoot, d.name, 'memory')
      if (fs.existsSync(memDir)) return memDir
    }
  }
  return null
}

function readSafe(p) {
  try {
    return fs.readFileSync(p, 'utf-8')
  } catch {
    return null
  }
}

function writeIfChanged(p, content) {
  const cur = readSafe(p)
  if (cur === content) return false
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, content, 'utf-8')
  return true
}

const HEADER_PREFIX = '> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.'

function mirrorFile(src, dst, category) {
  const raw = readSafe(src)
  if (!raw) return false
  const body = raw.replace(/^---[\s\S]*?---\s*/, '') // frontmatter 제거
  const wrapped = `${HEADER_PREFIX}\n> source: ${src.replace(/\\/g, '/')}\n> category: ${category}\n\n---\n\n${body}\n`
  return writeIfChanged(dst, wrapped)
}

function syncMemory() {
  const memDir = resolveMemoryDir()
  if (!memDir) {
    console.log('[sync-memory] memory dir 미발견 — skip (정상)')
    return { mirrored: 0, removed: 0 }
  }
  console.log(`[sync-memory] source: ${memDir}`)

  // 멀티 PC 안전 가드: 이 머신 memory 의 mirror 대상 파일이 기존 mirror 의 50% 미만이면
  //   = 다른 PC 에서 생성된 mirror. mirror/prune/README/CONTEXT 전부 skip — 상대 PC mirror 파괴 방지.
  //   (authoritative 머신: srcMatch≈existing → 정상 동작. fresh/foreign 머신: 완전 no-op.)
  {
    const srcMatch = fs.readdirSync(memDir).filter((n) => /^(project_|feedback_|reference_).*\.md$/.test(n)).length
    let existingMirror = 0
    for (const cat of ['project', 'feedback', 'reference']) {
      const d = path.join(AI_CONTEXT_DIR, cat)
      if (fs.existsSync(d)) existingMirror += fs.readdirSync(d).filter((f) => f.endsWith('.md')).length
    }
    if (existingMirror > 0 && srcMatch < existingMirror * 0.5) {
      console.log(`[sync-memory] 이 머신 대상(${srcMatch}) < 기존 mirror(${existingMirror})×0.5 — 다른 PC mirror 로 판단, 전체 skip.`)
      return { mirrored: 0, removed: 0, skipped: true }
    }
  }

  const entries = fs.readdirSync(memDir, { withFileTypes: true })
  const targetByName = new Map() // mirror dst path → category
  let mirrored = 0

  for (const e of entries) {
    if (!e.isFile() || !e.name.endsWith('.md')) continue
    if (e.name === 'MEMORY.md') continue // 인덱스만 — 별도 처리
    let category = null
    if (e.name.startsWith('project_')) category = 'project'
    else if (e.name.startsWith('feedback_')) category = 'feedback'
    else if (e.name.startsWith('reference_')) category = 'reference'
    // user_* 는 의도적 제외 (개인 정보)
    if (!category) continue
    const src = path.join(memDir, e.name)
    const dst = path.join(AI_CONTEXT_DIR, category, e.name)
    targetByName.set(dst, category)
    if (mirrorFile(src, dst, category)) {
      mirrored++
      console.log(`  + ${path.relative(REPO_ROOT, dst)}`)
    }
  }

  // 삭제된 memory 파일에 해당하는 mirror 정리
  let removed = 0
  if (fs.existsSync(AI_CONTEXT_DIR)) {
    for (const cat of ['project', 'feedback', 'reference']) {
      const catDir = path.join(AI_CONTEXT_DIR, cat)
      if (!fs.existsSync(catDir)) continue
      for (const f of fs.readdirSync(catDir)) {
        const dst = path.join(catDir, f)
        if (!targetByName.has(dst)) {
          fs.unlinkSync(dst)
          removed++
          console.log(`  - ${path.relative(REPO_ROOT, dst)} (removed)`)
        }
      }
    }
  }

  // README 생성 (Project 가 첫 진입 시 어떤 파일 있나)
  const readmePath = path.join(AI_CONTEXT_DIR, 'README.md')
  const cats = ['project', 'feedback', 'reference']
  const stats = cats.map((c) => {
    const d = path.join(AI_CONTEXT_DIR, c)
    const n = fs.existsSync(d) ? fs.readdirSync(d).filter((f) => f.endsWith('.md')).length : 0
    return { c, n }
  })
  const readme = [
    '# docs/AI_CONTEXT — 작업 history mirror',
    '',
    HEADER_PREFIX,
    '',
    'Claude Code 의 외부 memory (`~/.claude/projects/<encoded>/memory/`) 를 repo 안으로 mirror.',
    'Claude Project (chat) 가 GitHub sync 로 작업 history 까지 보게 함.',
    '',
    '## 카테고리',
    '',
    ...stats.map(({ c, n }) => `- **${c}/** — ${n} 파일 (${categoryLabel(c)})`),
    '',
    '## 갱신',
    '',
    '```bash',
    'node scripts/sync-export-memory.mjs',
    'node scripts/sync-export-memory.mjs --refresh-context  # docs/CONTEXT.md 자동 블록도',
    '```',
    '',
    '사람이 수동 편집 X — script 가 매번 덮어씀.',
    '',
  ].join('\n')
  writeIfChanged(readmePath, readme)

  return { mirrored, removed }
}

function categoryLabel(c) {
  switch (c) {
    case 'project':
      return '작업 milestone / 결과'
    case 'feedback':
      return '사용자 피드백 룰 (반복 지시 차단)'
    case 'reference':
      return '외부 시스템 참조 (Linear / Slack 등 위치)'
    default:
      return ''
  }
}

function refreshContextAutoBlocks() {
  const original = readSafe(CONTEXT_MD)
  if (!original) {
    console.log('[refresh-context] docs/CONTEXT.md 없음 — skip')
    return false
  }

  function sh(cmd) {
    try {
      return execSync(cmd, { cwd: REPO_ROOT, encoding: 'utf-8' }).trim()
    } catch {
      return ''
    }
  }

  const branch = sh('git rev-parse --abbrev-ref HEAD') || '(unknown)'
  const recentCommits = sh('git log --oneline -5').split('\n').filter(Boolean)
  const migrations = (() => {
    const dir = path.join(REPO_ROOT, 'supabase', 'migrations')
    if (!fs.existsSync(dir)) return []
    return fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.sql'))
      .sort()
      .reverse()
      .slice(0, 5)
  })()

  let out = original

  // <!-- auto:branch -->
  out = replaceBlock(out, 'branch', [
    `**활성 브랜치**: \`${branch}\``,
    `**main 으로 PR 대상**: 별도 확인`,
  ])

  // <!-- auto:recent-commits -->
  out = replaceBlock(out, 'recent-commits', [
    '**최근 5 commit**:',
    ...recentCommits.map((l) => {
      const m = l.match(/^(\S+)\s+(.+)$/)
      return m ? `- \`${m[1]}\` ${m[2]}` : `- ${l}`
    }),
  ])

  // <!-- auto:recent-migrations -->
  out = replaceBlock(out, 'recent-migrations', [
    '**최근 5 migration**:',
    ...migrations.map((m) => `- \`${m}\``),
  ])

  const changed = writeIfChanged(CONTEXT_MD, out)
  if (changed) console.log('[refresh-context] docs/CONTEXT.md 자동 블록 갱신')
  else console.log('[refresh-context] docs/CONTEXT.md 변경 없음')
  return changed
}

function replaceBlock(text, name, lines) {
  const startMark = `<!-- auto:${name} -->`
  const endMark = `<!-- /auto:${name} -->`
  const block = `${startMark}\n${lines.join('\n')}\n${endMark}`
  const re = new RegExp(
    `${escapeRe(startMark)}[\\s\\S]*?${escapeRe(endMark)}`,
    'g',
  )
  if (!re.test(text)) {
    // 블록 없으면 append (드문 케이스)
    return `${text.trimEnd()}\n\n${block}\n`
  }
  return text.replace(re, block)
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// ───── main ─────
const t0 = Date.now()
const memResult = syncMemory()
console.log(
  `[sync-memory] mirrored=${memResult.mirrored} removed=${memResult.removed} (${Date.now() - t0}ms)`,
)

if (REFRESH_CONTEXT && !memResult.skipped) {
  refreshContextAutoBlocks()
}
