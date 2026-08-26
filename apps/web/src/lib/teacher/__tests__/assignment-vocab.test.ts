// apps/web/src/lib/teacher/__tests__/assignment-vocab.test.ts
//
// **"담았어요" 가 거짓말이 되는 것**을 막는다.
//
// 2026-08-26 이전, 학생이 `단어장에 담기` 를 누르면 `class_assignment_progress.collected_at`
// 만 찍혔다. 단어장은 그대로였고, 교사 대시보드는 그 숫자를 세어 "N명이 담았어요" 라고 했다.
// 화면도 DB 도 오류를 내지 않는다 — **하지 않은 일을 했다고 말할 뿐이다.**
//
// 여기서 잠그는 것은 그 행을 만드는 규칙이다. 특히 `origin` 은 값마다 **삭제 의미가 달라서**
// 틀리면 몇 주 뒤 엉뚱한 순간에 낱말이 사라진다.

import { describe, expect, it } from 'vitest'

import {
  ASSIGNMENT_ORIGIN,
  assignmentWordsToVocabRows,
  usableAssignmentWords,
} from '../assignment-vocab'

const UID = '00000000-0000-0000-0000-000000000001'

describe('과제 낱말 → 단어장 행', () => {
  it("origin 은 'assignment' 다 — 'shared_set' 이면 무관한 도서 해지에 함께 지워진다", () => {
    const [row] = assignmentWordsToVocabRows(UID, [{ w: 'gallop', m: '질주하다' }])
    expect(row?.origin).toBe(ASSIGNMENT_ORIGIN)
    expect(row?.origin).not.toBe('shared_set')
    expect(row?.origin).not.toBe('manual')
  })

  it('뜻이 없어도 행이 만들어진다 — meaning 은 NOT NULL 이다', () => {
    const [row] = assignmentWordsToVocabRows(UID, [{ w: 'gallop' }])
    expect(row?.meaning).toBe('')
  })

  it('표면형이 비면 버린다 — word 가 NOT NULL 이라 넣으면 전체 upsert 가 실패한다', () => {
    const words = [{ w: 'gallop' }, { w: '   ' }, { w: '' }] as Parameters<
      typeof usableAssignmentWords
    >[0]
    expect(usableAssignmentWords(words)).toHaveLength(1)
    expect(assignmentWordsToVocabRows(UID, words)).toHaveLength(1)
  })

  it('낱말이 없으면 빈 배열 — 빈 upsert 를 날리지 않는다', () => {
    expect(assignmentWordsToVocabRows(UID, [])).toEqual([])
    expect(assignmentWordsToVocabRows(UID, null)).toEqual([])
  })

  it('FSRS 상태를 적지 않는다 — 이미 배운 낱말의 이력을 덮어쓸 여지를 만들지 않는다', () => {
    const [row] = assignmentWordsToVocabRows(UID, [{ w: 'gallop', m: '질주하다', v: 7 }], new Set(['gallop']))
    expect(Object.keys(row ?? {}).sort()).toEqual([
      'lemma',
      'meaning',
      'origin',
      'user_id',
      'word',
    ])
  })

  it('사전에 있는 낱말만 lemma 를 채운다 — FK 위반 한 건이 전체 upsert 를 죽인다', () => {
    // `vocabularies.lemma` → `shared_dictionary(word)` FK (실측: vocabularies_lemma_fkey).
    // 사전에 없는 값을 적으면 **그 한 행 때문에 나머지 스무 개까지 못 담긴다.**
    const rows = assignmentWordsToVocabRows(
      UID,
      [{ w: 'gallop' }, { w: 'zzzznotaword' }],
      new Set(['gallop']),
    )
    expect(rows[0]?.lemma).toBe('gallop')
    expect(rows[1]?.lemma).toBeNull()
    // 두 행 모두 살아 있어야 한다 — 하나가 사전에 없다고 나머지를 버리지 않는다.
    expect(rows).toHaveLength(2)
  })

  it('아는 표제어를 안 넘기면 전부 NULL — 기본값이 안전한 쪽이다', () => {
    const [row] = assignmentWordsToVocabRows(UID, [{ w: 'gallop' }])
    expect(row?.lemma).toBeNull()
  })
})
