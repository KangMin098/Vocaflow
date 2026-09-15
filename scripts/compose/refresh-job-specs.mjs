// scripts/compose/refresh-job-specs.mjs
//
// ACP §20 — **저장된 발주 사양을 지금 규칙으로 다시 만든다.**
//
// 왜 필요한가 (2026-08-19):
//   발주 사양(어수·문장 길이·작성 지시)은 `buildJobSpec` 이 유형과 목표 레벨에서 만든다.
//   그 함수가 고쳐지면 **새 발주만 바뀌고 이미 저장된 것은 낡은 채로 남는다.** 그리고 검수는
//   저장된 사양을 목표로 삼아 글을 재므로, 낡은 목표에 대고 **오탐을 낸다.**
//
//   실측: 다뉴브 초등판(V3)의 저장 사양이 평균 문장 14어절이었다. 지금 규칙으로는 초등 밴드라
//   9어절이 맞고, 글도 9어절로 쓰여 있었다. 그런데 검수는 "짧다 — 목표 유형의 호흡이 아니다"
//   라고 지적했다. **글이 아니라 목표가 낡은 것이었다.**
//
// 사양은 손으로 고치지 않는다 — 여기서도 `buildJobSpec` 을 그대로 부른다. 그래야 화면·배치·
//   검수가 같은 답을 본다.
//
// 재실행 안전: 같은 값을 다시 써도 결과가 같다. 외부 요청 없음.
//
// 실행:
//   pnpm dlx tsx scripts/compose/refresh-job-specs.mjs            # 무엇이 바뀌는지만 본다
//   pnpm dlx tsx scripts/compose/refresh-job-specs.mjs --commit   # 저장한다

import fs from 'node:fs'
import path from 'node:path'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const commit = process.argv.includes('--commit')

const { createClient } = await import('@supabase/supabase-js')
const { buildJobSpec } = await import('@vocaflow/library-pipeline')

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

const { data: jobs, error } = await db
  .from('article_compose_jobs')
  .select('id, batch_id, track, register, target_v_level, skill_focus, words_min, words_max, avg_sentence_words, directives, activities, article_id')
  .order('created_at')
if (error) throw new Error('발주 조회 실패: ' + error.message)

const changes = []
for (const j of jobs ?? []) {
  const spec = buildJobSpec(j.track, j.target_v_level, {
    register: j.register ?? undefined,
    skillFocus: j.skill_focus ?? undefined,
  })
  if ('error' in spec) {
    console.log(`  ⚠ ${j.track} V${j.target_v_level} — 사양을 만들 수 없다: ${spec.error}`)
    continue
  }
  const diff = []
  if (j.words_min !== spec.words.min || j.words_max !== spec.words.max) {
    diff.push(`어수 ${j.words_min}~${j.words_max} → ${spec.words.min}~${spec.words.max}`)
  }
  if (j.avg_sentence_words !== spec.avgSentenceWords) {
    diff.push(`문장 ${j.avg_sentence_words} → ${spec.avgSentenceWords}어절`)
  }
  const oldD = JSON.stringify(j.directives ?? [])
  const newD = JSON.stringify([...spec.directives])
  if (oldD !== newD) diff.push(`작성 지시 ${(j.directives ?? []).length} → ${spec.directives.length}줄`)
  if (diff.length) changes.push({ job: j, spec, diff })
}

console.log(`발주 ${jobs?.length ?? 0} · 낡은 사양 ${changes.length}\n`)
for (const c of changes) {
  console.log(`  ${c.job.track} V${c.job.target_v_level}`)
  for (const d of c.diff) console.log(`      ${d}`)
}

if (!changes.length) {
  console.log('전부 지금 규칙과 같다.')
  process.exit(0)
}
if (!commit) {
  console.log('\n--commit 을 붙이면 저장한다. 사양이 바뀌면 그 글의 검수 결과도 바뀐다 — 다시 돌릴 것.')
  process.exit(0)
}

let saved = 0
for (const c of changes) {
  const { error: uErr } = await db
    .from('article_compose_jobs')
    .update({
      words_min: c.spec.words.min,
      words_max: c.spec.words.max,
      avg_sentence_words: c.spec.avgSentenceWords,
      directives: [...c.spec.directives],
      activities: [...c.spec.activities],
    })
    .eq('id', c.job.id)
  if (uErr) console.error(`  ⚠ ${c.job.id} 저장 실패: ${uErr.message}`)
  else saved++
}

console.log(`\n갱신 ${saved} / ${changes.length}`)
console.log('사양이 바뀐 글은 검수를 다시 돌릴 것 — 목표가 달라졌으므로 지적도 달라진다.')
