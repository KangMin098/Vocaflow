// apps/web/src/components/dictation/__tests__/results-retry-missed.test.tsx
// @vitest-environment node
// T-0221 — 「틀린 문장만 다시」 단추: 있을 때만 그림 · 44px · 보이는 초점 · 부모는 주인 확인(same)일 때만 수를 넘기고 누르는 순간 다시 판정.
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

describe('DictationResultActions — 틀린 문장만 다시', () => {
  it('틀림·건너뜀이 있으면 수와 함께 그린다(44px · 초점 링) · 「한 번 더」는 그대로', () => {
    const html = renderToString(<DictationResultActions retry={retry} from={null} missedCount={3} onRetryMissed={() => {}} />)
    const btn = html.match(/<button[^>]*data-testid="dictation-retry-missed"[^>]*>/)?.[0] ?? ''
    expect(btn).toContain('type="button"')
    expect(btn).toContain('data-missed-count="3"')
    expect(btn).toContain('min-h-[44px]')
    expect(btn).toContain('focus-visible:ring-2')
    expect(html).toContain('틀린 문장 <!-- -->3<!-- -->개만 다시 받아쓰기')
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
  it('부모 결속 — same 일 때만 수를 넘기고, 누르는 순간 실행 시점 판정을 다시 본 뒤 기존 custom 진입으로만 간다', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '../DictationResultsClient.tsx'), 'utf8')
    expect(src).toMatch(/missedCount=\{reviewEnabled && missedRetry \? missedRetry\.count : 0\}/)
    expect(src).toMatch(/if \(!missedRetry \|\| !replayAllowed\(liveRef\.current, snapshotForAllow\)\) return\s*\n\s*stashCustomScript\(missedRetry\.payload\)\s*\n\s*router\.push\(MISSED_RETRY_HREF\)/)
    expect(src).toMatch(/missedRetryScript\(detail\.session\.title, detail\.attempts\)/)
  })
})
