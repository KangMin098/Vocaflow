// scripts/csat/__tests__/meaning-support-artifact.test.mjs
//
// v3.1 산출물 계약 가드 — 원문 입력 없이 CI 에서 돈다.
//   ① 파일럿 계약(manifest.contract.expectedPublic 명시 목록) ↔ 산출물: 빈 산출물 · 대상 누락 · 잘못된 count · manifest 밖 항목은 실패
//   ② 기대 공개 집합 = manifest 문항 중 지금 검수 판정으로 public 인 것 = 산출물 키(서로 같아야 한다)
//   ③ 대조 자료(alignment): 배포 v3 문장 수와 같고, 모든 앵커에 구절 지문이 있고, 검수 해시 밖에 있다
//   ④ 빌드 실행: 원문 입력이 없으면 full · --dry 모두 exit 1, 기존 산출물 byte-identical
//   node --test scripts/csat/__tests__/meaning-support-artifact.test.mjs
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { classifyReview } from '../lib-inquiry-review.mjs'
import { ALIGN_VERSION, checkPilotContract, decidePublic, lettersOnly, supportContentHash, textHash } from '../lib-meaning-support.mjs'

const ROOT = process.cwd()
const DIR = 'scripts/csat/meaning-support-drain'
const OUT = 'apps/web/src/lib/csat/meaning-support-data.json'
const readJson = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'))
const pub = readJson('apps/web/src/lib/csat/inquiry-data.json').items
const manifest = readJson(`${DIR}/pilot-manifest.json`)
const artifact = readJson(OUT)
const clone = (v) => JSON.parse(JSON.stringify(v))

const verdictsOf = new Map()
for (const f of readdirSync(join(ROOT, DIR)).filter((f) => /^review-[\w-]+\.json$/.test(f))) {
  const r = readJson(`${DIR}/${f}`)
  for (const v of r.verdicts ?? []) {
    const l = verdictsOf.get(v.itemId) ?? []
    l.push({ verdict: v.verdict, reviewer: v.reviewer ?? r.reviewer, content_hash: v.content_hash, criteria: v.criteria ?? r.criteria })
    verdictsOf.set(v.itemId, l)
  }
}

test('① 파일럿 계약 — 커밋된 산출물은 통과', () => {
  assert.deepEqual(checkPilotContract(manifest, artifact), [])
})

test('① 파일럿 계약 — 빈 산출물 · 대상 누락 · 잘못된 count · manifest 밖 항목 · 빈 계약은 실패', () => {
  const empty = { ...clone(artifact), items: {}, count: 0 }
  assert.ok(checkPilotContract(manifest, empty).some((e) => e.includes('비어 있음')))
  const one = manifest.contract.expectedPublic[0]
  const missing = clone(artifact); delete missing.items[one]; missing.count = Object.keys(missing.items).length
  assert.ok(checkPilotContract(manifest, missing).some((e) => e.startsWith(`${one}: 공개 대상인데`)))
  const badCount = clone(artifact); badCount.count += 1
  assert.ok(checkPilotContract(manifest, badCount).some((e) => e.startsWith('count')))
  const extra = clone(artifact); extra.items['2099#1'] = extra.items[one]; extra.count += 1
  assert.ok(checkPilotContract(manifest, extra).some((e) => e.startsWith('2099#1')))
  assert.ok(checkPilotContract({ ...manifest, contract: { id: 'x', expectedPublic: [] } }, artifact).some((e) => e.includes('expectedPublic')))
  assert.ok(checkPilotContract({ ...manifest, contract: null }, artifact).some((e) => e.includes('contract.id')))
})

test('② 기대 공개 집합 = 검수 판정 public = 산출물 키 = 계약 목록', () => {
  const publicNow = []
  for (const m of manifest.items) {
    const p = `${DIR}/support-${m.itemId.replace('#', '-')}.out.json`
    if (!existsSync(join(ROOT, p))) continue
    const d = decidePublic(readJson(p), verdictsOf.get(m.itemId) ?? [], pub[m.itemId], classifyReview)
    if (d.state === 'public') publicNow.push(m.itemId)
  }
  const keys = Object.keys(artifact.items).sort()
  assert.deepEqual(publicNow.sort(), keys)
  assert.deepEqual([...manifest.contract.expectedPublic].sort(), keys)
})

test('③ 대조 자료 — 문장 수 · 앵커별 구절 지문 · 검수 해시 밖', () => {
  for (const [id, e] of Object.entries(artifact.items)) {
    const a = e.alignment
    assert.ok(a && a.v === ALIGN_VERSION, `${id} alignment`)
    assert.equal(a.sentences.length, pub[id].v3.sentence_count, `${id} 문장 수`)
    for (const s of a.sentences) assert.ok(s.len > 0 && /^[0-9a-f]{14}$/.test(s.h) && s.chars >= s.len, `${id} s${s.n}`)
    for (const an of e.anchors) {
      const sp = a.spans[an.id]
      assert.ok(sp && sp.n === an.sentence && sp.e > sp.s && /^[0-9a-f]{14}$/.test(sp.h), `${id} ${an.id}`)
      const sent = a.sentences.find((x) => x.n === an.sentence)
      assert.ok(sp.e <= sent.len, `${id} ${an.id} 범위`)
      // 기존 공개 표현(quote)은 그 글자 지문이 구절 지문과 같아야 한다 — 원문 없이도 확인되는 부분
      if (an.quote) assert.equal(textHash(lettersOnly(an.quote)), sp.h, `${id} ${an.id} quote 지문`)
    }
    const { alignment, ...rest } = e
    assert.equal(supportContentHash(rest), supportContentHash(e), `${id} alignment 는 검수 해시 밖`)
    assert.equal(e.review.contentHash, supportContentHash(e))
    assert.ok(alignment)
  }
})

test('④ 빌드 — 원문 입력이 없으면 full · dry 모두 exit 1, 산출물 byte-identical', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'ms-build-'))
  try {
    mkdirSync(join(tmp, 'apps/web/src/lib/csat'), { recursive: true })
    cpSync(join(ROOT, 'apps/web/src/lib/csat/inquiry-data.json'), join(tmp, 'apps/web/src/lib/csat/inquiry-data.json'))
    cpSync(join(ROOT, OUT), join(tmp, OUT))
    mkdirSync(join(tmp, DIR), { recursive: true })
    for (const f of readdirSync(join(ROOT, DIR))) if (!f.startsWith('input-') && f.endsWith('.json')) cpSync(join(ROOT, DIR, f), join(tmp, DIR, f))
    const before = readFileSync(join(tmp, OUT))
    for (const extra of [[], ['--dry']]) {
      const r = spawnSync(process.execPath, [join(ROOT, 'scripts/csat/meaning-support-build.mjs'), ...extra], { cwd: tmp, encoding: 'utf8' })
      assert.equal(r.status, 1, `exit ${extra.join(' ')}: ${r.stdout}${r.stderr}`)
      assert.match(r.stderr, /원문 입력이 없다/)
      assert.ok(readFileSync(join(tmp, OUT)).equals(before), '산출물이 바뀌었다')
      assert.ok(!existsSync(join(tmp, `${OUT}.tmp`)))
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
})
