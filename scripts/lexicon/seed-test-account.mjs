// scripts/lexicon/seed-test-account.mjs
//
// Lexicon Phase 1 — e2e 베이스라인용 test 계정 seed (멱등 · 가역)
//
// 사전 조건:
//   1. lexicon-test@vocaflow.local 계정이 Supabase Auth 에 존재
//   2. shared_dictionary 에 8개 seed 단어 매칭 (사전 확인 완료)
//
// 실행:
//   node scripts/lexicon/seed-test-account.mjs
//   node scripts/lexicon/seed-test-account.mjs --dry-run
//
// 정리:
//   node scripts/lexicon/cleanup-test-account.mjs

import { exit } from 'node:process'
import { makeClient } from '../dict-common.mjs'

// ───────────────────────────────────────────────────────────
// 상수
// ───────────────────────────────────────────────────────────

const TEST_EMAIL = 'lexicon-test@vocaflow.local'

// deterministic UUID — 재실행 시 동일 row (멱등 보장)
const TEST_TEXT_ID = 'a0000000-1ec0-0000-0000-000000000001'

// seed 8개 — A1:2, A2:3, B1:1, B2:2
const SEED_WORDS = ['science', 'study', 'achieve', 'create', 'develop', 'effective', 'abandon', 'fundamental']

// FSRS 초기값 — CLAUDE.md §17.4 (Vocaflow 한국 학습자 표준)
const FSRS_INITIAL_DIFFICULTY = 6.0
const FSRS_INITIAL_STABILITY = 0

// vocabularies.origin CHECK 정합 — 'manual' (사용자 손수 생성 의미)
const SEED_ORIGIN = 'manual'

// 8개 단어가 자연스럽게 들어간 짧은 텍스트
const TEST_TEXT_CONTENT = [
  'In a remarkable study of science, researchers wanted to develop new ideas.',
  'They needed to create effective methods, considering fundamental principles.',
  'Some had to abandon old habits to achieve real progress.',
].join(' ')

// ───────────────────────────────────────────────────────────
// 메인
// ───────────────────────────────────────────────────────────

// boolean flag — arg() 헬퍼는 '--flag value' 형식 가정이므로 직접 검사
const DRY_RUN = process.argv.includes('--dry-run')
const supabase = makeClient()

console.log(`\n▶ Lexicon Phase 1 — Test Account Seed`)
console.log(`  target: ${TEST_EMAIL}`)
console.log(`  mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'WRITE'}\n`)

// 1) user_id 조회 (하드코딩 X) — auth.admin API 사용 (PostgREST 는 auth schema 미노출)
const { data: usersPage, error: userErr } = await supabase.auth.admin.listUsers({ perPage: 200 })
if (userErr) { console.error('  ✗ auth.admin.listUsers 실패:', userErr.message); exit(1) }
const userRow = usersPage.users.find(u => u.email === TEST_EMAIL)
if (!userRow) {
  console.error(`  ✗ ${TEST_EMAIL} 미존재 — Dashboard 에서 먼저 생성 필요`)
  exit(1)
}
const USER_ID = userRow.id
console.log(`  ✓ user_id: ${USER_ID}`)

// 2) user_profiles 검증 (auth 트리거가 생성했어야 함)
const { data: profile, error: profErr } = await supabase.from('user_profiles')
  .select('user_id, display_name').eq('user_id', USER_ID).maybeSingle()
if (profErr) { console.error('  ✗ user_profiles 조회 실패:', profErr.message); exit(1) }
if (!profile) {
  console.error('  ✗ user_profiles row 미존재 — handle_new_user 트리거 점검 필요')
  exit(1)
}
console.log(`  ✓ user_profiles 정상 (display_name=${profile.display_name ?? '(null)'})`)

// 3) shared_dictionary 에서 seed 단어 메타 fetch
const { data: dictRows, error: dictErr } = await supabase.from('shared_dictionary')
  .select('word, meaning_ko, pos, cefr_level, ipa').in('word', SEED_WORDS)
if (dictErr) { console.error('  ✗ shared_dictionary 조회 실패:', dictErr.message); exit(1) }
if (!dictRows || dictRows.length !== SEED_WORDS.length) {
  console.error(`  ✗ seed 단어 매칭 부족: ${dictRows?.length ?? 0} / ${SEED_WORDS.length}`)
  exit(1)
}
const dictMap = new Map(dictRows.map(r => [r.word, r]))
console.log(`  ✓ shared_dictionary 매칭: ${dictRows.length} / ${SEED_WORDS.length}`)

