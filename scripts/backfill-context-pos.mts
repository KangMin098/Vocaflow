// scripts/backfill-context-pos.mts
// Phase 2 백필 — 다의어(multi-POS) 단어의 추출 행에 winkNLP 문맥 POS 저장.
//   Phase 3 추출이 이 값으로 meanings_ko sense 선택. 단일-POS 단어는 sense 매칭 불필요라 제외.
// 사용: npx tsx scripts/backfill-context-pos.mts

import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { processText } from '../packages/wlp/src/index.ts'

for (const f of ['apps/web/.env.local', '.env.local']) {
  try { for (const l of readFileSync(f, 'utf8').split('\n')) { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '') } } catch { /**/ }
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
const POS_MAP: Record<string, string> = { NOUN: 'noun', VERB: 'verb', ADJ: 'adjective', ADV: 'adverb', ADP: 'preposition', PRON: 'pronoun', CCONJ: 'conjunction', SCONJ: 'conjunction', AUX: 'verb', DET: 'determiner', INTJ: 'interjection', PART: 'particle', NUM: 'number' }

// 1) multi-POS 단어 집합 (sense 매칭 필요 대상)
const multiPos = new Set<string>()
{
  let from = 0
  while (true) {
    const { data } = await sb.from('shared_dictionary').select('word, meanings_ko').gte('v_level', 6).range(from, from + 999)
    if (!data || data.length === 0) break
    for (const d of data as any[]) {
      const pos = new Set((d.meanings_ko ?? []).map((s: any) => s.pos))
      if (pos.size >= 2) multiPos.add(d.word)
    }
    if (data.length < 1000) break
    from += 1000
  }
}
console.log(`multi-POS 단어: ${multiPos.size}`)

// 2) 각 테이블 백필
//
// ⚠️ 두 표의 키가 다르다.
//   `library_book_vocabularies` — uuid 대리키 `id` 를 쓴다. `lemma` 도 94.8% 채워져 있다.
//   `library_article_vocabularies` — 대리키 `id` 와 `lemma` 를 **걷었다**
//     (마이그레이션 `20260901040000_lav_drop_dead_columns`). id 는 399 MB 인덱스를
//     쓰면서 `idx_scan = 0` 이었고, lemma 는 11,011,463행 전부 NULL 이었다.
//     실제 키는 `(library_article_id, word)` 다.
//   PostgREST 는 복합키 `.in()` 이 안 되므로 기사 쪽은 **기사별로 낱말을 묶어** 보낸다.
async function backfill(table: string, composite = false) {
  let from = 0, done = 0
  const cols = composite ? 'library_article_id, word, first_sentence' : 'id, word, lemma, first_sentence'
  const byId: Record<string, string[]> = {}                      // pos → id[]
  const byArt: Record<string, Record<string, string[]>> = {}      // pos → 기사 → word[]
  while (true) {
    const { data } = await sb.from(table).select(cols).is('context_pos', null).not('first_sentence', 'is', null).range(from, from + 999)
    if (!data || data.length === 0) break
    for (const r of data as any[]) {
      const w = (composite ? r.word : (r.lemma ?? r.word)).toLowerCase()
      if (!multiPos.has(w)) continue
      let res; try { res = processText(r.first_sentence) } catch { continue }
      let pos: string | null = null
      for (const s of res.sentences) for (const t of s.tokens) if (t.lemma === w) { pos = POS_MAP[t.pos] ?? null; break }
      if (!pos) continue
      if (composite) ((byArt[pos] ??= {})[r.library_article_id] ??= []).push(r.word)
      else (byId[pos] ??= []).push(r.id)
    }
    if (data.length < 1000) break
    from += 1000
  }
  // pos별 배치 UPDATE
  if (composite) {
    for (const [pos, arts] of Object.entries(byArt)) {
      for (const [aid, words] of Object.entries(arts)) {
        for (let i = 0; i < words.length; i += 500) {
          const slice = words.slice(i, i + 500)
          await sb.from(table).update({ context_pos: pos }).eq('library_article_id', aid).in('word', slice)
          done += slice.length
        }
      }
    }
  } else {
    for (const [pos, ids] of Object.entries(byId)) {
      for (let i = 0; i < ids.length; i += 500) {
        const slice = ids.slice(i, i + 500)
        await sb.from(table).update({ context_pos: pos }).in('id', slice)
        done += slice.length
      }
    }
  }
  const dist = composite
    ? Object.entries(byArt).map(([p, arts]) => p + ':' + Object.values(arts).reduce((n, w) => n + w.length, 0))
    : Object.entries(byId).map(([p, ids]) => p + ':' + ids.length)
  console.log(`${table}: context_pos 백필 ${done} (pos분포 ${dist.join(' ')})`)
}
await backfill('library_book_vocabularies')
await backfill('library_article_vocabularies', true)
console.log('완료')
