// apps/web/scripts/csat-lecture/f2-bundle.mts
//
// **F2 — 빌드 산출물에 대본이 없다.** `next build` 뒤에 돌린다. 강의 데이터의 한국어 해설(12자 이상)을
// 클라이언트 번들(.next/static)과 미리 그린 HTML·RSC(.next/server/app)에서 찾는다. 하나라도 있으면 FAIL.
// 대본은 서버의 fs 로만 읽혀야 한다(`lib/csat/lecture/store.ts`) — 번들에 딸려 들어가면 누구나 받는다.
import fs from 'node:fs'
import path from 'node:path'

import type { LectureExamFile } from '../../src/lib/csat/lecture/types'
import { DATA, REPORTS, writeJson } from './env.mts'

const needles = new Set<string>()
for (const f of fs.readdirSync(DATA).filter((x) => x.endsWith('.json') && x !== 'index.json')) {
  const j = JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8')) as LectureExamFile
  for (const l of Object.values(j.lectures))
    for (const c of l.cues) for (const g of c.segments) if (g.lang === 'ko-KR' && g.text.length >= 12) needles.add(g.text)
}
const roots = ['.next/static', '.next/server/app']
const files: string[] = []
const walk = (d: string) => {
  if (!fs.existsSync(d)) return
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name)
    if (e.isDirectory()) walk(p)
    else if (/\.(js|html|rsc|json|body)$/.test(e.name)) files.push(p)
  }
}
roots.forEach(walk)
const hits: string[] = []
for (const f of files) {
  const s = fs.readFileSync(f, 'utf8')
  for (const n of needles) if (s.includes(n)) {
    hits.push(f)
    break
  }
}
const pass = files.length > 0 && hits.length === 0
writeJson(path.join(REPORTS, 'f2-bundle-report.json'), {
  check: 'F2',
  measuredAt: new Date().toISOString(),
  pass,
  narrationStrings: needles.size,
  filesScanned: files.length,
  filesWithNarration: hits,
})
console.log(`F2 ${pass ? 'PASS' : 'FAIL'} — 대본 ${needles.size}줄 · 파일 ${files.length}개 검사 · 대본 포함 ${hits.length}`)
process.exit(pass ? 0 : 1)
