// scripts/audit/progress-surface.mts
//
// 학습 기록·진도 표면 감사 — READ ONLY.
// 배포된 순수 로직(computeStreak · getMemoryState · blockProgress)을 실제 행에 그대로 먹여
// "화면이 뭐라고 말하는가" 와 "실제로 무슨 일이 있었나" 를 나란히 낸다.
//
// 실행: npx tsx --tsconfig apps/web/tsconfig.json scripts/audit/progress-surface.mts

import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

import { computeStreak, type ActivityDayDto } from '../../apps/web/src/lib/learner/growth-math'
import { getMemoryState } from '../../apps/web/src/lib/srs/state'
import { applyReview } from '../../apps/web/src/lib/srs/fsrs'
import { Rating, type SrsCard } from '../../apps/web/src/lib/srs/types'
import { BLOCK_MODULES, type TodayBlockKey } from '../../apps/web/src/lib/learner/today-blocks'

const ENV = 'apps/web/.env.local'

function env(key: string): string {
  const raw = readFileSync(ENV, 'utf8')
  const m = raw.match(new RegExp('^' + key + '\\s*=\\s*(.+)$', 'm'))
  if (!m) throw new Error(key + ' not found in ' + ENV)
  return m[1].trim().replace(/^["']|["']$/g, '')
}

function kstDateIso(offsetDays = 0): string {
  return new Date(Date.now() + 9 * 3_600_000 + offsetDays * 86_400_000).toISOString().slice(0, 10)
}

function toKstDate(iso: string): string {
  return new Date(new Date(iso).getTime() + 9 * 3_600_000).toISOString().slice(0, 10)
}

function anon(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return 'u' + h.toString(16).slice(0, 6)
}

async function main(): Promise<void> {
  const db = createClient(env('NEXT_PUBLIC_SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false },
  })

  // 이 스크립트도 처음엔 1,000행에서 잘렸다 — 감사 대상과 같은 함정이라 그대로 적어 둔다.
  async function all<T>(table: string, cols: string): Promise<T[]> {
    const out: T[] = []
    for (let from = 0; ; from += 1000) {
      let data: unknown = null
      let last = ''
      for (let attempt = 0; attempt < 5; attempt++) {
        const res = await db.from(table).select(cols).range(from, from + 999)
        if (!res.error) {
          data = res.data
          last = ''
          break
        }
        last = res.error.message
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)))
      }
      if (last) throw new Error(`${table}: ${last}`)
      const rows = (data ?? []) as unknown as T[]
      out.push(...rows)
      if (rows.length < 1000) break
    }
    return out
  }

  const da = await all<Record<string, never>>(
    'daily_activity',
    'user_id, date, total_minutes, total_words, total_reviews, by_module',
  )
  const lr = await all<Record<string, never>>('learning_records', 'user_id, module, attempted_at')
  const vo = await all<Record<string, never>>(
    'vocabularies',
    'user_id, stability, last_review_at, next_review_at',
  )

  const activity = (da ?? []) as Array<{
    user_id: string
    date: string
    total_minutes: number | null
    total_words: number | null
    total_reviews: number | null
    by_module: Record<string, number> | null
  }>
  const records = (lr ?? []) as Array<{ user_id: string; module: string; attempted_at: string }>
  const vocab = (vo ?? []) as Array<{
    user_id: string
    stability: number | null
    last_review_at: string | null
    next_review_at: string | null
  }>

  const users = [...new Set(activity.map((a) => a.user_id))]
  const now = new Date()

  console.log('\n=== ① 연속일 / 이번 주 학습일 — 셸 띠 + /dashboard ActivityTrace ===')
  console.log('shipped  : computeStreak(daily_activity.total_minutes|total_words)')
  console.log('truth    : learning_records 가 있는 KST 날짜\n')

  for (const uid of users) {
    const mine = activity.filter((a) => a.user_id === uid)
    const byDate = new Map(mine.map((a) => [a.date, a]))

    const days28: ActivityDayDto[] = []
    const truthDays: boolean[] = []
    const reviewDays: ActivityDayDto[] = []
    for (let i = 27; i >= 0; i--) {
      const d = kstDateIso(-i)
      const row = byDate.get(d)
      days28.push({ date: d, minutes: row?.total_minutes ?? 0, words: row?.total_words ?? 0 })
      // 정본: 실제 리뷰가 있었는가 (daily_activity.total_reviews 는 lr 트리거가 채운다)
      const reviewed = (row?.total_reviews ?? 0) > 0
      truthDays.push(reviewed)
      reviewDays.push({ date: d, minutes: reviewed ? 1 : 0, words: 0 })
    }

    const shippedStreak = computeStreak(days28)
    const truthStreak = computeStreak(reviewDays)
    const shippedWeek = days28.slice(-7).filter((d) => d.minutes > 0 || d.words > 0).length
    const truthWeek = truthDays.slice(-7).filter(Boolean).length
    const shipped28 = days28.filter((d) => d.minutes > 0 || d.words > 0).length
    const truth28 = truthDays.filter(Boolean).length

    const pattern = days28
      .map((d, i) => (d.minutes > 0 || d.words > 0 ? 'S' : truthDays[i] ? 'r' : '.'))
      .join('')

    console.log(
      `${anon(uid)}  streak ${shippedStreak} (실제 ${truthStreak})  ·  이번주 ${shippedWeek}일 (실제 ${truthWeek}일)  ·  28일 ${shipped28}일 (실제 ${truth28}일)`,
    )
    console.log(`         ${pattern}   S=띠가 셈 r=학습했으나 안 셈 .=없음`)
  }

  console.log('\n=== ② 오늘의 흐름 5블록 — 완료 신호가 존재하는가 ===')
  console.log('done 판정은 daily_activity.by_module (= learning_records 트리거) 를 본다.')
  const seenModules = new Set<string>()
  for (const a of activity) for (const k of Object.keys(a.by_module ?? {})) seenModules.add(k)
  const seenInRecords = new Set(records.map((r) => r.module))
  for (const key of Object.keys(BLOCK_MODULES) as TodayBlockKey[]) {
    const want = BLOCK_MODULES[key]
    if (want.length === 0) {
      console.log(`  ${key.padEnd(7)} : (별도 인자 dcpDoneToday)`)
      continue
    }
    const hit = want.filter((m) => seenModules.has(m))
    const hitLr = want.filter((m) => seenInRecords.has(m))
    console.log(
      `  ${key.padEnd(7)} : 기대 [${want.join(', ')}] → by_module 실측 [${hit.join(', ') || '없음'}] · learning_records 실측 [${hitLr.join(', ') || '없음'}]${hit.length === 0 ? '   ⛔ 영원히 미완료' : ''}`,
    )
  }
  console.log(`  (관측된 by_module 키 ${seenModules.size}종: ${[...seenModules].sort().join(', ')})`)

  console.log('\n=== ③ "다시 볼" 두 정의 — 처방 dueCount vs 띠 attention/fresh ===')
  for (const uid of [...new Set(vocab.map((v) => v.user_id))]) {
    const mine = vocab.filter((v) => v.user_id === uid)
    const due = mine.filter((v) => v.next_review_at && new Date(v.next_review_at) <= now).length
    let risk = 0
    let shaky = 0
    let stable = 0
    let fresh = 0
    for (const v of mine) {
      const s = getMemoryState(
        {
          difficulty: 0,
          stability: v.stability ?? 0,
          lastReviewAt: v.last_review_at ? new Date(v.last_review_at) : null,
        } as Parameters<typeof getMemoryState>[0],
        now,
      )
      if (s === 'new') fresh++
      else if (s === 'risk') risk++
      else if (s === 'shaky') shaky++
      else stable++
    }
    console.log(
      `  ${anon(uid)}  vocab ${mine.length}  ·  /hub 복습 헤드라인 dueCount=${due}  ·  띠 다시볼=${risk + shaky} (risk ${risk} / shaky ${shaky})  ·  새단어=${fresh}  ·  stable=${stable}`,
    )
  }

  console.log('\n=== ④ 28일 막대(learning_records) vs 집계(daily_activity.total_reviews) ===')
  for (const uid of users) {
    const mine = activity.filter((a) => a.user_id === uid)
    const aggr = mine.reduce((s, a) => s + (a.total_reviews ?? 0), 0)
    const kept = records.filter((r) => r.user_id === uid).length
    console.log(
      `  ${anon(uid)}  daily_activity 누적 리뷰 ${aggr}  ·  살아있는 learning_records ${kept}  ·  소실 ${aggr - kept}`,
    )
  }

  const perModule = new Map<string, { agg: number; lr: number }>()
  for (const a of activity)
    for (const [k, v] of Object.entries(a.by_module ?? {})) {
      const cur = perModule.get(k) ?? { agg: 0, lr: 0 }
      cur.agg += Number(v) || 0
      perModule.set(k, cur)
    }
  for (const r of records) {
    const cur = perModule.get(r.module) ?? { agg: 0, lr: 0 }
    cur.lr += 1
    perModule.set(r.module, cur)
  }
  const lost = [...perModule.entries()]
    .filter(([, v]) => v.agg - v.lr > 0)
    .sort((a, b) => b[1].agg - b[1].lr - (a[1].agg - a[1].lr))
  console.log('  모듈별 소실:', lost.map(([k, v]) => `${k} ${v.agg}→${v.lr}`).join(' · '))

  console.log('\n=== ⑤ next_review_at 있으나 last_review_at 없는 단어 (due 인데 상태는 new) ===')
  const ghost = vocab.filter((v) => v.next_review_at && !v.last_review_at)
  console.log(`  전체 ${vocab.length} 중 ${ghost.length}건`)

  const us = await all<{ user_id: string; known_word_count: number | null; current_streak: number | null }>(
    'user_stats',
    'user_id, known_word_count, current_streak',
  )
  console.log('\n=== ⑤-b user_stats (stability>=21 캐시) ===')
  for (const r of us)
    console.log(
      `  ${anon(r.user_id)}  known_word_count=${r.known_word_count ?? 0}  current_streak=${r.current_streak ?? 0}`,
    )
  const maxS = Math.max(...vocab.map((v) => v.stability ?? 0))
  console.log(`  실측 최대 stability = ${maxS} 일 (임계 21일)`)

  console.log('\n=== ⑥ FSRS — 배포된 applyReview 를 이상적 학습자에게 반복 적용 ===')
  console.log('   (매번 예정일에 정확히 복습 · 항상 Good/Easy — S 는 자라야 한다)')
  for (const [label, rating] of [
    ['Good', Rating.Good],
    ['Easy', Rating.Easy],
  ] as const) {
    let card: SrsCard = {
      id: 'probe',
      difficulty: 6.0,
      stability: 0,
      lastReviewAt: null,
      nextReviewAt: null,
      moduleHistory: [],
      reviewCount: 0,
    }
    let t = new Date('2026-01-01T00:00:00Z')
    const trace: string[] = []
    for (let n = 1; n <= 8; n++) {
      const r = applyReview({ card, rating, module: 'flashcard', reviewedAt: t })
      card = r.card
      trace.push(card.stability.toFixed(4))
      t = card.nextReviewAt ?? new Date(t.getTime() + 86_400_000)
    }
    console.log(`  항상 ${label}: S = ${trace.join(' → ')}`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
