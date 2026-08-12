// apps/web/src/app/admin/__tests__/page.test.tsx
//
// /admin 대시보드 렌더 검증.
// 이 화면은 v06.35 에서 목업 상수(총 사용자 1,247 …)를 걷어내고 실측 집계로 바꿨다.
// 회귀 위험이 "숫자가 다시 상수로 굳는 것" 이므로, 픽스처를 바꾸면 화면 숫자도 바뀌는지를 고정한다.
// (실 DB 연결은 lib/admin/__tests__/dashboard-stats.integration.test.ts 가 담당.)

import { renderToString } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { DashboardStats } from '@/lib/admin/dashboard-stats'

const statsMock = vi.fn<[], Promise<DashboardStats>>()

vi.mock('@/lib/auth/require-admin', () => ({
  requireAdmin: async () => ({ id: 'admin-uuid', email: 'admin@test', role: 'admin' as const }),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({}),
}))

vi.mock('@/lib/admin/dashboard-stats', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/admin/dashboard-stats')>()
  return { ...actual, getAdminDashboardStats: () => statsMock() }
})

import AdminDashboardPage from '../page'

/** 2026-08-12 실측값을 축약한 픽스처 — reportsOpen 만 null(테이블 없음). */
const STATS: DashboardStats = {
  books: { published: 12, ready: 304, inFlight: 0, failed: 83, seeds: 1843 },
  articles: { published: 160, ready: 2, inFlight: 0, failed: 0, seeds: 7 },
  comics: { published: 1, draft: 0 },
  pdComics: { published: 1, review: 4, inFlight: 1, failed: 0 },
  jobs: { pending: 1, running: 0, awaitingMapping: 0, failed: 0 },
  vcb: { pending: 0, exported: 0, enriched: 2000, flagged: 0, failed: 0 },
  vrl: { openConcerns: 0, classified: 45682 },
  words: { dict: 45682, pending: 0, judgments: 16, chapterQuiz: 1019 },
  learners: { total: 3, activeToday: 1 },
  texts: 275,
  qualityLastMeasuredAt: '2026-08-10T18:25:00.015026+00:00',
  reportsOpen: null,
  recent: [
    {
      at: '2026-08-12T10:00:00+00:00',
      kind: 'LCP',
      accent: 'var(--p)',
      title: 'Dead Souls',
      detail: '검수 대기',
      href: '/admin/curation/preview/04fda0cd-99b3-40ed-993c-704fdc023565',
    },
    {
      at: '2026-08-11T09:00:00+00:00',
      kind: '드레인 큐',
      accent: 'var(--success)',
      title: 'LibriVox 챕터 매핑',
      detail: '대기',
      href: '/admin/curation',
    },
  ],
}

function render(stats: DashboardStats) {
  statsMock.mockResolvedValue(stats)
  // SSR 텍스트 경계 주석(<!-- -->)이 문자열 어서션을 끊으므로 제거 후 검사
  return AdminDashboardPage().then((el) => renderToString(el).replaceAll('<!-- -->', ''))
}

describe('AdminDashboardPage', () => {
  beforeEach(() => {
    statsMock.mockReset()
  })

  it('KPI 를 집계 결과에서 계산한다 (상수 아님)', async () => {
    const html = await render(STATS)

    // 공개 = 12 + 160 + 1 + 1
    expect(html).toContain('174')
    // 검수 대기 = 304 + 2 + 4
    expect(html).toContain('310')
    // 실패 = 83 + 0 + 0 + 0 + 0
    expect(html).toContain('83')
    // 오늘 학습자 / 가입자
    expect(html).toContain('오늘 학습자')
    expect(html).toContain('가입 3명')

    // 목업 시절의 상수가 남아 있지 않다
    expect(html).not.toContain('1,247')
    expect(html).not.toContain('GPT-4o-mini')
    expect(html).not.toContain('The Great Gatsby')
  })

  it('파이프라인 8개 큐와 실측 칩을 렌더한다', async () => {
    const html = await render(STATS)

    expect(html).toContain('LCP · 도서 큐레이션')
    expect(html).toContain('ACP · 짧은 글')
    expect(html).toContain('드레인 큐 · Claude Code')
    expect(html).toContain('VCB · 단어장 파이프라인')
    expect(html).toContain('VRL · 어휘 레벨')
    expect(html).toContain('CCP · 도서 만화')
    expect(html).toContain('PDCP · 퍼블릭도메인 만화')
    expect(html).toContain('Pending Words')
    expect(html).toContain('8개 큐')

    // 천단위 구분 포맷
    expect(html).toContain('1,843')
    expect(html).toContain('45,682')
  })

  it('DB 를 읽지 않는 화면에 목업 태그를, reports 부재는 "테이블 없음" 으로 표시한다', async () => {
    const html = await render(STATS)

    expect(html).toContain('목업')
    expect(html).toContain('reports 테이블 없음')
    expect(html).toContain('결제 테이블 없음')
    // 미구현을 "0건" 으로 뭉개지 않는다
    expect(html).not.toContain('미처리 0건')
  })

  it('조회 실패(null)는 0 이 아니라 —', async () => {
    const html = await render({
      ...STATS,
      books: { published: null, ready: null, inFlight: null, failed: null, seeds: null },
    })
    expect(html).toContain('—')
  })

  it('최근 변경이 없으면 빈 상태를 안내한다', async () => {
    const html = await render({ ...STATS, recent: [] })
    expect(html).toContain('최근 변경된 파이프라인 항목이 없습니다')
  })
})
