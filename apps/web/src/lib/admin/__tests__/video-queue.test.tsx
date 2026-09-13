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
import { JOB_STAGES, type JobQueue, type VideoConsole } from '../video-console'

const emptyConsole: VideoConsole = {
  builtAt: new Date().toISOString(),
  baseUrl: 'https://example.test/video',
  rows: [],
  issues: [],
  views: { started: {}, completed: {}, byId: {} },
  storageError: null,
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
      <VideoConsoleClient data={emptyConsole} drift={[]} queue={null} />,
    )
    // 빈 표를 그리면 "큐가 비었다" 로 읽힌다 — 그건 거짓이다.
    expect(html).not.toContain('마지막 움직임')
    for (const label of ['대기', '포장']) expect(html).not.toContain(`>${label}<`)
  })

  it('큐가 있으면 단계 여섯이 **0 인 것까지** 나온다', () => {
    const html = renderToString(
      <VideoConsoleClient data={emptyConsole} drift={[]} queue={queue} />,
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
      <VideoConsoleClient data={emptyConsole} drift={[]} queue={queue} />,
    )
    expect(html).toContain('type-blank')
    expect(html).toContain('에서 멈춤')
    expect(html).toContain('포트가 안 비었다')
  })

  it('실패가 0 이면 실패 목록을 안 그린다 — 볼 것이 없으면 펴지 않는다', () => {
    const clean: JobQueue = { ...queue, counts: { ...queue.counts, failed: 0 }, failed: [] }
    const html = renderToString(
      <VideoConsoleClient data={emptyConsole} drift={[]} queue={clean} />,
    )
    expect(html).not.toContain('에서 멈춤')
  })
})
