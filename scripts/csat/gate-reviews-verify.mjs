// scripts/csat/gate-reviews-verify.mjs
//
// **판정 파일이 export 와 맞는지 적재 전에 확인한다 — 읽기 전용.**
//
// 왜: 판정은 여러 에이전트가 병렬로 채운다(청크 팬아웃). 적재기(`gate-mixed-import --input`)도
// 리비전·본문 해시를 대조하지만, **어느 줄이 왜 틀렸는지**는 적재기가 멈춘 뒤에야 알 수 있다.
// 그래서 같은 대조를 먼저 돌려 **파일 단위로** 판정한다(빠진 편 · 남는 편 · 해시 불일치 · 모순 장르).
//
// 실측 2026-09-20: 병렬 판정 중 공용 scratchpad 파일명이 겹쳐 다른 청크의 스크립트가 덮어써졌다.
// 그런 사고는 출력 파일에 조용히 남으므로, 사람 눈이 아니라 이 검사가 잡아야 한다.
//
// 실행: node scripts/csat/gate-reviews-verify.mjs <export.json> <reviews.json> [...쌍 반복]

import fs from 'node:fs'

import { HARMFUL, UNFIT } from './gate-rules.mjs'

// ⚠️ **적재기와 같은 집합을 써야 한다.** 여기 손으로 적어 두었더니 `poetry-drama` 가 빠져 있었고,
//   그 조합(`use` + `poetry-drama`)은 이 검사를 통과한 뒤 `gate-mixed-import` 에서 throw 했다 —
//   검사기가 먼저 보라고 만든 것인데 먼저 못 봤다. 그래서 정본(`gate-rules`)에서 편다.
const BLOCKED = new Set([...HARMFUL, ...UNFIT, 'poetry-drama'])
const KEYS = ['id', 'verdict', 'genre', 'why', 'source_updated_at', 'body_sha256']
const pairs = process.argv.slice(2)
if (!pairs.length || pairs.length % 2) throw new Error('<export.json> <reviews.json> 쌍으로 넘긴다')

let bad = 0
for (let i = 0; i < pairs.length; i += 2) {
  const [exportFile, reviewFile] = [pairs[i], pairs[i + 1]]
  const exported = JSON.parse(fs.readFileSync(exportFile, 'utf8'))
  const reviews = JSON.parse(fs.readFileSync(reviewFile, 'utf8'))
  const byId = new Map(exported.map((x) => [x.id, x]))
  const problems = []

  if (!Array.isArray(reviews)) problems.push('reviews 가 배열이 아니다')
  const seen = new Set()
  for (const [n, r] of (Array.isArray(reviews) ? reviews : []).entries()) {
    const at = `#${n + 1}`
    const extra = Object.keys(r ?? {}).filter((k) => !KEYS.includes(k))
    if (extra.length) problems.push(`${at} 여분 키: ${extra.join(',')}`)
    const src = byId.get(r?.id)
    if (!src) { problems.push(`${at} export 에 없는 id: ${r?.id}`); continue }
    if (seen.has(r.id)) problems.push(`${at} 중복 id: ${r.id}`)
    seen.add(r.id)
    if (!['use', 'narrative', 'reject'].includes(r.verdict)) problems.push(`${at} verdict 값이 아니다: ${r.verdict}`)
    if (typeof r.genre !== 'string' || !r.genre) problems.push(`${at} genre 없음`)
    if (typeof r.why !== 'string' || r.why.trim().length < 10) problems.push(`${at} why 가 10자 미만`)
    if (r.verdict !== 'reject' && BLOCKED.has(r.genre)) problems.push(`${at} 모순: ${r.verdict} + 차단 장르 ${r.genre}`)
    // 반대 방향도 본다 — 드레인 정본(JUDGING.md)은 `reject` 면 genre 가 차단 장르여야 한다고 못박는다.
    // 주제 장르로 reject 하면 사유 코드가 `blockedBy: 'news'` 처럼 남아 나중에 되짚을 수 없다.
    if (r.verdict === 'reject' && !BLOCKED.has(r.genre)) problems.push(`${at} reject 인데 차단 장르가 아니다: ${r.genre}`)
    if (Date.parse(r.source_updated_at) !== Date.parse(src.source_updated_at)) problems.push(`${at} 리비전 불일치: ${r.id}`)
    if (r.body_sha256 !== src.body_sha256) problems.push(`${at} 본문 해시 불일치: ${r.id}`)
  }
  for (const x of exported) if (!seen.has(x.id)) problems.push(`판정이 빠진 편: ${x.id}`)

  const dist = {}
  for (const r of Array.isArray(reviews) ? reviews : []) {
    const k = `${r.verdict}/${r.genre}`
    dist[k] = (dist[k] ?? 0) + 1
  }
  console.log(JSON.stringify({
    exportFile, reviewFile, exported: exported.length, reviewed: Array.isArray(reviews) ? reviews.length : 0,
    ok: problems.length === 0, problems: problems.slice(0, 10), distribution: dist,
  }))
  if (problems.length) bad++
}
process.exit(bad ? 1 : 0)
