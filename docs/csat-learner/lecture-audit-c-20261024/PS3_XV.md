# PS3-XV — PASS 표본 재검(pass_sample_seed12345 인덱스 24~35)

재검자 PS3-XV(원 작성자 아님). 원 판정을 참조하지 않고 강의 cue 전문(`apps/web/src/lib/csat/lecture-data/*.json`)과 DB `csat_items`(passage·choices·answer·answers, SELECT 전용)를 대조해 10항 검증을 했다. 서수와 anchor가 하나씩 어긋나는 것(KNOWN_B)은 세지 않았다. 내부 검토이며 학습 효과는 NOT_EVALUATED.

| item_id | 공식 정답 | 판정 | 비고 |
|---|---|---|---|
| M2509#30 | 5 | PASS_CONFIRMED | 믿음/사실 두 층, ⑤ rationality→irrationality. 오답 ①~④ 위치·논리 일치 |
| M2006#26 | 2 | PASS_CONFIRMED | or(어느 하나만 한 크기) vs 합친 크기. 나머지 문장 대응 정확 |
| 2025#31 | 1 | PASS_CONFIRMED | 8·9문장 feels close / whole person 근거. ④ 함정 처리 타당 |
| M2006#44 | 5 | PASS_CONFIRMED | (e)=Master Brooks(Father 호칭). (a)~(d)=Joe 일치 |
| M2306#40 | 1 | PASS_CONFIRMED | passive container·at rest → necessary, exclusion → inequality |
| M2106#45 | 2 | PASS_CONFIRMED | (B) 귀갓길 light and full of joy. 시점 함정 설명 타당 |
| M2209#43 | 4 | PASS_CONFIRMED | In that class→D, roommate's words→B, Wait!→C |
| M2206#27 | 5 | PASS_CONFIRMED | No photography is allowed. ①~④ 일치 |
| M2206#41 | 3 | PASS_CONFIRMED | adapt·reinterpreted 근거, 오답 범위 과소/과잉 처리 타당 |
| M1809#45 | 2 | PASS_CONFIRMED | (B) finally proud. 시점 함정(D still) 설명 정확 |
| M2309#26 | 3 | PASS_CONFIRMED | continued his work ↔ 중단. 수동태 영향 방향 확인 |
| M2409#30 | 4 | PASS_CONFIRMED | This(단절의 원인)→countered 아닌 created. ⑤ 검산 연결 타당 |

요약: 12건 모두 PASS_CONFIRMED. ISSUE_FOUND 0, REVIEW_REQUIRED 0. 12건 모두 원문을 직접 읽었다.
