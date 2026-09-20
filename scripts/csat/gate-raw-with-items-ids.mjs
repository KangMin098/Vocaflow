// scripts/csat/gate-raw-with-items-ids.mjs
//
// **판정 하나로 적격이 되는 raw 원본 목록을 뽑는다 — 읽기 전용.**
//
// ── 왜 이 목록이 따로 필요한가 (실측 2026-09-20) ───────────────────────
// `purpose:'raw'`(잘리지 않은 PLOS 논문 전문)는 어느 용도로도 게시할 수 없어서 판정 대상에서
// 제외돼 있었다. 그 판단은 적격 정책 v3 **전**에 만들어졌고, v3 에는 그때 없던 경로가 있다 —
// **문항이 붙은 원본은 `excerpt`(item-linked)로 적격**이 된다. 정본 평가기로 반례를 확인했다:
//   raw · B2 · V6 · 5,507어 · 문항 있음 → 지금 `unjudged[raw_content_unjudged · base_judgement]`
//                                      → `verdict='use'` 를 넣으면 **`excerpt` · 차단 0**
// 즉 **판정 한 번에 열리는 공급**이 판정 큐에서 빠져 있었다(2026-09-20: 기사 309편 · 문항 14,265개).
//
// 여기서 뽑는 것은 그 교집합뿐이다:
//   ① 적격 캐시 등급 `unjudged`
//   ② 차단 사유가 **정확히** `raw_content_unjudged` + `base_judgement`(다른 사유가 더 있으면
//      판정만으로는 안 열린다 — 예: `cefr_above_band` 는 밴드 문제라 판정이 못 고친다)
//   ③ `csat_dcp_items` 가 붙어 있다(= excerpt 경로가 성립)
//
// 재실행 안전: 읽기만 한다. 판정이 끝난 것은 등급이 바뀌어 다음 실행의 목록에서 빠진다.
//
// 실행:
//   node scripts/csat/gate-raw-with-items-ids.mjs                        # 몇 편인지만 센다
//   node scripts/csat/gate-raw-with-items-ids.mjs --write .agent-logs/raw-judge --per 100
//     → <prefix>-01.txt · -02.txt … (한 파일 ≤100 UUID · export·적재기의 상한과 같다)

import fs from 'node:fs'
import path from 'node:path'
import { createScriptClient } from '../lib/supabase-client.mjs'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}

const arg = (k) => {
  const i = process.argv.indexOf(`--${k}`)
  return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : null
}
const prefix = arg('write')
const per = Number(arg('per') ?? 100)
if (!Number.isInteger(per) || per < 1 || per > 100) throw new Error('--per 는 1..100 (적재기 상한과 같다)')

const db = createScriptClient()
const JUDGE_ONLY = ['raw_content_unjudged', 'base_judgement']

// 캐시에서 unjudged 를 페이지로 받는다 — 차단 사유 비교는 자바스크립트에서(정확 일치).
const candidates = []
for (let from = ''; ; ) {
  let q = db
    .from('csat_source_eligibility')
    .select('article_id,result')
    .eq('policy_version', 3)
    .order('article_id')
    .limit(1000)
  if (from) q = q.gt('article_id', from)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  if (!data?.length) break
  for (const row of data) {
    const blockers = row.result?.blockers
    if (row.result?.grade !== 'unjudged' || !Array.isArray(blockers)) continue
    if (blockers.length !== JUDGE_ONLY.length || JUDGE_ONLY.some((x, i) => blockers[i] !== x)) continue
    candidates.push(row.article_id)
  }
  from = data.at(-1).article_id
  if (data.length < 1000) break
}

// 문항이 붙은 것만.
//
// ⚠️ **행을 받아 세지 않는다.** 한 원본에 문항이 평균 46개라 `.in(ref_id, 100개)` 는
//   PostgREST 한 응답 상한(1,000행)에 걸려 **앞쪽 20편만 보인다** — 실측 2026-09-20 에
//   이 실수로 309편이 76편으로 줄어 보였다(오류 없음). 존재 여부만 필요하므로 **id 하나씩
//   `head` count** 로 묻는다(인덱스 `(kind, ref_id)` 로 가볍다).
const withItems = []
for (const id of candidates) {
  const { count, error } = await db
    .from('csat_dcp_items')
    .select('id', { count: 'exact', head: true })
    .eq('kind', 'article')
    .eq('ref_id', id)
  // `count ?? 0` 으로 삼키지 않는다 — 없는 표도 head 요청엔 204/null 이다(AGENTS.md).
  if (error || count == null) throw new Error(`문항 수를 셀 수 없다: ${id} — ${error?.message ?? 'count=null'}`)
  if (count > 0) withItems.push(id)
}
withItems.sort()

const files = []
if (prefix) {
  fs.mkdirSync(path.dirname(prefix), { recursive: true })
  for (let i = 0; i < withItems.length; i += per) {
    const file = `${prefix}-${String(i / per + 1).padStart(2, '0')}.txt`
    fs.writeFileSync(file, withItems.slice(i, i + per).join('\n') + '\n', { flag: 'wx' })
    files.push(file)
  }
}
console.log(JSON.stringify({
  readOnly: true,
  unjudgedJudgeOnly: candidates.length,
  withItems: withItems.length,
  files,
  next: files.length
    ? 'gate-article-export --ids-file <file> --output <json> --include-raw-with-items → 판정 → gate-mixed-import --input <reviews> [--commit] → source-policy-refresh --ids-file <file> → --plan → --commit'
    : '--write <prefix> 로 청크 파일을 만든다',
}))
