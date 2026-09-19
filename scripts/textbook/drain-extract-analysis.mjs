// scripts/textbook/drain-extract-analysis.mjs
//
// **발췌 분석 큐를 배치로 나눠 돌린다 — 한 번에 몰아치지 않는다.**
//
// ── 왜 구동기가 따로 있나 ────────────────────────────────────────────
// `scripts/acp/process-queue.mjs` 는 한 번에 `--limit` 만큼만 처리하고 끝난다. 큐가 1만 편이면
// 100번 넘게 불러야 하는데, 그걸 손으로 세는 대신 여기서 돈다.
//
// ⚠️ **쉼이 이 파일의 존재 이유다.** 편당 어휘 100~120개를 쓰므로 1만 편이면 누적 쓰기가
//   100만 행대다. 이 저장소는 2026-09-06 에 쓰기 폭주로 **25분 전면 정지**를 겪었다
//   (사전 드레인이 초당 33건을 한 행씩 PATCH → 229MB 체크포인트 → I/O 포화).
//   그래서 배치 사이에 쉬고, 실패가 이어지면 **스스로 멈춘다.**
//
// 재실행 안전: `process-queue` 가 `queued` 만 집으므로 몇 번을 돌려도 같은 글을 두 번
// 처리하지 않는다. 중간에 끊어도 다음 실행이 남은 것부터 이어 간다.
//
// 실행:
//   node scripts/textbook/drain-extract-analysis.mjs                    # 예행(무엇을 할지만)
//   node scripts/textbook/drain-extract-analysis.mjs --commit
//   node scripts/textbook/drain-extract-analysis.mjs --commit --batch 50 --rest 20 --max 2000
//   node scripts/textbook/drain-extract-analysis.mjs --commit --feed plos-extract

import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

// 회수(`reclaimStuck`)에만 쓴다 — 처리 자체는 자식 프로세스가 한다.
for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL_BASE || !KEY) throw new Error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 없다')
const HEADERS = { apikey: KEY, Authorization: `Bearer ${KEY}` }

const arg = (n, d = null) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : d
}
const COMMIT = process.argv.includes('--commit')
const FEED = arg('feed', 'plos-extract')
/** 한 번에 처리할 편수. 작을수록 쓰기가 고르게 퍼진다. */
const BATCH = Number(arg('batch', 50))
/** 배치 사이 쉼(초). **0 으로 두지 마라** — 그게 쓰기 폭주다. */
const REST = Number(arg('rest', 15))
/** 이번 실행에서 처리할 상한. 없으면 큐가 빌 때까지. */
const MAX = Number(arg('max', 0)) || Infinity
/** 연속 실패 상한 — 넘으면 멈춘다. 죽은 DB 를 계속 두들기지 않는다. */
const MAX_FAILS = 3
/**
 * `i/n` — 큐를 n 조각으로 나눠 그중 i 번째만 맡는다. 여러 구동기를 **겹치지 않게** 동시에
 * 돌리기 위한 것이다. 정본은 `scripts/acp/process-queue.mjs` 의 `--shard` 이고 여기서는
 * 그대로 넘기기만 한다 — 나누는 규칙을 두 벌 두면 언젠가 어긋난다.
 */
const SHARD = arg('shard', null)

const num = (n) => n.toLocaleString()
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * **죽은 프로세스가 남긴 중간 상태를 되돌린다.**
 *
 * ⚠️ 처리기는 글을 집으면 `normalizing` → `analyzing` 으로 바꾸고 끝나면 `ready` 로 올린다.
 *   그 사이에 프로세스가 죽으면 그 행은 **중간 상태에 영영 남는다** — 처리기가 `queued` 만
 *   집기 때문에 아무도 다시 안 줍고, 큐 수치에도 안 잡혀 **줄어든 것처럼 보인다.**
 *   2026-09-07 에 조각 하나가 윈도우 0xC0000409 로 죽었고(구동기가 다음 배치에서 회복했다),
 *   그 직후 중간 상태 3행이 보였다. **다만 그 셋은 잠시 뒤 사라졌다** — 죽어서 남은 것이
 *   아니라 다른 조각이 처리 중이던 행이었다. 즉 이 함수는 **관측된 사고의 수습이 아니라
 *   예방**이다. 프로세스가 죽는 것은 실제로 일어났고, 그때 중간 상태가 남으면 되돌릴 길이
 *   지금 코드에 없다는 것이 근거다.
 *
 * 그래서 배치 앞에서 **오래 멈춰 있는 것만** 되돌린다. `MIN` 분을 두는 이유는 지금 처리 중인
 * 행을 뺏지 않기 위해서다 — 여러 조각이 동시에 돌고 있고, 한 편에 5초쯤 걸린다.
 */
