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

import { HARMFUL, UNFIT, SOURCE_USES } from './gate-rules.mjs'

// ⚠️ **적재기와 같은 집합을 써야 한다.** 여기 손으로 적어 두었더니 `poetry-drama` 가 빠져 있었고,
//   그 조합(`use` + `poetry-drama`)은 이 검사를 통과한 뒤 `gate-mixed-import` 에서 throw 했다 —
//   검사기가 먼저 보라고 만든 것인데 먼저 못 봤다. 그래서 정본(`gate-rules`)에서 편다.
const BLOCKED = new Set([...HARMFUL, ...UNFIT, 'poetry-drama'])
// `uses` 는 2026-09-23 에 더한 일곱째 키 — **이 원문으로 어떤 교재를 만들 수 있는가**.
// 그 전에 끝난 판정 파일에는 없으므로 **없어도 통과시키되**, 채운 비율을 출력에 찍는다
// (조용히 비어 있으면 전량을 다시 읽어야 하는 것을 나중에야 알게 된다).
const KEYS = ['id', 'verdict', 'genre', 'why', 'source_updated_at', 'body_sha256', 'uses', 'basis', 'kind']
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
  const whyCount = new Map()
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
    // 보관 청크를 내용 판정으로(또는 그 반대로) 적재하면 판정이 엉뚱한 칸에 들어간다(2026-09-24).
    if ((src.kind ?? 'content') !== (r.kind ?? 'content')) problems.push(`${at} kind 불일치: 청크 ${src.kind ?? 'content'} · 판정 ${r.kind ?? 'content'}`)
    if ((src.basis ?? 'full') !== (r.basis ?? 'full')) problems.push(`${at} basis 불일치: 청크 ${src.basis ?? 'full'} · 판정 ${r.basis ?? 'full'}`)
    whyCount.set(r.why, (whyCount.get(r.why) ?? 0) + 1)
    if (r.uses !== undefined) {
      if (!Array.isArray(r.uses)) problems.push(`${at} uses 가 배열이 아니다`)
      else {
        const unknown = r.uses.filter((u) => !SOURCE_USES.has(u))
        if (unknown.length) problems.push(`${at} 모르는 uses: ${unknown.join(',')}`)
        if (new Set(r.uses).size !== r.uses.length) problems.push(`${at} uses 에 중복`)
        // 버릴 글에 「이걸로 만들 수 있다」가 붙어 있으면 둘 중 하나가 틀린 것이다.
        if (r.verdict === 'reject' && r.uses.length) problems.push(`${at} reject 인데 uses 가 있다: ${r.uses.join(',')}`)
        if (r.verdict !== 'reject' && !r.uses.length) problems.push(`${at} ${r.verdict} 인데 uses 가 비었다`)
      }
    }
  }
  for (const x of exported) if (!seen.has(x.id)) problems.push(`판정이 빠진 편: ${x.id}`)
  // `why` 는 편마다 따로 쓴다(정본 §6). 같은 문장이 세 편 이상에 붙으면 읽지 않고 복사한 것이다 —
  //   2026-09-24 시범에서 81편에 같은 문장이 붙었다.
  for (const [why, k] of whyCount) if (k >= 3) problems.push(`같은 why 가 ${k}편에: "${String(why).slice(0, 40)}…"`)

  const dist = {}
  const useCount = {}
  let withUses = 0
  for (const r of Array.isArray(reviews) ? reviews : []) {
    const k = `${r.verdict}/${r.genre}`
    dist[k] = (dist[k] ?? 0) + 1
    if (Array.isArray(r.uses)) {
      withUses++
      for (const u of r.uses) useCount[u] = (useCount[u] ?? 0) + 1
    }
  }
  const rows = Array.isArray(reviews) ? reviews.length : 0
  console.log(JSON.stringify({
    exportFile, reviewFile, exported: exported.length, reviewed: rows,
    ok: problems.length === 0, problems: problems.slice(0, 10), distribution: dist,
    // 채움 비율을 늘 찍는다 — `uses` 가 조용히 빈 채로 쌓이면 나중에 전량을 다시 읽어야 한다.
    usesFilled: `${withUses}/${rows}`, uses: useCount,
  }))
  if (problems.length) bad++
}
process.exit(bad ? 1 : 0)
