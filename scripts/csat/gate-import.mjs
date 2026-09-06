// scripts/csat/gate-import.mjs
//
// **게이트 판정을 조각에 적용한다. 기본은 예행(dry) — `--commit` 이 있어야 쓴다.**
//
// ── 무엇을 쓰는가 ───────────────────────────────────────────────────
// ① `csat_fit.gate` (jsonb 키 하나 추가 — 마이그레이션 불필요)
//    { v, publishable, verdict, genre, why, codes[], by, at }
// ② 게시 불가면 `status='archived'` + `status_message`
//
// ⚠️ **지우지 않는다.** `archived` 는 이미 있는 상태값이고 파이프라인이 이미 거른다.
//   되돌릴 수 있게 남기는 쪽을 골랐다 — 판정이 틀렸을 때 원문을 다시 못 구하기 때문이다.
//   진짜 DELETE 는 판정이 굳은 뒤 별도 결정으로 한다.
//
// ⚠️ **csat_fit 을 통째로 덮으면 안 된다.** 그 안에 대역 채점 결과(pass·topic)가 있고
//   덮으면 균형 사정권 계산이 통째로 날아간다. 읽어서 키 하나만 더한다.
//
// 재실행 안전: 같은 판정을 다시 써도 결과가 같다. 이미 같은 값이면 건너뛴다.
//
// 실행: node scripts/csat/gate-import.mjs [--commit] [--rate 8] [--stale] [--curl]
//   --rate 는 **초당 쓰기 수**다. 기본 8 — 이 드레인이 분당 1,100건을 한 행씩 쓰기 때문에 붙였다.

import fs from 'node:fs'
import path from 'node:path'

import { hardReject, purposeOf, decide, PURPOSE_RULE, RULES_VERSION, CODES_VERSION } from './gate-rules.mjs'
import { curlFetch } from './lib-curl-fetch.mjs'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const COMMIT = process.argv.includes('--commit')
// ⚠️ **판 올림 뒤 재판정은 앞쪽이 전부 수렴해 있다.** 그런데도 매 회차가 처음부터 훑어
//   이미 끝난 5만 행을 페이지로 다시 넘긴다 — 회차당 6,000편이 220편으로 떨어졌다.
//   `--from` 으로 아직 안 된 첫 id 부터 시작하면 그 낭비가 사라진다.
//   (기본값은 처음부터 — 평소 실행의 재실행 안전은 그대로다.)
const fromArg = process.argv.indexOf('--from')
const FROM = fromArg > 0 ? process.argv[fromArg + 1] : ''
// ⚠️ **판을 올린 뒤의 재판정은 남은 행이 id 전체에 흩어져 있다.** `--from` 으로는 못 줄인다.
//   `--stale` 은 아직 지금 판이 아닌 행만 질의한다 — 9만 행을 훑으며 수렴한 것을 건너뛰는 대신,
//   애초에 안 받는다. 회차당 486편이 남은 것 전부가 된다.
const STALE = process.argv.includes('--stale')
/**
 * 판정 청크가 있는 곳 — **둘이다.**
 *
 * `gate-drain` 은 책 단위(Gutenberg), `gate-article-drain` 은 기사 단위(futurity·usgs·nasa…).
 * ⚠️ 기사 쪽을 여기 안 넣으면 판정 5,823편이 **아무 오류 없이 무시된다** — 적재기는
 *   "판정 파일 N개" 만 찍으므로 빠진 줄 모른다. 실측 2026-09-06 에 발사 직전 발견했다.
 * 청크 번호가 겹치므로(둘 다 chunk-01) **디렉터리를 나눠 둔 채로** 각각 읽는다.
 */
const DRAINS = ['scripts/csat/gate-drain', 'scripts/csat/gate-article-drain']
  .map((d) => path.resolve(d))
  .filter((d) => fs.existsSync(d))

