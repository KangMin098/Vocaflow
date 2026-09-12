// scripts/srs/replay-stability.mts
//
// **망가진 stability 를 실제 복습 이력으로 되살린다.**
//
// ── 왜 필요한가 ───────────────────────────────────────────────────────
// `toFsrsCard` 가 `state` 를 안 넣어 ts-fsrs 가 매번 New 분기를 탔다. 복원한 stability 를
// 버리고 `S = w[rating-1]` 로 초기화하므로, **복습을 아무리 해도 S 가 안 자란다.**
// 실측 2026-09-05: 복습한 234단어의 최대 S 가 8.2956일(FSRS-5 초기값 w[3])이고 S 는 복습
// 횟수와 역상관이었다(29회 복습 → 0.0010일 = 86초). 코드는 고쳤지만 **DB 에 남은 값은
// 그대로 틀려 있다** — 그 값으로 Memory Decay 색과 다음 복습일이 정해진다.
//
// ── 추측하지 않는다 ──────────────────────────────────────────────────
// `learning_records` 가 `rating` 과 `attempted_at` 을 들고 있으므로 **실제 이력을 그대로
// 다시 돌린다.** 규칙으로 지어낸 값을 넣는 것이 아니라, 고친 코드로 같은 복습을 다시 겪게
// 하는 것이다. 실측: 복습한 234단어 = 이력이 있는 234단어(665건) — 빠짐없이 재생된다.
//
// ⚠️ 이력이 없는 단어는 **건드리지 않는다.** `learning_records` 는 `vocabularies` 에
//    ON DELETE CASCADE 로 매달려 있어, 단어를 지우면 그 이력도 사라진다. 지워진 단어의
//    이력으로는 아무것도 되살릴 수 없고, 없는 것을 지어내면 그게 더 나쁘다.
//
// 재실행 안전: 이력에서 다시 계산하므로 몇 번을 돌려도 같은 값이 나온다.
//
// 실행:
//   npx tsx --tsconfig apps/web/tsconfig.json scripts/srs/replay-stability.mts          (미리보기)
//   npx tsx --tsconfig apps/web/tsconfig.json scripts/srs/replay-stability.mts --commit
import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { applyReview, createNewCard } from '../../apps/web/src/lib/srs/fsrs'
import type { SrsCard } from '../../apps/web/src/lib/srs/types'

const COMMIT = process.argv.includes('--commit')

const t = fs.readFileSync('apps/web/.env.local', 'utf8')
const g = (k: string) => (t.match(new RegExp(`^${k}\\s*=\\s*(.+)$`, 'm')) ?? [])[1]?.trim().replace(/^["']|["']$/g, '')
const db = createClient(g('NEXT_PUBLIC_SUPABASE_URL')!, g('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })

async function retry<T extends { error: unknown }>(fn: () => PromiseLike<T>, tries = 8): Promise<T> {
  let last: T | undefined
  for (let i = 0; i < tries; i += 1) {
    try { const r = await fn(); if (!r.error) return r; last = r } catch (e) { last = { error: e } as T }
    await new Promise((r) => setTimeout(r, Math.min(20_000, 800 * 2 ** i)))
  }
  return last as T
}

type Rec = { vocabulary_id: string; rating: number | null; module: string; attempted_at: string }
type Vocab = { id: string; stability: number; difficulty: number; review_count: number; last_review_at: string | null; next_review_at: string | null }

async function page<T>(table: string, select: string, order: string): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await retry(() => db.from(table).select(select).order(order).range(from, from + 999))
    if (error) throw new Error(String((error as { message?: string }).message))
    out.push(...((data ?? []) as T[]))
    if ((data ?? []).length < 1000) break
  }
  return out
}

async function main() {
  const recs = await page<Rec>('learning_records', 'vocabulary_id, rating, module, attempted_at', 'attempted_at')
  const vocabs = await page<Vocab>('vocabularies', 'id, stability, difficulty, review_count, last_review_at, next_review_at', 'id')
  const byVocab = new Map<string, Rec[]>()
  for (const r of recs) {
    if (r.rating == null || !r.vocabulary_id) continue
    const l = byVocab.get(r.vocabulary_id) ?? []
    l.push(r)
    byVocab.set(r.vocabulary_id, l)
  }
  console.log(`  단어 ${vocabs.length} · 이력 있는 단어 ${byVocab.size} · 기록 ${recs.length}`)

  const updates: Array<{ id: string; stability: number; difficulty: number; next: Date | null; last: Date | null; reps: number }> = []
  let skippedNoHistory = 0
  const rows: string[] = []
  for (const v of vocabs) {
    const hist = byVocab.get(v.id)
    if (!hist?.length) { skippedNoHistory += 1; continue }
    hist.sort((a, b) => a.attempted_at.localeCompare(b.attempted_at))
    let card: SrsCard = createNewCard(v.id, new Date(hist[0]!.attempted_at))
    for (const h of hist) {
      card = applyReview({
        card,
        rating: h.rating as 1 | 2 | 3 | 4,
        module: h.module as SrsCard['moduleHistory'][number],
        reviewedAt: new Date(h.attempted_at),
      }).card
    }
    updates.push({
      id: v.id, stability: card.stability, difficulty: card.difficulty,
      next: card.nextReviewAt, last: card.lastReviewAt, reps: hist.length,
    })
    if (rows.length < 12) {
      rows.push(`  ${v.id.slice(0, 8)}  복습 ${String(hist.length).padStart(2)}회   S ${v.stability.toFixed(4).padStart(9)} → ${card.stability.toFixed(2).padStart(8)}일`)
    }
  }

  const before = updates.map((u) => vocabs.find((v) => v.id === u.id)!.stability)
  const after = updates.map((u) => u.stability)
  const med = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] ?? 0
  console.log(`\n  재생 대상 ${updates.length} · 이력 없어 건너뜀 ${skippedNoHistory}`)
  console.log(`  stability 중앙값  ${med(before).toFixed(4)}일 → ${med(after).toFixed(2)}일`)
  console.log(`  stability 최대    ${Math.max(...before).toFixed(4)}일 → ${Math.max(...after).toFixed(2)}일`)
  console.log(`  21일(known 임계) 돌파  ${before.filter((x) => x >= 21).length} → ${after.filter((x) => x >= 21).length}`)
  console.log('\n  ── 표본 ──')
  for (const r of rows) console.log(r)

  if (!COMMIT) { console.log('\n  미리보기다 — 아무것도 쓰지 않았다. 반영하려면 --commit'); return }
  let done = 0
  for (let i = 0; i < updates.length; i += 4) {
    await Promise.all(updates.slice(i, i + 4).map(async (u) => {
      const { error } = await retry(() => db.from('vocabularies').update({
        stability: u.stability,
        difficulty: u.difficulty,
        last_review_at: u.last?.toISOString() ?? null,
        next_review_at: u.next?.toISOString() ?? null,
      }).eq('id', u.id))
      if (error) throw new Error(String((error as { message?: string }).message))
      done += 1
    }))
    process.stdout.write(`\r  반영 ${done}/${updates.length}`)
  }
  console.log('\n→ 반영 완료')
}
main()
