// scripts/csat/lib-fit.mjs
//
// **수능 적합도 채점기 — 모양 + 담화.** `score-articles.mjs` 안에만 있던 것을 꺼냈다.
//
// ── 왜 꺼냈는가 ──────────────────────────────────────────────────────
// 새 소스를 붙일지 정하려면 **적재하기 전에** 그 소스의 글이 대역을 통과하는지 재야 한다.
// 그런데 자가 `score-articles.mjs` 안에 갇혀 있어서, 재려면 그 파일을 복사하는 수밖에 없었다.
// 복사본이 생기면 **소스 판정과 재고 채점이 다른 자로 이뤄진다** — "이 소스는 70% 통과한다"
// 고 재 놓고 적재한 뒤 채점하면 다른 값이 나오는 일이 벌어진다.
//
// 그래서 자는 여기 하나만 둔다. `score-articles.mjs`(재고 채점)도, 소스 탐색기도,
// 적재 시점 게이트도 전부 이걸 부른다.
//
// ⚠️ **이 채점기가 재지 않는 축: 소재.** 실측(2026-08-30)에서 이 자로 재면 `wikipedia` 가
//   적합률 94.6% 로 1위인데 그 제목은 *Judge (sumo)* · *True Blue (album)* 이다.
//   2026-09-03 에 소재 분류기를 게이트로 붙여 봤지만 **확신도를 올릴수록 오히려 앨범 문서가
//   올라왔다**(`docs/reports/csat-source-fit-20260903.md` §3). 소재는 `lib-topic.mjs` 로
//   따로 재고, 소스 정책으로 통제한다. **자가 못 재는 것을 재는 척하지 않는 것이 이 파일의 계약이다.**
//
// 판(version)을 올리는 규칙: 아래 로직이 바뀌면 `SCORER_VERSION` 을 올린다 — 그래야 이미
// 채점된 원문이 재채점 대상으로 잡힌다. 대역 값만 바뀐 경우는 `bandsHash` 가 알아서 잡는다.

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import { allRows, itemBlocks, passageOf } from './lib-passage.mjs'
import { cleanPassage, looksInterleaved } from './clean-passage.mjs'
import { looksLikeProse } from './prose-gate.mjs'

export const SCORER_VERSION = 1
/** 수능 최다 출제 · 기출 표본이 가장 두꺼운 유형(n=55)이라 기준으로 쓴다. */
export const TYPE = 'R-BLANK'

const bandsFile = JSON.parse(
  fs.readFileSync(path.resolve('scripts/csat/data/type-bands-all.json'), 'utf8'),
)
export const SHAPE = bandsFile.bands[TYPE]

/**
 * ⚠️ `bandsFile.builtAt` 은 시각이 아니라 **생성 스크립트 이름**('build-bands-all.mjs')이다.
 *   그걸 판별자로 쓰면 대역을 다시 만들어 값이 바뀌어도 같은 문자열이라 **재채점 대상을
 *   못 가린다.** 그래서 대역 값 자체를 해시한다 — 값이 바뀌면 해시가 바뀐다.
 */
export const BANDS_HASH = crypto
  .createHash('sha256')
  .update(JSON.stringify(SHAPE))
  .digest('hex')
  .slice(0, 12)

