// scripts/dict/backfill-lemma-frequent.mts
//
// **`shining` 카드가 「정강이」를 가르치던 것을 되돌린다.**
//
// `en_inflection_bases('shining')` 은 `{shin, shine}` 을 둘 다 돌려주는데 선택이
// `ORDER BY word LIMIT 1` 이라, 짧은 어간이 긴 표제어의 **접두사**여서 알파벳순에서
// 항상 이겼다. 실측 2026-09-05 (발행 `shared_words`):
//
//   shining→shin 「정강이」 190행 · spared→spar 「스파링」 126 · faded→fad 「일시적 유행」 105
//   raging→rag 「걸레」 96 · guided→guid 「GUID」 80 · firing→fir 「전나무」 74
//   dined→din 「소음」 73 · cured→cur 「똥개」 73 · paler→pal 「친구」 72
//   stated→stat 「statistic 줄임말」 67 · latest→lat 「광배근(속어)」 65
//   pacing→pac 「PAC(정치활동위원회)」 62 · piping→pip 「과일씨」 55
//
// 뜻만이 아니다 — `flashcard/scoped-words.ts` 의 `fetchDictExtras` 가 lemma 로 조회하므로
// 연어·유의어·니모닉까지 전부 엉뚱한 낱말 것이 딸려 온다.
//
// 마이그레이션 `20260905161000_lbv_lemma_prefer_frequent` 가 앞으로 들어올 행을 맡고,
// 이 스크립트가 이미 박힌 것을 맡는다. **두 곳을 고쳐야 한다**:
//   ① `shared_words.lemma` · `meaning_ko` — 발행 시 복사돼 **학습자가 실제로 보는 값**
//   ② `library_book_vocabularies.lemma` — 원장 (다음 발행이 다시 틀리지 않게)
// ①만 고치면 원장이 계속 틀리고, ②만 고치면 카드는 계속 「정강이」라고 말한다.
//
// ── 어떻게 찾나 ──────────────────────────────────────────────────────
// SQL 로 한 문장에 하면 1.68M/681k 행을 훑다 **statement timeout** 이 난다(실측).
// 행을 전수로 훑는 대신 **사전에서 후보쌍을 먼저 만든다** — `X` 와 `Xe` 가 둘 다 표제어이고
// `Xe` 가 더 흔한 쌍은 49,244행 안에서 찾으면 되고, 그런 쌍은 수백 개뿐이다.
// 그다음 `.eq('lemma', X)` 로 해당 행만 집어 온다. 훑는 양이 세 자릿수 배 줄어든다.
//
// 멱등 — 두 번째 실행은 바꿀 것이 0이다.
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

type Dict = { word: string; frequency_rank: number | null; meaning_ko: string | null; v_level: number | null; classified_by: string | null; word_register: string | null }

