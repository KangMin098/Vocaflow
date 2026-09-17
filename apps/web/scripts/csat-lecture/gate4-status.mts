// apps/web/scripts/csat-lecture/gate4-status.mts
//
// **Gate 4 현황 — 청크마다 어디까지 왔나.** 읽기 전용.
//
//   exported → written(원고 있음) → clean(기계 검사 통과, 심사만 남음) → graded(스냅숏+채점) → loaded(적재)
//
//   npx tsx scripts/csat-lecture/gate4-status.mts            (표)
//   npx tsx scripts/csat-lecture/gate4-status.mts --json     (조정자용)

import fs from 'node:fs'
import path from 'node:path'

import type { LectureIndex } from '../../src/lib/csat/lecture/types'
import { DATA, readJson, WORK } from './env.mts'

const index = readJson<LectureIndex>(path.join(DATA, 'index.json'), { built: '', items: {} })
const names = fs
  .readdirSync(WORK)
  .filter((f) => /^chunk-.+\.json$/.test(f) && !/\.(out|grade|regrade|report|graded)/.test(f) && f !== 'chunk-pilot.json')
  .map((f) => f.slice('chunk-'.length, -'.json'.length))
  .sort()

const rows = names.map((name) => {
  const chunk = readJson<{ items: { id: string }[] }>(path.join(WORK, `chunk-${name}.json`), { items: [] })
  const ids = chunk.items.map((i) => i.id)
  const out = readJson<{ lectures: Record<string, unknown> } | null>(path.join(WORK, `chunk-${name}.out.json`), null)
  const graded = fs.existsSync(path.join(WORK, `chunk-${name}.out.graded.json`))
  const grade = readJson<{ grades: Record<string, unknown> } | null>(path.join(WORK, `chunk-${name}.grade.json`), null)
  const report = readJson<{ items: { id: string; status: string; issues: { code: string }[] }[] } | null>(
    path.join(WORK, `chunk-${name}.report.json`),
    null,
  )
  const written = out ? ids.filter((id) => out.lectures[id]).length : 0
  // 심사 전 기계 검사: 「ungraded」만 남았으면 clean
  const clean = report
    ? report.items.filter((r) => r.issues.every((i) => i.code === 'ungraded' || i.code === 'stale-grade')).length
    : 0
  const loaded = ids.filter((id) => index.items[id]).length
  const stage =
    loaded === ids.length
      ? 'loaded'
      : grade
        ? 'graded'
        : graded
          ? 'grading'
          : clean === ids.length
            ? 'clean'
            : written === ids.length
              ? 'written'
              : written
                ? 'partial'
                : 'exported'
  return { name, items: ids.length, written, clean, graded: grade ? Object.keys(grade.grades).length : 0, loaded, stage }
})

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(rows))
} else {
  for (const r of rows) console.log(`${r.stage.padEnd(9)} ${r.name.padEnd(14)} ${r.loaded}/${r.items} 적재 · 원고 ${r.written} · 깨끗 ${r.clean} · 채점 ${r.graded}`)
  const sum = (k: 'items' | 'loaded') => rows.reduce((a, r) => a + r[k], 0)
  const by = (s: string) => rows.filter((r) => r.stage === s).length
  console.log(`청크 ${rows.length} — exported ${by('exported')} · partial ${by('partial')} · written ${by('written')} · clean ${by('clean')} · grading ${by('grading')} · graded ${by('graded')} · loaded ${by('loaded')}`)
  console.log(`문항 적재 ${sum('loaded')}/${sum('items')} (+ 파일럿 6 → 색인 ${Object.keys(index.items).length})`)
}