// ── 책 판정 읽기 ────────────────────────────────────────────────────
const book = new Map()
let files = 0
for (const dir of DRAINS)
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.out.json')).sort()) {
  const arr = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))
  files += 1
  for (const it of arr) {
    if (!it.verdict) continue
    book.set(it.book, { verdict: it.verdict, genre: it.genre ?? '', why: it.why ?? '' })
  }
}
/**
 * 이 행이 어느 책의 조각인가 — **판정 대조 키**.
 *
 * ⚠️ 두 곳에서 쓴다(`settled` 와 판정 조회). 예전에는 조회 쪽에만 인라인으로 있었고,
 *   `settled` 가 판정을 안 봐서 새 판정이 반영되지 않았다. 한 벌로 둬야 둘이 안 갈린다.
 */
const keyOf = (r) => String(r.title ?? '').split(' — ')[0].trim() || '(무제)'

/**
 * **쓰기 속도 제한 — 이 드레인이 분당 1,100건을 쓰기 때문에 있다.**
 *
 * 실측 2026-09-06: 이 스크립트가 3,353편을 **한 행씩 PATCH** 로 썼다.
 * edge 로그에 `PATCH /rest/v1/library_articles` 가 07:21~07:23 세 분 동안
 * 878 · 1,569 · 906 건(합계 정확히 3,353)으로 찍혔다 — **분당 1,100건**이다.
 *
 * ⚠️ **이것이 그날의 장애 원인은 아니다 — 처음에 그렇게 적었다가 정정했다.**
 *   같은 창의 `postgres_logs` 를 다시 재니 근거가 없었다: 체크포인트는 32~49MB·write 2.6~6.5초로
 *   작았고, `statement timeout` 은 07:00~08:05 내내 분당 0~13건으로 **고르게** 났다 —
 *   쓰기 폭주 시각에 치솟지 않았다. 장애는 08:05 에 갑자기 전 소스가 끊긴 것이고,
 *   저장소의 판정은 `capacity:api_outage:2026-09-06T0806` — **읽기 포화**다
 *   (`capacity:disk_io:instance`: shared_buffers 256MB 대 데이터 6,315MB, 캐시가 4%).
 *
 * 그래도 속도 제한은 둔다. 이 저장소에는 **실제로 확인된** 단건 PATCH 폭주가 둘 있고
 * (`shared_dictionary` 1,87x건/분 · `library_article_vocabularies` 초당 114건 — 체크포인트가
 * 매번 3~4.5분이었다), 이 드레인은 같은 모양이다. 아직 아프지 않았다는 것이
 * 안 아플 것이라는 뜻은 아니다.
 *
 * ⚠️ **일괄 upsert 로 바꾸지 않았다.** 행마다 `csat_fit` 이 달라 한 문장으로 못 묶고,
 *   PostgREST upsert 는 payload 에 없는 NOT NULL 열에서 터질 수 있다 — 판정을 넣으려다
 *   원문을 깨뜨리는 위험을 감수할 자리가 아니다. **속도를 줄이는 쪽이 맞다**:
 *   WAL 총량은 그대로여도 체크포인트가 몰리지 않는다.
 *
 * 기본 8건/초(3,353편이면 약 7분). 급하면 `--rate 20`, 다른 드레인과 겹칠 때는 `--rate 3`.
 */
const rateArg = (() => {
  const i = process.argv.indexOf('--rate')
  return i > 0 && process.argv[i + 1] ? Number(process.argv[i + 1]) : NaN
})()
const RATE = Number.isFinite(rateArg) && rateArg > 0 ? rateArg : 8
let lastWriteAt = 0
const pace = async () => {
  const gap = 1000 / RATE
  const wait = lastWriteAt + gap - Date.now()
  // `sleep` 은 아래에서 정의된다 — `pace` 는 훑기 루프 안에서만 불리므로 그때는 이미 있다.
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  lastWriteAt = Date.now()
}

console.log('게이트 적용' + (COMMIT ? ' — **쓴다**' : ' — 예행(쓰지 않는다)'))
console.log('='.repeat(78))
console.log(`  판정 파일 ${files}개 · 책 **${book.size}권**\n`)
if (!book.size) {
  console.error('  ❌ 판정이 없다. 먼저 gate-book-export.mjs 로 뽑고 채울 것.')
  process.exit(1)
}

