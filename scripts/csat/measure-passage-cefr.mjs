// scripts/csat/measure-passage-cefr.mjs
//
// **기출 지문의 난이도 분포를 잰다 — 읽기 전용 · 집계만 출력한다.**
//
// 왜: 「CSAT 트랙에 별도 CEFR 상한을 둘 것인가」(DD-57)를 결정하려면 **기출 지문이 실제로 어느
// 난이도인가**를 알아야 한다. 그런데 `csat_items` 에는 CEFR 컬럼이 없다 — 그래서 여기서 계산한다.
//
// ⚠️ **저작권 경계**: 기출 원문은 화면·저장소·로그 어디에도 남기지 않는다(docs/CSAT_SOURCE_GATE).
//   이 스크립트는 본문을 읽어 **수치만** 출력한다. 지문 조각·제목을 찍지 않는다.
//
// ⚠️ **무엇을 재는지 정확히**: 정본 3중 합의(`analyze/cefr-detect.ts`)의 **신호 2(가독성, 가중치 30%)**
//   만 쓴다 — Flesch Reading Ease → CEFR 매핑이 그 파일의 것과 **같은 경계값**이다(90/80/70/55/40).
//   신호 1(어휘 분포 50%)·신호 3(LLM 20%)은 포함하지 않았다. 그래서 결과는
//   **「가독성 기준 추정」**이고, 최종 라벨이 아니다. 이 구분을 지우면 수치가 과신된다.
//
// 실행: node scripts/csat/measure-passage-cefr.mjs [--json]

import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { createScriptClient } from '../lib/supabase-client.mjs'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}
const require = createRequire(path.resolve('packages/library-pipeline/package.json'))
// CJS interop — 이 패키지는 `default` 아래에 실제 함수를 둔다(정본 `cefr-detect.ts` 는 ESM import 라 자동 처리됨)
const readabilityModule = require('text-readability')
const readability = readabilityModule.default ?? readabilityModule
const db = createScriptClient()

/** `analyze/cefr-detect.ts` 의 신호 2 와 **같은 경계값**. 바뀌면 그 파일과 함께 바꾼다. */
const cefrByReadingEase = (fre) =>
  fre >= 90 ? 'A1' : fre >= 80 ? 'A2' : fre >= 70 ? 'B1' : fre >= 55 ? 'B2' : fre >= 40 ? 'C1' : 'C2'

/** 연도 — `exam_id` 는 `2026`(수능) 또는 `M2706`(모평) 꼴이다. */
const yearOf = (examId) => {
  const m = /^M?(\d{2})(\d{2})?$/.exec(examId) ?? /^(\d{4})$/.exec(examId)
  if (!m) return examId
  if (m[0].length === 4 && !m[0].startsWith('M')) return m[0] // 2026
  return `20${m[1]}` // M2706 → 2027학년도 6월 → 시행 2026 이지만 학년도 표기를 따른다
}

const rows = []
for (let from = ''; ; ) {
  let q = db.from('csat_items').select('id,exam_id,type_id,passage,in_scope').order('id').limit(500)
  if (from) q = q.gt('id', from)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  if (!data?.length) break
  rows.push(...data)
  from = data.at(-1).id
  if (data.length < 500) break
}

const byType = new Map()
const byYear = new Map()
const overall = new Map()
let measured = 0
let skippedShort = 0

for (const r of rows) {
  const text = (r.passage ?? '').trim()
  // 지문이 없는 문항(어법·어휘 단독 등)과 너무 짧은 것은 가독성이 불안정하다 — 센 수를 따로 찍는다.
  if (text.split(/\s+/).length < 40) {
    skippedShort++
    continue
  }
  const level = cefrByReadingEase(readability.fleschReadingEase(text))
  measured++
  const bump = (map, key) => {
    const cell = map.get(key) ?? {}
    cell[level] = (cell[level] ?? 0) + 1
    map.set(key, cell)
  }
  bump(byType, r.type_id ?? '(유형 없음)')
  bump(byYear, yearOf(r.exam_id))
  bump(overall, 'all')
}

const pct = (cell) => {
  const total = Object.values(cell).reduce((a, b) => a + b, 0)
  return Object.fromEntries(
    ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
      .filter((k) => cell[k])
      .map((k) => [k, `${cell[k]} (${((cell[k] / total) * 100).toFixed(1)}%)`]),
  )
}
const out = {
  readOnly: true,
  what: '가독성(Flesch Reading Ease) 기준 추정 — 정본 3중 합의의 신호 2 만. 최종 라벨이 아니다',
  items: rows.length,
  measured,
  skippedShortOrNoPassage: skippedShort,
  overall: pct(overall.get('all') ?? {}),
  byType: Object.fromEntries([...byType].sort().map(([k, v]) => [k, pct(v)])),
  byYear: Object.fromEntries([...byYear].sort().map(([k, v]) => [k, pct(v)])),
}
console.log(process.argv.includes('--json') ? JSON.stringify(out, null, 2) : JSON.stringify(out))
