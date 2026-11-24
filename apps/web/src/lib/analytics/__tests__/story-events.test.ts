// apps/web/src/lib/analytics/__tests__/story-events.test.ts
//
// LCP Story S5 이벤트 계약(docs/LCP_STORY.md §17 · AGENTS D2/D3) — 속성은 숫자 · 불리언 · 닫힌 열거형만.
// 발행 키 · 제목 · 원문 URL · 인용 · 사용자 id 같은 자유 문자열이 실리면 isSafeProps(마지막 방어선)가 막는지,
// 그리고 정의된 모든 행동 값이 그 방어선을 실제로 통과하는지 본다(통과 못 하면 track() 이 조용히 버린다).
//
// ⚠️ DB `funnel_events_event_check` 허용 목록은 S5 SQL 승인 · 적용 전이다. 공유 DB 에 쓰는
//    `db-allowlist.integration.test.ts` 는 여기서 대신하지 않으며 실행하지 않았다(NOT_RUN — 승인 대기).

import { describe, expect, it } from 'vitest'

import { ALLOWED_EVENTS, isSafeProps, type PublicEvent } from '../events'

type ReaderProps = Extract<PublicEvent, { name: 'story_reader_action' }>['props']
type CatalogProps = Extract<PublicEvent, { name: 'story_catalog_viewed' }>['props']

const ACTIONS: ReaderProps['action'][] = ['start', 'resume', 'navigate', 'unit_complete', 'source_open', 'edition_switch']
const KINDS: ReaderProps['kind'][] = ['story_edition', 'easy_reader']
const COVERAGES: ReaderProps['coverage'][] = ['complete_work', 'episode', 'excerpt']

describe('LCP Story 이벤트 계약', () => {
  it('두 이름이 허용 목록에 있다 — 없으면 track() 이 조용히 버린다', () => {
    expect(ALLOWED_EVENTS).toContain('story_catalog_viewed')
    expect(ALLOWED_EVENTS).toContain('story_reader_action')
  })

  it('정의된 모든 행동 · 판본 종류 · 범위 조합이 속성 방어선을 통과한다', () => {
    for (const action of ACTIONS) {
      for (const kind of KINDS) {
        for (const coverage of COVERAGES) {
          const props: ReaderProps = { action, kind, coverage, unit_index: 0, completed: false }
          expect(isSafeProps(props), `${action}/${kind}/${coverage}`).toBe(true)
        }
      }
    }
    const catalog: CatalogProps = { works: 3, editions: 5, signed_in: true }
    expect(isSafeProps(catalog)).toBe(true)
  })

  it('식별자 · URL · 인용을 실으면 방어선이 막는다', () => {
    const base = { action: 'source_open', kind: 'story_edition', coverage: 'episode', unit_index: 2, completed: false }
    expect(isSafeProps({ ...base, release_key: 'lsr_0123456789abcdef0123456789abcdef' })).toBe(false)
    expect(isSafeProps({ ...base, source_url: 'https://www.gutenberg.org/ebooks/1234' })).toBe(false)
    expect(isSafeProps({ ...base, quote: 'The gulls rose over the rock' })).toBe(false)
    expect(isSafeProps({ ...base, title: 'Gull Rock — a synthetic story' })).toBe(false)
    expect(isSafeProps({ ...base, user_id: '3f0c6a2e-1b7d-4c55-9a51-2f3e4d5c6b7a' })).toBe(false)
  })

  it('방어선의 한계: 24자 이하 공백 없는 문자열은 통과한다 — 그래서 속성 모양은 타입(닫힌 열거형)이 막는다', () => {
    // 짧은 URL 조각은 런타임 검사를 넘는다. 화면 코드가 이런 값을 싣지 못하게 하는 것은 PublicEvent 타입이다.
    expect(isSafeProps({ work: 'gull-rock' })).toBe(true)
    // @ts-expect-error — story_reader_action 에는 work_key 자리가 없다(타입이 거부해야 한다).
    const bad: ReaderProps = { action: 'start', kind: 'story_edition', coverage: 'episode', unit_index: 0, completed: false, work_key: 'gull-rock' }
    expect(bad.action).toBe('start')
  })
})
