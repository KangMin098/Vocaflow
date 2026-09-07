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
  countUnplayable,
  usableAssignmentWords,
  type DictLookup,
} from '../assignment-vocab'

const UID = '00000000-0000-0000-0000-000000000001'

/** 사전에 있는 낱말 — 표제어가 실재하고 뜻도 있다. */
function dict(entries: Record<string, string | null>): Map<string, DictLookup> {
  return new Map(Object.entries(entries).map(([w, m]) => [w, { meaningKo: m }]))
}

describe('과제 낱말 → 단어장 행', () => {
  it("origin 은 'assignment' 다 — 'shared_set' 이면 무관한 도서 해지에 함께 지워진다", () => {
    const [row] = assignmentWordsToVocabRows(UID, [{ w: 'gallop', m: '질주하다' }])
    expect(row?.origin).toBe(ASSIGNMENT_ORIGIN)
    expect(row?.origin).not.toBe('shared_set')
    expect(row?.origin).not.toBe('manual')
  })

  it('과제에 뜻이 없으면 사전에서 채운다 — 빈 뜻이면 어떤 게임에도 안 나온다', () => {
    // `fetchDueGameWords` 가 `.neq('meaning','')` 로 거른다.
    // 채우지 않으면 단어장에 들어가고도 영영 안 풀리는 죽은 낱말이 된다.
    const [row] = assignmentWordsToVocabRows(UID, [{ w: 'gallop' }], dict({ gallop: '질주하다' }))
    expect(row?.meaning).toBe('질주하다')
  })

  it('교사가 보낸 뜻이 우선이다 — 학생이 과제 카드에서 본 것이 그것이다', () => {
    const [row] = assignmentWordsToVocabRows(
      UID,
      [{ w: 'gallop', m: '(말이) 전속력으로 달리다' }],
      dict({ gallop: '질주하다' }),
    )
    expect(row?.meaning).toBe('(말이) 전속력으로 달리다')
  })

  it('둘 다 없으면 빈 뜻으로 넣되 셀 수 있게 한다 — 조용히 버리지 않는다', () => {
    const rows = assignmentWordsToVocabRows(UID, [{ w: 'gallop' }, { w: 'run', m: '달리다' }])
    expect(rows[0]?.meaning).toBe('')
    expect(countUnplayable(rows)).toBe(1)
  })

  it('공백뿐인 뜻도 빈 것으로 본다 — DB 는 통과시키지만 게임은 거른다', () => {
    const [row] = assignmentWordsToVocabRows(UID, [{ w: 'gallop', m: '   ' }], dict({ gallop: '질주하다' }))
    expect(row?.meaning).toBe('질주하다')
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
    const [row] = assignmentWordsToVocabRows(
      UID,
      [{ w: 'gallop', m: '질주하다', v: 7 }],
      dict({ gallop: '질주하다' }),
    )
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
      dict({ gallop: '질주하다' }),
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
