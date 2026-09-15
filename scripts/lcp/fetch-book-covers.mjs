// scripts/lcp/fetch-book-covers.mjs
//
// 도서 표지 대량 확보 — library_books.cover_image_url 채우기.
//
// 왜 필요한가: 2026-08-30 실측 — status='ready' 303권 중 표지가 있는 것은 22권(7%)뿐이었다.
//   반면 이미 발행된 13권은 12권(92%)이 표지를 갖는다. 표지 없는 카드가 그리드를 채우면
//   학습자에게는 "빈 서가" 로 보인다 — 재고가 없는 게 아니라 **보여줄 얼굴이 없는** 것이다.
//   발행 확대의 선행 조건이라 별도 스크립트로 뽑았다.
//
// 출처별 규칙:
//   standard_ebooks — 표지 URL 이 source_id 로부터 결정된다.
//       https://standardebooks.org/ebooks/{source_id}/downloads/cover.jpg
//       (source_id 는 'mark-twain/the-adventures-of-tom-sawyer' 또는
//        번역자가 붙은 'plato/dialogues/benjamin-jowett' 3-세그먼트도 있다 — 둘 다 같은 규칙)
//   그 외(storyweaver 등) — 결정 규칙이 없다. 손대지 않고 건너뛴 수만 보고한다.
//
// 재실행 안전: cover_image_url 이 이미 있는 행은 조회 단계에서 제외한다. 몇 번 돌려도 결과가 같다.
// 쓰기는 --commit 을 줄 때만. 기본은 dry-run.
//
// 사용:
//   node scripts/lcp/fetch-book-covers.mjs                     # dry-run 전량
//   node scripts/lcp/fetch-book-covers.mjs --limit 20          # 20권만
//   node scripts/lcp/fetch-book-covers.mjs --commit            # 실제 기록
//   node scripts/lcp/fetch-book-covers.mjs --status ready --commit

import { makeClient, arg } from '../dict-common.mjs'

const UA = 'Vocaflow/1.0 (educational use; +https://standardebooks.org)'
const CONCURRENCY = 4 // Standard Ebooks 는 비영리 소규모 서버다 — 낮게 유지한다
const REQ_TIMEOUT_MS = 15_000

const argv = process.argv.slice(2)
const COMMIT = argv.includes('--commit')
const LIMIT = Number(arg(argv, '--limit', '0')) || 0
const STATUS = arg(argv, '--status', null) // null = 전 상태

const seCoverUrl = (sourceId) =>
  `https://standardebooks.org/ebooks/${sourceId.replace(/^\/+|\/+$/g, '')}/downloads/cover.jpg`

/** HEAD 로 존재 확인. 200 + image/* 만 통과시킨다. 404 를 그대로 기록하면 깨진 이미지가 남는다. */
async function verify(url) {
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), REQ_TIMEOUT_MS)
  try {
    const res = await fetch(url, { method: 'HEAD', headers: { 'User-Agent': UA }, signal: ctl.signal })
    const type = res.headers.get('content-type') || ''
    return { ok: res.ok && type.startsWith('image/'), code: res.status, type }
  } catch (e) {
    return { ok: false, code: 0, type: String(e?.name === 'AbortError' ? 'timeout' : e?.message || e) }
  } finally {
    clearTimeout(timer)
  }
}

async function mapPool(items, size, fn) {
  const out = new Array(items.length)
  let cursor = 0
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (cursor < items.length) {
        const i = cursor++
        out[i] = await fn(items[i], i)
      }
    }),
  )
  return out
}

async function main() {
  const db = makeClient()

  // 페이지네이션 — .range 로 전량 수집(기본 1000행 상한 회피)
  const rows = []
  for (let from = 0; ; from += 1000) {
    let q = db
      .from('library_books')
      .select('id, source, source_id, title, status')
      .is('cover_image_url', null)
      .order('created_at', { ascending: true })
      .range(from, from + 999)
    if (STATUS) q = q.eq('status', STATUS)
    const { data, error } = await q
    if (error) throw new Error(`조회 실패: ${error.message}`)
    rows.push(...data)
    if (data.length < 1000) break
  }

  const eligible = rows.filter((r) => r.source === 'standard_ebooks' && r.source_id)
  const unsupported = rows.length - eligible.length
  const targets = LIMIT > 0 ? eligible.slice(0, LIMIT) : eligible

  console.log(`표지 없는 도서: ${rows.length}${STATUS ? ` (status=${STATUS})` : ''}`)
  console.log(`  · standard_ebooks 규칙 적용 대상: ${eligible.length}`)
  console.log(`  · 규칙 없음(건너뜀): ${unsupported}`)
  console.log(`  · 이번 실행 대상: ${targets.length}${COMMIT ? ' [COMMIT]' : ' [dry-run]'}`)
  if (targets.length === 0) return

  let verified = 0
  let missing = 0
  const found = []

  await mapPool(targets, CONCURRENCY, async (row) => {
    const url = seCoverUrl(row.source_id)
    const r = await verify(url)
    if (r.ok) {
      verified++
      found.push({ id: row.id, url })
    } else {
      missing++
      console.log(`  ✗ ${row.title} — ${r.code} ${r.type}`)
    }
  })

  console.log(`\n확인됨 ${verified} / 없음 ${missing}`)

  if (!COMMIT) {
    console.log('dry-run — 기록하지 않았다. --commit 으로 실행하면 반영된다.')
    return
  }

  let written = 0
  for (const f of found) {
    const { error } = await db
      .from('library_books')
      .update({ cover_image_url: f.url })
      .eq('id', f.id)
      .is('cover_image_url', null) // 다른 세션이 그 사이 채웠으면 덮지 않는다
    if (error) {
      console.error(`  ! 기록 실패 ${f.id}: ${error.message}`)
      continue
    }
    written++
  }
  console.log(`기록 ${written} / 확인됨 ${verified} (차이는 동시 기록으로 건너뛴 행)`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
