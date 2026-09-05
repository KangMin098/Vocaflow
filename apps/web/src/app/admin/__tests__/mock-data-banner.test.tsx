// apps/web/src/app/admin/__tests__/mock-data-banner.test.tsx
//
// 목업 화면이 **고지 없이** 존재하지 못하게 하는 잠금장치.
//
// 왜 목록을 코드에 박는가:
//   2026-09-05 이전, admin 5개 화면이 DB 를 한 번도 읽지 않고 상수를 실측처럼 그렸다
//   (/admin/users 는 "총 사용자 1,247" — 실제 user_profiles 는 3행). 유일한 고지는 기본 접힘인
//   화면도움말 안이라 사실상 아무도 보지 못했다. 배너를 다는 것만으로는 재발을 막지 못한다 —
//   다음 사람이 목업 화면을 하나 더 추가하면 그만이기 때문이다.
//   그래서 "이 화면은 아직 목업이다" 를 **선언**으로 남기고, 선언된 화면이 전부 배너를 그리는지
//   여기서 고정한다. 연동이 끝나면 화면에서 배너를 지우고 이 목록에서도 빼면 된다 —
//   목록에 남겨 둔 채 배너만 지우면 이 스펙이 실패한다.
//
// 이 스펙이 잡지 못하는 것: 목록에 아예 올리지 않고 새 목업 화면을 만드는 경우.
//   그건 리뷰의 몫이다. 대신 아래 "지워진 상수" 검사가 옛 값의 부활만은 막는다.

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

/** 2026-09-05 실측: 가입 3 · 오늘 활성 2. 나머지는 이 스펙과 무관해 0/null 로 채운다. */
const STATS: DashboardStats = {
  books: { published: 12, ready: 304, inFlight: 0, failed: 83, seeds: 1843 },
  articles: { published: 293, ready: 18819, inFlight: 0, failed: 0, seeds: 7 },
  comics: { published: 1, draft: 0 },
  pdComics: { published: 1, review: 4, inFlight: 1, failed: 0 },
  jobs: { pending: 0, running: 0, awaitingMapping: 0, failed: 0 },
  vcb: { pending: 0, exported: 0, enriched: 0, flagged: 0, failed: 0 },
  vrl: { openConcerns: 0, classified: 0 },
  words: { dict: 49244, pending: 0, judgments: 0, chapterQuiz: 2453 },
  learners: { total: 3, activeToday: 2 },
  texts: 278,
  qualityLastMeasuredAt: null,
  reportsOpen: null,
  recent: [],
}

/**
 * 아직 실측이 아닌 admin 화면 — **여기에 선언된 화면은 MockDataBanner 를 그려야 한다.**
 * `partial` 은 화면 일부만 실측이라는 뜻(배너 의무는 동일).
 */
const MOCK_SCREENS: { slug: string; load: () => Promise<{ default: () => unknown }> }[] = [
  { slug: 'analytics', load: () => import('../analytics/page') },
  { slug: 'users', load: () => import('../users/page') },
  { slug: 'reports', load: () => import('../reports/page') },
  { slug: 'billing', load: () => import('../billing/page') },
  { slug: 'settings', load: () => import('../settings/page') },
  { slug: 'library', load: () => import('../library/page') },
]

/** 배너 본문의 고정 문구 — 컴포넌트를 바꾸면 여기도 같이 바뀌어야 한다(그게 의도). */
const BANNER_HEADLINE = '이 화면의 수치는 실측이 아닙니다.'

async function renderScreen(load: () => Promise<{ default: () => unknown }>): Promise<string> {
  const mod = await load()
  const el = await mod.default()
  // SSR 텍스트 경계 주석(<!-- -->)이 문자열 어서션을 끊으므로 제거 후 검사
  return renderToString(el as React.ReactElement).replaceAll('<!-- -->', '')
}

