// scripts/lcp/curation-meta/export.mjs
//
// 도서 큐레이션 메타(한국어 소개·장르·연령) 드레인 — 1단계 export.
//
// 왜 필요한가: 2026-08-30 발행 확대(13→316권) 뒤 실측 —
//   \`curation_metadata\` 에 synopsis_ko 가 있는 도서가 **5/316** 이었다.
//   폴백인 \`library_seed_catalog\` 는 admin/curator 전용 RLS 라 **학습자에게는 빈 값**이다.
//   그래서 학습자가 보는 것은 제목·저자·표지·레벨뿐이고, 한국 고등학생이 영어 고전 316권 중
//   무엇을 고를지 판단할 근거가 없다. 서가를 24배로 늘린 것이 **선택을 더 어렵게** 만든 셈이다.
//
//   장르는 더 나쁘다. \`lib/library/genres.ts\` 의 \`bucketOf\` 는 genre_norm 이 비면
//   'literary'(문학·소설) 로 떨어뜨린다 — 그 파일 주석이 이미 경고하고 있다:
//   "발행 도서의 genre_norm NULL 은 큐레이션 백필로 해소해야 근본 정확(프론트 한계)".
//   지금은 \`The Wealth of Nations\` · \`The Federalist Papers\` 도 문학·소설로 뜬다.
//
// 3단 구조(CLAUDE.md §🤖):
//   1) 이 스크립트 → chunk-NN.json
//   2) Claude Code 가 읽고 채워 chunk-NN.out.json
//   3) import.mjs --commit → curation_metadata 에 **키만 더한다**(통째로 덮지 않는다)
//
// 재실행 안전: synopsis_ko 가 이미 있는 도서는 제외한다. 몇 번 돌려도 같은 결과다.
//
// 사용: node scripts/lcp/curation-meta/export.mjs [--size 40]

import { mkdirSync, writeFileSync, existsSync, readdirSync, rmSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { makeClient, arg } from '../../dict-common.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = resolve(__dirname, 'work')
const SIZE = Number(arg(process.argv.slice(2), '--size', '40')) || 40

const db = makeClient()

const rows = []
for (let from = 0; ; from += 1000) {
  const { data, error } = await db
    .from('library_books')
    .select('id, title, author, original_publish_year, book_v_level, cefr_band, cefrj_level, word_count, chapter_count, reading_minutes, category_tags, curation_metadata, is_picture_book')
    .eq('status', 'published')
    .order('reading_minutes', { ascending: true })
    .range(from, from + 999)
  if (error) throw new Error(`조회 실패: ${error.message}`)
  rows.push(...data)
  if (data.length < 1000) break
}

// 이미 채워진 것은 건너뛴다 — 이게 재실행 안전의 전부다.
const need = rows.filter((r) => {
  const m = r.curation_metadata ?? {}
  return !m.synopsis_ko || !m.genre_norm
})

console.log(`발행 도서 ${rows.length} · 메타 결손 ${need.length}`)
if (need.length === 0) {
  console.log('채울 것이 없다.')
  process.exit(0)
}

// 이전 실행의 입력 청크만 지운다 — .out.json(내가 채운 것)은 건드리지 않는다.
mkdirSync(OUT_DIR, { recursive: true })
if (existsSync(OUT_DIR)) {
  for (const f of readdirSync(OUT_DIR)) {
    if (/^chunk-\d+\.json$/.test(f)) rmSync(resolve(OUT_DIR, f))
  }
}

let n = 0
for (let i = 0; i < need.length; i += SIZE) {
  n++
  const slice = need.slice(i, i + SIZE).map((r) => ({
    id: r.id,
    title: r.title,
    author: r.author,
    year: r.original_publish_year,
    v_level: r.book_v_level,
    cefr_band: r.cefr_band,
    cefrj: r.cefrj_level,
    words: r.word_count,
    chapters: r.chapter_count,
    minutes: r.reading_minutes,
    tags: r.category_tags,
    is_picture_book: r.is_picture_book,
    // ↓ Claude Code 가 채운다
    synopsis_ko: null,
    learning_value: null,
    themes: null,
    genre_norm: null,
    age_band: null,
    est_cefr: null,
    est_basis: null,
  }))
  const p = resolve(OUT_DIR, `chunk-${String(n).padStart(2, '0')}.json`)
  writeFileSync(p, JSON.stringify(slice, null, 2))
}
console.log(`청크 ${n}개 (권당 ${SIZE}) → ${OUT_DIR}`)
