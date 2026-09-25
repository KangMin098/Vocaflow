// apps/web/scripts/csat-learner/blank-probe.mts
//
// **빈칸은 PDF 에서 무엇인가 — 글자인가, 그린 선인가.** (2026-09-25 · blank-audit 후속 탐침)
// 한 문항이 있는 쪽의 가로 선마다 폭 · 높이 차 · 같은 줄 글자 수 · 덮인 비율 · 빈칸 판정을 찍는다.
// 원문은 찍지 않는다 — 좌표와 개수만.
//   npx tsx scripts/csat-learner/blank-probe.mts --exam M2706 --no 31

import fs from 'node:fs'
import path from 'node:path'

import { blankFrags } from '../../src/lib/csat/reflow/pdf-frags'
import { arg, localPapers, pdfPages } from './env.mts'

const exam = arg('exam') ?? 'M2706'
const no = Number(arg('no') ?? 31)
const anchors = JSON.parse(fs.readFileSync(path.resolve(`src/lib/csat/anchor-data/${exam}.json`), 'utf8'))
const file = localPapers().get(anchors.sha256)
if (!file) throw new Error('로컬 PDF 없음')
const at = anchors.items.find((i: { no: number }) => i.no === no)
const pg = (await pdfPages(file)).find((x) => x.p === at.p)!
const next = anchors.items.filter((i: { p: number; col: number; y: number }) => i.p === at.p && i.col === at.col && i.y < at.y).sort((a: { y: number }, b: { y: number }) => b.y - a.y)[0]
const lo = next ? next.y : 0
const inItem = (y: number) => y <= at.y + 4 && y > lo
const gutter = 420
const colOk = (x: number) => (x < gutter ? 0 : 1) === at.col
const blanks = blankFrags(pg.frags, pg.lines ?? [])
console.log(`${exam}#${no} · 쪽 ${at.p} 단 ${at.col} · 문항 y ${lo.toFixed(0)}~${at.y.toFixed(0)} · 밑줄 문자 조각 ${pg.frags.filter((f) => /_{2,}/.test(f.str)).length}`)
for (const ln of (pg.lines ?? []).filter((l) => inItem(l.y) && colOk(l.x0)).sort((a, b) => b.y - a.y)) {
  const row = pg.frags.filter((f) => f.y - ln.y >= -1 && f.y - ln.y <= 6 && f.x < ln.x1 + 380 && f.x + f.w > ln.x0 - 380)
  const covered = row.reduce((s, f) => s + Math.max(0, Math.min(f.x + f.w, ln.x1 - 1) - Math.max(f.x, ln.x0 + 1)), 0)
  const hit = blanks.some((b) => Math.abs(b.x - ln.x0) < 2 && Math.abs(b.y - ln.y) < 6)
  console.log(`  y ${ln.y.toFixed(1)} x ${ln.x0.toFixed(0)}–${ln.x1.toFixed(0)} 폭 ${(ln.x1 - ln.x0).toFixed(0)} · 같은 줄 조각 ${row.length} · 기준선차 ${row.length ? Math.min(...row.map((f) => f.y - ln.y)).toFixed(1) : '-'} · 덮임 ${((covered / (ln.x1 - ln.x0)) * 100).toFixed(0)}% · ${hit ? '빈칸' : '-'}`)
}

// ── --rows: 문항 영역의 줄 모양(시작 x · 끝 x · 줄 안 최대 틈 · 근처 가로 선) — 선도 틈도 못 찾을 때 본다
if (process.argv.includes('--rows')) {
  const fr = pg.frags.filter((f) => colOk(f.x) && inItem(f.y) && f.str.trim())
  const rows = new Map<number, typeof fr>()
  for (const f of fr) {
    const k = [...rows.keys()].find((y) => Math.abs(y - f.y) < 2.5) ?? f.y
    rows.set(k, [...(rows.get(k) ?? []), f])
  }
  const colR = Math.max(...fr.map((f) => f.x + f.w))
  for (const [y, r] of [...rows].sort((a, b) => b[0] - a[0])) {
    const s = r.sort((a, b) => a.x - b.x)
    let gap = 0
    let at = 0
    for (let i = 1; i < s.length; i++) {
      const g = s[i].x - (s[i - 1].x + s[i - 1].w)
      if (g > gap) {
        gap = g
        at = s[i - 1].x + s[i - 1].w
      }
    }
    const near = (pg.lines ?? []).filter((l) => colOk(l.x0) && Math.abs(l.y - y) < 6)
    console.log(
      `  줄 y ${y.toFixed(0)} 끝「${s.map((f) => f.str).join(" ").trim().slice(-4).replace(/[A-Za-z]/g, "x")}」 x ${s[0].x.toFixed(0)}–${(s[s.length - 1].x + s[s.length - 1].w).toFixed(0)} (단끝까지 ${(colR - s[s.length - 1].x - s[s.length - 1].w).toFixed(0)}) 최대틈 ${gap.toFixed(0)}@${at.toFixed(0)}${near.length ? ' 선 ' + near.map((l) => `${l.x0.toFixed(0)}–${l.x1.toFixed(0)} dy ${(y - l.y).toFixed(1)}`).join(',') : ''}`,
    )
  }
}

// ── --spaces: 조각 안의 연속 공백(빈칸이 공백 문자로 찍힌 문제지) — 자리와 길이만
if (process.argv.includes('--spaces')) {
  for (const f of pg.frags.filter((f) => colOk(f.x) && inItem(f.y))) {
    for (const m of f.str.matchAll(/[  　]{2,}/g)) {
      const before = f.str.slice(0, m.index).replace(/[A-Za-z]/g, 'x').slice(-6)
      console.log(`  공백 ${m[0].length}칸 · 줄 y ${f.y.toFixed(0)} · 앞「${before}」 · 조각 폭 ${f.w.toFixed(0)} 글자 ${f.str.length}`)
    }
  }
}
