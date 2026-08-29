// scripts/lcp/safety/apply-slur-verdicts.mjs
//
// 멸칭 판정(verdicts.json)을 사전에 반영한다 — 3단 드레인의 3단계 import.
//
// 조치는 **삭제가 아니라 재분류**다(2026-08-25 선례와 같은 형태).
//   · 표면형이 이미 표제어면 → word_register 를 'period_cultural' 로 옮긴다.
//   · 표면형이 표제어가 아니면 → **표제어로 등재**하고 'period_cultural' 로 둔다.
//     이게 통하는 이유: select_book_chapter_vocab 은
//       `JOIN shared_dictionary sd ON sd.word = CASE WHEN <표면형이 분류된 표제어로 존재>
//                                                    THEN lower(bv.word)
//                                                    ELSE resolve_dict_headword(lemma) END`
//     이라, 굴절형을 등재하는 순간 판정 기준이 lemma 에서 **그 표면형 자신**으로 옮겨 간다.
//     그래서 중립 lemma(savage="흉포한" · retard="지연시키다")를 건드리지 않고
//     멸칭 굴절형만 노이즈 필터에 걸리게 할 수 있다. 마이그레이션이 필요 없다.
//
// ⚠️ 사전에서 지우지 않는다. 학습자가 원문에서 눌렀을 때 뜻은 떠야 한다 —
//    그래서 등재하는 뜻은 "쓰지 말라" 가 아니라 **무슨 뜻이었는지**를 먼저 적는다.
//
// 이 스크립트는 사전만 고친다. 이미 발행된 단어장에서 빼는 것은 **재발행**이 한다
//   (republish-affected-books.mjs) — 손으로 행을 지우면 다음 재발행에서 다시 들어온다.
//
// 재실행 안전: 이미 period_cultural 인 표제어는 건너뛴다. 등재는 upsert 라 중복되지 않는다.
// 쓰기는 --commit 일 때만.
//
// 사용: node scripts/lcp/safety/apply-slur-verdicts.mjs [--commit]

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { makeClient } from '../../dict-common.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const COMMIT = process.argv.includes('--commit')
const db = makeClient()

const { slurs } = JSON.parse(readFileSync(resolve(__dirname, 'verdicts.json'), 'utf8'))
console.log(`판정된 멸칭 ${slurs.length}종${COMMIT ? ' [COMMIT]' : ' [dry-run]'}\n`)

let reclassified = 0
let inserted = 0
let already = 0
let failed = 0

for (const s of slurs) {
  const { data: existing, error: qErr } = await db
    .from('shared_dictionary')
    .select('word, word_register, meaning_ko, classified_by')
    .eq('word', s.surface)
    .maybeSingle()
  if (qErr) {
    failed++
    console.log(`  ! ${s.surface} — 조회 실패: ${qErr.message}`)
    continue
  }

  if (existing) {
    if (existing.word_register === 'period_cultural') {
      already++
      console.log(`  · ${s.surface} — 이미 period_cultural`)
      continue
    }
    console.log(`  → ${s.surface} — 재분류 ${existing.word_register} → period_cultural`)
    if (COMMIT) {
      const { error } = await db
        .from('shared_dictionary')
        .update({ word_register: 'period_cultural' })
        .eq('word', s.surface)
      if (error) { failed++; console.log(`    ! 실패: ${error.message}`); continue }
    }
    reclassified++
    continue
  }

  // 표제어가 없다 — 등재한다. meaning_ko 와 classified_by 가 있어야 추출 RPC 의 CASE 가
  // 이 표면형을 표제어로 채택하고, 그래야 노이즈 필터가 걸 수 있다.
  if (!s.meaning_ko || !s.pos) {
    failed++
    console.log(`  ! ${s.surface} — 등재에 필요한 meaning_ko/pos 가 verdicts.json 에 없다`)
    continue
  }
  console.log(`  + ${s.surface} — 신규 등재 (period_cultural)`)
  if (COMMIT) {
    const { error } = await db.from('shared_dictionary').insert({
      word: s.surface,
      pos: s.pos,
      meaning_ko: s.meaning_ko,
      word_register: 'period_cultural',
      // classified_by 는 check 제약이 있는 열거값이다(shared_dictionary_classified_by_check).
      // 자유 문자열을 넣으면 INSERT 가 통째로 거부된다 — 판정 출처는 source 로 남긴다.
      classified_by: 'claude_code_opus_5',
      // source 도 check 제약 열거값이다(shared_dictionary_source_check).
      // 'inflection-seed' 가 정확히 이 경우다 — 굴절형을 표제어로 심는다.
      source: 'inflection-seed',
      // 판정 근거는 자유 필드에 남긴다 — 나중에 이 등재가 왜 생겼는지 추적 가능해야 한다.
      field_provenance: { word_register: 'slur-verdict-20260830', meaning_ko: 'slur-verdict-20260830' },
      // v_level 은 일부러 비운다 — 지어낸 난이도를 넣지 않는다. 단어장 제외는
      // word_register='period_cultural' 하나로 이미 확정된다(추출 RPC 의 노이즈 필터).
    })
    if (error) { failed++; console.log(`    ! 실패: ${error.message}`); continue }
  }
  inserted++
}

console.log(`\n재분류 ${reclassified} · 신규 등재 ${inserted} · 이미 처리됨 ${already} · 실패 ${failed}`)
if (!COMMIT) console.log('dry-run — 사전을 바꾸지 않았다. --commit 으로 실행하면 반영된다.')
else console.log('다음: node scripts/lcp/safety/republish-affected-books.mjs --commit (발행 단어장에서 실제로 빼는 단계)')
