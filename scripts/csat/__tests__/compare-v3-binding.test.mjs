// scripts/csat/__tests__/compare-v3-binding.test.mjs
//
// 실제 공개 산출물 결속(M5) — 공개된 모든 비교 쌍의 양쪽이 지금 공개 탐구와 같은 근거 위에 있는가.
//   inquiry_hash = 지금 작성 결과의 contentHash · units_hash · analysis_version = 공개 inquiry-data 의 값 · 쌍 내용 해시 = 독립 pass 결속.
// 커밋된 파일만 읽는다(원문 입력 청크 없이 CI 에서 돈다). 하나라도 어긋나면 화면이 그 쌍을 빼야 하는데, 빌드가 내보냈다는 뜻이다.
//   node --test scripts/csat/__tests__/compare-v3-binding.test.mjs
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

import { classifyReview, contentHash, pairContentHash, PAIR_CRITERIA_VERSION } from '../lib-inquiry-review.mjs'

const ROOT = process.cwd()
const readJson = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'))
const listOf = (o) => (Array.isArray(o) ? o : o.items ?? [])

const pub = readJson('apps/web/src/lib/csat/inquiry-data.json').items
const data = readJson('apps/web/src/lib/csat/compare-v3-data.json')

const IDIR = 'scripts/csat/inquiry-drain'
const outs = new Map()
for (const f of readdirSync(join(ROOT, IDIR)).filter((f) => /^chunk-(inq|v3)-[\w-]+\.out\.json$/.test(f)).sort()) {
  for (const it of listOf(readJson(`${IDIR}/${f}`))) {
    const prev = outs.get(it.id)
    if (!prev || (it.v3 && !prev.v3) || f.startsWith('chunk-v3')) outs.set(it.id, it)
  }
}

test('공개 쌍의 양쪽 결속이 지금 공개 탐구와 같다(분석 버전 · 문장 분할 · 탐구 내용 해시)', () => {
  const bad = []
  for (const [pid, p] of Object.entries(data.pairs)) {
    for (const k of ['left', 'right']) {
      const id = p[k]
      const b = p.binding?.[k] ?? {}
      const rec = pub[id]
      if (!rec || rec.review !== 'verified' || !rec.v3) { bad.push(`${pid} ${k} 공개 v3 아님`); continue }
      if (b.analysis_version !== rec.analysis_version) bad.push(`${pid} ${k} 분석 버전 ${b.analysis_version} ≠ ${rec.analysis_version}`)
      if (b.units_hash !== rec.v3.units_hash) bad.push(`${pid} ${k} 문장 분할 해시 다름`)
      if (!outs.has(id) || contentHash(outs.get(id)) !== b.inquiry_hash) bad.push(`${pid} ${k} 탐구 내용 해시 다름`)
    }
  }
  assert.deepEqual(bad.slice(0, 10), [], `어긋난 결속 ${bad.length}건`)
  assert.ok(Object.keys(data.pairs).length > 0)
})

test('공개 쌍마다 현재 내용 해시에 묶인 독립 pass 가 있다', () => {
  const CDIR = 'scripts/csat/compare-drain'
  const pairs = new Map()
  for (const f of readdirSync(join(ROOT, CDIR)).filter((f) => /^chunk-v3p-\d+\.out\.json$/.test(f))) {
    const o = readJson(`${CDIR}/${f}`)
    for (const p of o.pairs ?? []) pairs.set(p.pair_id, { ...p, writer_run: p.writer_run ?? o.writer_run })
  }
  const verdicts = new Map()
  for (const f of readdirSync(join(ROOT, CDIR)).filter((f) => /^review-v3p-[\w-]+\.json$/.test(f))) {
    const r = readJson(`${CDIR}/${f}`)
    for (const v of r.verdicts ?? []) {
      const l = verdicts.get(v.pair_id) ?? []
      l.push({ verdict: v.verdict, reviewer: v.reviewer ?? r.reviewer, content_hash: v.content_hash, criteria: v.criteria ?? r.criteria, file: f })
      verdicts.set(v.pair_id, l)
    }
  }
  const bad = Object.keys(data.pairs).filter((pid) => {
    const p = pairs.get(pid)
    return !p || classifyReview(p, verdicts.get(pid) ?? [], { criteria: PAIR_CRITERIA_VERSION, hashOf: pairContentHash }).state !== 'verified'
  })
  assert.deepEqual(bad.slice(0, 10), [], `독립 pass 없는 공개 쌍 ${bad.length}건`)
})