async function main() {
  // ── ① 사전에서 후보쌍을 만든다 (X · Xe 가 둘 다 표제어이고 Xe 가 더 흔한 것) ──
  const dict = new Map<string, Dict>()
  let cursor = ''
  for (;;) {
    const { data, error } = await retry(() => db.from('shared_dictionary')
      .select('word, frequency_rank, meaning_ko, v_level, classified_by, word_register')
      .gt('word', cursor).order('word').limit(1000))
    if (error) throw new Error(String((error as { message?: string }).message))
    const rows = (data ?? []) as Dict[]
    if (!rows.length) break
    for (const r of rows) dict.set(r.word, r)
    cursor = rows[rows.length - 1]!.word
    process.stdout.write(`\r  사전 ${dict.size}`)
  }
  // 트리거와 같은 자격 조건 — 안 맞추면 트리거가 안 고를 표제어로 갈아타게 된다
  const eligible = (d: Dict | undefined) =>
    !!d && d.v_level != null && !!d.classified_by && !!d.meaning_ko && d.meaning_ko.length > 0 &&
    (d.word_register ?? 'standard') !== 'abbreviation'

  const pairs: Array<{ old: string; next: string; meaning: string }> = []
  for (const [w, d] of dict) {
    if (w.length < 2 || w.length > 6) continue
    const e = dict.get(`${w}e`)
    if (!eligible(e)) continue
    if ((e!.frequency_rank ?? 999999) >= (d.frequency_rank ?? 999999)) continue
    pairs.push({ old: w, next: `${w}e`, meaning: e!.meaning_ko! })
  }
  console.log(`\n  후보쌍 ${pairs.length}종 (X 와 Xe 가 둘 다 표제어이고 Xe 가 더 흔한 것)`)

  // ── ② 그 lemma 를 가진 행만 집어 온다 ────────────────────────────────
  // 표면형이 그 어간으로 시작해야 한다 — `shining` 은 `shin` 으로 시작하지만
  // 무관한 낱말이 우연히 같은 lemma 를 갖는 경우를 배제한다.
  let swFixed = 0, lbvFixed = 0, checked = 0
  const samples: string[] = []
  for (const p of pairs) {
    for (const table of ['shared_words', 'library_book_vocabularies'] as const) {
      const rows: Array<{ id: string; word: string }> = []
      for (let from = 0; ; from += 1000) {
        const { data, error } = await retry(() => db.from(table)
          .select('id, word').eq('lemma', p.old).order('id').range(from, from + 999))
        if (error) throw new Error(String((error as { message?: string }).message))
        const r = (data ?? []) as Array<{ id: string; word: string }>
        rows.push(...r)
        if (r.length < 1000) break
      }
      // ⚠️ **`-s`/`-es` 만 붙은 표면형은 짧은 쪽의 정당한 굴절이다** — 건드리면 안 된다.
      //    실측 오탐: `cods` 는 `cod`(대구)의 복수인데 `code`(암호)로 바꾸려 했다.
      //    `bals`(bal 의 복수) · `cliches`(clich+es) 도 같은 갈래다.
      //
      //    반면 `-ing`/`-ed`/`-er`/`-est` 는 다르다 — 짧은 쪽에서 만들려면 **자음을 겹쳐야**
      //    하므로(`cop`→`copping`) 겹치지 않은 `coping` 은 `cope` 에서 온 것이 맞다.
      //    `blaming`(blam→blamming) · `boned`(bon→bonned) 도 같은 논리로 안전하다.
      const hit = rows.filter((r) => {
        const w = String(r.word).toLowerCase()
        if (!w.startsWith(p.old) || w === p.old) return false
        const tail = w.slice(p.old.length)
        if (tail === 's' || tail === 'es' || tail === "'s") return false
        return true
      })
      checked += rows.length
      if (!hit.length) continue
      if (samples.length < 14 && table === 'shared_words') {
        samples.push(`    ${hit[0]!.word.padEnd(14)} ${p.old} → ${p.next}  (${dict.get(p.old)!.meaning_ko?.slice(0, 12)} → ${p.meaning.slice(0, 12)})  ${hit.length}행`)
      }
      if (!COMMIT) { if (table === 'shared_words') swFixed += hit.length; else lbvFixed += hit.length; continue }
      const patch = table === 'shared_words' ? { lemma: p.next, meaning_ko: p.meaning } : { lemma: p.next }
      for (let i = 0; i < hit.length; i += 3) {
        await Promise.all(hit.slice(i, i + 3).map(async (r) => {
          const { error } = await retry(() => db.from(table).update(patch).eq('id', r.id))
          if (error) throw new Error(String((error as { message?: string }).message))
        }))
      }
      if (table === 'shared_words') swFixed += hit.length; else lbvFixed += hit.length
    }
    process.stdout.write(`\r  훑음 ${checked}행 · 발행본 ${swFixed} · 원장 ${lbvFixed}   `)
  }
  console.log('\n\n  ── 표본 ──')
  for (const s of samples) console.log(s)
  console.log(`\n  발행본(shared_words) ${swFixed}행 · 원장(library_book_vocabularies) ${lbvFixed}행`)
  console.log(COMMIT ? '→ 반영 완료' : '\n  미리보기다 — 아무것도 쓰지 않았다. 반영하려면 --commit')
}
main()
