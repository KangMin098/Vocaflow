// apps/web/src/lib/admin/__tests__/video-queue.test.tsx
//
// **큐 패널이 0 과 없음을 가르는가.**
//
// 이 화면에서 가장 위험한 실수는 마이그레이션 전에 **빈 표를 그리는 것**이다 —
// "큐가 비었다"(= 할 일이 없다)로 읽히는데 사실은 큐 자체가 없다. 이 저장소가
// `count ?? 0` · 204 로 삼키던 계측에서 반복해 겪은 모양이다.
//
// 살아 있는 표 없이 확인할 수 있는 것만 본다: **넘긴 값으로 무엇을 그리는가.**

import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { VideoConsoleClient } from '@/app/admin/video/VideoConsoleClient'
import {
  JOB_STAGES,
  type EvalSummary,
  type JobQueue,
  type PlanBoard,
  type VideoConsole,
} from '../video-console-shape'

const emptyConsole: VideoConsole = {
  builtAt: new Date().toISOString(),
  baseUrl: 'https://example.test/video',
  rows: [],
  issues: [],
  views: { started: {}, completed: {}, byId: {} },
  storageError: null,
}

/** 아무 후보도 없는 기획판 — 기본값. 개별 검사가 필요한 곳에서 덮어쓴다. */
const emptyPlan: PlanBoard = {
  addressable: 73,
  covered: 73,
  next: [],
  blocked: [],
  coverage: 1,
}

const queue: JobQueue = {
  counts: { failed: 2, queued: 5, voiced: 0, rendered: 1, packaged: 0, published: 54 },
  failed: [
    {
      video_id: 'type-blank',
      kind: 'type',
      stage: 'failed',
      stage_before_fail: 'rendered',
      error: '포트가 안 비었다',
      note: null,
      seconds: null,
      formats_rendered: 1,
      updated_at: new Date().toISOString(),
      published_at: null,
    },
  ],
  inFlight: [],
  lastMovedAt: new Date().toISOString(),
  total: 62,
}

describe('큐 패널', () => {
  it('큐가 없으면(마이그레이션 전) 패널을 아예 안 그린다', () => {
    const html = renderToString(
      <VideoConsoleClient data={emptyConsole} drift={[]} queue={null} evaluation={null} plan={emptyPlan} />,
    )
    // 빈 표를 그리면 "큐가 비었다" 로 읽힌다 — 그건 거짓이다.
    expect(html).not.toContain('마지막 움직임')
    for (const label of ['대기', '포장']) expect(html).not.toContain(`>${label}<`)
  })

  it('큐가 있으면 단계 여섯이 **0 인 것까지** 나온다', () => {
    const html = renderToString(
      <VideoConsoleClient data={emptyConsole} drift={[]} queue={queue} evaluation={null} plan={emptyPlan} />,
    )
    // 0 인 단계를 빼면 그 단계가 사라진 걸로 읽힌다.
    expect(JOB_STAGES.length).toBe(6)
    for (const label of ['실패', '대기', '음성', '렌더', '포장', '발행']) {
      expect(html, label).toContain(label)
    }
    // React 가 값과 글자 사이에 주석 마커를 넣는다(`62<!-- -->편`) — 값만 본다.
    expect(html).toContain('>62')
    expect(html).toContain('마지막 움직임')
  })

  it('실패한 편은 **어디서 멈췄는지와 이유**를 함께 낸다', () => {
    const html = renderToString(
      <VideoConsoleClient data={emptyConsole} drift={[]} queue={queue} evaluation={null} plan={emptyPlan} />,
    )
    expect(html).toContain('type-blank')
    expect(html).toContain('에서 멈춤')
    expect(html).toContain('포트가 안 비었다')
  })

  it('실패가 0 이면 실패 목록을 안 그린다 — 볼 것이 없으면 펴지 않는다', () => {
    const clean: JobQueue = { ...queue, counts: { ...queue.counts, failed: 0 }, failed: [] }
    const html = renderToString(
      <VideoConsoleClient
        data={emptyConsole}
        drift={[]}
        queue={clean}
        evaluation={null}
        plan={emptyPlan}
      />,
    )
    expect(html).not.toContain('에서 멈춤')
  })
})