describe('admin 목업 화면 고지', () => {
  beforeEach(() => {
    statsMock.mockReset()
    statsMock.mockResolvedValue(STATS)
  })

  it.each(MOCK_SCREENS)('/admin/$slug 은 접히지 않는 배너를 그린다', async ({ load }) => {
    const html = await renderScreen(load)

    expect(html).toContain(BANNER_HEADLINE)
    // 화면도움말(기본 접힘) 안이 아니라 항상 보이는 자리여야 한다
    expect(html).toContain('role="status"')
    expect(html).toContain('aria-label="실측 아님 안내"')
    // 막다른 화면 금지 — 다음 한 걸음(실측 화면 링크)이 있다
    expect(html).toContain('href="/admin"')
  })

  it('지워진 상수가 되살아나지 않는다', async () => {
    const html = (await Promise.all(MOCK_SCREENS.map((s) => renderScreen(s.load)))).join('\n')

    // 사용자 — user_profiles 실제 3행 대비 415배
    expect(html).not.toContain('1,247')
    expect(html).not.toContain('student.k@example.com')
    // 분석 — 상수 DAU/MAU 와 연도 없는 코호트 라벨
    expect(html).not.toContain('1,124')
    expect(html).not.toContain('11/24~11/30')
    // 결제 — PG 미연동인데 매출처럼 읽히던 값
    expect(html).not.toContain('₩1.84M')
    expect(html).not.toContain('tx-93281')
    // 신고 — reports 테이블 자체가 없다
    expect(html).not.toContain('SLA 위반 1건')
    // 콘텐츠 — 저장소에 없는 카탈로그
    expect(html).not.toContain('The Great Gatsby')
    // 설정 — 거짓 단언(가장 위험했던 문구)
    expect(html).not.toContain('활성화 후 즉시 적용됩니다')
    expect(html).not.toContain('변경 즉시 모든 활성 세션에 적용')
    // 상수 날짜
    expect(html).not.toContain('2026-04-30')
    expect(html).not.toContain('2026-04-29')
  })

  it('사용자 화면의 두 칸은 집계 결과에서 온다 (상수 아님)', async () => {
    const html = await renderScreen(MOCK_SCREENS[1].load)

    expect(html).toContain('총 사용자')
    expect(html).toContain('>3<')
    expect(html).toContain('오늘 활성')
    expect(html).toContain('>2<')

    // 셀 곳이 없는 칸은 0 이 아니라 —
    expect(html).toContain('Pro 구독')
    expect(html).toContain('집계할 곳이 없습니다')
  })

  it('집계 결과가 바뀌면 화면 숫자도 바뀐다', async () => {
    statsMock.mockResolvedValue({
      ...STATS,
      learners: { total: 4321, activeToday: 0 },
    })
    const html = await renderScreen(MOCK_SCREENS[1].load)

    expect(html).toContain('4,321')
    // 0 은 실측된 0 이므로 — 로 뭉개지 않는다
    expect(html).toContain('>0<')
  })

  it('조회 실패(null)는 0 이 아니라 —', async () => {
    statsMock.mockResolvedValue({ ...STATS, learners: { total: null, activeToday: null } })
    const html = await renderScreen(MOCK_SCREENS[1].load)

    expect(html).toContain('—')
    expect(html).not.toContain('>0<')
  })

  it('죽은 컨트롤(핸들러 없는 버튼)이 남아 있지 않다', async () => {
    const html = (await Promise.all(MOCK_SCREENS.map((s) => renderScreen(s.load)))).join('\n')

    // 눌러도 아무 일이 없던 버튼들의 라벨.
    // `>` 를 붙여 **요소의 텍스트로 나온 경우만** 잡는다 — 설명문에서 「+ 새 공지 작성」처럼
    // 인용하는 것은 "지웠다는 사실" 을 알리는 정상 문장이라 걸리면 안 된다.
    for (const dead of ['초대', '기간 · 7일', '스크립트 추가', 'AI 재분석', '+ 새 공지 작성', 'CSV']) {
      expect(html).not.toContain(`>${dead}`)
    }
    // 메뉴가 열리지 않던 행 우측 ⋯
    expect(html).not.toContain('aria-label="더보기"')
    // 링크도 버튼도 아닌 행에 붙어 있던 이동 어포던스
    expect(html).not.toContain('lucide-chevron-right')
    // 점검 모드 스위치는 남되 잠겨 있어야 한다
    expect(html).toContain('점검 모드 (저장 경로 없음 — 사용 불가)')
    expect(html).toContain('disabled=""')
  })
})
