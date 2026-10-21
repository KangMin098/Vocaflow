// scripts/design/render-ledger.mjs
//
// 렌더 확인을 **URL별 증거로** 센다 — 「약 30」 같은 어림을 없애기 위해(사용자 지시 2026-10-19).
// 결과 JSON(캡처 `_report.json` · 측정 `_layout.json` · 세션 `_sessions@*.json` · 검사 `_*.json`)을 모아
// 각 기록의 착지 주소를 실제 라우트(page.tsx — admin · api · dev 제외)에 맞춘다. 정상 렌더로 세는 조건:
//   · 기록이 ok(또는 오류 없음) · 착지가 /login 이 아님(로그인 화면 자체는 예외) · 오류 화면 판정 없음
// 출력: 라우트별 증거 파일 · 시각 · 서버 · 개수, 그리고 학습자 · CSAT 분모별 합계(markdown).
// 사용: node scripts/design/render-ledger.mjs <결과 폴더>... > ledger.md

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { reportEvidence } from './lib/render-evidence.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const APP = path.join(ROOT, 'apps/web/src/app')

/** page.tsx → 라우트 템플릿 */
function routes() {
  const out = []
  const walk = (dir, segs) => {
    for (const n of fs.readdirSync(dir)) {
      const p = path.join(dir, n)
      if (!fs.statSync(p).isDirectory()) continue
      if (n === 'api' || n === 'admin' || n === 'dev' || n.startsWith('_')) continue
      const seg = n.startsWith('(') ? null : n
      const next = seg ? [...segs, seg] : segs
      if (fs.existsSync(path.join(p, 'page.tsx'))) out.push('/' + next.join('/'))
      walk(p, next)
    }
  }
  if (fs.existsSync(path.join(APP, 'page.tsx'))) out.push('/')
  walk(APP, [])
  return [...new Set(out)].map((r) => ({
    route: r,
    re: new RegExp('^' + r.replace(/\[\.\.\.[^\]]+\]/g, '.+').replace(/\[[^\]]+\]/g, '[^/]+') + '/?$'),
    dynamic: r.includes('['),
  }))
}

const ROUTES = routes()
const match = (pathname) => {
  // 정적 라우트 우선(동적 패턴이 정적 경로를 먹지 않게)
  const hit = ROUTES.filter((r) => r.re.test(pathname)).sort((a, b) => Number(a.dynamic) - Number(b.dynamic))[0]
  return hit?.route ?? null
}

const files = []
const walkFiles = (p) => {
  if (!fs.existsSync(p)) return
  const st = fs.statSync(p)
  if (st.isDirectory()) for (const n of fs.readdirSync(p)) walkFiles(path.join(p, n))
  else if (/^_.*\.json$/.test(path.basename(p))) files.push(p)
}
for (const d of process.argv.slice(2)) walkFiles(path.resolve(ROOT, d))

const ev = new Map()
const add = (pathname, rec) => {
  if (!pathname) return
  const r = match(pathname.split('?')[0])
  if (!r) return
  if (!ev.has(r)) ev.set(r, [])
  ev.get(r).push(rec)
}
for (const f of files) {
  let j
  try { j = JSON.parse(fs.readFileSync(f, 'utf8')) } catch { continue }
  const rel = path.relative(ROOT, f).split(path.sep).join('/')
  for (const record of reportEvidence(j, { file: rel })) {
    add(record.route, { ...record, note: record.isolated ? '격리 부품 — 정상 라우트 아님' : undefined })
  }
}

const learner = ROUTES.filter((r) => !r.route.startsWith('/csat'))
const csat = ROUTES.filter((r) => r.route.startsWith('/csat'))
const line = (r) => {
  const e = ev.get(r.route) ?? []
  const isolated = e.length > 0 && e.every((x) => x.note)
  const last = e.map((x) => x.at).filter(Boolean).sort().pop()
  return `| \`${r.route}\` | ${e.length ? (isolated ? '격리만' : '✓') : '—'} | ${e.length} | ${last ? last.slice(0, 10) : ''} | ${[...new Set(e.map((x) => x.file))].slice(0, 2).join('<br>')} |`
}
const count = (list) => list.filter((r) => (ev.get(r.route) ?? []).some((x) => !x.note)).length
const iso = (list) => list.filter((r) => { const e = ev.get(r.route) ?? []; return e.length > 0 && e.every((x) => x.note) }).length

console.log(`# 렌더 증거 원장 (${new Date().toISOString().slice(0, 10)})\n`)
console.log(`- 결과 파일 ${files.length}개를 읽었다. 정상 렌더 = 기록 통과 · 로그인으로 튕기지 않음 · 오류 화면 아님.`)
console.log(`- **학습자 ${learner.length} 라우트 중 정상 렌더 증거 ${count(learner)}** (격리 화면만 ${iso(learner)}) · **CSAT ${csat.length} 중 ${count(csat)}**\n`)
console.log('| 라우트 | 렌더 | 기록 수 | 마지막 | 증거(앞 2개) |\n|---|---|---|---|---|')
for (const r of learner) console.log(line(r))
console.log('\n### CSAT(3B 유지 — 경계 확인용)\n\n| 라우트 | 렌더 | 기록 수 | 마지막 | 증거(앞 2개) |\n|---|---|---|---|---|')
for (const r of csat) console.log(line(r))
