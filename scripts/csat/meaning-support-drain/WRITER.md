# v3.1 원문 이해 교수 설명 — 작성 지침 (schema `meaning-support/1`)

정본 계약: `docs/csat-learner/v31/MEANING_SUPPORT_DESIGN.md` §1 · §5 · §6 · §7. 입력 `input-<id>.json`(원문 포함 · 커밋 안 함) → 출력 `support-<id>.out.json`(커밋).

## 목적
학습자가 영어 문장의 **의미를 형성**하고, **쉬운 말**로 바꾸되 **주체 · 조건 · 부정 · 범위 · 가능성 · 시간 · 지시 · 비교를 보존**하고,
문장을 **연결**해 글 전체를 이해하도록 돕는 설명이다. 번역 · 구문 라벨 · 정답 요령을 늘어놓는 일이 아니다. 정답 번호를 출발점으로 삼지 않는다.

## 출력 모양
```json
{ "writer_run": "ms-wr-<id>", "status": "ok | needs_source | needs_review | not_applicable", "reason": "ok 가 아닐 때 필수",
  "support": {
    "schema": "meaning-support/1", "itemId": "2026#34",
    "binding": { "analysisVersion": 5, "unitsHash": "…", "basePublicHash": "…", "sourceSnapshotHash": "…" },  // 입력 binding 그대로
    "sourceRef": { "organizer": "kice", "examId": "2026", "itemNo": 34, "inputRef": "입력 inputRef" },
    "defaultUnitId": "u1",
    "anchors": [ { "id": "a1", "sentence": 7, "quote": "then the law cannot be", "occurrence": 1, "mode": "original" } ],
    "propositions": [ { "id": "p1", "textKo": "…", "basis": "source_observation", "anchorIds": ["a1"], "warrantsKo": [], "limitKo": "" } ],
    "units": [ { "id": "u1", "sentences": [6, 7], "legacyMeaningIds": ["m1"], "labelKo": "짧은 이름", "exactKo": "정확한 뜻", "simpleKo": "쉬운 말 하나",
                 "propositionIds": ["p1"], "preserves": [ { "facet": "condition", "valueKo": "…", "anchorIds": ["a1"], "explanationKo": "…" } ],
                 "syntax": { "parts": [ { "id": "s1", "role": "main", "anchorIds": [], "meaningKo": "…" } ], "attachments": [ { "fromPart": "s2", "toPart": "s1", "whyKo": "…" } ], "recombinedKo": "…" },
                 "misunderstanding": { "alteredKo": "최소 변형 오해", "lostFacet": "condition", "whyWrongKo": "…", "anchorIds": ["a1"] } } ],
    "relations": [ { "id": "r1", "from": ["u1"], "to": ["u2"], "kind": "condition", "beforeKo": "앞 의미", "afterKo": "뒤 의미", "changeKo": "실제로 무엇이 바뀌나",
                     "propositionIds": [], "anchorIds": [], "basis": "source_observation", "warrantsKo": [], "limitKo": "" } ],
    "whole": { "genre": "argument", "summaryKo": "유형에 맞는 1~2문장 전체 이해", "propositionIds": [], "relationIds": ["r1"], "limitsKo": [] },
    "bridges": [ { "unitId": "u1", "meaningIds": ["m1"], "choiceNumbers": [3], "designClaimIndices": [0] } ]
  } }
```

## 규칙
1. **unit 2~4개**만 — 학습자에게 실제로 도움이 필요한 의미부터. 모든 문장을 다루지 않는다. syntax · misunderstanding 은 필요한 unit 에만.
2. **영어 인용 예산 0** — `anchors[].quote` 는 입력 `v3.meanings[].expression` 안의 연속 구절만, 8단어 이하. 새 영어를 쓰지 않는다. 기존 인용 밖을 가리키려면 quote 없이 `sourceRange`(공백 정규화 문장 기준 0-기반 UTF-16 [start,end), spanHash=그 구간 SHA-256)를 쓴다. 설명 한국어 안에도 원문 영어를 새로 옮기지 않는다.
3. 문장 번호는 입력 sentences 의 n(인쇄 순서). 삽입 문항의 입력 1번은 주어진 문장이다 — 지문 첫 문장으로 다루지 않는다. 순서 · 장문은 원래 번호를 유지한다.
4. **쉬운 말이 한정을 잃지 않는다** — may/might · Often · only · Unless · cannot · almost · more than twice · second highest 같은 한정을 보존하고 `preserves` 에 적는다. facet 을 비우려면 「보존할 한정이 없다」는 판단이어야 한다.
5. **관계는 이름이 아니라 변화** — `changeKo` 에 무엇을 인정하고 무엇을 유지 · 제한 · 수정하는지 적는다. 실제 선행 조건을 「바로 앞 문장」으로 고정하지 않는다.
6. **명시 / 연결 추론 / 설명용 확장 구별** — basis 가 source_observation 이 아니면 warrantsKo(연결 이유)와 limitKo(경계) 필수. 비유는 설명용임을 밝힌다. 외부 상식을 원문 사실로 쓰지 않는다.
7. **어법 · 오류** — 원문 오류를 조용히 고치지 않는다. 교정 예는 `syntax.correction` 에만, anchor 는 실제 원문에만.
8. **도표** — 입력에 도표 본체가 없으면 수치 사실을 확정하지 않는다. 언어 명제(배수 · 순위 · 범주)만 설명하고 `support.partial = { scope: ["language"], withheldKo: "원본 도표 확인 전 수치 판단 보류" }`.
9. **bridges** 는 실제 연결만 — `choiceNumbers` 는 그 선지의 `meaning_ids` 가 같은 의미를 실제로 가리킬 때만, designClaimIndices 는 `v3.design.claims` 의 인덱스.
10. 출제자 속마음 단정 · 「항상 · 반드시」 같은 보편 단정 금지. 전체 번역을 쓰지 않는다. 국내 강사 · 교재 설명을 복제하지 않는다.
11. 끝에 `node scripts/csat/meaning-support-validate.mjs --item <id>` 가 오류 0 이어야 한다. 원문 · 결속이 맞지 않으면 status 를 ok 로 두지 않는다.
