// scripts/acp/prune-vocab-sentences.mjs
//
// **어휘 표의 문장 사본을 필요한 것만 남기고 비운다 — 배치 드라이버.**
//
// ── 무엇을 하나 ───────────────────────────────────────────────────────
// `library_article_vocabularies.first_sentence` 는 평균 188 B × 11,011,463행 =
// **약 2,081 MB** 로 정리 후 heap 의 71% 다. 그런데 그 값은 보관 중인 원문 속 문장의
// **무압축 사본**이고(2 KB 미만이라 TOAST 압축이 안 걸린다), 한 기사 안에서 같은 문장이
// 평균 4.48번 되풀이된다.
//
// 실제로 읽는 곳을 다 세어 보니 **17.23% 만 있으면 된다**:
//   · 발행 글의 전 행      — 새 단어장 발행 시 `shared_words.source_sentence` 로 복사되는 자리
//                            (이미 발행된 279개·8,960낱말은 8,960/8,960 복사 완료라 무관)
//   · 사전 미등재 낱말      — `select_article_coverage` / `select_extraction_residual` 의 문맥
// 조판(`volume-pool.mjs`)은 이 컬럼을 **아예 안 받는다**.
//
// ⚠️ 사전 채굴 두 함수는 **자가 다르다** — `select_extraction_residual` 은 사전을 직접만
//   조회하고 `lexicon_clean` 을 보는데, `select_article_coverage` 는 굴절형까지 되짚는다.
//   그래서 **둘의 합집합**을 남긴다. 굴절형 자만 쓰면 표본 21,610 중 975행만 남는데
//   residual 은 3,352행이 필요하다 — 그대로 두면 잔차 목록이 조용히 11%p 줄고,
//   줄어든 목록을 근거로 "사전이 다 찼다" 고 오판하게 된다(오류가 아니라 누락이라 안 보인다).
//
// ⚠️ **삭제가 아니라 캐시 축출이다.** 비운 문장은 `library_articles.content` 에
//   normalizePunctuation → reflowSoftHyphens → extractBookLemmas → computeLearningValue
//   를 돌리면 비트 단위로 되살아난다(6편 2,565행 대조 · 불일치 0 · 편당 46.5 ms).
//
// ── 왜 배치인가 ───────────────────────────────────────────────────────
// UPDATE 는 행마다 새 버전을 쓴다. 11M 행을 한 번에 비우면 heap 이 정리 전에 두 배로
// 부풀어 디스크가 위험하다(DB 가 이미 7.6 GB). 배치로 끊고, 몇 배치마다 일반 `VACUUM`
// 으로 공간을 재사용시킨다. 마지막 `VACUUM FULL` 은 **사람이 판단해서** 따로 돌린다
// (ACCESS EXCLUSIVE 락 — 조판·발행·Admin 미리보기가 그동안 멈춘다).
//
// ── 재실행 안전 ────────────────────────────────────────────────────────
// 이미 NULL 인 행은 대상 술어에서 빠진다. 몇 번을 돌려도 결과가 같고, 중간에 끊겨도
// 이어서 돌리면 된다. 남길 행(발행 글 · 사전 미등재)은 절대 건드리지 않는다.
//
// ── 실행 ──────────────────────────────────────────────────────────────
//   node scripts/acp/prune-vocab-sentences.mjs                 # 예행 — 대상 수만 센다
//   node scripts/acp/prune-vocab-sentences.mjs --commit        # 실제로 비운다
//   node scripts/acp/prune-vocab-sentences.mjs --commit --batch 20000 --max 500000
//
// 전제: 마이그레이션 `20260901060000_prune_article_vocab_sentences` 적용됨.

import fs from 'node:fs'
import path from 'node:path'

for (const f of ['apps/web/.env.local', '.env.local']) {
  try {
    for (const line of fs.readFileSync(path.resolve(f), 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
    }
  } catch {
    /* 없으면 다음 후보 */
  }
}

const arg = (n, d = null) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d
}
const commit = process.argv.includes('--commit')
const BATCH = Number(arg('batch', 25000))
const MAX = Number(arg('max', Infinity))
// 몇 배치마다 진행 상황을 다시 재나. 매번 세면 세는 값이 배치보다 비싸다.
const RECOUNT_EVERY = Number(arg('recount', 10))

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 없다 (apps/web/.env.local)')
  process.exit(1)
}

