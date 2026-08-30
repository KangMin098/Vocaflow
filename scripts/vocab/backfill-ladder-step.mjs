// scripts/vocab/backfill-ladder-step.mjs
//
// **발행 단어장의 계단을 낱말 실측으로 정한다** (`shared_word_sets.ladder_step`).
//
// ── 왜 필요한가 (실측 2026-08-30) ───────────────────────────────────
// 서가의 사다리 **2·4·6단이 비어 있었다.** 콘텐츠가 없어서가 아니라 **배정이 닿지 못해서**다:
//
//   `cefrToVLevel` = { A1:1, A2:3, B1:5, B2:7, C1:9, C2:10 }   ← 홀수만 낸다
//   카테고리 경로  = { 초등:1, 중등:3, 고등:5, 수능:7 }          ← 역시 홀수만
//
// 두 경로 다 **짝수 계단에 구조적으로 닿을 수 없다.** 7단짜리 사다리인데 배정 로직은
// 네 칸만 쓸 수 있었고, 그래서 "재고 0" 이 아니라 "닿지 못한 칸" 이 빈 채로 보였다.
//
// 세트에 실제로 들어 있는 낱말의 **v_level 중앙값**으로 재면 일곱 계단이 전부 찬다:
//   1단 5 · 2단 7 · 3단 2 · 4단 8 · 5단 11 · 6단 9 · 7단 13 · 학령 밖 15
//   (CEFR 라벨 기준으로는 1단 5 · 3단 10 · 5단 22 · 7단 10 · 학령 밖 23 이었다)
//
// ── 왜 중앙값인가 ────────────────────────────────────────────────────
// 평균은 꼬리에 끌린다. 주제 세트에는 아주 쉬운 낱말과 아주 어려운 낱말이 섞여 있어
// 평균을 쓰면 실제로 학습자가 만나는 난이도보다 높게 잡힌다. **중앙값은 "이 책을 펴면
// 만나는 보통 낱말" 에 해당**하고, 그것이 학년을 정하는 기준이다.
//
// ── 안전 ────────────────────────────────────────────────────────────
// · **이미 값이 있는 세트는 건드리지 않는다** — `ladder_step` 은 컴포저가 정하는 저작물이고,
//   이 스크립트의 추정으로 사람이 정한 값을 덮으면 안 된다.
// · 사전에 매칭된 낱말이 `MIN_WORDS` 미만이면 건너뛴다 — 표본이 얇으면 중앙값이 흔들린다.
// · 사다리 밖(중앙값 8 이상)은 비워 둔다. 성인 수준은 학령 사다리의 칸이 아니다.
// · 기본은 드라이런. 실제로 쓰려면 `--commit`.
//
// 실행: node scripts/vocab/backfill-ladder-step.mjs [--commit]

import fs from 'node:fs'
import path from 'node:path'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const { createClient } = await import('@supabase/supabase-js')

const COMMIT = process.argv.includes('--commit')
const HIDDEN = ['library_book', 'library_article']
/** 이보다 적게 매칭되면 중앙값을 믿지 않는다. */
const MIN_WORDS = 20

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
)

const { data: sets, error } = await supabase
  .from('shared_word_sets')
  .select('id, title, category, cefr_level, ladder_step')
  .eq('is_published', true)
  .not('category', 'in', `(${HIDDEN.join(',')})`)
if (error) throw new Error(`세트 조회 실패: ${error.message}`)

/** 세트의 낱말을 읽는다 — 세트별로 나눠 부른다(`shared_words` 는 8만 행이라 한 번에 못 훑는다). */
async function wordsOf(setId) {
  const out = []
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error: e } = await supabase
      .from('shared_words')
      .select('word')
      .eq('set_id', setId)
      .order('word')
      .range(from, from + PAGE - 1)
    if (e) throw new Error(`shared_words(${setId}): ${e.message}`)
    out.push(...data.map((r) => r.word.toLowerCase()))
    if (data.length < PAGE) break
  }
  return [...new Set(out)]
}

async function vLevelsOf(words, chunk = 400) {
  const out = []
  for (let i = 0; i < words.length; i += chunk) {
    const { data, error: e } = await supabase
      .from('shared_dictionary')
      .select('v_level')
      .in('word', words.slice(i, i + chunk))
      .not('v_level', 'is', null)
    if (e) throw new Error(`shared_dictionary: ${e.message}`)
    out.push(...data.map((r) => r.v_level))
  }
  return out
}

/** 중앙값. 짝수 개면 아래쪽을 쓴다 — 계단은 **틀리면 아래로** 가는 편이 안전하다. */
function median(xs) {
  if (xs.length === 0) return null
  const v = [...xs].sort((a, b) => a - b)
  return v[Math.floor((v.length - 1) / 2)]
}

const stats = { total: sets.length, skipAuthored: 0, skipThin: 0, skipOutside: 0, planned: 0, wrote: 0 }
const byStep = new Map()

for (const s of sets) {
  if (s.ladder_step != null) {
    stats.skipAuthored += 1
    continue
  }
  const words = await wordsOf(s.id)
  const levels = await vLevelsOf(words)
  if (levels.length < MIN_WORDS) {
    stats.skipThin += 1
    continue
  }
  const med = median(levels)
  // 사다리는 1~7 단이다. V0(유치원)·V8+(성인)은 학령 사다리 밖이라 비워 둔다.
  if (med == null || med < 1 || med > 7) {
    stats.skipOutside += 1
    continue
  }
  const step = Math.round(med)
  stats.planned += 1
  byStep.set(step, (byStep.get(step) ?? 0) + 1)

  if (COMMIT) {
    const { error: uErr } = await supabase
      .from('shared_word_sets')
      .update({ ladder_step: step })
      .eq('id', s.id)
      // ⚠️ 조건을 한 번 더 건다 — 읽은 뒤 사람이 값을 넣었으면 덮지 않는다.
      .is('ladder_step', null)
    if (uErr) throw new Error(`쓰기 실패(${s.title}): ${uErr.message}`)
    stats.wrote += 1
  }
}

console.log(`발행 세트 ${stats.total}`)
console.log(`  건너뜀 — 이미 정해짐 ${stats.skipAuthored} · 표본 얇음(<${MIN_WORDS}) ${stats.skipThin} · 학령 밖 ${stats.skipOutside}`)
console.log(`  계단별 배정: ${[...byStep.entries()].sort((a, b) => a[0] - b[0]).map(([k, v]) => `${k}단 ${v}`).join(' · ')}`)
console.log(COMMIT ? `기록 완료 — ${stats.wrote}권` : `드라이런 — ${stats.planned}권이 기록될 예정. 실제 기록은 --commit.`)
