// scripts/csat/judgment-fixtures-export.mjs
// 유형 전용 판단 도구(대량작업 D)의 실제 기출 픽스처를 DB 에서 읽기 전용으로 뽑는다.
// 문항(원문 단위·선지)과 공개 뒤 자료(정답·분석)를 서로 다른 파일로 나눠, 공개 전 화면이
// 정답 파일을 import 하지 않아도 되게 한다. 분석은 published 이고 units_version 이 일치하는 것만 쓴다.
// 실행: node --tls-max-v1.2 scripts/csat/judgment-fixtures-export.mjs   (재실행 안전 — 파일을 덮어쓴다)
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(path.resolve('apps/web/package.json'))
const { createClient } = require('@supabase/supabase-js')

const env = (name) => {
  if (process.env[name]) return process.env[name]
  for (const f of ['.env.local', '.env', 'apps/web/.env.local', 'apps/web/.env']) {
    if (!fs.existsSync(f)) continue
    const m = fs.readFileSync(f, 'utf8').match(new RegExp(`^${name}\\s*=\\s*(.+)$`, 'm'))
    if (m) return m[1].trim().replace(/^["']|["']$/g, '')
  }
  return null
}
const url = env('NEXT_PUBLIC_SUPABASE_URL') ?? env('SUPABASE_URL')
const key = env('SUPABASE_SERVICE_ROLE_KEY') ?? env('SUPABASE_SERVICE_KEY')
if (!url || !key) throw new Error('SUPABASE_URL / SERVICE_ROLE_KEY 가 필요하다')
const db = createClient(url, key, { auth: { persistSession: false } })

const TYPES = ['R-IRRELEVANT', 'R-ORDER', 'R-NOTICE', 'R-FACT', 'R-GRAMMAR', 'R-SUMMARY', 'R-MOOD']
const PER_TYPE = 2
const OUT = 'apps/web/src/lib/csat/judgment/fixtures'
fs.mkdirSync(OUT, { recursive: true })

// 수능(exam_id 4자리) → 모평(M) → 학평(H) 순으로 고른다
const rank = (examId) => (/^\d{4}$/.test(examId) ? 0 : examId.startsWith('M') ? 1 : 2)

const report = []
for (const type of TYPES) {
  const { data: items, error } = await db.from('csat_items').select('id, exam_id, no, type_id, stem, choices, answer, body_ok').eq('type_id', type).eq('body_ok', true)
  if (error) throw error
  const sorted = items.sort((a, b) => rank(a.exam_id) - rank(b.exam_id) || b.exam_id.localeCompare(a.exam_id))
  const picked = []
  for (const it of sorted) {
    if (picked.length >= PER_TYPE) break
    if (!Array.isArray(it.choices) || it.choices.length !== 5 || !it.answer) continue
    const { data: an } = await db.from('csat_item_analyses').select('version, units_version, units_hash, design_intent, answer_locus, choice_analysis, status').eq('item_id', it.id).eq('status', 'published').order('version', { ascending: false }).limit(1)
    const a = an?.[0]
    if (!a?.units_version) continue
    const { data: un } = await db.from('csat_item_units').select('units, units_version, units_hash').eq('item_id', it.id).eq('units_version', a.units_version).limit(1)
    const u = un?.[0]
    if (!u || (a.units_hash && u.units_hash !== a.units_hash)) continue
    if (!Array.isArray(a.choice_analysis) || a.choice_analysis.length !== 5) continue
    picked.push({ it, a, u })
  }
  const item = picked.map(({ it, u, a }) => ({
    id: it.id,
    examId: it.exam_id,
    no: it.no,
    typeId: it.type_id,
    stem: it.stem,
    choices: it.choices,
    units: u.units.map((x) => ({ id: x.id, n: x.n, kind: x.kind, text: x.text })),
    version: { unitsVersion: u.units_version, unitsHash: u.units_hash, analysisVersion: a.version },
  }))
  const reveal = picked.map(({ it, a }) => ({
    id: it.id,
    analysisVersion: a.version,
    unitsVersion: a.units_version,
    answer: it.answer,
    designIntent: a.design_intent,
    answerLocus: a.answer_locus,
    choices: a.choice_analysis,
  }))
  const slug = type.toLowerCase()
  fs.writeFileSync(path.join(OUT, `${slug}.items.json`), JSON.stringify({ source: 'csat_items+csat_item_units (published analysis units_version)', items: item }, null, 2) + '\n')
  fs.writeFileSync(path.join(OUT, `${slug}.reveal.json`), JSON.stringify({ source: 'csat_item_analyses status=published', reveal }, null, 2) + '\n')
  report.push(`${type}: ${picked.map((p) => p.it.id).join(', ') || 'DATA_GAP'}`)
}
console.log(report.join('\n'))
