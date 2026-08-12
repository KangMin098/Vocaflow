// apps/web/src/lib/admin/__tests__/dashboard-stats.integration.test.ts
//
// /admin 대시보드 집계 — 실 DB 통합. 환경변수 없으면 skip (CI 기본 skip).
//
// 이 테스트가 지키는 것:
//   ① 카운트 쿼리 35개의 테이블·컬럼·상태값이 실제 스키마와 맞는가
//      (status CHECK 제약이 바뀌면 조용히 0 이 되는 게 아니라 여기서 드러난다)
//   ② **없는 테이블을 0 으로 뭉개지 않는가** — head:true 요청은 없는 테이블에도
//      204/error=null/count=null 을 돌려준다. `count ?? 0` 으로 쓰면 "미처리 0건" 이라는
//      거짓 안심이 운영 화면 첫 장에 박힌다. reports 부재를 그 회귀 감지기로 쓴다.

import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { config as dotenvConfig } from 'dotenv'
import { beforeAll, describe, expect, it } from 'vitest'

import { fmt, getAdminDashboardStats, relativeKo, sum } from '../dashboard-stats'

// vitest.config 는 레포 루트 .env.local 만 읽는데 그 파일이 없다 — 키는 apps/web/.env.local 에 있다.
// 공용 설정을 고치면 미갱신 골든 스냅샷 3건이 함께 깨져서(자세한 사유는 vitest.config.ts 주석)
// 여기서만 명시 로드한다. dotenv 는 기존 값을 덮지 않으므로 CI 환경변수가 있으면 그쪽이 우선.
dotenvConfig({ path: resolve(fileURLToPath(new URL('.', import.meta.url)), '../../../../.env.local') })

const SUPABASE_URL = process.env['NEXT_PUBLIC_SUPABASE_URL']
const SERVICE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY']
const skipIfNoEnv = !SUPABASE_URL || !SERVICE_KEY

describe.skipIf(skipIfNoEnv)('getAdminDashboardStats (integration)', () => {
  let client: SupabaseClient
  let stats: Awaited<ReturnType<typeof getAdminDashboardStats>>

  beforeAll(async () => {
    client = createClient(SUPABASE_URL!, SERVICE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    stats = await getAdminDashboardStats(client)
  })

  it('모든 파이프라인 카운트가 숫자로 온다 (스키마 정합)', () => {
    const numeric: [string, number | null][] = [
      ['books.published', stats.books.published],
      ['books.ready', stats.books.ready],
      ['books.inFlight', stats.books.inFlight],
      ['books.failed', stats.books.failed],
      ['books.seeds', stats.books.seeds],
      ['articles.published', stats.articles.published],
      ['articles.ready', stats.articles.ready],
      ['articles.inFlight', stats.articles.inFlight],
      ['articles.failed', stats.articles.failed],
      ['articles.seeds', stats.articles.seeds],
      ['comics.published', stats.comics.published],
      ['comics.draft', stats.comics.draft],
      ['pdComics.published', stats.pdComics.published],
      ['pdComics.review', stats.pdComics.review],
      ['pdComics.inFlight', stats.pdComics.inFlight],
      ['pdComics.failed', stats.pdComics.failed],
      ['jobs.pending', stats.jobs.pending],
      ['jobs.running', stats.jobs.running],
      ['jobs.awaitingMapping', stats.jobs.awaitingMapping],
      ['jobs.failed', stats.jobs.failed],
      ['vcb.pending', stats.vcb.pending],
      ['vcb.exported', stats.vcb.exported],
      ['vcb.enriched', stats.vcb.enriched],
      ['vcb.flagged', stats.vcb.flagged],
      ['vcb.failed', stats.vcb.failed],
      ['vrl.openConcerns', stats.vrl.openConcerns],
      ['vrl.classified', stats.vrl.classified],
      ['words.dict', stats.words.dict],
      ['words.pending', stats.words.pending],
      ['words.judgments', stats.words.judgments],
      ['words.chapterQuiz', stats.words.chapterQuiz],
      ['learners.total', stats.learners.total],
      ['learners.activeToday', stats.learners.activeToday],
      ['texts', stats.texts],
    ]

    const broken = numeric.filter(([, v]) => typeof v !== 'number').map(([k]) => k)
    expect(broken, `집계 실패(테이블/컬럼/상태값 불일치): ${broken.join(', ')}`).toEqual([])
  })

  it('없는 테이블(reports)은 0 이 아니라 null 로 온다', () => {
    // reports 가 생기면 이 단언이 깨진다 — 그때 화면 문구("reports 테이블 없음")도 함께 고칠 것.
    expect(stats.reportsOpen).toBeNull()
  })

  it('최근 변경은 updated_at 내림차순 8건 이하', () => {
    expect(stats.recent.length).toBeLessThanOrEqual(8)
    const times = stats.recent.map((e) => new Date(e.at).getTime())
    expect(times).toEqual([...times].sort((a, b) => b - a))
    for (const e of stats.recent) {
      expect(e.href.startsWith('/admin/')).toBe(true)
      expect(e.title.length).toBeGreaterThan(0)
    }
  })
})

describe('표시 헬퍼', () => {
  it('fmt: null 은 —, 0 은 0, 천단위 구분', () => {
    expect(fmt(null)).toBe('—')
    expect(fmt(0)).toBe('0')
    expect(fmt(45682)).toBe('45,682')
  })

  it('sum: 하나라도 null 이면 합계도 null (불완전한 합을 감춘 채 보여주지 않는다)', () => {
    expect(sum(1, 2, 3)).toBe(6)
    expect(sum(1, null, 3)).toBeNull()
    expect(sum()).toBe(0)
  })

  it('relativeKo: 분/시/일 경계', () => {
    const now = Date.parse('2026-08-12T12:00:00Z')
    expect(relativeKo('2026-08-12T11:59:30Z', now)).toBe('방금 전')
    expect(relativeKo('2026-08-12T11:30:00Z', now)).toBe('30분 전')
    expect(relativeKo('2026-08-12T09:00:00Z', now)).toBe('3시간 전')
    expect(relativeKo('2026-08-10T12:00:00Z', now)).toBe('2일 전')
    // 7일 이상은 상대시간이 무의미해 날짜로
    expect(relativeKo('2026-07-01T12:00:00Z', now)).toMatch(/7\.\s*1/)
  })
})
