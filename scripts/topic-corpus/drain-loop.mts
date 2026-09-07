// scripts/topic-corpus/drain-loop.mts
//
// **주제 코퍼스 큐를 무인으로 비운다.**
//
//   pnpm tcp:drain                    # 큐가 마를 때까지
//   pnpm tcp:drain -- --batches 50    # 50배치만 (맛보기)
//   pnpm tcp:drain -- --source ted:ai # 그 주제만
//   pnpm tcp:drain -- --max 10        # 배치당 편수 (1..10)
//
// ── 왜 이 스크립트가 필요한가 (실측 2026-08-26) ──────────────────────
// 큐에 **85,179건**이 대기 중인데, 이걸 도는 유일한 방법이 Admin 화면이 반복 호출하는
// 것이었다. 한 호출 상한 10편 · 편당 1.2초 예의 지연이라 **사람이 지키고 앉아 있을
// 분량이 아니다**(대략 40시간대).
//
// ⚠️ 그 40시간의 **88.6% 는 버려진다** — 수확률이 11.4% 다(done 1,377 / skipped 10,653).
//    실패 사유는 전부 "자막 없음(번역만 있거나 비공개)". 적재 시점에 걸러 두면 좋았겠지만
//    **자막 유무는 `/transcript` 를 받아 봐야 안다**(발견 API 도 그 힌트를 주지 않는다).
//    즉 이 낭비는 피할 수 없고, 대신 **한 번만** 치른다 — skipped 는 다시 claim 되지 않는다.
//    그러니 사람이 지켜보는 40시간이 아니라 **무인 40시간**으로 바꾸는 것이 이 스크립트다.
//
// ── 안전 ──
// 본체는 `apps/web/src/lib/topic-corpus/drain.ts` 로, Admin 라우트와 **같은 함수**다.
// claim 이 `FOR UPDATE SKIP LOCKED` 라 화면과 동시에 돌려도 같은 문서를 두 번 잡지 않는다.
// Ctrl+C 로 언제든 끊어도 되고, 다시 켜면 이어서 마른다.

import { parseArgs } from 'node:util'

import { createClient } from '@supabase/supabase-js'

import { drainTopicCorpusBatch, MAX_PER_CALL } from '../../apps/web/src/lib/topic-corpus/drain'
import { loadSupabaseEnv } from '../lib/supabase-env.mts'


// ⚠️ `pnpm tcp:drain -- --batches 3` 로 부르면 argv 에 `--` 가 그대로 들어오고,
//    Node parseArgs 는 그것을 **옵션 끝** 으로 읽어 뒤 인자를 전부 무시한다
//    (실측 2026-08-26: --max 5 를 줬는데 기본값 10 으로 돌았다). 앞의 `--` 만 걷어낸다.
const argv = process.argv.slice(2).filter((a, i, all) => !(a === '--' && all.slice(0, i).every((x) => x === '--')))

const { values } = parseArgs({
  args: argv,
  options: {
    source: { type: 'string' },
    max: { type: 'string', default: '10' },
    batches: { type: 'string' },
    quiet: { type: 'boolean', default: false },
  },
  allowPositionals: true,
})

// 환경변수 우선 — 그래야 CI·스케줄러에서도 돈다(로컬은 .env.local 로 떨어진다).
const { url, serviceRoleKey: key, source: credSource } = loadSupabaseEnv()

const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
const sourceId = values.source ?? null
const max = Math.min(Math.max(Number(values.max) || 10, 1), MAX_PER_CALL)
const maxBatches = values.batches ? Number(values.batches) : Infinity

// Ctrl+C 는 **지금 배치를 끝내고** 멈춘다 — 배치 중간에 죽으면 claim 된 행이
// `claimed` 상태로 남아 회수를 기다려야 한다.
let stopping = false
process.on('SIGINT', () => {
  if (stopping) process.exit(130)
  stopping = true
  console.log('\n[tcp] 중단 요청 — 이번 배치를 끝내고 멈춘다 (한 번 더 누르면 즉시 종료)')
})

async function pendingCount(): Promise<number | null> {
  const { count, error } = await db
    .from('topic_corpus_queue')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')
  return error ? null : (count ?? null)
}

const started = Date.now()
const before = await pendingCount()
console.log(
  `[tcp] 시작 — 대기 ${before ?? '?'}건 · 배치당 ${max}편 · 자격 ${credSource}` +
    (sourceId ? ` · 주제 ${sourceId}` : '') +
    (Number.isFinite(maxBatches) ? ` · 최대 ${maxBatches}배치` : ''),
)

let batches = 0
let harvested = 0
let skipped = 0
let failed = 0
let consecutiveErrors = 0

while (!stopping && batches < maxBatches) {
  const out = await drainTopicCorpusBatch(db, { sourceId, max })
  batches += 1

  if (out.error) {
    consecutiveErrors += 1
    console.error(`[tcp] claim 실패(${consecutiveErrors}회): ${out.error}`)
    // 세 번 연속 실패하면 멈춘다 — 같은 벽에 계속 부딪히며 로그만 늘리지 않는다.
    if (consecutiveErrors >= 3) {
      console.error('[tcp] 연속 3회 실패 — 중단한다. 원인을 보고 다시 켤 것.')
      break
    }
    await new Promise((r) => setTimeout(r, 5_000))
    continue
  }
  consecutiveErrors = 0

  harvested += out.harvested
  skipped += out.skipped
  failed += out.failed

  if (out.drained) {
    console.log('[tcp] 큐가 말랐다.')
    break
  }

  if (!values.quiet && batches % 10 === 0) {
    const mins = (Date.now() - started) / 60_000
    const done = harvested + skipped + failed
    const rate = done / Math.max(mins, 0.01)
    const left = before != null ? Math.max(0, before - done) : null
    console.log(
      `[tcp] ${batches}배치 · 수확 ${harvested} · 건너뜀 ${skipped} · 실패 ${failed}` +
        ` · ${rate.toFixed(1)}편/분` +
        (left != null ? ` · 남은 ${left}건 ≈ ${(left / Math.max(rate, 0.01) / 60).toFixed(1)}시간` : ''),
    )
  }
}

const after = await pendingCount()
const mins = (Date.now() - started) / 60_000
console.log(
  `\n[tcp] 종료 — ${batches}배치 · ${mins.toFixed(1)}분` +
    `\n      수확 ${harvested} · 건너뜀 ${skipped} · 실패 ${failed}` +
    `\n      대기 ${before ?? '?'} → ${after ?? '?'}`,
)
// 실패가 남았으면 0 이 아닌 코드로 — 스케줄러가 조용한 실패를 성공으로 세지 않게.
process.exit(failed > 0 && harvested === 0 ? 1 : 0)
