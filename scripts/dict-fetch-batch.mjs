// scripts/dict-fetch-batch.mjs
//
// shared_dictionary 에서 meaning_ko IS NULL 단어를 batch 단위로 추출.
//
// 정렬: cefr_level ASC NULLS LAST, word ASC — 자연스러운 A1 → C2 진행.
//
// CLI:
//   node scripts/dict-fetch-batch.mjs                    (기본 50)
//   node scripts/dict-fetch-batch.mjs --limit 100
//   node scripts/dict-fetch-batch.mjs --cefr A1          (특정 레벨만)
//
// 출력 (stdout, JSON):
//   {
//     batch_size: 50,
//     remaining_total: 21690,
//     cefr_distribution: { A1: 25, A2: 15, B1: 10 },
//     words: [{ word, pos, pos_all, cefr }, ...]
//   }

import { argv, exit, stdout } from 'node:process'

import { arg, makeClient, VALID_CEFR } from './dict-common.mjs'

const limit = Math.max(1, Math.min(500, Number(arg(argv, '--limit', 50))))
const cefrFilter = arg(argv, '--cefr', null)

if (cefrFilter && !VALID_CEFR.has(cefrFilter)) {
  console.error(`  ✗ --cefr 값 이상: ${cefrFilter} (A1~C2 만 허용)`)
  exit(1)
}

const supabase = makeClient()

// 1) 남은 NULL 총 개수 (필터 반영)
let countQuery = supabase
  .from('shared_dictionary')
  .select('word', { count: 'exact', head: true })
  .is('meaning_ko', null)
if (cefrFilter) countQuery = countQuery.eq('cefr_level', cefrFilter)

const { count: remaining, error: countError } = await countQuery
if (countError) {
  console.error('  ✗ count 실패:', countError.message)
  exit(1)
}

if (!remaining) {
  stdout.write(
    JSON.stringify(
      {
        batch_size: 0,
        remaining_total: 0,
        cefr_distribution: {},
        words: [],
        message: cefrFilter
          ? `CEFR=${cefrFilter} 의 NULL 단어 없음 — 완료.`
          : 'NULL 단어 없음 — 모두 채워졌습니다.',
      },
      null,
      2,
    ) + '\n',
  )
  exit(0)
}

// 2) 실제 batch 추출
let q = supabase
  .from('shared_dictionary')
  .select('word, pos, pos_all, cefr_level')
  .is('meaning_ko', null)
  .order('cefr_level', { ascending: true, nullsFirst: false })
  .order('word', { ascending: true })
  .limit(limit)
if (cefrFilter) q = q.eq('cefr_level', cefrFilter)

const { data, error } = await q
if (error) {
  console.error('  ✗ select 실패:', error.message)
  exit(1)
}

const words = (data ?? []).map((r) => ({
  word: r.word,
  pos: r.pos,
  pos_all: r.pos_all,
  cefr: r.cefr_level,
}))

const cefrDist = {}
for (const w of words) {
  const k = w.cefr ?? 'NONE'
  cefrDist[k] = (cefrDist[k] ?? 0) + 1
}

stdout.write(
  JSON.stringify(
    {
      batch_size: words.length,
      remaining_total: remaining,
      cefr_distribution: cefrDist,
      words,
    },
    null,
    2,
  ) + '\n',
)
