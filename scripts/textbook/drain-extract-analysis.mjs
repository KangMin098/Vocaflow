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

const num = (n) => n.toLocaleString()
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

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
  console.log('\n  --commit 을 붙이면 실제로 돈다. 중간에 끊어도 다음 실행이 이어 간다.')
  process.exit(0)
}

console.log(`발췌 분석 구동기 — 배치 ${BATCH} · 쉼 ${REST}초 · feed=${FEED}`)
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
