// apps/web/src/lib/flashcard/dict-extras.ts
//
// 학습 카드(정답면) 리치 보강 — 단어 배치 → 사전 부가정보 map.
//   ① collocations(자주 쓰는 표현) ② 다의어 품사별 뜻(meanings_ko ≥2 sense) ③ 어원 root 분해.
// vocabularies/scoped 단어는 flat meaning 만 보유 → shared_dictionary + word_root_links 배치 조회로 보강.
// scoped-words / hub-words 공용(단일 출처). 실패해도 카드 렌더 무영향(빈 map).

import type { SupabaseClient } from '@supabase/supabase-js'

export interface WordSense {
  pos: string
  meaning: string
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
}

const AFFIX_ORDER: Record<string, number> = { prefix: 0, root: 1, suffix: 2 }

/** 단어 배치 → {collocations, senses(다의어), roots(어원)} map. 키 = lowercase 표제어. */
export async function fetchDictExtras(
  client: SupabaseClient,
  rawWords: string[],
): Promise<Map<string, DictExtras>> {
  const map = new Map<string, DictExtras>()
  const words = [...new Set(rawWords.map((w) => (w ?? '').toLowerCase()).filter(Boolean))]
  if (words.length === 0) return map

  // ① collocations + 다의어 senses (shared_dictionary)
  const { data: dict, error: dictErr } = await client
    .from('shared_dictionary')
    .select('word, collocations, meanings_ko')
    .in('word', words)
  if (dictErr) {
    console.warn('[flashcard/dict-extras] dict fetch failed:', dictErr.message)
  } else {
    for (const d of (dict ?? []) as Array<{
      word: string
      collocations: string[] | null
      meanings_ko: unknown
    }>) {
      const e: DictExtras = map.get(d.word) ?? {}
      if (d.collocations && d.collocations.length > 0) e.collocations = d.collocations
      if (Array.isArray(d.meanings_ko) && d.meanings_ko.length >= 2) {
        const senses = (d.meanings_ko as Array<{ pos?: string; meaning?: string }>)
          .filter((s) => s && typeof s.meaning === 'string' && s.meaning.trim())
          .map((s) => ({ pos: (s.pos ?? '').trim(), meaning: (s.meaning as string).trim() }))
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
