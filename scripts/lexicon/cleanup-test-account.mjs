// scripts/lexicon/cleanup-test-account.mjs
//
// Lexicon Phase 1 — e2e 베이스라인 test 계정 데이터 정리 (멱등 · 가역)
//
// 삭제 대상 (FK 의존성 역순):
//   user_word_set_subscriptions → learning_records → vocabularies → texts
//
// 보존:
//   auth.users 자체 (Phase 6 안정화 시점에 Dashboard 에서 수동 삭제)
//   user_profiles (auth.users 와 결합 보존)
//
// 실행:
//   node scripts/lexicon/cleanup-test-account.mjs
//   node scripts/lexicon/cleanup-test-account.mjs --dry-run

import { exit } from 'node:process'
import { makeClient } from '../dict-common.mjs'

const TEST_EMAIL = 'lexicon-test@vocaflow.local'

// boolean flag — arg() 헬퍼는 '--flag value' 형식 가정이므로 직접 검사
const DRY_RUN = process.argv.includes('--dry-run')
const supabase = makeClient()

console.log(`\n▶ Lexicon Phase 1 — Test Account Cleanup`)
console.log(`  target: ${TEST_EMAIL}`)
console.log(`  mode: ${DRY_RUN ? 'DRY RUN (no deletes)' : 'DELETE'}\n`)

// 1) user_id 조회 (하드코딩 X) — auth.admin API 사용 (PostgREST 는 auth schema 미노출)
const { data: usersPage, error: userErr } = await supabase.auth.admin.listUsers({ perPage: 200 })
if (userErr) { console.error('  ✗ auth.admin.listUsers 실패:', userErr.message); exit(1) }
const userRow = usersPage.users.find(u => u.email === TEST_EMAIL)
if (!userRow) {
  console.warn(`  ⚠ ${TEST_EMAIL} 미존재 — 정리할 대상 없음 (멱등 정상)`)
  exit(0)
}
const USER_ID = userRow.id
console.log(`  ✓ user_id: ${USER_ID}`)

// 2) 사전 카운트 (삭제 전 상태 측정)
const tables = ['user_word_set_subscriptions', 'learning_records', 'vocabularies', 'texts']
const before = {}
for (const t of tables) {
  const { count, error } = await supabase.from(t)
    .select('*', { count: 'exact', head: true }).eq('user_id', USER_ID)
  if (error) { console.error(`  ✗ ${t} 사전 카운트 실패:`, error.message); exit(1) }
  before[t] = count ?? 0
}
console.log(`  사전 상태:`)
for (const t of tables) console.log(`    ${t.padEnd(32)} = ${before[t]}`)

if (DRY_RUN) {
  console.log('\n  [DRY RUN] — 이하 DELETE 미실행. 실 적용은 --dry-run 없이 재실행.')
  console.log(`  삭제 예상: ${Object.values(before).reduce((a, b) => a + b, 0)} rows`)
  exit(0)
}

// 3) DELETE 순서대로 (FK 의존성 역순, spec 명시 순서 준수)
const deleted = {}

// 3-a) user_word_set_subscriptions (독립)
{
  const { error, count } = await supabase.from('user_word_set_subscriptions')
    .delete({ count: 'exact' }).eq('user_id', USER_ID)
  if (error) { console.error('  ✗ subscriptions DELETE 실패:', error.message); exit(1) }
  deleted.user_word_set_subscriptions = count ?? 0
}

// 3-b) learning_records (user_id 기준 — CASCADE 의존 X, 명시 삭제로 결정성 확보)
{
  const { error, count } = await supabase.from('learning_records')
    .delete({ count: 'exact' }).eq('user_id', USER_ID)
  if (error) { console.error('  ✗ learning_records DELETE 실패:', error.message); exit(1) }
  deleted.learning_records = count ?? 0
}

// 3-c) vocabularies (learning_records.vocabulary_id CASCADE 안전망)
{
  const { error, count } = await supabase.from('vocabularies')
    .delete({ count: 'exact' }).eq('user_id', USER_ID)
  if (error) { console.error('  ✗ vocabularies DELETE 실패:', error.message); exit(1) }
  deleted.vocabularies = count ?? 0
}

// 3-d) texts (마지막)
{
  const { error, count } = await supabase.from('texts')
    .delete({ count: 'exact' }).eq('user_id', USER_ID)
  if (error) { console.error('  ✗ texts DELETE 실패:', error.message); exit(1) }
  deleted.texts = count ?? 0
}

console.log(`\n  삭제 결과:`)
for (const t of tables) console.log(`    ${t.padEnd(32)} = ${deleted[t]}`)

// 4) 사후 검증 — 모두 0 이어야 함
const after = {}
for (const t of tables) {
  const { count, error } = await supabase.from(t)
    .select('*', { count: 'exact', head: true }).eq('user_id', USER_ID)
  if (error) { console.error(`  ✗ ${t} 사후 카운트 실패:`, error.message); exit(1) }
  after[t] = count ?? 0
}

const residual = Object.entries(after).filter(([, v]) => v > 0)
if (residual.length > 0) {
  console.error(`\n  ✗ 잔여 데이터 발견:`)
  for (const [t, v] of residual) console.error(`    ${t} = ${v}`)
  exit(1)
}

console.log(`\n  사후 검증: 모두 0 rows ✓`)
console.log(`  (auth.users + user_profiles 는 보존됨 — Phase 6 시점 수동 삭제)`)
console.log(`\n✅ cleanup 완료. seed 재실행 시 깨끗한 상태에서 시작.\n`)