const { createClient } = await import('@supabase/supabase-js')
// ⚠️ 내장 fetch 가 이 환경에서 죽는다(같은 순간 curl 은 정상). --curl 로 갈아 끼운다.
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
  ...(process.argv.includes('--curl') ? { global: { fetch: curlFetch } } : {}),
})

// ⚠️ 첫 실행이 12,300편에서 **오류 한 줄 없이** 죽었다(2026-09-05). 같은 일이 이 저장소의
//   PLOS 수확에서도 있었다. 원인을 못 잡은 채 긴 루프를 다시 돌리면 또 같은 자리에서 잃는다.
//   재실행 안전은 이미 있으니, 여기서는 일시적 실패를 삼켜 루프가 끊기지 않게만 한다.
// 두 번째 실행도 18,000편에서 말없이 끝났다. 재시도로 안 잡혔으니 던져진 오류가 아니다.
// 무엇이 끝냈는지 로그에 남긴다 — 안 남기면 세 번째도 같은 자리에서 잃는다.
for (const sig of ['SIGTERM', 'SIGINT', 'SIGHUP']) {
  process.on(sig, () => {
    console.error(`\n  ⛔ ${sig} 로 종료됨 — 재실행하면 이어서 간다`)
    process.exit(1)
  })
}
process.on('unhandledRejection', (e) => {
  console.error(`\n  ⛔ 처리 안 된 거부: ${String(e?.message ?? e).slice(0, 120)}`)
  process.exit(1)
})
process.on('exit', (code) => console.error(`\n  [종료 코드 ${code}]`))

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function retry(fn, what, attempt = 0) {
  try {
    const r = await fn()
    if (r?.error) throw new Error(r.error.message)
    return r
  } catch (e) {
    if (attempt >= 4) throw new Error(`${what} — ${String(e.message).slice(0, 80)}`)
    await sleep(1500 * 2 ** attempt)
    return retry(fn, what, attempt + 1)
  }
}

/**
 * **서사를 게시 불가로 두는 것은 수능 쪽 사정이다 — 교재 쪽은 반대다.**
 *
 * 이 파일은 `publishable = verdict === 'use'` 로 판정해 왔다. 그런데 설계 문서
 * (`docs/CSAT_SOURCE_GATE.md`)는 `narrative` 를 두고 **"버리지 않는다 — 심경·분위기
 * (R-MOOD)와 내용일치(R-FACT)가 요구하는 것이 정확히 이것이다"** 라고 적는다.
 * 문서와 코드가 어긋나 있었고 코드 쪽이 이겼다(실측 2026-09-05: narrative 3,698편 전부 archived).
 *
 * 그중 **1,241편이 초·중 교재용 발췌**(`feed_id='kid-excerpt'`)다. 초·중 독해 교재는
 * 이야기 지문을 싣는다 — 이 저장소가 "초·중 창의 narrative 재고가 **0편**" 이라
 * StoryWeaver 를 새로 배선한 것이 그 기록이다. 수능 지문이 설명·논증문이라 서사를 빼는 것과,
 * 교재가 이야기를 필요로 하는 것은 **다른 용도의 다른 판단**이다.
 * 한 자로 두 용도를 재면 한쪽이 반드시 틀린다.
 *
 * `reject` 는 어느 쪽에서도 게시 불가다(교리·차별·폐기된 사실) — 그건 용도와 무관하다.
 */
// 이 판단은 `gate-rules.mjs` 의 `purposeOf` + `decide` 로 옮겼다 — 용도가 넷(csat·kids·
// library·raw)이고 서사 말고도 갈리는 축(운문·구조 잔재·미절단 원본)이 더 있었기 때문이다.
// `kid-excerpt` 와 `adapted` 는 거기서 `kids` 로 간다.

const tally = { total: 0, judged: 0, unjudged: 0, pub: 0, quarantine: 0, skipped: 0, wrote: 0, restored: 0, byPurpose: {}, byBlock: {} }
const byVerdict = {}
const byCode = {}
const NOW = new Date().toISOString()

