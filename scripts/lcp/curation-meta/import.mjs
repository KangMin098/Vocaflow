// scripts/lcp/curation-meta/import.mjs
//
// 큐레이션 메타 드레인 — 3단계 import. chunk-NN.out.json → library_books.curation_metadata
//
// ⚠️ **통째로 덮지 않는다.** curation_metadata 는 jsonb 이고 다른 파이프라인이 넣은 키
//    (popularity_rank · description 등)가 이미 들어 있을 수 있다. 기존 값을 읽어 **키만 더한다**.
//    덮으면 그 키들이 조용히 사라진다(CLAUDE.md §🤖).
//
// ⚠️ **빈 값·너무 짧은 값은 넣지 않는다.** 넣으면 다음 export 가 "완료" 로 세어
//    구멍이 영영 남는다. 건너뛴 수를 반드시 출력한다.
//
// 검증(넣기 전에 거른다):
//   · synopsis_ko  — 8자 이상 (한 줄 소개)
//   · learning_value — 4자 이상
//   · themes       — 문자열 2~4개
//   · genre_norm   — lib/library/genres.ts 의 RULES 키워드 중 하나를 포함해야 한다.
//                    포함하지 않으면 bucketOf 가 'literary' 로 떨어뜨려 **오분류가 그대로 남는다**
//                    — 채워도 안 채운 것과 같아지므로 거른다.
//   · age_band     — 'N+' 형식. ageBandOf 가 parseInt 로 읽는다(<10 어린이 · ≤15 청소년 · 그 외 성인).
//   · est_cefr     — A1~C2
//
// 재실행 안전: 이미 같은 값이 들어 있으면 건너뛴다. 몇 번 돌려도 결과가 같다.
// 쓰기는 --commit 일 때만.
//
// 사용: node scripts/lcp/curation-meta/import.mjs [--commit]

import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { makeClient } from '../../dict-common.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const WORK = resolve(__dirname, 'work')
const COMMIT = process.argv.includes('--commit')

// lib/library/genres.ts 의 RULES 와 **같은 키워드**. 여기가 갈리면 채운 값이 화면에서
// 다른 버킷으로 떨어진다 — 바꿀 일이 생기면 두 곳을 같은 커밋에서 고칠 것.
const GENRE_KEYWORDS = [
  '동화', '아동', '청소년', '그림책', '우화',
  '추리', '범죄', '스릴러', '미스터리', '탐정', '괴기', '공포',
  'SF', '에스에프', '공상과학', '환상', '판타지', '고딕',
  '로맨스', '연애',
  '시', '운문', '희곡', '비극', '사극', '희극', '서사시', '드라마',
  '철학', '정치', '에세이', '논설', '자서전', '전기', '회고', '사상', '종교', '역사서',
  '학술', '정책', '보고서', '논픽션', '사회학', '교과서',
  '모험', '역사', '서부', '전쟁', '항해',
  '소설', // literary fallback 을 **의도적으로** 노린 값만 허용 (빈 값과 구분된다)
]
const CEFR = new Set(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'])

/** @returns {string|null} 문제가 있으면 사유, 없으면 null */
function validate(r) {
  if (!r.synopsis_ko || r.synopsis_ko.trim().length < 8) return 'synopsis_ko 8자 미만'
  if (!r.learning_value || r.learning_value.trim().length < 4) return 'learning_value 4자 미만'
  if (!Array.isArray(r.themes) || r.themes.length < 2 || r.themes.length > 4) return 'themes 2~4개 아님'
  if (r.themes.some((t) => typeof t !== 'string' || t.trim().length === 0)) return 'themes 빈 항목'
  if (!r.genre_norm) return 'genre_norm 없음'
  if (!GENRE_KEYWORDS.some((k) => r.genre_norm.includes(k))) {
    return `genre_norm '${r.genre_norm}' 이 어느 버킷 키워드도 포함하지 않는다 (bucketOf 가 literary 로 떨어뜨린다)`
  }
  if (!r.age_band || Number.isNaN(parseInt(r.age_band, 10))) return "age_band 'N+' 형식 아님"
  if (!r.est_cefr || !CEFR.has(r.est_cefr)) return 'est_cefr A1~C2 아님'
  if (!r.est_basis || r.est_basis.trim().length < 2) return 'est_basis 없음'
  return null
}

const db = makeClient()

if (!existsSync(WORK)) {
  console.error(`작업 디렉터리가 없다: ${WORK} — export.mjs 를 먼저 돌릴 것`)
  process.exit(1)
}
const files = readdirSync(WORK).filter((f) => /^chunk-\d+\.out\.json$/.test(f)).sort()
if (files.length === 0) {
  console.error('chunk-NN.out.json 이 없다 — Claude Code 가 채운 파일이 필요하다')
  process.exit(1)
}
console.log(`out 청크 ${files.length}개${COMMIT ? ' [COMMIT]' : ' [dry-run]'}\n`)

let ok = 0
let skipped = 0
let unchanged = 0
let failed = 0
const reasons = new Map()

for (const f of files) {
  const rows = JSON.parse(readFileSync(resolve(WORK, f), 'utf8'))
  for (const r of rows) {
    const bad = validate(r)
    if (bad) {
      skipped++
      reasons.set(bad, (reasons.get(bad) ?? 0) + 1)
      console.log(`  ⊘ ${r.title} — ${bad}`)
      continue
    }

    // 기존 값을 읽어 **키만 더한다**
    const { data: cur, error: qErr } = await db
      .from('library_books')
      .select('curation_metadata')
      .eq('id', r.id)
      .maybeSingle()
    if (qErr) { failed++; console.log(`  ! ${r.title} — 조회 실패: ${qErr.message}`); continue }

    const existing = cur?.curation_metadata ?? {}
    if (existing.synopsis_ko && existing.genre_norm) { unchanged++; continue }

    const merged = {
      ...existing,
      synopsis_ko: existing.synopsis_ko ?? r.synopsis_ko.trim(),
      learning_value: existing.learning_value ?? r.learning_value.trim(),
      themes: existing.themes ?? r.themes.map((t) => t.trim()),
      genre_norm: existing.genre_norm ?? r.genre_norm.trim(),
      age_band: existing.age_band ?? r.age_band.trim(),
      est_cefr: existing.est_cefr ?? r.est_cefr,
      est_basis: existing.est_basis ?? r.est_basis.trim(),
    }

    if (COMMIT) {
      const { error } = await db
        .from('library_books')
        .update({ curation_metadata: merged })
        .eq('id', r.id)
      if (error) { failed++; console.log(`  ! ${r.title} — 기록 실패: ${error.message}`); continue }
    }
    ok++
  }
}

console.log(`\n기록 ${ok} · 이미 있음 ${unchanged} · 검증 탈락 ${skipped} · 실패 ${failed}`)
if (reasons.size > 0) {
  console.log('탈락 사유:')
  for (const [why, n] of [...reasons].sort((a, b) => b[1] - a[1])) console.log(`  ${n}× ${why}`)
}
if (!COMMIT) console.log('dry-run — 기록하지 않았다. --commit 으로 실행하면 반영된다.')
