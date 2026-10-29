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
import { dictationFrom, withDictationFrom } from '@/lib/dictation/return'
import { MISSED_RETRY_HREF } from '@/lib/dictation/retry-missed'

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
    expect(src).toMatch(/if \(!stashMissedRetry\(snapshotForAllow\?\.session\.userId \?\? null, missedRetry\)\) return[\s\S]{0,200}?router\.push\(withDictationFrom\(MISSED_RETRY_HREF, from\)\)\n\s*\}, \[missedRetry, snapshotForAllow, router, from\]\)/)
    expect(src).not.toMatch(/router\.push\(MISSED_RETRY_HREF\)/)
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

describe('T-0243 — 틀린 문항만 다시도 들어온 자리(?from=)를 잇는다', () => {
  const go = (raw: string | null) => withDictationFrom(MISSED_RETRY_HREF, dictationFrom(raw))
  it('유효한 내부 from 은 설정 주소에 붙는다', () => {
    expect(go('/text/t-1?mode=read')).toBe('/dictate/setup?retry=missed&from=%2Ftext%2Ft-1%3Fmode%3Dread')
  })
  it('없음 · 외부 · 받아쓰기 자기 경로는 기존 경로 그대로', () => {
    for (const raw of [null, '', 'https://evil.example/x', '//evil.example', '/dictate', '/dictate/results?sessionId=s', 'javascript:alert(1)']) {
      expect(go(raw)).toBe(MISSED_RETRY_HREF)
    }
  })
  it('설정 · 세션이 from 을 다음 화면으로 넘긴다(기존 경로 재사용)', () => {
    const setup = fs.readFileSync(path.resolve(__dirname, '../DictationSetupClient.tsx'), 'utf8')
    const session = fs.readFileSync(path.resolve(__dirname, '../DictationSessionClient.tsx'), 'utf8')
    expect(setup).toContain('router.push(withDictationFrom(`/dictate/session?sessionId=${session.id}`, from))')
    expect(session).toContain('router.replace(withDictationFrom(`/dictate/results?sessionId=${session.id}`, from))')
  })
})
