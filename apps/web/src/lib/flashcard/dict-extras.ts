// apps/web/src/lib/flashcard/dict-extras.ts
//
// 학습 카드(정답면) 리치 보강 — 단어 배치 → 사전 부가정보 map.
//   ① collocations(자주 쓰는 표현) ② 다의어 품사별 뜻(meanings_ko ≥2 sense) ③ 어원 root 분해.
// vocabularies/scoped 단어는 flat meaning 만 보유 → shared_dictionary + word_root_links 배치 조회로 보강.
// scoped-words / hub-words 공용(단일 출처). 실패해도 카드 렌더 무영향(빈 map).

import type { SupabaseClient } from '@supabase/supabase-js'

import { cleanWordWebRow } from '@/lib/dict/word-web'

export interface WordSense {
  pos: string
  meaning: string
  /** 그 뜻으로만 읽히는 예문 (meanings_ko[].example) — 뜻을 갈라 주는 문장. 없으면 미표시 */
  example?: string
  /** 예문 해석 (meanings_ko[].example_ko) — 국내 교재는 예문마다 해석을 단다. 없으면 미표시 */
  exampleKo?: string
}
export interface RootPart {
  root: string
  gloss: string
  affix: string // prefix | root | suffix
}
export interface DictExtras {
  collocations?: string[]
  senses?: WordSense[]
  roots?: RootPart[]
  mnemonic?: string // 어근 기반 니모닉(mnemonic_ko)
  /**
   * 파생어 — 한 낱말에서 갈라져 나온 말(`derived_forms`).
   *
   * ⚠️ **재고는 있는데 화면이 안 읽고 있었다** (실측 2026-08-30: 카탈로그 58.8%).
   *   시중 단어장은 표제어 아래 파생어를 붙이는 것이 기본형이고(실측 보유율 41.4%),
   *   우리는 그보다 많이 갖고도 학습자에게 한 번도 보여 준 적이 없었다.
   *   DB 에만 있는 것은 재고이지 제품이 아니다.
   */
  derived?: string[]
  /** 유의어 — `synonyms`. 위와 같은 이유로 이번에 화면에 올린다(카탈로그 71.1%). */
  synonyms?: string[]
  /** 반의어 — `antonyms`. 짝을 이루는 말은 함께 보여야 변별이 생긴다(카탈로그 51.5%). */
  antonyms?: string[]
  /**
   * 예문 → 한국어 해석. 카드가 어떤 예문을 고를지 여기서는 알 수 없으므로 **표를 넘기고**
   * 소비 측에서 찾게 한다. 키는 정규화된 예문(소문자·공백 축약).
   */
  exampleTranslations?: Record<string, string>
}

/** 예문 대조 키 — 대소문자·연속 공백 차이로 해석을 놓치지 않게 한다. */
export const exampleKey = (s: string): string => s.trim().toLowerCase().replace(/\s+/g, ' ')

const AFFIX_ORDER: Record<string, number> = { prefix: 0, root: 1, suffix: 2 }