async function reclaimStuck(minutes = 10) {
  const cutoff = new Date(Date.now() - minutes * 60_000).toISOString()
  const qs =
    `feed_id=eq.${FEED}` +
    `&status=in.(normalizing,analyzing)` +
    `&updated_at=lt.${encodeURIComponent(cutoff)}` +
    `&select=id`
  const res = await fetch(`${URL_BASE}/rest/v1/library_articles?${qs}`, {
    method: 'PATCH',
    headers: { ...HEADERS, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({ status: 'queued', status_message: '중간 상태에서 회수(프로세스 중단)' }),
  })
  if (!res.ok) return 0
  const rows = await res.json()
  return Array.isArray(rows) ? rows.length : 0
}

/** 한 배치를 돌리고 「몇 편 처리했는지 · 큐에 몇 편 남았는지」를 돌려준다. */
function runBatch() {
  return new Promise((resolve) => {
    const args = [
      'dlx',
      'tsx',
      'scripts/acp/process-queue.mjs',
      '--feed',
      FEED,
      '--commit',
      '--limit',
      String(BATCH),
      ...(SHARD ? ['--shard', SHARD] : []),
    ]
    const child = spawn('pnpm', args, { shell: true })
    let out = ''
    child.stdout.on('data', (d) => (out += d))
    child.stderr.on('data', (d) => (out += d))
    child.on('close', (code) => {
      // `처리 N / M · 남은 큐 K`
      const m = out.match(/처리\s+(\d+)\s*\/\s*(\d+)\s*·\s*남은 큐\s+([\d,]+)/)
      resolve({
        code,
        done: m ? Number(m[1]) : 0,
        left: m ? Number(m[3].replace(/,/g, '')) : null,
        tail: out.split('\n').filter(Boolean).slice(-3).join(' / ').slice(0, 200),
      })
    })
  })
}

if (!COMMIT) {
  console.log('발췌 분석 구동기 — 예행')
  console.log('='.repeat(70))
  console.log(`  대상 feed   ${FEED}`)
  console.log(`  배치        ${BATCH}편`)
  console.log(`  배치 사이 쉼 ${REST}초`)
  console.log(`  이번 상한    ${MAX === Infinity ? '큐가 빌 때까지' : `${num(MAX)}편`}`)
  console.log(`  조각        ${SHARD ?? '전량'}`)
  console.log('\n  --commit 을 붙이면 실제로 돈다. 중간에 끊어도 다음 실행이 이어 간다.')
  process.exit(0)
}

console.log(
  `발췌 분석 구동기 — 배치 ${BATCH} · 쉼 ${REST}초 · feed=${FEED}${SHARD ? ` · 조각 ${SHARD}` : ''}`,
)
console.log('='.repeat(70))

const started = Date.now()
let total = 0
let fails = 0
let round = 0

for (;;) {
  if (total >= MAX) {
    console.log(`\n  이번 상한 ${num(MAX)}편에 닿았다. 다시 돌리면 이어 간다.`)
    break
  }
  round += 1
  // 죽은 프로세스가 남긴 중간 상태를 먼저 되돌린다 — 안 하면 그 행은 영영 안 잡히고
  // 큐 수치에서도 사라져 **줄어든 것처럼 보인다.**
  const reclaimed = await reclaimStuck()
  if (reclaimed) console.log(`  ↺ 중간 상태에서 회수 ${reclaimed}편`)
  const r = await runBatch()

  if (r.code !== 0 || r.done === 0) {
    fails += 1
    console.log(`  [${round}] 처리 0 (종료코드 ${r.code}) — ${r.tail}`)
    if (r.left === 0) {
      console.log('\n  큐가 비었다.')
      break
    }
    if (fails >= MAX_FAILS) {
      console.error(`\n  ❌ 연속 ${fails}회 실패 — 멈춘다. 죽은 쪽을 계속 두들기지 않는다.`)
      process.exitCode = 1
      break
    }
    // 실패했으면 더 오래 쉰다 — 상대가 회복할 시간을 준다.
    await sleep(REST * 2000)
    continue
  }

  fails = 0
  total += r.done
  const mins = (Date.now() - started) / 60000
  const rate = total / Math.max(mins, 0.01)
  const eta = r.left != null && rate > 0 ? `· 남은 ${num(r.left)}편 ≈ ${(r.left / rate / 60).toFixed(1)}시간` : ''
  console.log(`  [${round}] +${r.done} · 누적 ${num(total)} ${eta}`)

  if (r.left === 0) {
    console.log('\n  큐가 비었다.')
    break
  }
  await sleep(REST * 1000)
}

const mins = ((Date.now() - started) / 60000).toFixed(1)
console.log(`\n  처리 ${num(total)}편 · ${mins}분 · 배치 ${round}회`)
console.log('  스냅샷을 다시 뜨면 화면이 줄어든 큐를 보인다:')
console.log('    pnpm dlx tsx scripts/textbook/source-eligibility-scan.mjs')