let cursor = FROM || '00000000-0000-0000-0000-000000000000'
for (;;) {
  const { data } = await retry(
    () =>
      db
        .from('library_articles')
        // ⚠️ 전에는 `.eq('source','gutenberg')` 였다. 그러면 **판정을 안 받은 소스가
        //   그대로 게시된다** — PLOS 논문 전문 34,700행이 정확히 그 상태였다.
        //   전량을 훑되 용도(`purposeOf`)가 기준을 가른다.
        // ⚠️ **본문을 여기서 받지 않는다.** 표 전체 본문이 1.3 GB 이고 그 대부분이
        //   PLOS 논문 전문(평균 4만 자)이다. 전량을 끌어오면 긴 루프가 세 번 다
        //   말없이 죽었다(2026-09-05). 용도는 `feed_id`·`source` 만으로 정해지므로,
        //   본문은 **규칙을 걸 행에만** 따로 받는다.
        .select('id,title,status,status_message,feed_id,source,csat_fit')
        .gt('id', cursor)
        .or(STALE ? `csat_fit->gate->>rv.is.null,csat_fit->gate->>rv.neq.${RULES_VERSION}` : 'id.gte.00000000-0000-0000-0000-000000000000')
        .order('id')
        .limit(300),
    '조회',
  )
  if (!data?.length) break
  cursor = data[data.length - 1].id

  // ⚠️ **이미 v2 로 판정됐고 용도도 그대로면 본문이 필요 없다.** 본문 조회가 이 루프에서
  //   가장 비싼 일이고(curl 경로에서는 요청마다 프로세스 하나), 재실행할 때마다 7만 편의
  //   본문을 다시 받는 것은 순전한 낭비다. 상태가 어긋난 행은 아래 `settled` 가 걸러 낸다.
  const settled = (r) => {
    const g = r.csat_fit?.gate
    // ⚠️ 규칙 판이 바뀌었으면 저장된 판정을 믿으면 안 된다 — 그게 반영 누락의 원인이었다.
    if (!g || g.v !== 2 || g.rv !== RULES_VERSION || g.purpose !== purposeOf(r)) return false
    // ⚠️⚠️ **새로 들어온 책 판정이 저장된 것과 다르면 수렴이 아니다.**
    //   실측 2026-09-06: 책 511권을 새로 판정하고 적재했는데 **한 행도 안 바뀌었다**
    //   (「판정 있음 0 · 쓴 것 0」). 규칙만으로 한 번 게이트를 돌린 행은
    //   `by:'rule'` · `verdict:null` · `rv:3` 으로 남는데, 위 세 줄만 보면 그게 "수렴" 이라
    //   **판정을 조회하기도 전에 건너뛰었다.** 즉 규칙 통과 뒤에 붙은 LLM 판정은
    //   영영 반영될 수 없었다 — 드레인은 성공했다고 보고하고 구멍은 그대로 남는다.
    //   `--stale` 로도 안 풀린다(그쪽은 `rv` 가 낡은 행만 좁히는 스위치다).
    if ((book.get(keyOf(r))?.verdict ?? null) !== (g.verdict ?? null)) return false
    const stuckArchived =
      g.publishable && r.status === 'archived' && String(r.status_message ?? '').startsWith('게시 게이트:')
    const stuckLive = !g.publishable && g.purpose !== 'raw' && r.status !== 'archived'
    return !stuckArchived && !stuckLive
  }
  // 저장된 codes 가 지금 판이면 본문이 필요 없다 — 판정 논리만 바뀐 재판정이 그렇다.
  // ⚠️ v2 기록에는 cv 가 없다. 그 기록들은 지금의 HARD_RULES 로 쓰인 것이므로 판 1로 인정한다
  //   — 안 그러면 첫 재판정에서 9만 편의 본문을 다시 받고, 이 최적화가 아무 일도 못 한다.
  const codesVersionOf = (r) => r.csat_fit?.gate?.cv ?? (r.csat_fit?.gate?.v === 2 ? 1 : null)
  const needBody = data
    .filter((r) => purposeOf(r) !== 'raw' && !settled(r) && codesVersionOf(r) !== CODES_VERSION)
    .map((r) => r.id)
  const body = new Map()
    // ⚠️ `.in()` 은 id 를 전부 URL 에 싣는다. 100개면 4,000자가 넘어 curl 이 요청을 못 낸다
  //   (상태 000). 40개로 줄이면 1,600자 안쪽이라 안전하다.
  for (let i = 0; i < needBody.length; i += 40) {
    const { data: bodies } = await retry(
      () => db.from('library_articles').select('id,content').in('id', needBody.slice(i, i + 40)),
      '본문 조회',
    )
    for (const b of bodies ?? []) body.set(b.id, b.content)
  }

  for (const row of data) {
    tally.total += 1
    // ⚠️ **L3(조각 단위) 판정이 있는 행은 건드리지 않는다.** 그 행들은 책 판정이 `mixed`
    //   (= 책 단위로는 못 가른다) 라서 조각을 하나씩 본 것이다. 여기서 책 판정으로 다시 쓰면
    //   더 정확한 판정을 덜 정확한 판정으로 덮는다 — 두 층이 같은 칸을 쓰면 마지막에
    //   돈 쪽이 이기고, 그게 하필 이 스크립트다(더 자주 돈다).
    if (row.csat_fit?.gate?.by === 'chunk-llm') {
      tally.skipped += 1
      continue
    }
    // 본문을 안 받은 행은 이미 수렴한 행이다 — 규칙을 다시 돌릴 근거가 없다.
    if (purposeOf(row) !== 'raw' && !body.has(row.id) && settled(row)) {
      tally.skipped += 1
      continue
    }
    const v = book.get(keyOf(row)) ?? null
    if (v) tally.judged += 1
    else tally.unjudged += 1
    byVerdict[v?.verdict ?? '(LLM 판정 없음)'] = (byVerdict[v?.verdict ?? '(LLM 판정 없음)'] ?? 0) + 1

    const purpose = purposeOf(row)
    tally.byPurpose[purpose] = (tally.byPurpose[purpose] ?? 0) + 1
    // 미절단 원본은 본문을 규칙에 걸 필요가 없다 — 크기만으로 이미 게시 불가고,
    // 4만 자에 정규식 11개를 돌리는 것은 34,700행에서 그냥 낭비다.
    const codes =
      purpose === 'raw'
        ? []
        : body.has(row.id)
          ? hardReject(body.get(row.id))
          : (row.csat_fit?.gate?.codes ?? [])
    for (const c of codes) byCode[c] = (byCode[c] ?? 0) + 1
    const { publishable, blockedBy } = decide({
      purpose,
      verdict: v?.verdict ?? null,
      genre: v?.genre ?? '',
      codes,
    })
    if (blockedBy) tally.byBlock[blockedBy] = (tally.byBlock[blockedBy] ?? 0) + 1
    // ⚠️ **예행에서도 센다.** `if (!COMMIT) continue` 뒤에서 세면 예행이 0 을 보고하고,
    //   그러면 "무엇이 바뀌는지" 를 모른 채 --commit 을 누르게 된다.
    const willRestore =
      publishable &&
      row.status === 'archived' &&
      String(row.status_message ?? '').startsWith('게시 게이트:')
    if (willRestore) tally.restored += 1
    if (publishable) tally.pub += 1
    else tally.quarantine += 1

    const gate = {
      v: 2,
      rv: RULES_VERSION,
      cv: CODES_VERSION,
      publishable,
      purpose,
      blockedBy,
      verdict: v?.verdict ?? null,
      genre: v?.genre ?? '',
      why: v?.why ?? '',
      codes,
      by: v ? 'book-llm+rule' : 'rule',
      at: NOW,
    }
    const prev = row.csat_fit?.gate
    // 재실행 안전 — 판정이 그대로면 쓰지 않는다(`at` 은 비교에서 뺀다).
    const same =
      prev &&
      prev.v === gate.v &&
      prev.rv === gate.rv &&
      prev.publishable === gate.publishable &&
      prev.purpose === gate.purpose &&
      prev.blockedBy === gate.blockedBy &&
      prev.verdict === gate.verdict &&
      prev.genre === gate.genre &&
      JSON.stringify(prev.codes ?? []) === JSON.stringify(codes)
    // ⚠️ **판정이 같아도 상태가 어긋나 있으면 건너뛰면 안 된다.**
    //   실측 2026-09-05: `publishable=true` 인데 `archived` 로 남은 것이 **409편**이었다.
    //   판정만 보고 skip 하니 상태 불일치가 영영 안 고쳐졌다 — 재실행 안전은
    //   "같은 값을 다시 안 쓴다" 가 아니라 **"다시 돌리면 상태가 수렴한다"** 는 뜻이다.
    if (same && !willRestore) {
      tally.skipped += 1
      continue
    }
    if (!COMMIT) continue

    // ⚠️ 기존 csat_fit 을 읽어 키 하나만 더한다 — 통째로 덮으면 pass·topic 이 날아간다.
    const patch = { csat_fit: { ...(row.csat_fit ?? {}), gate } }
    // ⚠️ **미절단 원본은 상태를 건드리지 않는다.** `publishable=false` 로 게시는 막히지만,
    //   `archived` 로 내리면 나중에 지문으로 잘라 낼 추출 단계가 그 행을 못 찾는다.
    //   "게시 불가" 와 "폐기" 는 다른 말이다.
    if (purpose !== 'raw' && !publishable && row.status !== 'archived') {
      patch.status = 'archived'
      patch.status_message = `게시 게이트: ${PURPOSE_RULE[purpose]?.label ?? purpose} · ${blockedBy}`
    }
    // **되돌릴 수 있어야 재실행 안전이다.** 판정이 바뀌어 게시 가능해졌는데 그대로
    //   archived 로 두면 이 스크립트는 한 방향으로만 움직이는 자가 된다.
    //   ⚠️ **이 게이트가 내린 것만** 되돌린다 — 다른 이유로 archived 된 글은 건드리지 않는다.
    if (willRestore) {
      patch.status = 'queued'
      patch.status_message = null
    }
    await pace()
    await retry(() => db.from('library_articles').update(patch).eq('id', row.id), `쓰기 ${row.id}`)
    tally.wrote += 1
  }
  process.stdout.write(`\r  훑음 ${tally.total.toLocaleString()}편 · 쓴 것 ${tally.wrote.toLocaleString()}`)
  if (data.length < 300) break
}

