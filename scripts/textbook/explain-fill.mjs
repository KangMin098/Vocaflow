// scripts/textbook/explain-fill.mjs
//
// **결정론 해설 적재 — 상업 교재 8단계 중 6번(해답·해설).**
//
// `explain-items.ts` 의 작성기를 저장 문항 전체에 돌려 `answer_key.explanation_ko` 를 채운다.
// 시중 79종 실측 기준선은 **해설 보유율 사실상 100%** 인데 우리는 2.7% 였다
// (`scripts/textbook/market-benchmark.mjs`).
//
// ── 반드시 지키는 것 ────────────────────────────────────────────────
//  · **jsonb 를 통째로 덮지 않는다.** 기존 `answer_key` 를 읽어 키 하나만 더한다 —
//    덮으면 정답 키가 날아간다(루트 CLAUDE.md §🤖).
//  · **이미 해설이 있으면 건너뛴다.** Claude Code 배치가 쓴 해설이 우선이다.
//  · **빈 값·짧은 값을 넣지 않는다.** 작성기가 null 을 주면 넣지 않고 세기만 한다 —
//    넣어 버리면 다음 실행이 "완료" 로 세어 구멍이 영영 남는다.
//  · 재실행 안전 — 몇 번 돌려도 결과가 같다.
//
// 실행:
//   node scripts/textbook/explain-fill.mjs              보기만 (dry-run)
//   node scripts/textbook/explain-fill.mjs --commit     실제 적재
//   node scripts/textbook/explain-fill.mjs --commit --type unit_vocab
//   node scripts/textbook/explain-fill.mjs --overwrite  결정론 해설을 다시 쓴다(규칙이 좋아졌을 때)

import fs from 'node:fs'
import path from 'node:path'
// **한 번에 하나만 돈다.** 겹치면 둘 다 statement timeout 으로 죽는다 — batch-lock.mjs 참조.
import { acquire } from './batch-lock.mjs'

acquire('textbook-batch')

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const { createClient } = await import('@supabase/supabase-js')
const {
  DETERMINISTIC_EXPLAIN_TYPES,
  explainInsertSeam,
  explainShortInsertSeam,
  explainItem,
  explainOrderSeam,
  toCsatInsert,
  toCsatOrder,
} = await import('@vocaflow/library-pipeline')

/**
 * 순서·삽입은 `explain-items.ts` 가 아니라 `explain-seam.ts` 가 쓴다.
 *
 * 수능 인쇄 형식으로 못 바꾸는 문항은 이음매 자체가 성립하지 않으므로 건너뛴다 —
 * 그 사실을 `못씀` 으로 세고 조용히 빈 값을 넣지 않는다.
 */
function explainSeamItem(type, payload, answerKey) {
  if (type === 'order') {
    const it = toCsatOrder(payload?.presented ?? [], answerKey?.source_order ?? [])
    return it ? explainOrderSeam(it) : null
  }
  if (type === 'insert') {
    const it = toCsatInsert(payload?.remaining ?? [], payload?.insert_sentence ?? '', answerKey?.position)
    if (it) return explainInsertSeam(it)
    // 자리가 5곳이 안 되는 것(3~4문장)은 교재에는 못 써도 **학습 화면에서는 그대로 풀린다.**
    // 실측 1,748건 중 1,047건이 그렇다 — 그 화면에 해설이 없던 자리다.
    return explainShortInsertSeam(
      payload?.remaining ?? [],
      payload?.insert_sentence ?? '',
      answerKey?.position,
    )
  }
  return null
}

/** 이 스크립트가 채우는 유형 전체. */
const FILL_TYPES = [...DETERMINISTIC_EXPLAIN_TYPES, 'order', 'insert']

const COMMIT = process.argv.includes('--commit')
const OVERWRITE = process.argv.includes('--overwrite')
const typeFlag = process.argv.indexOf('--type')
const ONLY_TYPE = typeFlag >= 0 ? process.argv[typeFlag + 1] : null
const LIMIT = Number(process.argv[process.argv.indexOf('--limit') + 1]) || 0

/** 결정론 해설임을 표시한다 — 나중에 배치 해설과 구별해 다시 쓸 수 있어야 한다. */
const WRITER_KEY = 'explanation_writer'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
)

const types = ONLY_TYPE ? [ONLY_TYPE] : [...FILL_TYPES]
console.log(`대상 유형 ${types.length}: ${types.join(', ')}`)
console.log(COMMIT ? '모드: 적재' : '모드: 보기만 (--commit 으로 실제 적재)')
if (OVERWRITE) console.log('⚠ --overwrite: 결정론 해설을 다시 쓴다 (배치 해설은 건드리지 않는다)')

const stats = {}
const samples = []
let scanned = 0
let written = 0

