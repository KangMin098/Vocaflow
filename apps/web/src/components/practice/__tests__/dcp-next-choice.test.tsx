// apps/web/src/components/practice/__tests__/dcp-next-choice.test.tsx
// 완료 뒤 보조 선택 「다른 글 살펴보기」 — opt-in(nextChoice), 완료 화면에만, 기사 연습 다리만 켠다 · 새 제출 · 기록 없음.
import fs from 'node:fs'
import path from 'node:path'
import { renderToString } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { DcpItem } from '@/lib/learner/dcp'

const h = vi.hoisted(() => ({
  done: false,
  actions: { gradeDcpItem: vi.fn(), recordDcpErrorCause: vi.fn() },
}))
vi.mock('@/lib/learner/dcp-actions', () => h.actions)
vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react')
  return {
    ...actual,
    // phase 의 초기값('answering')만 'done' 으로 심어 완료 화면을 서버 렌더로 그린다
    useState: (init: unknown) => actual.useState(h.done && init === 'answering' ? 'done' : init),
  }
})

import { DcpPlayer } from '../DcpPlayer'
import { ARTICLE_NEXT_CHOICE } from '../ArticlePracticeBridge'

const ITEM: DcpItem = {
  id: 'a',
  type: 'topic',
  paragraphIdx: 0,
  payload: { passage: 'The bakery opens early.', choices: ['bread', 'weather', 'hours', 'cakes', 'traffic'], stemKo: '주제는?', underline: null, summarySentence: null },
}

const render = (done: boolean, nextChoice?: { href: string; label: string }) => {
  h.done = done
  return renderToString(<DcpPlayer items={[ITEM]} backHref="/text/t1" backCta="읽던 글로" nextChoice={nextChoice} />)
}

beforeEach(() => {
  h.actions.gradeDcpItem.mockClear()
  h.actions.recordDcpErrorCause.mockClear()
})

describe('DcpPlayer nextChoice', () => {
  it('완료 전에는 보이지 않는다', () => {
    const html = render(false, ARTICLE_NEXT_CHOICE)
    expect(html).not.toContain('dcp-next-choice')
    expect(html).not.toContain('다른 글 살펴보기')
  })
  it('완료 후: /library/scripts 링크 · 44px · focus-visible · 본문 복귀는 그대로 먼저', () => {
    const html = render(true, ARTICLE_NEXT_CHOICE)
    const link = html.match(/<a[^>]*data-testid="dcp-next-choice"[^>]*>([^<]*)<\/a>/)
    expect(link?.[1]).toBe('다른 글 살펴보기')
    expect(link?.[0]).toContain('href="/library/scripts"')
    expect(link?.[0]).toContain('min-h-[44px]')
    expect(link?.[0]).toContain('focus-visible:ring-2')
    expect(html).toContain('href="/text/t1"')
    expect(html.indexOf('읽던 글로')).toBeLessThan(html.indexOf('다른 글 살펴보기'))
  })
  it('기본(prop 없음) 완료 화면은 예전과 같다', () => {
    const html = render(true)
    expect(html).not.toContain('dcp-next-choice')
    expect(html).toContain('읽던 글로')
  })
  it('렌더해도 채점 · 원인 기록을 부르지 않는다', () => {
    render(true, ARTICLE_NEXT_CHOICE)
    expect(h.actions.gradeDcpItem).not.toHaveBeenCalled()
    expect(h.actions.recordDcpErrorCause).not.toHaveBeenCalled()
  })
})

describe('opt-in 경계 — 기사 연습 다리만 켠다', () => {
  const src = (p: string) => fs.readFileSync(path.resolve(__dirname, p), 'utf8')
  it('다리는 서가로 고정된 nextChoice 를 넘긴다', () => {
    expect(ARTICLE_NEXT_CHOICE).toEqual({ href: '/library/scripts', label: '다른 글 살펴보기' })
    expect(src('../ArticlePracticeBridge.tsx')).toContain('nextChoice={ARTICLE_NEXT_CHOICE}')
  })
  it('다른 호출부(교재 · DCP 세션 · 공장 · /fit 체험 · dev)는 넘기지 않는다', () => {
    for (const p of [
      '../../../app/(main)/practice/dcp/session/page.tsx',
      '../../../app/(main)/library/textbooks/[series]/[step]/practice/page.tsx',
      '../../csat/factory/FactoryDcpRunner.tsx',
      '../../textfit/ReadingTrial.tsx',
      '../../../app/dev/insert-feedback/dev.tsx',
      '../../../app/dev/meaning-evidence/dev.tsx',
      '../../../app/dev/vocab-practice/VocabPracticeDev.tsx',
    ]) {
      expect(src(p)).not.toContain('nextChoice')
    }
  })
})
