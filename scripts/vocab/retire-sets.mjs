// scripts/vocab/retire-sets.mjs
//
// **발행 단어장을 서가에서 내린다 — 지우지 않는다.**
//
// ── 왜 필요한가 (실측 2026-08-30) ───────────────────────────────────
// 선택 지수(`vocab/choice-benchmark.mts`)에서 못 준 신호 둘의 뿌리가 같았다:
//
//   · `toc` 70/100 — 21권이 목차가 없다(챕터 묶음 2개 미만).
//   · `preface` 41/100 — 41권이 표제어 선정 근거가 없다.
//
// 그 권들은 **컴포저를 아예 거치지 않은 레거시**다. 묶음 원리를 나중에 적어 넣을 수는 없다 —
// 청사진은 필터·정렬·그룹을 실제로 적용했다는 뜻이라, 안 거친 세트에 이름만 붙이면 거짓이 된다.
// 그래서 컴포저 판으로 **교체**하고 레거시는 내린다.
//
// ── 왜 DELETE 가 아닌가 ─────────────────────────────────────────────
// `is_published` 는 플래그다. 내려도 세트 행·낱말·구독이 그대로 남아 **언제든 되돌릴 수 있다**
// (`--restore`). DELETE 는 `user_word_set_subscriptions` 를 CASCADE 로 함께 지운다 —
// 되돌릴 수 없고, 구독자의 서재에서 권이 사라진다.
//
// 학습자가 이 세트에서 담아 간 낱말은 **어차피 영향이 없다** — 진도는 `vocabularies` 의
// 자기 행에 있고, `shared_words.id` 를 참조하는 테이블은 하나도 없다(실측: FK 0개).
//
// ── 안전 ────────────────────────────────────────────────────────────
// · 기본은 드라이런. 실제로 내리려면 `--commit`.
// · **되돌리기**: `--restore --commit` — 같은 목록을 다시 발행 상태로 올린다.
// · 이미 그 상태인 세트는 건드리지 않고 세어서 알린다 — **재실행 안전**.
// · 목록에 없는 slug 는 오류로 알린다. 조용히 넘어가면 "내렸다" 고 착각한다.
//
// 실행: node scripts/vocab/retire-sets.mjs --list <파일> [--commit] [--restore]

import fs from 'node:fs'
import path from 'node:path'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const { createClient } = await import('@supabase/supabase-js')

const COMMIT = process.argv.includes('--commit')
const RESTORE = process.argv.includes('--restore')
const listArg = (() => {
  const i = process.argv.indexOf('--list')
  return i >= 0 ? process.argv[i + 1] : null
})()
if (!listArg) {
  console.error('--list <파일> 필요 (한 줄에 slug 하나 · # 주석 허용)')
  process.exit(1)
}

const slugs = fs
  .readFileSync(path.resolve(listArg), 'utf8')
  .split('\n')
  .map((l) => l.replace(/#.*$/, '').trim())
  .filter(Boolean)

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

const target = RESTORE
const { data: rows, error } = await supabase
  .from('shared_word_sets')
  .select('id, slug, title, word_count, is_published, subscriber_count')
  .in('slug', slugs)
if (error) throw new Error(`shared_word_sets: ${error.message}`)

const found = new Map(rows.map((r) => [r.slug, r]))
const missing = slugs.filter((s) => !found.has(s))
if (missing.length > 0) {
  console.error(`⚠ 없는 slug ${missing.length}건: ${missing.join(', ')}`)
}

let toChange = 0
let already = 0
for (const slug of slugs) {
  const r = found.get(slug)
  if (!r) continue
  if (r.is_published === target) {
    already += 1
    continue
  }
  toChange += 1
  console.info(
    `  ${slug.padEnd(28)} ${String(r.word_count ?? 0).padStart(5)}낱말`
    + ` · 구독 ${r.subscriber_count ?? 0}  ${RESTORE ? '→ 발행' : '→ 내림'}`,
  )
}

if (COMMIT && toChange > 0) {
  const ids = slugs
    .map((s) => found.get(s))
    .filter((r) => r && r.is_published !== target)
    .map((r) => r.id)
  const { error: upErr } = await supabase
    .from('shared_word_sets')
    .update({ is_published: target })
    .in('id', ids)
  if (upErr) throw new Error(`상태 변경 실패: ${upErr.message}`)
}

console.info('')
console.info(`목록 ${slugs.length} · 없음 ${missing.length} · 이미 그 상태 ${already} · 바꿀 것 ${toChange}`)
console.info(
  COMMIT
    ? `  ${RESTORE ? '발행 복구' : '서가에서 내림'} ${toChange}건 — 되돌리려면 ${RESTORE ? '' : '--restore '}--commit`
    : '  드라이런 — --commit 으로 실제 반영',
)