const { createClient } = await import('@supabase/supabase-js')
const db = createClient(url, key, { auth: { persistSession: false } })

const fmt = (n) => n.toLocaleString('en-US')

const { data: before, error: cErr } = await db.rpc('count_article_vocab_prunable')
if (cErr) {
  console.error('대상 계수 실패:', cErr.message)
  console.error('마이그레이션 20260901060000 이 적용됐는지 확인할 것.')
  process.exit(1)
}
const total = Number(before)

console.log(`비울 대상 ${fmt(total)}행 — 평균 188 B 이므로 약 ${Math.round((total * 188) / 1024 / 1024)} MB`)
console.log('남기는 것: 발행 글의 전 행 + 사전에서 안 풀리는 4자 이상 낱말\n')

if (!commit) {
  console.log('예행이다. 아무것도 안 바꿨다. 실제로 비우려면 --commit 을 붙일 것.')
  console.log('⚠️ 비운 뒤 heap 을 실제로 되찾으려면 사람이 판단해 따로 돌린다:')
  console.log('     VACUUM FULL ANALYZE public.library_article_vocabularies;')
  process.exit(0)
}

let done = 0
let batches = 0
let remaining = total
const t0 = Date.now()

while (remaining > 0 && done < MAX) {
  const limit = Math.min(BATCH, MAX - done)
  const { data, error } = await db.rpc('prune_article_vocab_sentences', { p_limit: limit })
  if (error) {
    console.error(`\n배치 ${batches + 1} 실패:`, error.message)
    console.error(`여기까지 ${fmt(done)}행 비웠다. 다시 실행하면 이어서 돈다(재실행 안전).`)
    process.exit(1)
  }
  const row = Array.isArray(data) ? data[0] : data
  const pruned = Number(row?.pruned ?? 0)
  done += pruned
  batches += 1

  // 고를 대상이 없으면 끝이다 — 남은 수를 다시 세지 않고 바로 멈춘다.
  if (pruned === 0) {
    remaining = 0
    break
  }

  if (batches % RECOUNT_EVERY === 0) {
    const { data: c, error: e2 } = await db.rpc('count_article_vocab_prunable')
    if (e2) {
      console.error('\n중간 계수 실패:', e2.message)
      process.exit(1)
    }
    remaining = Number(c)
  } else {
    remaining = Math.max(0, remaining - pruned)
  }

  const sec = (Date.now() - t0) / 1000
  const rate = done / Math.max(sec, 0.001)
  const eta = rate > 0 ? Math.round(remaining / rate) : 0
  process.stdout.write(
    `\r배치 ${batches} · 비움 ${fmt(done)} / ${fmt(total)} · 남음 ${fmt(remaining)} · ${Math.round(rate)}행/s · 예상 ${eta}s   `,
  )
}

const sec = ((Date.now() - t0) / 1000).toFixed(1)
console.log(`\n\n완료 — ${fmt(done)}행을 비웠다 (${batches}배치 · ${sec}s)`)
console.log(`회수 예상 약 ${Math.round((done * 188) / 1024 / 1024)} MB`)
console.log('\n⚠️ heap 은 아직 안 줄었다. UPDATE 는 죽은 튜플을 남기므로 되찾으려면:')
console.log('     VACUUM FULL ANALYZE public.library_article_vocabularies;')
console.log('   ACCESS EXCLUSIVE 락을 잡는다 — 조판·발행·Admin 미리보기가 그동안 멈춘다.')
console.log('   여유 디스크를 확인하고 한산할 때 돌릴 것.')

// ⚠️ 즉시 exit 하지 않는다 — supabase-js 의 열린 핸들이 닫히는 중이면 Windows 에서
//   libuv 가 터져 성공한 작업이 종료코드 1 로 보고된다(process-queue.mjs 에 같은 주석).
await new Promise((r) => setTimeout(r, 100))
process.exit(0)