/** 단어 배치 → {collocations, senses(다의어), roots(어원)} map. 키 = lowercase 표제어. */
export async function fetchDictExtras(
  client: SupabaseClient,
  rawWords: string[],
): Promise<Map<string, DictExtras>> {
  const map = new Map<string, DictExtras>()
  const words = [...new Set(rawWords.map((w) => (w ?? '').toLowerCase()).filter(Boolean))]
  if (words.length === 0) return map

  // ① collocations + 다의어 senses + 니모닉 (shared_dictionary)
  const { data: dict, error: dictErr } = await client
    .from('shared_dictionary')
    .select('word, collocations, meanings_ko, mnemonic_ko, derived_forms, synonyms, antonyms')
    .in('word', words)
  if (dictErr) {
    console.warn('[flashcard/dict-extras] dict fetch failed:', dictErr.message)
  } else {
    for (const d of (dict ?? []) as Array<{
      word: string
      collocations: string[] | null
      meanings_ko: unknown
      mnemonic_ko: string | null
      derived_forms: string[] | null
      synonyms: string[] | null
      antonyms: string[] | null
    }>) {
      const e: DictExtras = map.get(d.word) ?? {}
      if (d.collocations && d.collocations.length > 0) e.collocations = d.collocations
      if (d.mnemonic_ko && d.mnemonic_ko.trim()) e.mnemonic = d.mnemonic_ko.trim()

      // 파생어·유의어·반의어 — 정제 규칙은 `lib/dict/word-web.ts` 한 곳에 있다.
      // 읽기 조회 창도 같은 함수를 쓴다(두 곳이 다르게 거르면 같은 낱말이 다르게 보인다).
      const clean = (list: string[] | null | undefined): string[] | undefined =>
        cleanWordWebRow(list, d.word) ?? undefined
      e.derived = clean(d.derived_forms)
      e.synonyms = clean(d.synonyms)
      e.antonyms = clean(d.antonyms)
      if (Array.isArray(d.meanings_ko) && d.meanings_ko.length > 0) {
        const raw = d.meanings_ko as Array<{
          pos?: string
          meaning?: string
          example?: string
          example_ko?: string
        }>
        // 해석표는 뜻이 하나뿐인 낱말에도 필요하다 — 대표 예문의 해석이 거기 들어 있다.
        const table: Record<string, string> = {}
        for (const s of raw) {
          const ex = (s?.example ?? '').trim()
          const ko = (s?.example_ko ?? '').trim()
          if (ex && ko) table[exampleKey(ex)] = ko
        }
        if (Object.keys(table).length > 0) e.exampleTranslations = table

        const senses = raw
          .filter((s) => s && typeof s.meaning === 'string' && s.meaning.trim())
          .map((s) => ({
            pos: (s.pos ?? '').trim(),
            meaning: (s.meaning as string).trim(),
            example: (s.example ?? '').trim() || undefined,
            exampleKo: (s.example_ko ?? '').trim() || undefined,
          }))
        if (senses.length >= 2) e.senses = senses
      }
      map.set(d.word, e)
    }
  }

  // ② 어원 root 분해 (word_root_links + word_roots) — 2쿼리 JS 조인(임베드 마찰 회피)
  const { data: links, error: linkErr } = await client
    .from('word_root_links')
    .select('word, affix_type, root_id')
    .in('word', words)
  if (linkErr) {
    console.warn('[flashcard/dict-extras] root links fetch failed:', linkErr.message)
    return map
  }
  const linkRows = (links ?? []) as Array<{ word: string; affix_type: string; root_id: number }>
  const rootIds = [...new Set(linkRows.map((l) => l.root_id))]
  if (rootIds.length === 0) return map

  const { data: roots } = await client
    .from('word_roots')
    .select('id, root, gloss_ko')
    .in('id', rootIds)
  const rootById = new Map<number, { root: string; gloss: string }>()
  for (const r of (roots ?? []) as Array<{ id: number; root: string; gloss_ko: string | null }>) {
    rootById.set(r.id, { root: r.root, gloss: (r.gloss_ko ?? '').trim() })
  }

  const partsByWord = new Map<string, RootPart[]>()
  for (const l of linkRows) {
    const r = rootById.get(l.root_id)
    if (!r || !r.gloss) continue
    const arr = partsByWord.get(l.word) ?? []
    arr.push({ root: r.root, gloss: r.gloss, affix: l.affix_type })
    partsByWord.set(l.word, arr)
  }
  for (const [word, parts] of partsByWord) {
    parts.sort((a, b) => (AFFIX_ORDER[a.affix] ?? 1) - (AFFIX_ORDER[b.affix] ?? 1))
    const e = map.get(word) ?? {}
    e.roots = parts.slice(0, 3) // 최대 3부분(과밀 방지)
    map.set(word, e)
  }
  return map
}
