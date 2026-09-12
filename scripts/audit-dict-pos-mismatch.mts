// scripts/audit-dict-pos-mismatch.mts
//
// 사전 sense/POS 품질 자동 탐지 — 코퍼스 지배 POS vs shared_dictionary 저장 primary POS 불일치.
// 근본: creep(저장 noun ↔ 실사용 verb)·founder(verb↔noun)·bay(adj↔noun) 류 오선정을 자동 flag.
//   winkNLP(파이프라인 동일)로 추출 단어의 실제 문맥 sentence(lbv/lav first_sentence) POS 태깅 →
//   단어별 지배 POS 집계 → 저장 pos 와 다르면 후보. Claude 검토 후 교정.
//
// 사용: npx tsx scripts/audit-dict-pos-mismatch.mts
//   (실행 디렉토리: repo root. env는 apps/web/.env.local 로드)

import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { processText } from '../packages/wlp/src/index.ts'

// env
for (const f of ['apps/web/.env.local', '.env.local']) {
  try {
    for (const line of readFileSync(f, 'utf8').split('\n')) {
      const m = line.match(/^([A-Z_]+)=(.*)$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
    }
  } catch { /* ignore */ }
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

// winkNLP universal POS → shared_dictionary pos 어휘
const POS_MAP: Record<string, string> = {
  NOUN: 'noun', VERB: 'verb', ADJ: 'adjective', ADV: 'adverb', ADP: 'preposition',
  PRON: 'pronoun', CCONJ: 'conjunction', SCONJ: 'conjunction', AUX: 'verb',
  DET: 'determiner', INTJ: 'interjection', PART: 'particle', NUM: 'number',
}

// 1) 추출 단어 + 문맥 sentence 수집 (발행 도서·아티클)
const bookSents: Array<{ word: string; sent: string }> = []
{
  const { data: books } = await sb.from('library_books').select('id').eq('status', 'published')
  const ids = (books ?? []).map((b: any) => b.id)
  // lbv: word + first_sentence (발행 도서만)
  let from = 0
  while (true) {
    const { data } = await sb.from('library_book_vocabularies')
      .select('word, lemma, first_sentence, library_book_id')
      .in('library_book_id', ids).not('first_sentence', 'is', null)
      .range(from, from + 999)
    if (!data || data.length === 0) break
    for (const r of data as any[]) if (r.first_sentence) bookSents.push({ word: (r.lemma ?? r.word).toLowerCase(), sent: r.first_sentence })
    if (data.length < 1000) break
    from += 1000
  }
}
{
  const { data: arts } = await sb.from('library_articles').select('id').eq('status', 'published')
  const ids = (arts ?? []).map((a: any) => a.id)
  let from = 0
  while (true) {
    // ⚠️ 기사 표에는 `lemma` 가 없다 — 11,011,463행 전부 NULL 이라 마이그레이션
    //   `20260901040000_lav_drop_dead_columns` 가 걷었다. 전에도 `r.lemma ?? r.word` 는
    //   항상 word 를 골랐으므로 집계 결과는 같다. (도서 표의 lemma 는 살아 있다 — 위 블록 참조.)
    const { data } = await sb.from('library_article_vocabularies')
      .select('word, first_sentence, library_article_id')
      .in('library_article_id', ids).not('first_sentence', 'is', null)
      .range(from, from + 999)
    if (!data || data.length === 0) break
    for (const r of data as any[]) if (r.first_sentence) bookSents.push({ word: (r.word ?? '').toLowerCase(), sent: r.first_sentence })
    if (data.length < 1000) break
    from += 1000
  }
}
console.log(`문맥 sentence 수집: ${bookSents.length}`)

// 2) 각 sentence winkNLP 태깅 → 단어별 POS 집계
const posByWord = new Map<string, Map<string, number>>()
for (const { word, sent } of bookSents) {
  let res
  try { res = processText(sent) } catch { continue }
  for (const s of res.sentences) {
    for (const t of s.tokens) {
      if (t.lemma !== word) continue
      const p = POS_MAP[t.pos] ?? null
      if (!p) continue
      if (!posByWord.has(word)) posByWord.set(word, new Map())
      const m = posByWord.get(word)!
      m.set(p, (m.get(p) ?? 0) + 1)
    }
  }
}

// 3) 지배 POS 계산 + 저장 POS 대조
console.log(`POS 집계된 단어: ${posByWord.size} (예: ${[...posByWord.entries()].slice(0,3).map(([w,m])=>`${w}[${[...m.entries()].map(([p,n])=>p+':'+n).join(' ')}]`).join(' · ')})`)
const words = [...posByWord.keys()]
const dictMap = new Map<string, any>()
for (let i = 0; i < words.length; i += 500) {
  const { data: dict } = await sb.from('shared_dictionary')
    .select('word, pos, meaning_ko, meanings_ko, frequency_rank, v_level')
    .in('word', words.slice(i, i + 500))
  for (const d of dict ?? []) dictMap.set((d as any).word, d)
}
console.log(`사전 매칭: ${dictMap.size}`)

const flagged: any[] = []
for (const [word, posCounts] of posByWord) {
  const d = dictMap.get(word)
  if (!d || !d.pos) continue
  const total = [...posCounts.values()].reduce((a, b) => a + b, 0)
  if (total < 3) continue // 표본 부족 제외
  const sorted = [...posCounts.entries()].sort((a, b) => b[1] - a[1])
  const [domPos, domN] = sorted[0]
  const conf = domN / total
  // 지배 POS ≠ 저장 primary POS + 확신 높음 + V≥6(실 study word) → 후보
  if (domPos !== d.pos && conf >= 0.7 && (d.v_level ?? 0) >= 6) {
    // 지배 POS 가 meanings_ko 인벤토리에 있나 (있으면 sense-선택 문제, 없으면 sense-누락)
    const invPos = new Set((d.meanings_ko ?? []).map((s: any) => s.pos))
    flagged.push({ word, stored: d.pos, corpus: domPos, conf: +conf.toFixed(2), n: total, gloss: d.meaning_ko, missing: !invPos.has(domPos), rank: d.frequency_rank })
  }
}
flagged.sort((a, b) => (a.missing === b.missing ? b.n - a.n : a.missing ? -1 : 1))
console.log(`\nPOS 불일치 후보: ${flagged.length}건 (지배 POS ≠ 저장, 확신≥0.7, 표본≥3)`)
console.log('word'.padEnd(16) + '저장→코퍼스  n  conf  누락?  gloss')
for (const f of flagged.slice(0, 60)) {
  console.log(`${f.word.padEnd(16)}${f.stored}→${f.corpus}`.padEnd(30) + `${String(f.n).padStart(3)}  ${f.conf}  ${f.missing ? '🔴누락' : '🟡선택'}  ${(f.gloss ?? '').slice(0, 22)}`)
}
console.log(`\n🔴 sense-누락(치명): ${flagged.filter(f => f.missing).length} · 🟡 sense-선택가능: ${flagged.filter(f => !f.missing).length}`)
