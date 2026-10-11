#!/usr/bin/env node
// scripts/csat/diagnosis/review-adjudicate.mjs
//
// 진단 태깅 검수 판정(2026-10-11) — 두 검수자 파일을 M2409 와 같은 규칙(final-v1)으로 합친다. **DB 에 쓰지 않는다.**
//   규칙: 진단 태그는 두 검수자 모두 1 이상일 때만 · 가중치는 작은 값(불일치 = 계약 ②·③ 근거가 약함)
//   입력: tmp/review/<exam>-review-A.json · <exam>-review-B.json · <exam>-items-full.json(시드 v2)
//   출력: scripts/csat/diagnosis/pilot/<exam>-review-final.json(M2409-review-final 과 같은 모양) · 요약 한 줄
//   node scripts/csat/diagnosis/review-adjudicate.mjs 2026 M2706
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const CODES = ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9']
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'))
const out = {}
for (const exam of process.argv.slice(2)) {
  const A = read(`tmp/review/${exam}-review-A.json`)
  const B = read(`tmp/review/${exam}-review-B.json`)
  const full = read(`tmp/review/${exam}-items-full.json`)
  let agreeCells = 0, cells = 0, sameAsSeed = 0, tagChanges = 0
  const items = full.items.map((it) => {
    const a = A.items.find((x) => x.no === it.no)?.w
    const b = B.items.find((x) => x.no === it.no)?.w
    if (!a || !b) throw new Error(`${exam} ${it.no} 검수 없음`)
    const w = {}
    const why = []
    for (const c of CODES) {
      cells++
      if (a[c] === b[c]) agreeCells++
      w[c] = a[c] >= 1 && b[c] >= 1 ? Math.min(a[c], b[c]) : 0
      if (a[c] !== b[c]) why.push(`adjudicate:${c} A ${a[c]} · B ${b[c]} → ${w[c]}`)
      if ((w[c] > 0) !== ((it.seedV2[c] ?? 0) > 0)) tagChanges++
    }
    if (CODES.every((c) => w[c] === (it.seedV2[c] ?? 0))) sameAsSeed++
    return { no: it.no, w, claudeA: a, claudeB: b, seedV2: it.seedV2, why }
  })
  const final = {
    exam, version: 'final-v1', date: '2026-10-11',
    reviewers: `${A.reviewer} · ${B.reviewer} — Codex CLI 미설치로 독립 검수자를 별도 문맥 Claude 로 대체(M2409 는 Claude · Codex). 검수 B 의 역량별 이유 칸은 일반 문장(문항별 요지 · 근거 · 차이 이유는 문항마다 있음)`,
    rule: '진단 태그는 두 검수자 모두 1 이상일 때만 · 가중치는 작은 값. 검수자 불일치 = 계약 ②·③ 근거가 약함',
    status: 'reviewed-not-saved — DB 저장(csat_dx_save_item_tagging) · diagnosis_ready 는 사용자 승인 뒤',
    agreement: { cells, agreeCells, rate: Math.round((agreeCells / cells) * 1000) / 1000 },
    items,
  }
  fs.writeFileSync(path.join(ROOT, `scripts/csat/diagnosis/pilot/${exam}-review-final.json`), JSON.stringify(final, null, 1) + '\n')
  out[exam] = { items: items.length, sameAsSeed, tagPresenceChanges: tagChanges, agreement: final.agreement.rate, disagreeItems: items.filter((i) => i.why.length).length }
}
console.log(JSON.stringify(out))
