// scripts/csat/fit-choice-band.mjs
//
// **오답 후보 풀에서 대역 중앙에 가장 가까운 조합을 고르는 루프.** (§10.27)
//
// `check-choice-band.mjs` 는 **재는** 자이고, 이 파일은 그 자를 **돌리는** 루프다.
//
// 왜 필요했나 — 2026-08-26 에 같은 실수를 세 번 반복하고서야 알았다.
// 주제 오답의 혼동도를 대역(0.0201~0.1402, 중앙 0.0800) 안에 넣으려는 시도가 세 번 다 빗나갔다:
//
//   | 시도 | 방법 | 혼동도 평균 | 대역 안 |
//   |---|---|---|---|
//   | v1~v4 | 지침을 **안 보고** 씀 | 0.0135 | 1/4 |
//   | 홀드아웃 1판 | 말로 된 지침을 **따라** 씀 | 0.1391 | 3/5 |
//   | 홀드아웃 2판 | 규칙을 **외우고** 씀 | 0.0056 | 1/5 |
//   | **v6 23번** | **재고 → 고치고 → 다시 잼** | **0.0842** | **1/1** |
//
// **말로 된 지침으로는 못 맞춘다. 계측 루프를 돌려야 든다.**
// 낮게 쓰면 지워지고, 고치라고 하면 넘어가고, 넘어가지 말라고 하면 다시 낮아진다.
// 사람이 표면 어휘 겹침을 눈으로 어림하지 못하기 때문이고, 그래서 이것은
// **작문 지침의 문제가 아니라 파이프라인에 게이트를 거는 문제**다.
//
// ⚠️ 이 루프로 맞춘 값은 **겨냥한 축**이다. 품질의 증거가 아니라
//    "작성 절차가 대역 안으로 수렴하는가" 의 답일 뿐이다.
//
// 실행: pnpm dlx tsx scripts/csat/fit-choice-band.mjs <후보풀 JSON>
//   후보풀 JSON: { items: [ { id, type, passage | src, key, pool: [오답 후보...] } ] }
//     · `src` 를 주면 "2014A 26" 처럼 기출 문항을 가리켜 그 지문을 쓴다
//     · `key` 는 정답 선지. pool 에서 4개를 골라 다섯 선지를 만든다

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { pastItems, makeIdf, choiceMetrics, choiceBands } from './check-choice-band.mjs'
import { CHOICE_RULES } from './verify-choice-rules.mjs'

const AXES = ['confusion', 'distractorPassage', 'accessibility', 'baitGap']

/** 대역 중앙에서 얼마나 떨어졌나 — 대역 폭으로 정규화해 축끼리 견줄 수 있게 한다 */
function centreDistance(m, band) {
  return AXES.reduce((s, k) => s + Math.abs(m[k] - band[k].mid) / Math.max(1e-9, band[k].hi - band[k].lo), 0)
}

/**
 * 후보 풀에서 4개를 골라 대역 중앙에 가장 가까운 조합을 돌려준다.
 * 정답 자리는 answerSlot(1~5, 기본 4)에 놓는다.
 */
export function fitChoices({ passage, type, key, pool, answerSlot = 4 }, past = pastItems(), bands = choiceBands(past)) {
  const band = bands[type]
  if (!band) throw new Error(`유형 ${type} 의 기출 표본이 부족하다`)
  const best = { d: Infinity }
  const n = pool.length
  for (let a = 0; a < n; a += 1) {
    for (let b = a + 1; b < n; b += 1) {
      for (let c = b + 1; c < n; c += 1) {
        for (let d = c + 1; d < n; d += 1) {
          const dis = [pool[a], pool[b], pool[c], pool[d]]
          const choices = [...dis.slice(0, answerSlot - 1), key, ...dis.slice(answerSlot - 1)]
          const one = { type, passage, choices, k: answerSlot - 1 }
          // **규칙을 먼저 건다.** 대역에 가까워도 C1 을 어기면 후보가 아니다.
          if (!CHOICE_RULES.every((r) => r.check(one))) continue
          const m = choiceMetrics(one, makeIdf([...past, one]))
          const inBand = AXES.filter((k) => m[k] >= band[k].lo && m[k] <= band[k].hi).length
          const dist = centreDistance(m, band)
          // 대역 안 칸수를 먼저 보고, 같으면 중앙에 가까운 쪽
          if (inBand > (best.inBand ?? -1) || (inBand === best.inBand && dist < best.d)) {
            Object.assign(best, { choices, m, inBand, d: dist, answer: answerSlot })
          }
        }
      }
    }
  }
  if (!Number.isFinite(best.d)) throw new Error('규칙을 통과하는 조합이 없다 — 후보 풀을 넓혀라')
  return best
}

// ── CLI ─────────────────────────────────────────────────────────────────────
const ENTRY = Boolean(process.argv[1]) && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (ENTRY) {
  const file = process.argv[2]
  if (!file) { console.log('사용법: pnpm dlx tsx scripts/csat/fit-choice-band.mjs <후보풀 JSON>'); process.exit(1) }
  const J = JSON.parse(fs.readFileSync(file, 'utf8'))
  const past = pastItems()
  const bands = choiceBands(past)
  const byKey = new Map(past.map((x) => [`${x.exam} ${x.no}`, x]))

  console.log('오답 대역 맞추기 — 후보 풀에서 중앙에 가장 가까운 조합을 고른다')
  console.log('='.repeat(84))
  let ok = 0
  let tot = 0
  const out = []
  for (const it of J.items) {
    const passage = it.passage ?? byKey.get(it.src)?.passage
    if (!passage) { console.log(`  ${it.id} 지문을 못 찾았다 (${it.src})`); continue }
    const r = fitChoices({ passage, type: it.type ?? 'R-TOPIC', key: it.key, pool: it.pool, answerSlot: it.answerSlot ?? 4 }, past, bands)
    const band = bands[it.type ?? 'R-TOPIC']
    ok += r.inBand
    tot += AXES.length
    out.push({ id: it.id, src: it.src, answer: r.answer, choices: r.choices, metrics: AXES.reduce((o, k) => ({ ...o, [k]: r.m[k] }), {}) })
    console.log('')
    console.log(`  ${it.id} ${it.src ?? ''}  대역 안 **${r.inBand}/4**  (후보 ${it.pool.length}개에서 4개 선택)`)
    for (const k of AXES) {
      const v = r.m[k]
      const b = band[k]
      const inB = v >= b.lo && v <= b.hi
      console.log(`     ${k.padEnd(18)} ${v.toFixed(4)}  대역 ${b.lo.toFixed(4)}~${b.hi.toFixed(4)} (중앙 ${b.mid.toFixed(4)})  ${inB ? '안' : '**밖**'}`)
    }
  }
  console.log('')
  console.log(`  전체 대역 안 **${ok}/${tot}** = ${(ok / tot * 100).toFixed(1)}%`)
  const DIR = path.resolve('scripts/csat/data')
  const dst = path.join(DIR, 'choice-fit-result.json')
  fs.writeFileSync(dst, JSON.stringify({ items: out }, null, 1))
  console.log(`\n→ ${dst}`)
}
