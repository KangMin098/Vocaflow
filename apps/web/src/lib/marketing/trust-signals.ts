// apps/web/src/lib/marketing/trust-signals.ts
//
// 공개 화면의 **신뢰 지표를 DB 에서 읽는다** — 상수로 적으면 반드시 낡는다.
//
// 왜 만들었나 (2026-08-26 실측):
//   `/pricing` 의 세 수치는 2026-08-17 실측을 손으로 적어 둔 것이었고, **9일 만에 셋 다 어긋났다**:
//     표제어 47,137 → 실제 47,890 (과소) · 도서–어휘 연결 1,678,478 → 실제 1,678,399 (**과대**)
//     · 수능 순서·삽입 1,374 → 실제 3,280 (과소)
//   같은 파일 주석이 "분기마다 재확인" 이라 적고 있었는데도 그렇다. 사람이 지키는 규칙으로는
//   안 되는 종류의 일이다 — 수치는 매일 변하고 재확인은 분기에 한 번이니 구조적으로 항상 틀리다.
//   그리고 이건 공개 라우트라, 과대 표시는 표시광고법이 정면으로 다루는 항목이다.
//
// ── 왜 service-role 인가 (sitemap 과 반대다) ─────────────────────────
// `lib/seo/content-entries.ts` 는 일부러 anon 으로 읽는다 — 거기서 만드는 것은
// "익명이 열 수 있는 URL 목록" 이라 RLS 가 곧 정답이기 때문이다.
// 여기서 말하는 것은 "우리가 가진 자산의 규모" 라 RLS 와 무관하다. 실제로 anon 으로는
// 세 표가 전부 **count=0 (오류 없이)** 로 나온다 — 그대로 쓰면 화면에 "표제어 0" 이 걸린다.
// 나가는 것은 **집계 숫자뿐**이고 행은 한 줄도 나가지 않는다.
//
// ⚠️ 못 읽으면 `null` — 화면은 섹션을 통째로 숨긴다. **낡은 숫자를 보여주느니 안 보여준다.**

import 'server-only'

import { createClient } from '@supabase/supabase-js'
import { cache } from 'react'

export interface TrustSignal {
  value: string
  label: string
  sub: string
}

/** 수능 유형 중 이 화면이 말하는 두 가지. 라벨(`순서·삽입`)과 같이 움직여야 한다. */
const CSAT_TYPES = ['order', 'insert'] as const

function serviceClient() {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL']
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY']
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

/**
 * head+count 로 총계만 읽는다.
 *
 * ⚠️ `count ?? 0` 을 쓰지 않는다 — 없는 표·막힌 표도 오류 없이 `null` 을 준다.
 *    0 으로 접으면 화면에 "표제어 0" 이 당당히 걸린다(이 저장소가 `/admin` 에서 겪은 함정).
 */
async function countOf(
  db: NonNullable<ReturnType<typeof serviceClient>>,
  table: string,
  narrow?: (q: never) => never,
): Promise<number | null> {
  const base = db.from(table).select('*', { count: 'exact', head: true })
  const q = narrow ? narrow(base as never) : base
  const { count, error } = await (q as unknown as PromiseLike<{
    count: number | null
    error: unknown
  }>)

  if (error) {
    console.error(`[trust-signals] ${table} 집계 실패`, (error as { message?: string }).message)
    return null
  }
  return typeof count === 'number' ? count : null
}

const fmt = (n: number): string => n.toLocaleString('en-US')

/** 공개 화면이 인용하는 플랫폼 실측치. 하나라도 못 읽으면 `null`. */
export interface PlatformFacts {
  /** 사전 표제어 수 */
  headwords: number
  /** 그중 한국어 뜻이 있는 비율(내림, %) */
  meaningKoPct: number
  /** 도서–어휘 연결 행 수 */
  bookVocabLinks: number
  /** 수능 유형 문항 중 순서·삽입 */
  csatOrderInsert: number
}

/**
 * 숫자 자체. 화면마다 필요한 조합이 달라서(요금제는 3종 카드, /fit 은 문장 안) 포맷 전 값을 준다.
 *
 * 하나라도 못 읽으면 전체를 `null` 로 준다 — 부분만 보여주면 나머지가 0 으로 읽힌다.
 */
export const fetchPlatformFacts = cache(async (): Promise<PlatformFacts | null> => {
  const db = serviceClient()
  if (!db) return null

  const [headwords, withKo, links, csat] = await Promise.all([
    countOf(db, 'shared_dictionary'),
    countOf(db, 'shared_dictionary', ((q: { not: (a: string, b: string, c: unknown) => unknown }) =>
      q.not('meaning_ko', 'is', null)) as never),
    countOf(db, 'library_book_vocabularies'),
    countOf(db, 'csat_dcp_items', ((q: { in: (a: string, b: readonly string[]) => unknown }) =>
      q.in('type', CSAT_TYPES)) as never),
  ])

  if (headwords === null || withKo === null || links === null || csat === null) return null
  if (headwords === 0 || links === 0 || csat === 0) {
    // 0 은 "자산이 없다" 가 아니라 대개 "못 읽었다" 다 — 그걸 공개 화면에 내보내지 않는다.
    console.error('[trust-signals] 집계가 0 이다 — 권한을 의심한다', { headwords, links, csat })
    return null
  }

  return {
    headwords,
    meaningKoPct: Math.floor((withKo / headwords) * 100),
    bookVocabLinks: links,
    csatOrderInsert: csat,
  }
})

/** 요금제 화면의 신뢰 지표 3종. 포맷된 문자열까지 서버가 정한다. */
export const fetchTrustSignals = cache(async (): Promise<TrustSignal[] | null> => {
  const f = await fetchPlatformFacts()
  if (!f) return null

  return [
    { value: fmt(f.headwords), label: '표제어', sub: `한국어 뜻 ${f.meaningKoPct}%` },
    { value: fmt(f.bookVocabLinks), label: '도서–어휘 연결', sub: '지문 어휘 자동 분해' },
    { value: fmt(f.csatOrderInsert), label: '수능 유형 문항', sub: '순서·삽입' },
  ]
})

/** 문장 안에 넣을 때 쓰는 포맷 — 화면마다 다르게 찍지 않도록 여기서 정한다. */
export const formatCount = fmt