if (DRY_RUN) {
  console.log('\n  [DRY RUN] — 이하 INSERT 미실행. 실 적용은 --dry-run 없이 재실행.')
  console.log(`  - texts: id=${TEST_TEXT_ID} title='Lexicon Test Script (E2E baseline)'`)
  console.log(`  - vocabularies: ${SEED_WORDS.length} rows (origin='${SEED_ORIGIN}', difficulty=${FSRS_INITIAL_DIFFICULTY})`)
  console.log(`  - user_word_set_subscriptions: 첫 발행된 세트 구독`)
  exit(0)
}

// 4) texts INSERT (deterministic UUID, ON CONFLICT DO NOTHING)
const { error: textErr } = await supabase.from('texts').upsert({
  id: TEST_TEXT_ID,
  user_id: USER_ID,
  title: 'Lexicon Test Script (E2E baseline)',
  content: TEST_TEXT_CONTENT,
  source: 'direct-script',
  cefr_level: 'B1',
  status: 'in_progress',
  progress_percent: 0,
}, { onConflict: 'id', ignoreDuplicates: true })
if (textErr) { console.error('  ✗ texts INSERT 실패:', textErr.message); exit(1) }
console.log(`  ✓ texts upsert: ${TEST_TEXT_ID}`)

// 5) vocabularies INSERT 8개 — word + lemma 둘 다 (Phase 1 dual-write)
const vocabRows = SEED_WORDS.map(w => {
  const meta = dictMap.get(w)
  return {
    user_id: USER_ID,
    text_id: TEST_TEXT_ID,
    word: w,
    lemma: w, // Phase 1 dual-write: word === lemma (정확 매칭 단어만 seed)
    meaning: meta.meaning_ko,
    pos: meta.pos,
    cefr_level: meta.cefr_level,
    pronunciation: meta.ipa,
    difficulty: FSRS_INITIAL_DIFFICULTY,
    stability: FSRS_INITIAL_STABILITY,
    origin: SEED_ORIGIN,
    review_count: 0,
  }
})
const { error: vocabErr, count: vocabCount } = await supabase.from('vocabularies').upsert(
  vocabRows,
  { onConflict: 'user_id,word', ignoreDuplicates: true, count: 'exact' },
)
if (vocabErr) { console.error('  ✗ vocabularies INSERT 실패:', vocabErr.message); exit(1) }
console.log(`  ✓ vocabularies upsert: ${vocabCount ?? SEED_WORDS.length} rows (idempotent)`)

// 6) user_word_set_subscriptions — 첫 발행된 set 구독 (없으면 skip)
const { data: setRow, error: setErr } = await supabase.from('shared_word_sets')
  .select('id, title').eq('is_published', true).order('sort_order').order('created_at').limit(1).maybeSingle()
if (setErr) { console.error('  ✗ shared_word_sets 조회 실패:', setErr.message); exit(1) }
if (!setRow) {
  console.warn('  ⚠ 발행된 shared_word_sets 없음 — 구독 skip')
} else {
  const { error: subErr } = await supabase.from('user_word_set_subscriptions').upsert(
    { user_id: USER_ID, set_id: setRow.id },
    { onConflict: 'user_id,set_id', ignoreDuplicates: true },
  )
  if (subErr) { console.error('  ✗ subscription INSERT 실패:', subErr.message); exit(1) }
  console.log(`  ✓ subscribed: '${setRow.title}' (${setRow.id})`)
}

// 7) 최종 검증
const { count: finalVocab } = await supabase.from('vocabularies')
  .select('id', { count: 'exact', head: true }).eq('user_id', USER_ID)
const { count: finalLemma } = await supabase.from('vocabularies')
  .select('id', { count: 'exact', head: true }).eq('user_id', USER_ID).not('lemma', 'is', null)
const { count: finalTexts } = await supabase.from('texts')
  .select('id', { count: 'exact', head: true }).eq('user_id', USER_ID)

console.log(`\n  검증 결과:`)
console.log(`    vocab_count : ${finalVocab} (기대: ≥ ${SEED_WORDS.length})`)
console.log(`    lemma_filled: ${finalLemma} (기대: = vocab_count)`)
console.log(`    texts_count : ${finalTexts} (기대: ≥ 1)`)

if (finalVocab < SEED_WORDS.length || finalLemma !== finalVocab || finalTexts < 1) {
  console.error('\n  ✗ 검증 실패')
  exit(1)
}
console.log(`\n✅ seed 완료. 베이스라인 e2e 실행 준비됨.\n`)