for (const type of types) {
  const s = { scanned: 0, already: 0, wrote: 0, skipped: 0, wrongOption: 0, citation: 0, lens: [] }
  stats[type] = s

  /**
   * **커서 페이징** — `range(from, ...)` 은 OFFSET 이라 깊어질수록 느려진다.
   *
   * 실측 2026-08-31: V5 문항을 56,191건 넣어 `csat_dcp_items` 가 9만을 넘자
   * `unit_vocab` 조회가 `canceling statement due to statement timeout` 으로 죽었다.
   * 페이지 크기(500)는 그대로인데 뒤쪽 페이지가 앞의 모든 행을 세고 지나가야 해서다.
   * 마지막 id 다음부터 읽으면 깊이와 무관하게 같은 비용이 된다.
   */
  const PAGE = 500
  let cursor = null
  for (;;) {
    let q = supabase
      .from('csat_dcp_items')
      .select('id,type,payload,answer_key')
      .eq('type', type)
      .order('id')
      .limit(PAGE)
    if (cursor) q = q.gt('id', cursor)
    // 일시적 실패(5xx·timeout)는 다시 시도한다 — 읽기라 안전하다.
    let data = null
    let error = null
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const res = await q
      data = res.data
      error = res.error
      if (!error) break
      const msg = String(error.message ?? '')
      if (!/5\d\d|timeout|schema cache|fetch failed|socket|ECONN|EAI_AGAIN|handshake/i.test(msg)) break
      console.error(`  ↻ ${type} 재시도 ${attempt + 1}/3 — ${msg.slice(0, 60)}`)
      await new Promise((r) => setTimeout(r, 1000 * 3 ** attempt))
    }
    if (error) throw new Error(`${type}: ${error.message}`)
    if (data?.length) cursor = data[data.length - 1].id
    if (data.length === 0) break

    const updates = []
    for (const row of data) {
      s.scanned += 1
      scanned += 1
      const ak = row.answer_key ?? {}

      // 이미 해설이 있으면 손대지 않는다. 예외: --overwrite 이고 그 해설을 우리가 쓴 것일 때.
      if (ak.explanation_ko) {
        const oursBefore = ak[WRITER_KEY] != null
        if (!(OVERWRITE && oursBefore)) { s.already += 1; continue }
      }

      const e = row.type === 'order' || row.type === 'insert'
        ? explainSeamItem(row.type, row.payload ?? {}, ak)
        : explainItem(row.type, row.payload ?? {}, ak)
      if (!e) { s.skipped += 1; continue }

      s.wrote += 1
      s.lens.push(e.ko.length)
      if (e.hasWrongOption) s.wrongOption += 1
      if (e.hasCitation) s.citation += 1
      if (samples.length < 12 && s.wrote <= 2) samples.push({ type, ko: e.ko })

      // 통째로 덮지 않는다 — 기존 키를 펼치고 두 키만 더한다.
      updates.push({ id: row.id, answer_key: { ...ak, explanation_ko: e.ko, [WRITER_KEY]: e.writer } })
    }

    if (COMMIT && updates.length) {
      // upsert 는 다른 컬럼을 NOT NULL 로 요구한다 — 행마다 update 로 answer_key 만 바꾼다.
      // 한 건씩 순차로 돌리면 1만 3천 건에 10분이 넘는다. 20건씩 동시에 보낸다.
      const queue = [...updates]
      await Promise.all(Array.from({ length: Math.min(20, queue.length) }, async () => {
        for (;;) {
          const u = queue.shift()
          if (!u) return
          // ⚠️ **이 쓰기는 재시도해도 안전하다** — 행 하나를 정해진 값으로 덮고,
          //   이미 해설이 있는 문항은 애초에 `updates` 에 안 들어온다(위 skip). 그래서
          //   중복이 생길 여지가 없다(적재 계열의 insert 와는 다르다).
          //   일시적 실패에 그냥 죽으면 몇 만 건짜리 배치가 통째로 멈춘다 — 실측
          //   2026-08-31 에 Cloudflare **520** 하나가 V5 해설 채우기를 죽였다.
          let uErr = null
          for (let attempt = 0; attempt < 4; attempt += 1) {
            const res = await supabase
              .from('csat_dcp_items')
              .update({ answer_key: u.answer_key })
              .eq('id', u.id)
            uErr = res.error
            if (!uErr) break
            const msg = String(uErr.message ?? '')
            // 영구 오류(권한·제약)는 다시 해도 같다 — 바로 던진다.
            if (!/5\d\d|timeout|schema cache|fetch failed|socket|ECONN|EAI_AGAIN|handshake/i.test(msg)) break
            await new Promise((r) => setTimeout(r, 1000 * 3 ** attempt))
          }
          if (uErr) throw new Error(`${type} ${u.id}: ${uErr.message}`)
          written += 1
        }
      }))
    }
    if (data.length < PAGE) break
    if (LIMIT && s.scanned >= LIMIT) break
  }

  const med = s.lens.length
    ? [...s.lens].sort((a, b) => a - b)[Math.floor(s.lens.length / 2)]
    : 0
  console.log(
    `  ${type.padEnd(16)} 훑음 ${String(s.scanned).padStart(5)} · 이미있음 ${String(s.already).padStart(5)}`
    + ` · 쓸수있음 ${String(s.wrote).padStart(5)} · 못씀 ${String(s.skipped).padStart(5)}`
    + ` · 중앙 ${String(med).padStart(3)}자 · 오답배제 ${s.wrote ? Math.round(100 * s.wrongOption / s.wrote) : 0}%`
    + ` · 인용 ${s.wrote ? Math.round(100 * s.citation / s.wrote) : 0}%`,
  )
}

const totalWrote = Object.values(stats).reduce((a, s) => a + s.wrote, 0)
const totalSkip = Object.values(stats).reduce((a, s) => a + s.skipped, 0)
const totalAlready = Object.values(stats).reduce((a, s) => a + s.already, 0)
console.log(`\n훑음 ${scanned} · 이미있음 ${totalAlready} · 쓸 수 있음 ${totalWrote} · 못 씀 ${totalSkip}`)
if (COMMIT) console.log(`적재 ${written}건`)
else console.log('적재 안 함 — `--commit` 을 붙여야 실제로 쓴다')

if (samples.length) {
  console.log('\n표본:')
  for (const s of samples) console.log(`  [${s.type}] ${s.ko}\n`)
}
