// apps/web/src/lib/admin/__tests__/video-requests.test.tsx
//
// **요청 순환 화면이 「누구 차례인지」를 맞게 말하는가.**
//
// 이 화면의 약속: 검토 대기만 사람 몫이고(버튼), 나머지는 복사할 명령이다. 표가 없으면
// 「0건」이 아니라 오류를 말한다. 자동 검사에서 떨어진 rev 는 승인 버튼이 잠긴다.

import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/app/admin/video/actions', () => ({
  createVideoRequestAction: vi.fn(),
  reviewVideoRequestAction: vi.fn(),
  cancelVideoRequestAction: vi.fn(),
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }))

import { RequestsPanel } from '@/app/admin/video/RequestsPanel'
import { RequestDetailClient } from '@/app/admin/video/requests/[id]/RequestDetailClient'
import type { RequestBoard, RequestDetail, VideoRequestRow } from '../video-requests'

const domain = {
  id: 'textbook',
  label: '교재',
  description: '시리즈 · 권별 · 문항 유형.',
  target_kinds: ['series', 'volume'],
  allow_custom_target: false,
  default_formats: ['wide'],
  enabled: true,
  sort: 20,
}

const row = (over: Partial<VideoRequestRow> = {}): VideoRequestRow => ({
  id: '11111111-2222-3333-4444-555555555555',
  domain_id: 'textbook',
  target_key: 'volume-reading-4',
  target_label: '독해 4권',
  purpose: 'buy',
  audience: 'parent',
  formats: ['wide'],
  memo: '',
  video_id: null,
  phase: 'requested',
  current_rev: 0,
  error: null,
  created_at: '2026-09-24T00:00:00Z',
  updated_at: '2026-09-24T00:00:00Z',
  ...over,
})

const revision = (ok: boolean) => ({
  rev: 1,
  plan: { need: '돈을 쓸 만한지', problem: '끝까지 안 쓴다', promise: '단계별 권', message: '내 단계부터', action: '첫 장을 풀어 본다' },
  design: {
    title: '독해 4권',
    subtitle: '부제',
    facts: [{ name: 'items', path: 'series[id=reading].rungs[step=4].items', label: '문항' }],
    scenes: [
      { role: 'problem' as const, kind: 'hook' as const, caption: '교재, 끝까지 쓰나요?', line: '교재, 끝까지 쓰나요?' },
      { role: 'action' as const, kind: 'closing' as const, caption: '첫 장 풀기', line: '첫 장', cta: '풀어 보기', url: 'vocaflow.app/textbook' },
    ],
  },
  checks: { ok, seconds: 8, items: ok ? [] : [{ rule: 'stray-number', level: 'error' as const, detail: '숫자' }] },
  author: 'claude',
  created_at: '2026-09-24T00:00:00Z',
})

const detail = (over: Partial<RequestDetail> = {}): RequestDetail => ({
  request: row({ phase: 'designed', current_rev: 1 }),
  domain,
  revisions: [revision(true)],
  reviews: [],
  evaluations: [],
  job: null,
  ...over,
})

describe('요청 탭', () => {
  it('표를 못 읽으면 0건이 아니라 마이그레이션을 말한다', () => {
    const board: RequestBoard = { ready: false, domains: [], targets: [], requests: [] }
    const html = renderToString(<RequestsPanel board={board} />)
    expect(html).toContain('20260924120000_video_requests')
    expect(html).not.toContain('요청 0건')
  })

  it('검토 대기 요청은 「내 차례」, 설계 대기는 에이전트 차례', () => {
    const board: RequestBoard = {
      ready: true,
      domains: [domain],
      targets: [],
      requests: [row({ phase: 'designed', current_rev: 1 }), row({ id: 'x2', target_label: '독해 5권' })],
    }
    const html = renderToString(<RequestsPanel board={board} />)
    expect(html).toContain('내 차례')
    expect(html).toContain('에이전트 차례')
    // 니즈 정의가 폼에 보인다 — 설계자와 같은 정의
    expect(html).toContain('원하는 것')
  })
})

describe('요청 상세', () => {
  it('검토 대기면 결정 버튼 셋과 코멘트 칸이 있다', () => {
    const html = renderToString(<RequestDetailClient detail={detail()} video={null} />)
    for (const t of ['승인', '수정 요청', '반려']) expect(html).toContain(t)
    expect(html).toContain('vr-comment')
    expect(html).toContain('aria-current="step"')
  })

  it('자동 검사에서 떨어진 rev 는 승인 버튼이 잠긴다', () => {
    const html = renderToString(<RequestDetailClient detail={detail({ revisions: [revision(false)] })} video={null} />)
    const approve = html.match(/<button[^>]*>✓ 승인[^<]*/)?.[0] ?? ''
    expect(approve).toContain('disabled')
  })

  it('승인 뒤에는 결정 버튼 대신 복사할 명령이 나온다', () => {
    const html = renderToString(
      <RequestDetailClient detail={detail({ request: row({ phase: 'approved', current_rev: 1 }) })} video={null} />,
    )
    expect(html).toContain('pnpm video requests:pull')
    expect(html).not.toContain('vr-comment')
  })

  it('적용 중이면 영상 id 가 박힌 제작 명령을 준다', () => {
    const html = renderToString(
      <RequestDetailClient
        detail={detail({ request: row({ phase: 'applying', current_rev: 1, video_id: 'req-volume-reading-4-111111' }) })}
        video={null}
      />,
    )
    expect(html).toContain('pnpm video voice req-volume-reading-4-111111')
  })
})
