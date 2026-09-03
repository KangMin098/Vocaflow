// scripts/csat/score-composed.mjs
//
// **지어 쓴 지문을 적재 전에 재는 자.** 수확한 원문과 **같은 자**(`lib-fit.mjs`)를 댄다.
//
// ── 왜 필요한가 ──────────────────────────────────────────────────────
// `probe-ojs.mjs` 로 인문 대량 공급선이 막힌 것을 확인한 뒤(순 수율 7~8%), 남은 길 셋 중
// 하나가 **예술·문화 지문을 짓는 것**이다(`docs/reports/csat-source-fit-20260903.md` §14).
// 저작권이 처음부터 깨끗하고 소재를 원하는 칸에 정확히 놓을 수 있다.
//
// ⚠️ 다만 **전제를 먼저 확인해야 한다.** 저장소에 이미 지어 둔 `original` 524편의 적합률은
//   **3.8%** 다. 그건 초·중용 짧은 글이라 그렇다는 것이 설명이지만, 그 설명이 맞는지는
//   **수능 대역을 겨냥해 지어 재 보기 전에는 모른다.** 6,000편을 짓기 전에 파일럿으로 가른다.
//
// ── 이 자가 내는 것 ──────────────────────────────────────────────────
// 편마다 `pass`(적합 창 수)와 **대역 진단** — 어수·문장길이·낱말길이가 기출 대역의 어디에
// 있는지. 떨어졌을 때 "왜" 를 알아야 다음 편을 고쳐 쓸 수 있다. 합격/불합격만 내면
// 고칠 방향을 모른 채 다시 짓게 된다.
//
// 재실행 안전: 읽기 전용. 파일만 읽고 아무것도 쓰지 않는다.
//
// 입력: `[{ title, topic, content }, …]` JSON
//
// 실행:
//   node scripts/csat/score-composed.mjs scripts/csat/compose-pilot/art-v1.json

import fs from 'node:fs'
import path from 'node:path'

import { scoreArticle, SHAPE, FLOOR, W, splitSentences } from './lib-fit.mjs'
import { classify } from './lib-topic.mjs'

const file = process.argv[2]
if (!file) {
  console.error('사용법: node scripts/csat/score-composed.mjs <지문 JSON>')
  process.exit(1)
}
const items = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'))

const CONNECTIVE =
  /\b(however|therefore|thus|hence|moreover|furthermore|nevertheless|nonetheless|consequently|accordingly|meanwhile|instead|rather|although|though|whereas|while|because|since|so that|as a result|for example|for instance|in contrast|on the other hand|in other words|that is|in fact|indeed|by contrast|similarly|likewise|in addition|on the contrary|in short|in sum)\b/gi
const ANAPHORA = /\b(this|these|those|such|its|their|his|her|they|them|it)\b/gi

/** 대역 어디쯤인지 한 글자로 — `<` 미달 · `=` 안 · `>` 초과. */
const band = (v, b) => (v < b.lo ? '<' : v > b.hi ? '>' : '=')

console.log(`지어 쓴 지문 채점 — 수확 원문과 같은 자\n${'='.repeat(78)}`)
console.log(
  `  대역 어수 ${SHAPE.words.lo}~${SHAPE.words.hi} · 문장 ${SHAPE.sentLen.lo.toFixed(1)}~${SHAPE.sentLen.hi.toFixed(1)}어 ` +
    `· 낱말 ${SHAPE.wordLen.lo.toFixed(2)}~${SHAPE.wordLen.hi.toFixed(2)}자\n` +
    `  담화 하한 연결사 ${FLOOR.conn.toFixed(2)} · 지시어 ${FLOOR.ana.toFixed(2)} (둘 다 1회 이상 필수)\n`,
)
console.log(
  `  ${'#'.padStart(3)} ${'어수'.padStart(6)} ${'문장'.padStart(6)} ${'낱말'.padStart(6)} ` +
    `${'연결'.padStart(5)} ${'지시'.padStart(5)} ${'창'.padStart(4)} ${'소재'.padEnd(11)} 제목`,
)
console.log('  ' + '-'.repeat(76))

let fit = 0
const topics = {}
const diag = { wordsLo: 0, wordsHi: 0, sentLo: 0, sentHi: 0, wordLo: 0, wordHi: 0, noConn: 0, lowAna: 0 }
for (const [i, it] of items.entries()) {
  const text = String(it.content ?? '')
  const sents = splitSentences(text)
  const words = W(text)
  const sentLen = words.length / Math.max(1, sents.length)
  const wordLen = words.reduce((s, x) => s + x.length, 0) / Math.max(1, words.length)
  const conn = (100 * (text.match(CONNECTIVE) ?? []).length) / Math.max(1, words.length)
  const ana = (100 * (text.match(ANAPHORA) ?? []).length) / Math.max(1, words.length)
  const sc = scoreArticle(text)
  const tp = classify(text.slice(0, 6000))
  topics[tp.topic] = (topics[tp.topic] ?? 0) + 1
  if (sc.pass > 0) fit++

  // 떨어진 이유를 모아 둔다 — 다음 편을 어느 쪽으로 고칠지가 여기서 나온다.
  if (sc.pass === 0) {
    if (words.length < SHAPE.words.lo) diag.wordsLo++
    if (sentLen < SHAPE.sentLen.lo) diag.sentLo++
    if (sentLen > SHAPE.sentLen.hi) diag.sentHi++
    if (wordLen < SHAPE.wordLen.lo) diag.wordLo++
    if (wordLen > SHAPE.wordLen.hi) diag.wordHi++
    if ((text.match(CONNECTIVE) ?? []).length === 0) diag.noConn++
    if (ana < FLOOR.ana) diag.lowAna++
  }

  console.log(
    `  ${String(i + 1).padStart(3)} ${String(words.length).padStart(6)} ` +
      `${(sentLen.toFixed(1) + band(sentLen, SHAPE.sentLen)).padStart(6)} ` +
      `${(wordLen.toFixed(2) + band(wordLen, SHAPE.wordLen)).padStart(6)} ` +
      `${conn.toFixed(1).padStart(5)} ${ana.toFixed(1).padStart(5)} ` +
      `${String(sc.pass).padStart(4)} ${tp.topic.padEnd(11)} ${String(it.title ?? '').slice(0, 34)}`,
  )
}

console.log('  ' + '-'.repeat(76))
const n = items.length
console.log(`  ${n}편 중 **적합 ${fit} (${((100 * fit) / Math.max(1, n)).toFixed(0)}%)**`)
console.log(`  소재: ${Object.entries(topics).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ')}`)
const fails = Object.entries(diag).filter(([, v]) => v > 0)
if (fails.length) {
  const label = { wordsLo: '글이 짧다', wordsHi: '글이 길다', sentLo: '문장이 짧다', sentHi: '문장이 길다', wordLo: '낱말이 짧다', wordHi: '낱말이 길다', noConn: '연결사 없음', lowAna: '지시어 부족' }
  console.log(`  떨어진 이유: ${fails.map(([k, v]) => `${label[k] ?? k} ${v}`).join(' · ')}`)
}
console.log(`\n  ⚠️ 표본 ${n}편이다. "된다/안 된다" 를 가르는 데는 쓰되, 적합률 수치로 인용하지 말 것.`)
