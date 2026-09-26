// scripts/csat/checklist-drain/export.mjs
//
// **v7 체크리스트 경로 — 배치 청크 뽑기.** 판정 기준 v7 §3-6(criteria.md). 기본은 예행(개수만) — `--write` 가 있어야 쓴다. DB 는 읽기만.
//
// 대상: 보관 판정도 내용 판정도 없는 **원본**(파생물 제외 · `bulk-export.mjs` 와 같은 조건) 중
//   논문 원천(`PAPER_SOURCES`)도 아니고 원장(`docs/source-check/checklist-audit.json`)이 끄지도 않은 원천.
// 쓰는 것(`scripts/csat/checklist-drain/batch-<N>/` · gitignore):
//   chunk-NN.json — 판정자(checklist-judge)에게 줄 청크. 항목 모양은 bulk-export 와 같다(전문 판정 청크로 그대로 옮겨 쓴다).
//   audit.json    — 5% 무작위 전문 재판정 대상 id. **판정자에게 보이지 않는다**(눈가림 — checklist-judge 정의가 열기를 막는다).
// 재실행 안전: 배치 폴더가 이미 있으면 멈춘다(같은 배치를 두 번 뽑지 않는다). 새 배치는 새 번호로.
//
// 실행: node --tls-max-v1.2 scripts/csat/checklist-drain/export.mjs --batch 1 [--sources wikinews] [--sid '#brief-']
//         [--max 500] [--budget 60000] [--per 25] [--write]
//   --sid    source_id 에 이 문자열이 든 행만(예: Wikinews Shorts 꼭지 `#brief-`)
//   --max    전체 상한(id 순서) · --budget 청크당 본문 글자 수 · --per 청크당 편수 상한

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

import { CRITERIA_VERSION, derivativeKind } from '../gate-rules.mjs'
import { auditPick, chunkByBudget, checklistAllowed, disabledSources } from './lib.mjs'

// 클라우드 세션에는 .env.local 이 없고 환경 변수로 들어온다 — 파일이 없어도 멈추지 않는다.
const envFile = path.resolve('apps/web/.env.local')
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
  }
}
const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`)
  return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d
}
const BATCH = Number(arg('batch', 0))
if (!Number.isInteger(BATCH) || BATCH < 1) throw new Error('--batch <n>')
const ONLY = arg('sources', '') ? new Set(arg('sources', '').split(',')) : null
const SID = arg('sid', '')
const MAX = Number(arg('max', 0))
const BUDGET = Number(arg('budget', 60_000))
const PER = Number(arg('per', 25))
const WRITE = process.argv.includes('--write')
const OUT = path.resolve(`scripts/csat/checklist-drain/batch-${BATCH}`)
const LEDGER = path.resolve('docs/source-check/checklist-audit.json')

const disabled = disabledSources(fs.existsSync(LEDGER) ? JSON.parse(fs.readFileSync(LEDGER, 'utf8')) : null)
if (ONLY) for (const s of ONLY) if (!checklistAllowed(s, disabled)) throw new Error(`${s} 는 체크리스트 경로 밖이다(논문 원천이거나 원장이 껐다 — criteria §3-6)`)
if (WRITE && fs.existsSync(OUT)) throw new Error(`${path.relative(process.cwd(), OUT)} 가 이미 있다 — 새 배치 번호를 쓴다`)

const { createScriptClient } = await import('../../lib/supabase-client.mjs')
const db = createScriptClient()

const ids = []
const bySource = new Map()
let cursor = '00000000-0000-0000-0000-000000000000'
for (;;) {
  const { data, error } = await db
    .from('library_articles')
    .select('id,source,source_id,feed_id,derived_from:csat_fit->derived_from,rv:csat_fit->gate->retain,gv:csat_fit->gate->>verdict')
    .gt('id', cursor).order('id').limit(1000)
  if (error) throw new Error(error.message)
  if (!data.length) break
  for (const r of data) {
    if (ONLY ? !ONLY.has(r.source) : !checklistAllowed(r.source, disabled)) continue
    if (SID && !String(r.source_id ?? '').includes(SID)) continue
    if (r.rv || r.gv || derivativeKind(r)) continue
    if (MAX && ids.length >= MAX) continue
    ids.push(r.id)
    bySource.set(r.source, (bySource.get(r.source) ?? 0) + 1)
  }
  cursor = data[data.length - 1].id
}
for (const [s, n] of [...bySource].sort()) console.log(`  ${s.padEnd(20)} ${n}`)
console.log(`  합계 ${ids.length} · 꺼진 원천 ${[...disabled].join(',') || '없음'}`)
if (!WRITE || !ids.length) process.exit(0)

const rows = []
for (let i = 0; i < ids.length; i += 50) {
  const { data, error } = await db
    .from('library_articles')
    .select('id,title,source,status,feed_id,updated_at,content,word_count,article_v_level,cefr_level,license,license_class,published_at,audio_url,rights:csat_fit->rights')
    .in('id', ids.slice(i, i + 50))
  if (error) throw new Error(error.message)
  rows.push(...data)
}
const rank = new Map(ids.map((id, i) => [id, i]))
const items = rows.sort((x, y) => rank.get(x.id) - rank.get(y.id)).map((r) => ({
  id: r.id, title: r.title, source: r.source, feed_id: r.feed_id,
  source_updated_at: r.updated_at,
  body_sha256: crypto.createHash('sha256').update(r.content ?? '').digest('hex'),
  kind: 'retain', basis: 'full', criteria_version: CRITERIA_VERSION,
  hints: {
    status: r.status, words: r.word_count, v_level: r.article_v_level, cefr: r.cefr_level,
    has_audio: !!r.audio_url, published_at: r.published_at,
    rights: r.rights ?? { license: r.license, class: r.license_class, evidence: 'unverified' },
  },
  content: r.content ?? '',
}))

// 편수 상한과 글자 수 상한을 함께 — 짧은 단신 수백 편이 한 청크에 몰리지 않게.
const chunks = chunkByBudget(items, BUDGET).flatMap((c) => {
  const out = []
  for (let i = 0; i < c.length; i += PER) out.push(c.slice(i, i + PER))
  return out
})
fs.mkdirSync(OUT, { recursive: true })
chunks.forEach((c, i) => {
  fs.writeFileSync(path.join(OUT, `chunk-${String(i + 1).padStart(2, '0')}.json`), `${JSON.stringify(c, null, 1)}\n`, { flag: 'wx' })
})
const audit = auditPick(items.map((x) => x.id), BATCH)
fs.writeFileSync(path.join(OUT, 'audit.json'), `${JSON.stringify({ batch: BATCH, criteria_version: CRITERIA_VERSION, total: items.length, audit }, null, 1)}\n`, { flag: 'wx' })
console.log(`  청크 ${chunks.length}개 · 감사 ${audit.length}편 → ${path.relative(process.cwd(), OUT)}`)
