// apps/web/src/components/dictation/__tests__/results-retry-missed.test.tsx
// @vitest-environment node
// T-0221 — 「틀린 문항만 다시」 단추: 있을 때만 그림 · 44px · 보이는 초점 · 부모는 주인 확인(same)일 때만 수를 넘기고 누르는 순간 다시 판정 · 계정 봉투로만 넘김.
import fs from 'node:fs'
import path from 'node:path'
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock('@/lib/supabase/client', () => ({ createClient: vi.fn() }))

import { DictationResultActions } from '../DictationResultsClient'

const retry = { textId: 't-1' }

describe('DictationResultActions — 틀린 문항만 다시', () => {
  it('틀림·건너뜀이 있으면 수와 함께 그린다(44px · 초점 링) · 「한 번 더」는 그대로', () => {
    const html = renderToString(<DictationResultActions retry={retry} from={null} missedCount={3} onRetryMissed={() => {}} />)
    const btn = html.match(/<button[^>]*data-testid="dictation-retry-missed"[^>]*>/)?.[0] ?? ''
    expect(btn).toContain('type="button"')
    expect(btn).toContain('data-missed-count="3"')
    expect(btn).toContain('min-h-[44px]')
    expect(btn).toContain('focus-visible:ring-2')
    expect(html).toContain('틀린 문항 <!-- -->3<!-- -->개만 다시 받아쓰기')
    expect(html).toContain('한 번 더')
    expect(html).toContain('href="/dictate/setup?text=t-1"')
  })
  it('0 개(모두 맞힘 · 주인 확인 전)이거나 동작이 없으면 그리지 않는다', () => {
    for (const el of [
      <DictationResultActions key="a" retry={retry} from={null} missedCount={0} onRetryMissed={() => {}} />,
      <DictationResultActions key="b" retry={retry} from={null} missedCount={2} />,
      <DictationResultActions key="c" retry={retry} from={null} />,
    ]) {
      expect(renderToString(el)).not.toContain('dictation-retry-missed')
    }
  })
  it('부모 결속 — same 일 때만 수를 넘기고, 누르는 순간 실행 시점 판정을 다시 본 뒤 계정 봉투로만 넘긴다', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '../DictationResultsClient.tsx'), 'utf8')
    expect(src).toMatch(/missedCount=\{reviewEnabled && missedRetry \? missedRetry\.items\.length : 0\}/)
    expect(src).toMatch(/if \(!missedRetry \|\| !replayAllowed\(liveRef\.current, snapshotForAllow\)\) return/)
    // 봉투는 확정된 결과 주인에게 묶고, 못 두면 이동하지 않는다 — 붙여넣기 전역 키(stashCustomScript)는 쓰지 않는다(리뷰 P1)
    expect(src).toMatch(/if \(!stashMissedRetry\(snapshotForAllow\?\.session\.userId \?\? null, missedRetry\)\) return\s*\n\s*router\.push\(MISSED_RETRY_HREF\)/)
    expect(src).not.toMatch(/stashCustomScript/)
    expect(src).toMatch(/missedRetryPayload\(detail\.session\.title, detail\.attempts\)/)
  })
  it('설정 화면 기본값 — ?retry=missed 는 전체 · 원 문항 하나씩 · 다시 묶는 선택지 없음, 다른 자료는 그대로(T0221_RETRY_UNIT_DECISION)', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '../DictationSetupClient.tsx'), 'utf8')
    expect(src).toMatch(/setCount\(retryMissed \? 'all' : Math\.min\(level\.recommended\.sessionCount, resolved\.sentences\.length\)\)/)
    expect(src).toMatch(/setChunkSize\(!retryMissed && allowsChunking\(resolved\.kind\) \? level\.recommended\.chunkSize : 1\)/)
    expect(src).toMatch(/const canChunk = !retryMissed && allowsChunking\(source\.kind\)/)
  })
})