/* ── 기획·평가 — 파이프라인의 나머지 두 단계 ────────────────────── */

const plan: PlanBoard = {
  addressable: 92,
  covered: 73,
  next: [
    {
      id: 'volume-reading-6',
      kind: 'volume',
      name: 'Vocaflow Reading 5',
      state: 'candidate',
      backing: 318477,
      backingLabel: '이 권의 문항',
      blockedWhy: null,
    },
    {
      id: 'volume-unknown',
      kind: 'volume',
      name: '재고를 못 센 권',
      state: 'candidate',
      backing: null,
      backingLabel: '이 권의 문항',
      blockedWhy: null,
    },
  ],
  blocked: [
    {
      id: 'volume-reading-1',
      kind: 'volume',
      name: 'Vocaflow Reading Starter',
      state: 'blocked',
      backing: 0,
      backingLabel: '이 권의 문항',
      blockedWhy: '이 권에 문항이 0개다 — 지금 찍으면 빈 서가를 광고하게 된다',
    },
  ],
  coverage: 73 / 91,
}

/**
 * 기획 값을 넘겨 서버 렌더한 HTML.
 *
 * 탭은 **클라이언트 상태**로 열리므로 서버 렌더에는 늘 기본 탭(현황)만 나온다 —
 * 그래서 탭 이름을 인자로 받지 않는다(받아 봐야 아무것도 안 바뀐다).
 */
const withPlan = () =>
  renderToString(
    <VideoConsoleClient
      data={emptyConsole}
      drift={[]}
      queue={queue}
      evaluation={null}
      plan={plan}
    />,
  )

describe('기획 탭', () => {
  // 탭은 클라이언트 상태로 열리므로 서버 렌더에는 기본 탭만 나온다.
  // 그래서 여기서는 **넘긴 값이 화면 어딘가에 도달하는가**가 아니라,
  // 컴포넌트가 그 값으로 죽지 않는가와 기본 탭 내용이 오염되지 않는가를 본다.
  it('기획 값을 받아도 기본 탭은 그대로 그려진다', () => {
    const html = withPlan()
    expect(html).toContain('영상 공장')
    // 기획 탭 내용이 기본 탭에 새어 나오면 안 된다.
    expect(html).not.toContain('지금 찍으면 안 되는 자리')
  })

  it('탭 목록에 기획·평가가 있다 — 없으면 열 수가 없다', () => {
    const html = withPlan()
    expect(html).toContain('>기획<')
    expect(html).toContain('>평가<')
  })
})

describe('평가 탭 — 없음과 0 을 가른다', () => {
  const summary: EvalSummary = {
    total: 73,
    evaluated: 73,
    clean: 72,
    failing: 1,
    incomplete: 0,
    lastAt: new Date().toISOString(),
    rows: [
      {
        video_id: 'benefit-decay',
        kind: 'benefit',
        eval_at: new Date().toISOString(),
        eval_pass: 6,
        eval_fail: 1,
        eval_unknown: 0,
        eval_axes: [
          {
            id: 'cue-length',
            label: '자막 노출 길이',
            verdict: 'fail',
            value: '큐 4개 · 가장 긴 것 8.10초',
            limit: '0.83~7초',
            source: 'netflix',
            offenders: ['큐 2 8.10초'],
          },
        ],
      },
    ],
  }

  it('평가 기록이 없으면(마이그레이션 전) 빈 표를 그리지 않는다', () => {
    const html = renderToString(
      <VideoConsoleClient
        data={emptyConsole}
        drift={[]}
        queue={queue}
        evaluation={null}
        plan={plan}
      />,
    )
    // 「전부 통과」로 읽힐 수 있는 문구가 나오면 안 된다.
    expect(html).not.toContain('규격을 어긴 편이 없습니다')
  })

  it('평가 값을 받아도 컴포넌트가 죽지 않는다', () => {
    const html = renderToString(
      <VideoConsoleClient
        data={emptyConsole}
        drift={[]}
        queue={queue}
        evaluation={summary}
        plan={plan}
      />,
    )
    expect(html).toContain('영상 공장')
  })
})
