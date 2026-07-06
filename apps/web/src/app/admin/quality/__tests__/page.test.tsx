// apps/web/src/app/admin/quality/__tests__/page.test.tsx
//
// /admin/quality 데이터 분기 렌더 검증.
// 런타임은 admin RLS 세션이 필요해 dev-bypass 브라우징으론 빈 상태만 확인 가능 —
// 카드/스파크라인/전회 대비/dims 분기는 픽스처로 renderToString 검증한다.

import { renderToString } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const fetchMock = vi.fn()

// CollectNowButton(클라이언트)의 useRouter 는 Next 라우터 컨텍스트 밖 renderToString 에서 throw — 스텁
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: () => {} }),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: () => ({
      select: () => ({
        order: () => ({
          limit: () => ({
            returns: () => fetchMock(),
          }),
        }),
      }),
    }),
  }),
}))

import AdminQualityPage from '../page'

/** collect_quality_metrics 실측 스키마 기반 픽스처 — measured_at DESC (쿼리 순서와 동일) */
const ROWS = [
  // 최신 스냅샷 (07-05)
  {
    stage: 'analyze',
    metric: 'book_v7_v8_share_pct',
    value: '33.33',
    dims: { books: 6, status: 'published', v_dist: { '7': 1, '8': 1 } },
    measured_at: '2026-07-05 18:10:00+00',
  },
  {
    stage: 'analyze',
    metric: 'book_v7_v8_share_pct',
    value: '55.56',
    dims: { books: 18, status: 'ready' },
    measured_at: '2026-07-05 18:10:00+00',
  },
  {
    stage: 'publish',
    metric: 'set_size_p50',
    value: '36',
    dims: { sets: 260, min: 2, max: 40 },
    measured_at: '2026-07-05 18:10:00+00',
  },
  {
    stage: 'ingest',
    metric: 'article_lexical_noise_p90',
    value: '0.000',
    dims: { articles: 46 },
    measured_at: '2026-07-05 18:10:00+00',
  },
  // 직전 스냅샷 (07-04) — ready 편중 비율만 변화(46.67→55.56)
  {
    stage: 'analyze',
    metric: 'book_v7_v8_share_pct',
    value: '33.33',
    dims: { books: 6, status: 'published' },
    measured_at: '2026-07-04 18:10:00+00',
  },
  {
    stage: 'analyze',
    metric: 'book_v7_v8_share_pct',
    value: '46.67',
    dims: { books: 15, status: 'ready' },
    measured_at: '2026-07-04 18:10:00+00',
  },
  {
    stage: 'publish',
    metric: 'set_size_p50',
    value: '36',
    dims: { sets: 260 },
    measured_at: '2026-07-04 18:10:00+00',
  },
  {
    stage: 'ingest',
    metric: 'article_lexical_noise_p90',
    value: '0.000',
    dims: { articles: 18 },
    measured_at: '2026-07-04 18:10:00+00',
  },
]

describe('AdminQualityPage', () => {
  beforeEach(() => {
    fetchMock.mockReset()
  })

  it('지표 카드·세그먼트·전회 대비·스파크라인·dims 를 렌더한다', async () => {
    fetchMock.mockResolvedValue({ data: ROWS, error: null })
    // SSR 텍스트 경계 주석(<!-- -->)이 문자열 어서션을 끊으므로 제거 후 검사
    const html = renderToString(await AdminQualityPage()).replaceAll('<!-- -->', '')

    // 지표 한글 라벨 + 세그먼트 배지 (published/ready 분리)
    expect(html).toContain('도서 V7–V8 편중 비율')
    expect(html).toContain('published')
    expect(html).toContain('ready')
    expect(html).toContain('챕터 세트 크기 p50')
    expect(html).toContain('아티클 어휘 노이즈 p90')

    // 값 포맷: pct → %, 정수 → 그대로
    expect(html).toContain('55.56%')
    expect(html).toContain('>36<')

    // 전회 대비: ready 55.56 vs 46.67 → ▲ 8.89%p / 동일값 → 변동 없음
    expect(html).toContain('▲')
    expect(html).toContain('8.89')
    expect(html).toContain('변동 없음')

    // 스파크라인 (수집 2회 → polyline)
    expect(html).toContain('<polyline')

    // dims 상세
    expect(html).toContain('books')
    expect(html).toContain('v_dist')

    // stage 그룹 헤더 (파이프라인 라벨)
    expect(html).toContain('분석')
    expect(html).toContain('발행')
    expect(html).toContain('수집 2회 보관')
  })

  it('데이터 없음 → 빈 상태 안내를 렌더한다', async () => {
    fetchMock.mockResolvedValue({ data: [], error: null })
    const html = renderToString(await AdminQualityPage())
    expect(html).toContain('수집된 품질 지표가 없어요')
    expect(html).toContain('기록 없음')
  })

  it('fetch 오류 → throw 없이 빈 상태 폴백', async () => {
    fetchMock.mockResolvedValue({ data: null, error: { message: 'permission denied' } })
    const html = renderToString(await AdminQualityPage())
    expect(html).toContain('수집된 품질 지표가 없어요')
  })
})
