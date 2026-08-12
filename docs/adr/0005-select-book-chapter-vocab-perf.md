# ADR 0005 — `select_book_chapter_vocab` 성능: 대작이 학습자에게 못 가는 이유

**상태**: Proposed (적용 대기 — 검증 도구가 DDL 을 요구하는데 MCP 연결이 끊긴 상태)
**작성**: 2026-08-12

## 문제

이 함수는 발행·재발행·품질게이트가 **모두** 거치는 단일 경로다. 그런데 30초
`statement_timeout` 에 걸려 대작이 통째로 막힌다:

| 도서 | lbv 행 | 결과 |
|---|--:|---|
| Pride and Prejudice | 4,516 | 774 ms |
| A Christmas Carol | 3,474 | 800 ms |
| Treasure Island | 4,145 | 2,462 ms |
| **Les Misérables** | **13,364** | **30초 초과 — 재발행 2회 실패** |

행 수에 **선형이 아니다**. 4,000행대가 1초 안팎인데 13,364행이 30초를 넘긴다.

막힌 도서는 `Les Misérables`(학습대상 5,690단어)만이 아니다. 분절을 고치며 재추출한
대작들(Plato 114만 단어 · Proust 122만 · Gibbon 108만)도 발행 시 같은 벽에 부딪힌다.
**추출 품질을 아무리 올려도 이 함수를 통과하지 못하면 학습자에게 0이다.**

## 원인 가설

핵심은 표제어 바인딩 CASE 다:

```sql
JOIN shared_dictionary sd ON sd.word = CASE
  WHEN EXISTS (SELECT 1 FROM shared_dictionary x
               WHERE x.word = lower(bv.word)
                 AND x.classified_by IS NOT NULL
                 AND x.meaning_ko IS NOT NULL AND length(x.meaning_ko) > 0)
  THEN lower(bv.word)
  ELSE resolve_dict_headword(COALESCE(bv.lemma, bv.word))
END
```

**행마다 `shared_dictionary` 를 2회 친다** — 상관 서브쿼리(EXISTS) + `resolve_dict_headword`
(그 함수 안에서도 여러 조회를 한다). 13,364행이면 26,728회 이상이고, 상관 서브쿼리라
플래너가 해시 조인으로 바꾸지 못한다.

Treasure Island 실측에서 버퍼 접근이 **61,888 페이지(약 483MB)** 였다 — 도서 한 권
처리에 그만큼을 훑는다. NANO/MICRO 급에서는 이것만으로 캐시가 밀린다.

## 제안

CASE 안의 EXISTS 를 `LEFT JOIN` 으로 바꾼다:

```sql
LEFT JOIN shared_dictionary direct
       ON direct.word = lower(bv.word)
      AND direct.classified_by IS NOT NULL
      AND direct.meaning_ko IS NOT NULL AND length(direct.meaning_ko) > 0
JOIN shared_dictionary sd
       ON sd.word = COALESCE(direct.word, resolve_dict_headword(COALESCE(bv.lemma, bv.word)))
```

두 가지가 달라진다:

1. **상관 서브쿼리 → 조인** — 플래너가 해시 조인을 쓸 수 있다.
2. **`resolve_dict_headword` 호출이 줄어든다** — `COALESCE` 는 단락 평가라
   `direct.word` 가 NOT NULL 이면 함수를 부르지 않는다. 대부분의 단어가 표면형으로
   직접 매칭되므로 호출 자체가 크게 준다.

의미는 동일하다. 기존 CASE 의 조건과 `direct` 조인 조건이 같은 술어이고,
`shared_dictionary.word` 가 PK 라 `direct` 는 행을 늘리지 않는다.

## 왜 아직 적용하지 않았나

**결과가 한 행이라도 바뀌면 안 되는 로직**이다. 이 함수의 출력이 곧 학습자가 받는
단어이고, 정렬(`sort_order`)까지 발행에 그대로 쓰인다.

검증은 "현행 스냅샷 → 개선 → 전수 대조" 여야 하는데, 그 대조 도구를 만들 수 없다:

- PostgREST 가 RPC 결과를 **1,000행으로 자른다**(`db-max-rows`). `.range()` 로도 못 넘긴다.
- 그래서 결과를 서버에서 요약(개수·해시)하는 함수가 필요한데 **그것도 DDL** 이다.

즉 MCP 연결이 돌아와야 검증과 적용을 함께 할 수 있다. 검증 없이 적용하는 건
이 함수에서는 하지 않는다.

## 적용 시 절차

1. 대조용 요약 함수 추가 — 도서별 `(chapter_idx, lemma, sort_order)` 목록의 해시와 행 수
2. 전 도서(316권) 현행 해시 스냅샷
3. 개선 함수 적용
4. 전 도서 재해시 → **한 권이라도 다르면 즉시 롤백**
5. 통과 시 `Les Misérables` 재발행으로 timeout 해소 확인

## 대안 (개선이 부족할 경우)

`resolve_dict_headword` 결과를 `library_book_vocabularies` 에 캐시하는 방안이 있다
(`backfill_book_lemmas` 가 이미 lemma 를 채우므로 같은 자리에). 스키마 변경이라
비용이 크지만, 조인 최적화로도 대작이 안 되면 그쪽이 근본 해법이다.
