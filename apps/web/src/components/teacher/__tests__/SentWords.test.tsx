// apps/web/src/components/teacher/__tests__/SentWords.test.tsx
//
// 교사가 실제 보낸 단어 · 뜻 확인(TEACHER-WORDS-01).
// 저장된 {w,m} 를 자르지 않고 읽는다 · 뜻 없음은 「함께 보내지지 않음」 · 행 하나라도 어긋나면 목록 전체를 확인 불가로 닫는다 ·
// 빈 배열과 구분한다 · T-0223 의 failed · progress:null 고지는 그대로다.
// 펼치기 · 여러 카드 · props 교체 흐름은 node 테스트 환경에서 클릭할 수 없어 PC 하네스(pd-t233-r1)가 본다.

import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import type { ClassAssignment } from '@/lib/teacher/assignment-actions'

import { readSentWords, SentAssignments, type SentAssignmentRow } from '../SentAssignments'

const A = (words: unknown, id = 'a-1'): ClassAssignment => ({
  id,
  classId: 'c-1',
  className: '1반',
  title: '7과 어휘',
  words: words as ClassAssignment['words'],
  createdAt: '2026-10-01T00:00:00Z',
})
const OK = { memberCount: 3, openedCount: 1, collectedCount: 1 }
const html = (rows: SentAssignmentRow[]) => renderToStaticMarkup(<SentAssignments rows={rows} />)

describe('readSentWords', () => {
  it('정상 목록은 순서 · 표면형 · 뜻을 그대로, 뜻 없음(null · 빈 문자열 · 없음)은 null', () => {
    expect(readSentWords([{ w: 'apple', m: '사과', v: 3 }, { w: 'pear', m: null }, { w: 'grape', m: '  ' }, { w: 'fig' }])).toEqual({
      ok: true,
      words: [
        { w: 'apple', m: '사과' },
        { w: 'pear', m: null },
        { w: 'grape', m: null },
        { w: 'fig', m: null },
      ],
    })
  })

  it('최대 200개를 자르지 않는다', () => {
    const many = Array.from({ length: 200 }, (_, i) => ({ w: `w${i}`, m: `뜻${i}` }))
    const r = readSentWords(many)
    expect(r.ok && r.words.length).toBe(200)
  })

  it('빈 배열은 형식이 맞는 0개, 배열이 아니면 확인 불가', () => {
    expect(readSentWords([])).toEqual({ ok: true, words: [] })
    for (const bad of [null, undefined, {}, 'apple', 3]) expect(readSentWords(bad)).toEqual({ ok: false })
  })

  it('행 하나라도 어긋나면(null · 빈 표면형 · 타입 오류) 목록 전체가 확인 불가 — 몰래 버리지 않는다', () => {
    for (const bad of [
      [{ w: 'apple' }, null],
      [{ w: 'apple' }, {}],
      [{ w: '  ' }],
      [{ w: 7 }],
      [{ w: 'apple', m: 3 }],
      ['apple'],
    ]) {
      expect(readSentWords(bad)).toEqual({ ok: false })
    }
  })
})

describe('SentAssignments — 보낸 단어 확인', () => {
  it('처음에는 접혀 있고 「보낸 단어 N개 확인」 단추만 — 목록은 누를 때만', () => {
    const h = html([{ assignment: A([{ w: 'apple', m: '사과' }, { w: 'pear' }]), progress: OK }])
    expect(h).toContain('보낸 단어 2개 확인')
    expect(h).toContain('aria-expanded="false"')
    expect(h).not.toContain('data-testid="sent-words-list"')
    expect(h).not.toContain('사과')
    expect(h).toContain('단어 2개')
  })

  it('잘못된 목록 → 확인 불가 안내 · 단추 없음 · 헤더도 개수 대신 확인 불가', () => {
    const h = html([{ assignment: A([{ w: 'apple' }, null]), progress: OK }])
    expect(h).toContain('보낸 단어 목록을 확인할 수 없어요')
    expect(h).not.toContain('data-testid="sent-words-toggle"')
    expect(h).toContain('단어 목록 확인 불가')
    expect(h).not.toContain('단어 1개')
  })

  it('빈 배열 → 「저장된 단어가 없어요」(확인 불가와 다르다)', () => {
    const h = html([{ assignment: A([]), progress: OK }])
    expect(h).toContain('저장된 단어가 없어요')
    expect(h).not.toContain('확인할 수 없어요')
    expect(h).not.toContain('data-testid="sent-words-toggle"')
  })

  it('집계 실패(progress:null)여도 단어는 확인할 수 있고, 집계 불가 고지는 그대로', () => {
    const h = html([{ assignment: A([{ w: 'apple', m: '사과' }]), progress: null }])
    expect(h).toContain('지금은 수행 현황을 확인할 수 없어요')
    expect(h).toContain('보낸 단어 1개 확인')
    expect(h).not.toContain('role="img"')
  })

  it('목록 실패(failed) 고지는 그대로 — 단어 단추 없음', () => {
    const h = renderToStaticMarkup(<SentAssignments rows={[]} failed />)
    expect(h).toContain('보낸 과제를 불러오지 못했어요')
    expect(h).not.toContain('sent-words')
  })

  it('카드마다 자기 단추 · 자기 목록 id', () => {
    const h = html([
      { assignment: A([{ w: 'apple' }], 'a-1'), progress: OK },
      { assignment: A([{ w: 'grape' }, { w: 'fig' }], 'a-2'), progress: null },
    ])
    expect(h).toContain('보낸 단어 1개 확인')
    expect(h).toContain('보낸 단어 2개 확인')
    const ids = [...h.matchAll(/aria-controls="([^"]+)"/g)].map((m) => m[1])
    expect(ids).toHaveLength(2)
    expect(new Set(ids).size).toBe(2)
  })
})
