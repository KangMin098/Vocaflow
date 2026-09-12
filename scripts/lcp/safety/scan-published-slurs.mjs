// scripts/lcp/safety/scan-published-slurs.mjs
//
// 발행 단어장의 **멸칭 후보**를 뽑는다 — 판정은 하지 않는다(3단 드레인의 1단계 export).
//
// 배경은 slur-roots.mjs 주석 참조. 요약하면: 추출 RPC 는 표면형이 사전 표제어가 아닐 때
//   lemma 의 register 로만 판정하므로, 중립 lemma 의 멸칭 굴절형이 학습 카드로 샌다.
//
// 출력:
//   scripts/lcp/safety/out/candidates.json — 한 건씩 판정할 후보
//   화면에는 요약만.
//
// 재실행 안전: 읽기 전용이다. 몇 번 돌려도 DB 를 바꾸지 않는다.
//
// 사용: node scripts/lcp/safety/scan-published-slurs.mjs

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { makeClient } from '../../dict-common.mjs'
import { matchRoots, ALREADY_KEPT, NOISE_REGISTERS } from './slur-roots.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(__dirname, 'out/candidates.json')
const PAGE = 1000

const db = makeClient()

/** 발행 단어장의 (표면형, lemma) 쌍 전량 — PostgREST 1,000행 상한 때문에 페이지네이션 필수. */
async function fetchPublishedSurfaces() {
  const setIds = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from('shared_word_sets')
      .select('id')
      .eq('is_published', true)
      .range(from, from + PAGE - 1)
    if (error) throw new Error(`세트 조회 실패: ${error.message}`)
    setIds.push(...data.map((r) => r.id))
    if (data.length < PAGE) break
  }

  const pairs = new Map() // surface → { lemma, sets:Set }
  for (let i = 0; i < setIds.length; i += 100) {
    const chunk = setIds.slice(i, i + 100)
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await db
        .from('shared_words')
        .select('word, lemma, set_id')
        .in('set_id', chunk)
        .range(from, from + PAGE - 1)
      if (error) throw new Error(`단어 조회 실패: ${error.message}`)
      for (const r of data) {
        const surface = String(r.word).toLowerCase()
        const cur = pairs.get(surface) ?? { lemma: String(r.lemma ?? r.word).toLowerCase(), sets: new Set() }
        cur.sets.add(r.set_id)
        pairs.set(surface, cur)
      }
      if (data.length < PAGE) break
    }
  }
  return pairs
}

const pairs = await fetchPublishedSurfaces()
console.log(`발행 단어장 표면형 ${pairs.size}종`)

// 어근 선별
const flagged = []
for (const [surface, v] of pairs) {
  const roots = matchRoots(surface)
  if (roots.length === 0) continue
  flagged.push({ surface, lemma: v.lemma, roots, set_count: v.sets.size })
}
console.log(`어근 선별 통과 ${flagged.length}종`)

// 사전 정보 붙이기 — 이미 노이즈로 재분류됐거나 판정이 끝난 것은 뺀다
const surfaces = flagged.map((f) => f.surface)
const lemmas = [...new Set(flagged.map((f) => f.lemma))]
const dict = new Map()
for (const list of [surfaces, lemmas]) {
  for (let i = 0; i < list.length; i += 200) {
    const { data, error } = await db
      .from('shared_dictionary')
      .select('word, meaning_ko, pos, word_register, classified_by, example_en')
      .in('word', list.slice(i, i + 200))
    if (error) throw new Error(`사전 조회 실패: ${error.message}`)
    for (const r of data) dict.set(r.word, r)
  }
}

const candidates = []
let skippedNoise = 0
let skippedKept = 0
for (const f of flagged) {
  const sd = dict.get(f.surface) ?? null
  const ld = dict.get(f.lemma) ?? null
  // 표면형이 이미 노이즈 register 면 추출 단계에서 걸러진다 — 후보 아님
  if (sd && NOISE_REGISTERS.includes(sd.word_register)) { skippedNoise++; continue }
  // lemma 가 노이즈면 표면형도 함께 걸러지는 경로다(표면형이 사전에 없을 때)
  if (!sd && ld && NOISE_REGISTERS.includes(ld.word_register)) { skippedNoise++; continue }
  if (ALREADY_KEPT.has(f.surface)) { skippedKept++; continue }

  candidates.push({
    surface: f.surface,
    lemma: f.lemma,
    surface_is_headword: !!sd,
    matched_roots: f.roots,
    published_set_count: f.set_count,
    surface_meaning_ko: sd?.meaning_ko ?? null,
    surface_register: sd?.word_register ?? null,
    lemma_meaning_ko: ld?.meaning_ko ?? null,
    lemma_register: ld?.word_register ?? null,
    lemma_pos: ld?.pos ?? null,
    example_en: sd?.example_en ?? ld?.example_en ?? null,
    verdict: null, // 'slur' = 학습 카드에서 제외 · 'keep' = 유지. Claude Code 가 채운다.
    reason: null,
  })
}

candidates.sort((a, b) => b.published_set_count - a.published_set_count)
mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, JSON.stringify(candidates, null, 2))

console.log(`이미 노이즈 처리됨(제외) ${skippedNoise} · 판정 완료 유지어(제외) ${skippedKept}`)
console.log(`판정 대기 후보 ${candidates.length}종 → ${OUT}`)
console.log(`  노출 세트 합 ${candidates.reduce((s, c) => s + c.published_set_count, 0)}`)