export const W = (s) => s.match(/[A-Za-z][A-Za-z'-]*/g) ?? []
export const splitSentences = (s) =>
  s
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((x) => x.trim())
    .filter((x) => x.length > 3)

const CONNECTIVE =
  /\b(however|therefore|thus|hence|moreover|furthermore|nevertheless|nonetheless|consequently|accordingly|meanwhile|instead|rather|although|though|whereas|while|because|since|so that|as a result|for example|for instance|in contrast|on the other hand|in other words|that is|in fact|indeed|by contrast|similarly|likewise|in addition|on the contrary|in short|in sum)\b/gi
const ANAPHORA = /\b(this|these|those|such|its|their|his|her|they|them|it)\b/gi

/** 기출에서 담화 하한을 뽑는다 — `discourse-band.mjs` 와 같은 방법·같은 표본. */
function discourseFloor() {
  const rows = []
  for (const r of allRows()) {
    if (r.type !== TYPE) continue
    const b = itemBlocks(r.exam, r.no)[0]
    if (!b) continue
    const p = cleanPassage(passageOf(b))
    if (!p || p.length < 150 || looksInterleaved(p)) continue
    const w = W(p)
    rows.push({
      conn: (100 * (p.match(CONNECTIVE) ?? []).length) / Math.max(1, w.length),
      ana: (100 * (p.match(ANAPHORA) ?? []).length) / Math.max(1, w.length),
    })
  }
  const q = (a, x) => {
    const s = [...a].sort((m, n) => m - n)
    return s[Math.floor(x * (s.length - 1))]
  }
  return {
    n: rows.length,
    conn: q(rows.map((r) => r.conn), 0.1),
    ana: q(rows.map((r) => r.ana), 0.1),
  }
}

// 기출 파일을 읽고 분위를 뽑는 일은 한 번이면 된다 — 5만 편을 채점하는 동안 상수다.
export const FLOOR = discourseFloor()

/**
 * 글 하나 → `{ shape, pass }`.
 *
 * `shape` = 모양(어수·문장길이·낱말길이)과 산문 게이트를 통과한 **겹치지 않는 창**의 수.
 * `pass`  = 그중 담화 하한(연결사·지시어 둘 다 등장 + 각 10분위 이상)까지 통과한 창의 수.
 *           **`pass > 0` 이 「모양·담화상 적합」의 정의다** (소재는 여기서 안 본다).
 *
 * 창은 탐욕적으로 잡는다 — 문장 i 에서 시작해 어수 하한을 넘는 첫 지점에서 끊고, 통과하면
 * 그 뒤부터 다시 센다. 그래서 한 글 안에서 창끼리 겹치지 않는다.
 */
export function scoreArticle(text) {
  const sents = splitSentences(text)
  const wp = sents.map(W)
  let shape = 0
  let pass = 0
  let i = 0
  while (i < sents.length) {
    let acc = []
    let j = i
    let hit = -1
    while (j < sents.length) {
      acc = acc.concat(wp[j])
      j++
      if (acc.length > SHAPE.words.hi) break
      if (acc.length < SHAPE.words.lo) continue
      const sentLen = acc.length / (j - i)
      const wordLen = acc.reduce((s, x) => s + x.length, 0) / acc.length
      if (
        sentLen < SHAPE.sentLen.lo ||
        sentLen > SHAPE.sentLen.hi ||
        wordLen < SHAPE.wordLen.lo ||
        wordLen > SHAPE.wordLen.hi
      )
        continue
      if (!looksLikeProse(sents.slice(i, j).join(' '), acc)) continue
      hit = j
      break
    }
    if (hit < 0) {
      i++
      continue
    }
    shape++
    const text2 = sents.slice(i, hit).join(' ')
    const w = W(text2)
    const conn = (100 * (text2.match(CONNECTIVE) ?? []).length) / Math.max(1, w.length)
    const ana = (100 * (text2.match(ANAPHORA) ?? []).length) / Math.max(1, w.length)
    const hasBoth =
      (text2.match(CONNECTIVE) ?? []).length > 0 && (text2.match(ANAPHORA) ?? []).length > 0
    if (conn >= FLOOR.conn && ana >= FLOOR.ana && hasBoth) pass++
    i = hit
  }
  return { shape, pass }
}

/** `csat_fit` 에 넣을 기록 한 벌. 저장 형태를 한 곳에서 정한다. */
export function fitRecord(text) {
  const s = scoreArticle(text)
  return {
    v: SCORER_VERSION,
    bandsHash: BANDS_HASH,
    type: TYPE,
    shape: s.shape,
    pass: s.pass,
    measuredAt: new Date().toISOString(),
  }
}