if (tally.restored) {
  console.log(`\n  되돌림 ${tally.restored.toLocaleString()}편 — 판정이 바뀌어 게시 가능해진 것`)
}
console.log(`\n\n  ${'판정'.padEnd(12)}${'조각'.padStart(9)}`)
console.log('  ' + '-'.repeat(40))
for (const [k, n] of Object.entries(byVerdict).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k.padEnd(12)}${n.toLocaleString().padStart(9)}`)
}
console.log('  ' + '-'.repeat(40))
console.log(`\n  기계 규칙 적중:`)
for (const [k, n] of Object.entries(byCode).sort((a, b) => b[1] - a[1])) {
  console.log(`    ${k.padEnd(16)}${n.toLocaleString().padStart(8)}`)
}
console.log(
  `\n  훑음 ${tally.total.toLocaleString()} · 판정 있음 ${tally.judged.toLocaleString()}` +
    ` · 판정 없음 ${tally.unjudged.toLocaleString()}\n` +
    `  **게시 가능 ${tally.pub.toLocaleString()} · 격리 ${tally.quarantine.toLocaleString()}**` +
    ` · 이미 같음 ${tally.skipped.toLocaleString()} · 쓴 것 ${tally.wrote.toLocaleString()}`,
)
if (!COMMIT) console.log(`\n  예행이었다. 실제로 쓰려면 --commit`)
