// scripts/csat/__tests__/meaning-support-public.test.mjs
//
// v3.1 교수 sidecar 공개 가드(C1 · C5 public gate 행) — 원문 없이 CI 에서 돈다(커밋된 산출물만 읽음).
//   ① 판정 규칙(decidePublic): 미검수 · 자기 검수 · 옛 기준 · 옛 hash · revise · hold · base 결속 불일치는 공개 불가
//   ② 실제 공개 산출물(meaning-support-data.json): 문항마다 형식 오류 0 · 배포 base 결속 일치 · 커밋된 작성 결과와 같은 내용 ·
//      현재 hash 에 묶인 독립 pass 존재 · 검수 보류(review_hold) 후보는 산출물에 없음
// 원문 대조(anchor 구간 · sourceSnapshotHash)는 비공개 입력이 필요한 full build 의 몫이다 — 이 가드는 그 증거 수준을 대신하지 않는다.
//   node --test scripts/csat/__tests__/meaning-support-public.test.mjs
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

import { classifyReview } from '../lib-inquiry-review.mjs'
import { basePublicHash, decidePublic, MS_CRITERIA_VERSION, supportContentHash, validateSupport } from '../lib-meaning-support.mjs'

const ROOT = process.cwd()
const readJson = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'))
const pub = readJson('apps/web/src/lib/csat/inquiry-data.json').items
const DIR = 'scripts/csat/meaning-support-drain'

// ── ① 판정 규칙 ────────────────────────────────────────────────────────────
const record = pub['2026#34']
const support = {
  schema: 'meaning-support/1', itemId: '2026#34',
  binding: { analysisVersion: record.analysis_version, unitsHash: record.v3.units_hash, basePublicHash: basePublicHash(record), sourceSnapshotHash: 'x' },
}
const out = { writer_run: 'ms-wr-t', status: 'ok', support }
const h = supportContentHash(support)
const pass = (over = {}) => ({ verdict: 'pass', reviewer: 'ms-rv-t', content_hash: h, criteria: MS_CRITERIA_VERSION, ...over })
const st = (verdicts, rec = record, o = out) => decidePublic(o, verdicts, rec, classifyReview).state

test('공개 판정: 독립 pass 만 공개 · 미검수 · 자기 검수 · 옛 기준 · 옛 hash 는 불가', () => {
  assert.equal(st([pass()]), 'public')
  assert.equal(st([]), 'unreviewed')
  assert.equal(st([pass({ reviewer: 'ms-wr-t' })]), 'unreviewed')
  assert.equal(st([pass({ criteria: 'meaning-support-v0.9' })]), 'unreviewed')
  assert.equal(st([pass({ content_hash: 'oldhash' })]), 'unreviewed')
})

test('공개 판정: 같은 hash 에 revise 가 있으면 revise · hold 가 있으면 review_hold(pass 가 있어도)', () => {
  assert.equal(st([pass(), pass({ verdict: 'revise', reviewer: 'ms-rv-2' })]), 'revise')
  assert.equal(st([pass(), pass({ verdict: 'hold', reviewer: 'ms-rv-2' })]), 'review_hold')
})

test('공개 판정: 배포 base 가 바뀌면 stale(같은 버전 · 같은 분할에서 문맥 뜻만 바뀌어도)', () => {
  const changed = JSON.parse(JSON.stringify(record)); changed.v3.meanings[0].meaning_ko += '!'
  assert.equal(st([pass()], changed), 'stale')
  assert.equal(st([pass()], { ...record, analysis_version: record.analysis_version + 1 }), 'stale')
  assert.equal(st([pass()], null), 'stale')
  assert.equal(st([pass()], record, { ...out, status: 'needs_source' }), 'not_ok')
})

// ── ② 실제 공개 산출물 ─────────────────────────────────────────────────────
const ARTIFACT = 'apps/web/src/lib/csat/meaning-support-data.json'
const artifact = existsSync(join(ROOT, ARTIFACT)) ? readJson(ARTIFACT) : { items: {} }
const verdictsOf = new Map()
for (const f of existsSync(join(ROOT, DIR)) ? readdirSync(join(ROOT, DIR)).filter((f) => /^review-[\w-]+\.json$/.test(f)) : []) {
  const r = readJson(`${DIR}/${f}`)
  for (const v of r.verdicts ?? []) {
    const l = verdictsOf.get(v.itemId) ?? []
    l.push({ verdict: v.verdict, reviewer: v.reviewer ?? r.reviewer, content_hash: v.content_hash, criteria: v.criteria ?? r.criteria })
    verdictsOf.set(v.itemId, l)
  }
}

test('공개 산출물: 문항마다 형식 오류 0 · 배포 base 결속 · 커밋된 작성 결과와 같은 내용 · 현재 hash 독립 pass', () => {
  const bad = []
  for (const [id, entry] of Object.entries(artifact.items)) {
    const { review, ...s } = entry
    const errs = validateSupport(s, { input: null, record: pub[id] }).filter((x) => !x.includes('sourceSnapshotHash ≠ 원문'))
    if (errs.length) bad.push(`${id} 형식 ${errs[0]}`)
    const outPath = `${DIR}/support-${id.replace('#', '-')}.out.json`
    if (!existsSync(join(ROOT, outPath))) { bad.push(`${id} 작성 결과 파일 없음`); continue }
    const o = readJson(outPath)
    if (supportContentHash(o.support) !== supportContentHash(s) || review?.contentHash !== supportContentHash(s)) bad.push(`${id} 산출물 ≠ 작성 결과`)
    const d = decidePublic(o, verdictsOf.get(id) ?? [], pub[id], classifyReview)
    if (d.state !== 'public') bad.push(`${id} ${d.state}(${d.reason})`)
  }
  assert.deepEqual(bad, [])
})

test('공개 산출물: 검수 보류 · revise · 미검수 후보는 실려 있지 않다(빌드가 후보를 읽고 뺐다)', () => {
  const files = existsSync(join(ROOT, DIR)) ? readdirSync(join(ROOT, DIR)).filter((f) => /^support-[\w-]+\.out\.json$/.test(f)) : []
  const leaked = []
  for (const f of files) {
    const o = readJson(`${DIR}/${f}`)
    const id = o.support?.itemId
    if (!id) continue
    const d = decidePublic(o, verdictsOf.get(id) ?? [], pub[id], classifyReview)
    if (d.state !== 'public' && artifact.items[id]) leaked.push(`${id}(${d.state})`)
  }
  assert.deepEqual(leaked, [])
})
