// apps/web/src/lib/teacher/assignment-vocab.ts
//
// 과제 낱말 → 학습자 단어장 행. **서버 액션 밖에 두는 이유는 테스트 때문이다**
// (`'use server'` 파일은 async 함수만 내보낼 수 있어 순수 함수를 검사할 수 없다).
//
// 여기서 정하는 것 셋 — 셋 다 틀리면 조용히 아프다:
//   1. `origin` — 값마다 **삭제 의미가 다르다**
//   2. `meaning` — NOT NULL 이고, **비면 낱말이 게임에서 영영 안 나온다**
//   3. 빈 낱말 걸러내기 — 표면형이 없으면 `word` 가 NOT NULL 을 위반한다
//   4. `lemma` — **`shared_dictionary(word)` 로 가는 FK 가 걸려 있다**

import type { AssignmentWord } from './assignment-actions'

/**
 * 교사가 보낸 낱말의 출처.
 *
 * ⚠️ `'shared_set'` 을 재사용하면 안 된다 — `unenroll_library_book` 이 도서를 해지할 때
 *    그 학습자의 `origin='shared_set'` 낱말을 지운다. **무관한 도서를 해지했을 뿐인데
 *    선생님이 보낸 단어가 함께 사라진다.** `'manual'` 은 "학습자가 직접 넣었다" 는 뜻이라
 *    사실과 다르고, `'imported'` 는 파일 가져오기의 자리다.
 */
export const ASSIGNMENT_ORIGIN = 'assignment' as const

/**
 * 사전에서 가져온 보강 정보 — 표제어가 실재하는지와 뜻.
 *
 * 한 번의 조회로 둘을 다 얻는다(`shared_dictionary` 에 `word`·`meaning_ko` 가 같이 있다).
 */
export interface DictLookup {
  meaningKo: string | null
}

export interface VocabInsertRow {
  user_id: string
  word: string
  /**
   * 표제어 — **사전에 있는 낱말일 때만 채운다.**
   *
   * `vocabularies.lemma` 에는 `shared_dictionary(word)` 로 가는 FK 가 있다(2026-08-26 실측:
   * `vocabularies_lemma_fkey`). 사전에 없는 값을 적으면 **그 한 행 때문에 일괄 upsert 전체가
   * 실패**하고, 학생은 과제를 통째로 못 담는다. 낱말 하나가 사전에서 빠졌다는 이유로
   * 나머지 스무 개까지 잃을 이유가 없다.
   *
   * NULL 이면 SRS 키가 표면형이 된다 — 이상적이지는 않지만 **담기지 않는 것보다 낫다.**
   */
  lemma: string | null
  /**
   * 뜻 — **비면 그 낱말은 어떤 게임에도 안 나온다.**
   *
   * `fetchDueGameWords` 가 `.neq('meaning','')` 로 거른다(빈 뜻으로는 문제를 못 만든다).
   * 그래서 과제에 뜻이 없으면 사전에서 채운다 — 안 그러면 단어장에 들어가고도
   * 영영 안 풀리는 죽은 낱말이 된다. 둘 다 없으면 빈 문자열로 넣되(학습자가 고칠 수 있다),
   * 그 수를 호출부가 셀 수 있게 한다.
   */
  meaning: string
  origin: typeof ASSIGNMENT_ORIGIN
}

/** 담을 수 있는 낱말만 남긴다 — 표면형이 없으면 `vocabularies.word`(NOT NULL)를 못 채운다. */
export function usableAssignmentWords(words: AssignmentWord[] | null | undefined): AssignmentWord[] {
  return (words ?? []).filter((w) => typeof w?.w === 'string' && w.w.trim().length > 0)
}

/**
 * 단어장 행으로 옮긴다.
 *
 * FSRS 상태(difficulty·stability·next_review_at)는 **넣지 않는다** — 컬럼 기본값이 있고,
 * 이미 갖고 있던 낱말은 `ignoreDuplicates` 로 건드리지 않는다. 여기서 값을 적으면
 * 나중에 upsert 옵션이 바뀌었을 때 학습자의 학습 이력을 덮어쓸 여지를 만든다.
 */
export function assignmentWordsToVocabRows(
  userId: string,
  words: AssignmentWord[] | null | undefined,
  /**
   * `shared_dictionary` 조회 결과. 키에 있으면 표제어가 실재한다는 뜻이고,
   * `meaningKo` 는 과제에 뜻이 없을 때의 대체다.
   */
  dict: ReadonlyMap<string, DictLookup> = new Map(),
): VocabInsertRow[] {
  return usableAssignmentWords(words).map((w) => {
    const found = dict.get(w.w)
    // 교사가 보낸 뜻이 우선이다 — 학생이 과제 카드에서 본 것이 그것이다.
    const meaning = (w.m ?? '').trim() || (found?.meaningKo ?? '').trim()
    return {
      user_id: userId,
      word: w.w,
      lemma: found ? w.w : null,
      meaning,
      origin: ASSIGNMENT_ORIGIN,
    }
  })
}

/** 뜻이 비어 게임에 못 나올 낱말 수 — 호출부가 사실대로 말할 수 있게. */
export function countUnplayable(rows: readonly VocabInsertRow[]): number {
  return rows.filter((r) => r.meaning.length === 0).length
}
