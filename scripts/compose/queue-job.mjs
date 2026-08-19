// scripts/compose/queue-job.mjs
//
// ACP §20 — **발주 만들기의 헤드리스 경로.**
//
// 취재 시작(drain-coverage)과 지문 작성 사이에 발주가 있는데, 이것도 화면 전용이었다.
// 사양(어수·문장 길이·작성 지시·붙일 활동)은 손으로 적지 않는다 — `buildJobSpec` 이
// 유형과 목표 레벨에서 만들어 낸다. 손으로 적으면 화면으로 만든 발주와 배치로 만든 발주의
// 지시가 갈리고, 그러면 같은 유형인데 결과물이 달라진다.
//
// 재실행 안전: 같은 묶음에 같은 유형·레벨 발주는 유일키가 막는다(23505 → 안내하고 끝낸다).
//
// 실행:
//   pnpm dlx tsx scripts/compose/queue-job.mjs --batch <id> --track general_proficiency \
//     --level 4 [--register news] [--skill single_word]

import fs from 'node:fs'
import path from 'node:path'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : null
}

const batchId = arg('batch')
const track = arg('track')
const level = Number(arg('level'))
if (!batchId || !track || !Number.isFinite(level)) {
  console.error('사용법: --batch <id> --track <유형> --level <0~11> [--register <..>] [--skill <..>]')
  process.exit(2)
}

const { createClient } = await import('@supabase/supabase-js')
const { LEARNING_TYPES, buildJobSpec } = await import('@vocaflow/library-pipeline')

if (!LEARNING_TYPES[track]) {
  console.error(`알 수 없는 유형: ${track}`)
  console.error(`쓸 수 있는 것: ${Object.keys(LEARNING_TYPES).join(' · ')}`)
  process.exit(2)
}

const spec = buildJobSpec(track, level, {
  register: arg('register') ?? undefined,
  skillFocus: arg('skill') ?? undefined,
})
if ('error' in spec) {
  console.error(`사양을 만들 수 없다: ${spec.error}`)
  process.exit(1)
}

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

const { data, error } = await db
  .from('article_compose_jobs')
  .insert({
    batch_id: batchId,
    track: spec.track,
    register: spec.register,
    target_v_level: spec.targetVLevel,
    skill_focus: spec.skillFocus,
    words_min: spec.words.min,
    words_max: spec.words.max,
    avg_sentence_words: spec.avgSentenceWords,
    directives: [...spec.directives],
    activities: [...spec.activities],
  })
  .select('id')
  .single()

if (error) {
  if (error.code === '23505') {
    console.log('이 묶음에 같은 유형·레벨 발주가 이미 있다 — 새로 만들지 않는다.')
    process.exit(0)
  }
  throw new Error('발주 생성 실패: ' + error.message)
}

console.log(`발주 생성 — ${data.id}`)
console.log(`  ${spec.track} · ${spec.register} · V${spec.targetVLevel} · ${spec.words.min}~${spec.words.max}단어 · 평균 ${spec.avgSentenceWords}단어/문장`)
console.log('\n작성 지시:')
for (const d of spec.directives) console.log(`  · ${d}`)
console.log(`\n붙일 활동: ${spec.activities.join(', ')}`)
