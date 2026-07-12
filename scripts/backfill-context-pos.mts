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
async function backfill(table: string, idCol: string) {
  let from = 0, done = 0
  const updates: Record<string, string[]> = {} // pos → ids
  while (true) {
    const { data } = await sb.from(table).select(`id, word, lemma, first_sentence`).is('context_pos', null).not('first_sentence', 'is', null).range(from, from + 999)
    if (!data || data.length === 0) break
    for (const r of data as any[]) {
      const w = (r.lemma ?? r.word).toLowerCase()
      if (!multiPos.has(w)) continue
      let res; try { res = processText(r.first_sentence) } catch { continue }
      let pos: string | null = null
      for (const s of res.sentences) for (const t of s.tokens) if (t.lemma === w) { pos = POS_MAP[t.pos] ?? null; break }
      if (!pos) continue
      ;(updates[pos] ??= []).push(r.id)
    }
    if (data.length < 1000) break
    from += 1000
  }
  // pos별 배치 UPDATE
  for (const [pos, ids] of Object.entries(updates)) {
    for (let i = 0; i < ids.length; i += 500) {
      await sb.from(table).update({ context_pos: pos }).in('id', ids.slice(i, i + 500))
      done += Math.min(500, ids.length - i)
    }
  }
  console.log(`${table}: context_pos 백필 ${done} (pos분포 ${Object.entries(updates).map(([p, ids]) => p + ':' + ids.length).join(' ')})`)
}
await backfill('library_book_vocabularies', 'id')
await backfill('library_article_vocabularies', 'id')
console.log('완료')
