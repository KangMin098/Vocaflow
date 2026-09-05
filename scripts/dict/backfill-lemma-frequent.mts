// scripts/dict/backfill-lemma-frequent.mts
//
// **`shining` 카드가 「정강이」를 가르치던 것을 되돌린다.**
//
// `en_inflection_bases('shining')` 은 `{shin, shine}` 을 둘 다 돌려주는데 선택이
// `ORDER BY word LIMIT 1` 이라, 짧은 어간이 긴 표제어의 **접두사**여서 알파벳순에서
// 항상 이겼다. 실측 2026-09-05 (발행 `shared_words`):
//
//   shining→shin 「정강이」 190행 · spared→spar 「스파링」 126 · faded→fad 「일시적 유행」 105
//   raging→rag 「걸레」 96 · firing→fir 「전나무」 74 · dined→din 「소음」 73
//   cured→cur 「똥개」 73 · paler→pal 「친구」 72
//
// 뜻만이 아니다 — `flashcard/scoped-words.ts` 의 `fetchDictExtras` 가 lemma 로 조회하므로
// 연어·유의어·니모닉까지 전부 엉뚱한 낱말 것이 딸려 온다.
//
// 마이그레이션 `20260905161000_lbv_lemma_prefer_frequent` 가 앞으로 들어올 행을 맡고,
// 이 스크립트가 이미 박힌 것을 맡는다. 두 곳을 고쳐야 한다:
//   ① `library_book_vocabularies.lemma` — 원장
//   ② `shared_words.lemma` · `meaning_ko` — 발행 시 복사돼 **학습자가 실제로 보는 값**
//      (①만 고치면 카드는 계속 「정강이」라고 말한다)
//
// ⚠️ `en_inflection_bases` 를 456,944행에 한 문장으로 돌리면 statement timeout 이 난다(실측).
//    그래서 **표면형 단위**로 좁혀 배치로 묻는다 — 굴절쌍은 27,096종뿐이다.
//
// 멱등 — 두 번째 실행은 바뀌는 쌍이 0이다.
//
// 실행:
//   npx tsx --tsconfig apps/web/tsconfig.json scripts/dict/backfill-lemma-frequent.mts
//   npx tsx --tsconfig apps/web/tsconfig.json scripts/dict/backfill-lemma-frequent.mts --commit
import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const COMMIT = process.argv.includes('--commit')
const t = fs.readFileSync('apps/web/.env.local', 'utf8')
const g = (k: string) => (t.match(new RegExp(`^${k}\\s*=\\s*(.+)$`, 'm')) ?? [])[1]?.trim().replace(/^["']|["']$/g, '')
const db = createClient(g('NEXT_PUBLIC_SUPABASE_URL')!, g('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })

async function retry<T extends { error: unknown }>(fn: () => PromiseLike<T>, tries = 10): Promise<T> {
  let last: T | undefined
  for (let i = 0; i < tries; i += 1) {
    try { const r = await fn(); if (!r.error) return r; last = r } catch (e) { last = { error: e } as T }
    await new Promise((r) => setTimeout(r, Math.min(30_000, 1_000 * 2 ** i)))
  }
  return last as T
}

type Pair = { w: string; old: string; fixed: string; meaning: string }

async function main() {
  // ── ① 바뀌는 굴절쌍을 찾는다 ───────────────────────────────────────
  // 표면형 단위로 좁힌다. 후보가 여럿인 쌍만 대상이므로 굳이 전 행을 훑지 않는다.
  const seenPairs = new Map<string, string>() // "surface|old" → old
  let cursor = ''
  for (;;) {
    const { data, error } = await retry(() => db
      .from('library_book_vocabularies')
      .select('word, lemma')
      .not('lemma', 'is', null)
      .gt('word', cursor).order('word').limit(1000))
    if (error) throw new Error(String((error as { message?: string }).message ?? error))
    const rows = (data ?? []) as Array<{ word: string; lemma: string }>
    if (!rows.length) break
    for (const r of rows) {
      const w = String(r.word).toLowerCase()
      const l = String(r.lemma).toLowerCase()
      if (w !== l) seenPairs.set(`${w}|${l}`, l)
    }
    cursor = rows[rows.length - 1]!.word
    process.stdout.write(`\r  굴절쌍 수집 ${seenPairs.size}`)
  }
  console.log(`\n  굴절쌍 ${seenPairs.size}종`)

  // ── ② 각 표면형의 「빈도순 우선」 표제어를 사전에 묻는다 ────────────
  // 사전 조회만으로 판정한다 — `en_inflection_bases` 는 DB 함수라 여기서 못 부른다.
  // 이 결함의 서명은 좁다: **짧은 어간 + e 를 붙인 형태가 사전에 있고 더 흔하다.**
  // 그 밖의 후보 다툼은 마이그레이션이 앞으로 막고, 여기서는 실측으로 확인된 갈래만 고친다.
  const cands = new Set<string>()
  for (const key of seenPairs.keys()) {
    const old = key.split('|')[1]!
    cands.add(old)
    cands.add(`${old}e`)
  }
  const dict = new Map<string, { rank: number | null; meaning: string }>()
  const list = [...cands]
  for (let i = 0; i < list.length; i += 200) {
    const { data, error } = await retry(() => db
      .from('shared_dictionary')
      .select('word, frequency_rank, meaning_ko, v_level, classified_by, word_register')
      .in('word', list.slice(i, i + 200)))
    if (error) throw new Error(String((error as { message?: string }).message ?? error))
    for (const r of (data ?? []) as Array<Record<string, unknown>>) {
      // 트리거와 같은 자격 조건 — 이걸 안 맞추면 트리거가 안 고를 표제어로 갈아탄다
      if (r.v_level == null || !r.classified_by) continue
      if (!r.meaning_ko || String(r.meaning_ko).length === 0) continue
      if ((r.word_register ?? 'standard') === 'abbreviation') continue
      dict.set(String(r.word), { rank: (r.frequency_rank as number) ?? null, meaning: String(r.meaning_ko) })
    }
    process.stdout.write(`\r  사전 조회 ${Math.min(i + 200, list.length)}/${list.length}`)
  }

  const pairs: Pair[] = []
  for (const key of seenPairs.keys()) {
    const [w, old] = key.split('|') as [string, string]
    const a = dict.get(old)
    const b = dict.get(`${old}e`)
    if (!a || !b) continue
    if ((b.rank ?? 999999) >= (a.rank ?? 999999)) continue
    // e-복원형이 실제로 그 표면형의 어간이어야 한다 (shine→shining ✓ / pal→paler ✓)
    if (!w.startsWith(old)) continue
    pairs.push({ w, old, fixed: `${old}e`, meaning: b.meaning })
  }
  console.log(`\n\n  바꿀 굴절쌍 ${pairs.length}종`)
  for (const p of pairs.slice(0, 14)) {
    console.log(`    ${p.w.padEnd(14)} ${p.old} → ${p.fixed}   (${dict.get(p.old)!.meaning.slice(0, 14)} → ${p.meaning.slice(0, 14)})`)
  }
  if (!pairs.length) return

  if (!COMMIT) {
    console.log('\n  미리보기다 — 아무것도 쓰지 않았다. 반영하려면 --commit')
    return
  }

  // ── ③ 원장과 발행본을 함께 고친다 ──────────────────────────────────
  // `shared_words` 를 빠뜨리면 카드는 계속 「정강이」라고 말한다.
  let lbv = 0, sw = 0
  for (const p of pairs) {
    const a = await retry(() => db.from('library_book_vocabularies')
      .update({ lemma: p.fixed }).eq('lemma', p.old).ilike('word', p.w).select('id'))
    if (a.error) throw new Error(String((a.error as { message?: string }).message))
    lbv += (a.data ?? []).length
    const b = await retry(() => db.from('shared_words')
      .update({ lemma: p.fixed, meaning_ko: p.meaning }).eq('lemma', p.old).ilike('word', p.w).select('id'))
    if (b.error) throw new Error(String((b.error as { message?: string }).message))
    sw += (b.data ?? []).length
    process.stdout.write(`\r  반영 원장 ${lbv} · 발행본 ${sw}   `)
  }
  console.log(`\n→ 원장 ${lbv}행 · 발행본 ${sw}행 반영`)
}
main()
