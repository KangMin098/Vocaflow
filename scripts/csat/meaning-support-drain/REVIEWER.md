# v3.1 원문 이해 교수 설명 — 독립 검수 지침 (기준 `meaning-support-v1.0`)

정본: `docs/csat-learner/v31/CONTENT_REVIEW_CRITERIA.md`. 작성 세션과 **분리된 세션**이 맡는다. 작성자의 자기평가 · 합리화 · 예상 답을 받지 않는다.
입력: `input-<id>.json`(원문 · 발문 · 선지 · 공개 v3) + `support-<id>.out.json` 의 support 전체. 기존 해설은 비교 자료이지 정답지가 아니다.
해시: `node scripts/csat/meaning-support-hash.mjs --item <id>` 의 현재 값.

판정 파일 `review-<라벨>.json`:
```json
{ "reviewer": "ms-rv-<라벨>", "criteria": "meaning-support-v1.0",
  "verdicts": [ { "itemId": "2026#34", "verdict": "pass | revise | hold", "content_hash": "…", "binding": { …support.binding }, "schema": "meaning-support/1",
                  "codes": ["MS02"], "why": "한국어 · revise/hold 면 구체적 수정안 또는 필요한 근거" } ] }
```

| ID | 확인 |
|---|---|
| MS01 | 주체 · 술어 · 대상 · 화자 · 수식/절 결합이 원문 문맥과 맞음 |
| MS02 | 쉬운 말이 주체 · 조건 · 부정 · 범위 · 가능성 · 시간 · 지시 · 비교를 보존(may→항상, 일부→전부, 조건 삭제는 revise) |
| MS03 | 구문 부분과 재결합 뜻 일치 · 원문 오류와 교정 예 구별 |
| MS04 | 두 명제의 연결과 실제 의미 변화가 설명됨(접속사 이름만이면 revise) |
| MS05 | 전체 이해가 명제 · 관계 · 사건 · 예외와 일관 · 유형에 다른 논리 구조 강요 없음 |
| MS06 | 명시 정보 · 연결 추론 · 비유/확장의 근거와 한계 구별 · 외부 상식을 원문 사실로 승격하지 않음 |
| MS07 | 문항 성립 · 설계 연결(bridges)의 실제 referent 확인 · 출제자 속마음 단정 없음 |
| MS08 | 문장 · 구절 · 범위 · 중복 occurrence · 읽기 순서 결속 |
| MS09 | 원본 도표 미확인 수치 보류 · 서사 화자/층위 · 공유 지문 · 위치 선지 예외 처리 |
| MS10 | 새 영어 인용 0 · 기존 8단어 표현 재사용 · 한국어로 원문 전체를 우회 재구성하지 않음 |

- 모든 적용 항목에 문제 없을 때만 **pass**. 내용 오류면 **revise**, 필수 근거 · 원문이 없으면 **hold**. 필요 없는 지원(구문 · 오해)은 n/a 로 두고 빈 값을 요구하지 않는다.
- 유창하다는 이유로 원문에 없는 주장을 통과시키지 않는다. 다른 가능한 읽기는 why 에 남긴다.
