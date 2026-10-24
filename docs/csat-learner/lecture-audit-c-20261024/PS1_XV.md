# PS1-XV — PASS 표본 재검(seed12345 인덱스 0~11)

- 재검자: PS1-XV(원 작성자 아님, 원 판정 미참조 전제). 내부 검토이며 사람 콘텐츠 승인이 아니다.
- 근거: 강의 `apps/web/src/lib/csat/lecture-data/*.json`(작업 공간 HEAD), DB `csat_items` stem·passage·choices·answer(s) SELECT.
- 10항 검증 전부 수행. 서수 표기·의도 단정은 KNOWN_B 로 세지 않음.

| item_id | 판정 | 확인 요지 |
|---|---|---|
| M2109#23 | PASS_CONFIRMED | 정답① 일치, s3 the trick 전환·s4~5 근거, 오답 4개 소거 원문 정합 |
| M2606#18 | PASS_CONFIRMED | 정답① 일치, wondering/Again 두 번 묻기, ② 광산 경력 함정 정합 |
| 2016#36 | PASS_CONFIRMED | 정답④(C)-(A)-(B), this avoidance training·however·the child 사슬 정합 |
| 2019#38 | PASS_CONFIRMED | 정답③, But…by hand 가 필사 장점 제한, 문장 위치·소거 정합 |
| M2509#36 | PASS_CONFIRMED | 정답⑤(C)-(B)-(A), would·The adjustments·larger 신호 정합 |
| M2409#39 | PASS_CONFIRMED | 정답③, This is because 이유-주장 짝, ④ critics 겹침 함정 정합 |
| 2021#24 | PASS_CONFIRMED | 정답③, time-based·added time 방향, ② 방향 뒤집기 정합 |
| 2019#25 | PASS_CONFIRMED | 정답③, 9,000→186,000(20배↑)·China 1위로 뒤 절 오류, 나머지 계산 정합 |
| M2306#19 | PASS_CONFIRMED | 정답① worried→delighted, s2 concern·s7~8 감탄, 오답 정합 |
| 2017#38 | PASS_CONFIRMED | 정답②, tactically weak 이유·them 지시 대상, 소거 정합 |
| M2306#32 | PASS_CONFIRMED | 정답④, Instead of 배제 목록·self-contained, ③ 역사 어휘 함정 정합 |
| M2606#22 | PASS_CONFIRMED | 정답①, 정보/의미 정의·Interpretation at the core, 오답 정합 |

- 집계: PASS_CONFIRMED 12 · ISSUE_FOUND 0 · REVIEW_REQUIRED 0.
- 적용 한계 메모(신규 결함 아님): M2109#23 c12 「역접 없어도 인정하라는 동사 뒤가 주장」, M2606#22 c13 「마지막 문장이 요지」는 일반 규칙으로 쓰면 반례 가능 — 이 문항에서는 원문과 맞음.
