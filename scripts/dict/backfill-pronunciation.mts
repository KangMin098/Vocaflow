// scripts/dict/backfill-pronunciation.mts
//
// **발음을 옆 칸에서 옮겨 적는다** — `shared_words.pronunciation ← ipa`.
//
// 발음을 담는 칸이 둘인데 쓰는 쪽과 읽는 쪽이 서로 다른 칸을 쓴다. 학습자 코드가
// `shared_words.ipa` 를 읽는 곳은 **0곳**이고 전부 `pronunciation` 만 select 한다
// (`workspace/scoped-words.ts` · `game/record-result.ts` · `deliver_chapter_vocab`).
//
// 실측 2026-09-05 (681,021행): `ipa` 645,300 (94.8%) · `pronunciation` 44,897 (6.6%)
//   → **603,311행이 베끼기만 하면 채워진다.** 카드의 발음 줄이 비어 있던 이유는
//     데이터가 없어서가 아니라 같은 행 옆 칸에 있어서였다.
//
// ⚠️ **값을 만들어 내지 않는다.** 없는 발음을 지어내는 것이 아니라 같은 행의 같은 값을
//    옮겨 적을 뿐이다. `pronunciation` 이 이미 있는 행은 건드리지 않는다.
//
// 마이그레이션 `20260905160000_shared_words_pronunciation_sync` 가 앞으로 들어올 행을
// 맡고, 이 스크립트가 이미 있는 행을 맡는다. 멱등 — 두 번째 실행은 대상이 0이다.
//
// 실행:
//   npx tsx --tsconfig apps/web/tsconfig.json scripts/dict/backfill-pronunciation.mts
//   npx tsx --tsconfig apps/web/tsconfig.json scripts/dict/backfill-pronunciation.mts --commit
import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const COMMIT = process.argv.includes('--commit')
const t = fs.readFileSync('apps/web/.env.local', 'utf8')
const g = (k: string) => (t.match(new RegExp(`^${k}\\s*=\\s*(.+)$`, 'm')) ?? [])[1]?.trim().replace(/^["']|["']$/g, '')
const db = createClient(g('NEXT_PUBLIC_SUPABASE_URL')!, g('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })

/**
 * 물러섰다 다시. 이 저장소에서 데인 자리 둘을 함께 막는다 —
 *   ① supabase-js 는 fetch 실패를 던지지 않고 `{ error }` 로 돌려준다
 *   ② 여러 세션·에이전트가 같은 DB 를 두드리면 REST 가 몇 분씩 막힌다(522). 길게 기다린다.
 */
async function retry<T extends { error: unknown }>(fn: () => PromiseLike<T>, tries = 10): Promise<T> {
  let last: T | undefined
  for (let i = 0; i < tries; i += 1) {
    try { const r = await fn(); if (!r.error) return r; last = r } catch (e) { last = { error: e } as T }
    await new Promise((r) => setTimeout(r, Math.min(30_000, 1_000 * 2 ** i)))
  }
  return last as T
}

async function main() {
  let cursor = '00000000-0000-0000-0000-000000000000'
  let seen = 0, target = 0, done = 0
  for (;;) {
    const { data, error } = await retry(() => db
      .from('shared_words')
      .select('id, ipa, pronunciation')
      .gt('id', cursor).order('id').limit(1000))
    if (error) throw new Error(String((error as { message?: string }).message ?? error))
    const rows = (data ?? []) as Array<{ id: string; ipa: string | null; pronunciation: string | null }>
    if (!rows.length) break
    seen += rows.length
    cursor = rows[rows.length - 1]!.id
    const todo = rows.filter((r) => (r.ipa ?? '').trim() && !(r.pronunciation ?? '').trim())
    target += todo.length
    if (COMMIT) {
      // **동시성을 낮게 둔다.** 앞서 이 DB 를 동시성 4 + 에이전트 5로 두드리다 522 를 냈다.
      for (let i = 0; i < todo.length; i += 3) {
        await Promise.all(todo.slice(i, i + 3).map(async (r) => {
          const { error: e } = await retry(() => db.from('shared_words').update({ pronunciation: r.ipa }).eq('id', r.id))
          if (e) throw new Error(String((e as { message?: string }).message ?? e))
          done += 1
        }))
      }
    }
    process.stdout.write(`\r  훑음 ${seen} · 대상 ${target}${COMMIT ? ` · 반영 ${done}` : ''}   `)
  }
  console.log(`\n\n  전체 ${seen} · 옆 칸에서 채울 수 있는 행 ${target}`)
  console.log(COMMIT ? `→ ${done}행 반영` : '\n  미리보기다 — 아무것도 쓰지 않았다. 반영하려면 --commit')
}
main()
