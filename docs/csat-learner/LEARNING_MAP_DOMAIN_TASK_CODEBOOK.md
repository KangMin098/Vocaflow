# 학습 지도 rev4.0 — 영역 · TASK 코드북(설계 제안 · 2026-10-10)

> **생성 문서 — 손으로 고치지 않는다.** 원천: [v4/codebook.json](./v4/codebook.json) · 기준 실측: [v4/asis-snapshot.json](./v4/asis-snapshot.json)(개발 DB 읽기 전용).
> 다시 그리기: `node scripts/csat/map/v4/render-codebook.mjs` · 무결성: `node --test scripts/csat/map/v4/__tests__/codebook.test.mjs`.
> 정본은 [LEARNING_MAP_VNEXT.md](./LEARNING_MAP_VNEXT.md) rev2.1 이다. 이 코드북은 정본을 바꾸지 않는다 — TASK 정의는 정본 §3 후보에 수행 목표 · 조건 · 관찰 · 기준을 **덧붙인 제안**이다.
> 근거 구분: **[실측]** DB · 코드에서 읽은 값 · **[정본]** rev2.1 승인 내용 · **[제안]** 이 문서의 설계 · **[가설]** 검증 안 됨.

## 1. 요약

- [실측] 라인 54 · 과제(활동) 183 · 라인↔문항 연결 148.
- [제안] rev4 TASK 30개 — 상태 canon_candidate 21 · hold 9 · 직접 확인 content_needed 14 · ready 2 · live 5 · blocked 9. **새로 발명한 TASK 는 0** — 모두 정본 §3 후보 · 학습자 화면 듣기 4단계에서 왔다(`proposed` 상태 0). 이전 설계의 「36개 수행 TASK」 목록은 저장소에서 찾지 못했다(2026-10-10 grep) — 그래서 대조 기준을 정본 후보로 삼았다.
- [제안] 라인 판단: 유지 2 · 분할 5 · 재분류 37 · 보류 7 · 통합 3. 수행 목표 성격 라인 11 — **지금 학습 요구를 만들 수 있는 것**: A1 · A2 · A3 · A5 · A8 · **목표 성격이지만 대상 TASK 가 모두 보류(요구 0)**: A7 · A9 · J1 · J2 · J3 · J5.
- [제안] 활동 분류: DC 55 · LM 31 · LA 45 · MC 24 · MG 28 — LA=학습 활동(연습) · DC=직접 확인 과제(실패 지점·성취를 관찰 — FIND/CHECK) · LM=학습 방법·절차(어떻게 공부하나) · MC=자료·콘텐츠 묶음(모음 풀이·읽을거리) · MG=관리용 체크리스트·메타데이터(기록·일정·다른 라인으로 보내기). **수행 목표 TASK 로 분류된 활동은 0** — DB 의 `csat_map_task` 는 이름과 달리 전부 활동 · 확인 · 방법 · 자료 · 관리 항목이다.
- [실측] 앱 안에서 실제로 실행되는 활동: B6-3(live) · A4-4(live) · A5-4(live) · A3-4(draft). 나머지 179개는 체크리스트(완료 토글)뿐이다.

## 2. 영역(6축) 재검토

| 축 | 이름 | 기존 라인 | 현재 proxy | 독립성 | 관찰 가능성 | 교수 가능성 | 성장 | 전이 | 한국 평가 관련성 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| V | 어휘·표현 의미 | A1 | A1 | 높음 — 문맥 밖 의미 접근은 다른 축 없이 관찰된다 | 직접 확인 도구 0(content_needed) | 높음 — 간격 반복·문맥 확인 | 누적 | V4 가 E3 선지 대응으로 전이 | 어휘 문항·전 유형의 기반 |
| S | 문장 이해 | A2 · A8 | A2+A8 | 높음 | S 직접 확인 과제 A2-4 1개(기출 밖 활동) · 채점 도구 0 | 높음 — 끊어 읽기·풀어 쓰기 | 단계적 | S-O1 이 R 전체의 재료 | 어법 문항(B9) + 전 독해 유형 |
| R | 글 이해 | A3 | A3+A6(legacy — A6 는 K) | 중간 — E 와 같은 문항에서 함께 관찰된다 | structure live · relation ready | 높음 — §13 Protocol | LP3→LP5 | R2 관계 facet 이 E3 relation_consistency 로 | 대의·빈칸·순서·삽입·요약의 주 처리 |
| E | 근거·선지 판단 | A5 | A4+A5 | 중간 — R 과 분리 유지(정본) | option·evidence live | 높음 — 근거 위치·선지 대응 | LP6 | 새 유형 문항 | 5지선다 전부 |
| L | 듣기 | A7 | A7 | 높음 | blocked — 대본·시점 증거 0 | 높음 | 누적 | — | 17문항(1–17번) |
| X | 실전 | A9 | A9 | 높음 — 영어 능력과 분리 | blocked — 문항별 시간 유효 데이터 0 | 중간 | 회차 반복 | 모든 시험 | 70분 45문항 |

> [실측] DB 의 「축」 노드는 A · B · C · D · I · J 6개다(본질 역량 · 문항 유형 · 선지 함정 · 풀이 습관 · 공부 방법 · 시험 운영). V/S/R/E/L/X 는 `lib/csat/map/core.ts` 가 A1–A9 를 묶어 **계산하는 표시 층**이고 DB 노드가 아니다. 보고서의 「6개 핵심축 V/S/R/E/L/X」와 「A/B/C/D/I/J 54라인」은 서로 다른 6이다.

## 3. rev4 TASK 정의

| 표시 | 영구 ID | 축 | 종류 | 상태 | 이름 | 수행 목표 | 조건 | 관찰 증거 | 정성 성취 기준 | 정량 계획 정책 | 직접 확인 | 방법(기존 라인·과제) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| V1 | `v.core_meaning` | V | 원자 | canon_candidate | 기본 의미 접근 | 시험 빈도 낱말의 기본 의미를 문맥 없이도 바로 꺼낸다 | 고등 기출 빈도 어휘 · 시간 제한 없음 | 낱말 → 뜻 인출 정답(독립 첫 시도) | 도움 없이 맞히고, 다른 날 다시 맞힌다 | 모르는 낱말 수 기준 간격 반복 분량(FSRS due) | content_needed | I6 · A1-2 |
| V2 | `v.contextual_sense` | V | 원자 | canon_candidate | 문맥 의미 선택 | 다의어에서 이 문장에 맞는 의미를 고른다 | 기출 지문 문장 안 | 문맥 의미 선택 정답 + 근거 낱말 지목 | 서로 다른 문맥 2개 이상에서 맞힌다 | 확인 문항 묶음 단위 | content_needed | I6-3 · B9-2 |
| V3 | `v.multiword` | V | 원자 | canon_candidate | 덩어리 표현 | 구·숙어·연어를 한 의미 단위로 읽는다 | 기출 지문 | 덩어리 경계·의미 정답 | 낱낱 해석으로 바꾸지 않고 의미를 말한다 | 표현 목록 간격 반복 | content_needed | I6 |
| V4 | `v.semantic_relation` | V | 원자 | canon_candidate | 표현 사이 의미 관계 | 유의·반의·상하위 표현의 의미 동등성을 판단한다 | 본문 표현 ↔ 다른 표현 | 두 표현이 같은 뜻인지 판정 + 이유 | 재진술 쌍을 가려낸다 | 확인 문항 묶음 | content_needed | A4-2 |
| S1 | `s.sentence_core` | S | 원자 | canon_candidate | 문장 뼈대 | 주어·서술어·목적어·보어를 찾는다 | 기출 긴 문장 | 뼈대 표시 정답 | 3문장 이상 연속 정확 | 막힌 문장 수집량 기준 | content_needed | I2 · A2-2 |
| S2 | `s.chunk_boundary` | S | 원자 | canon_candidate | 의미 단위 경계 | 구·절 경계를 끊어 읽는다 | 기출 문장 | 경계 표시 | 경계 오류 없이 풀어 쓴다 | 문장 묶음 | content_needed | I2 |
| S3 | `s.attachment` | S | 원자 | canon_candidate | 수식 관계 | 무엇이 무엇을 꾸미는지 정한다 | 수식어가 긴 문장 | 피수식어 지목 | 다른 문장에서도 맞힌다 | 문장 묶음 | content_needed | I2 |
| S4 | `s.structural_relation` | S | 원자 | canon_candidate | 구조 관계 | 병렬·종속·삽입·생략·도치를 풀어낸다 | 복합 구조 문장 | 구조 복원 정답 | 풀어 쓰기가 원문 의미와 같다 | 문장 묶음 | content_needed | I2 · A2-3 |
| S5 | `s.form_scope` | S | 원자 | canon_candidate | 형태·의미 범위 | 문법 형태와 부정·비교·조건의 범위를 판단한다 | 어법 문항 + 독해 문장 | 어법 판정 + 이유 | 포인트별 서로 다른 문항 2개 이상 | 포인트별 기출 반복 | content_needed | A8-2 · B9-1 |
| S-O1 | `s.o.sentence_meaning_model` | S | 통합 관찰 | canon_candidate | 문장 의미 구성(통합 관찰) | 한 문장의 명제와 핵심·부가 정보를 우리말로 구성한다 | 기출 문장 · 도움 없이 | 명제 풀어 쓰기 | 숙달도 계산 없음 — 관찰 기록만 | 없음(통합 관찰) | content_needed | A2-4 |
| R1 | `r.reference` | R | 원자 | canon_candidate | 지시·응집 추적 | 대명사·지시어·같은 개념의 연결을 추적한다 | 기출 지문 | 지시 대상 지목 | 서로 다른 지문 2개 | 확인 문항 묶음 | ready | B11-1 |
| R2 | `r.relation` | R | 원자 | canon_candidate | 문장 사이 관계 | 인접 문장의 관계(인과·대조·예시·재진술 …)를 구성한다 | 기출 지문 · relation facet 기록 | 관계 종류 + 근거 단서 | facet 별 막대 없음 — 관찰 근거 내역만 | 확인 문항 묶음 | ready | A3-1 |
| R3 | `r.discourse_function` | R | 원자 | canon_candidate | 문장·문단 기능 | 이 문장이 지금 하는 역할(근거·예시·반론 …)을 말한다 | 기출 지문 | 역할 표시 | §20-2 하향 조건 — Gold tagging 에서 R4 와 독립 관찰 확인 전 잠정 | 확인 문항 묶음 | live | A3-2 |
| R4 | `r.discourse_structure` | R | 원자 | canon_candidate | 글 전개 구조 | 역할들이 모여 만드는 전개 방식을 재구성한다 | 기출 지문 | 구조 유형 + 근거 | R3 와 다른 근거로 관찰될 때만 독립 | 확인 문항 묶음 | live | I1 |
| R5 | `r.central_meaning` | R | 원자 | canon_candidate | 중심 의미 | 중심과 부연을 가르고 핵심 주장을 한 줄로 압축한다 | 주제·요지·제목 지문 | 한 줄 요지 + 중심 문장 | 서로 다른 지문 2개 독립 확인 + 다른 날 재확인 | 확인 9문항 묶음(claim-support) 기준 | live | I1-3 · I5-1 |
| R6 | `r.inference` | R | 원자 | canon_candidate | 추론 | 쓰이지 않은 의미를 글 근거로 도출한다 | 함축·빈칸 지문 | 추론 + 근거 문장 | 근거 없는 추론은 실패 | 확인 문항 묶음 | content_needed | B7-1 |
| R-O1 | `r.o.global_meaning_model` | R | 통합 관찰 | canon_candidate | 글 전체 의미 모델(통합 관찰) | 글 전체의 일관된 의미를 구성한다 | 장문·고난도 | 구조도 + 요지 | 숙달도 계산 없음 | 없음 | content_needed | I1 |
| E1 | `e.task_demand` | E | 원자 | canon_candidate | 발문 요구 파악 | 발문이 요구하는 판단을 정확히 말한다 | 모든 유형 | 요구 진술 | 유형 2개 이상 | 확인 문항 | content_needed | B1-1 |
| E2 | `e.evidence_location` | E | 원자 | canon_candidate | 근거 위치 | 판단을 정하는 본문 근거 문장을 특정한다 | 빈칸 지문 등 | 근거 문장 지목(Evidence Anchor 결속) | 서로 다른 확인 문항 2개 독립 정답 → 다른 날 재확인 | 확인 5문항 묶음 | live | A5-1 |
| E3 | `e.option_correspondence` | E | 원자 | canon_candidate | 선지-본문 대응 | 선지가 본문의 어떤 의미를 다시 말했는지(또는 바꿨는지) 판단한다 | 주제·제목·요지 지문 · judgment facet 기록 | 대응 본문 문장 지목 | facet 별 막대 없음 · 함정 선택만으로 약함 판정 금지 | 확인 6문항 묶음 | live | A5-2 · B6-3 |
| E-O1 | `e.o.final_judgment` | E | 통합 관찰 | canon_candidate | 최종 판단(통합 관찰) | 정답 선택과 배제 이유를 함께 낸다 | 정답 + 과정 근거 | 선택 + 근거 + 배제 이유 | 추측 정답은 근거 아님 | 없음 | content_needed | I9 |
| L1 | `l.sound` | L | 원자 | hold | 소리 인식 | (보류) 연음·약음을 낱말로 인식 | — | — | — | — | blocked | I7 |
| L2 | `l.sentence` | L | 원자 | hold | 들은 문장 이해 | (보류) | — | — | — | — | blocked | I7 |
| L3 | `l.retain` | L | 원자 | hold | 정보 유지 | (보류) | — | — | — | — | blocked | B3-1 |
| L4 | `l.respond` | L | 원자 | hold | 응답 판단 | (보류) | — | — | — | — | blocked | B4-1 |
| X1 | `x.time_allocation` | X | 원자 | hold | 시간 배분 | (보류 §20-4) 영역·문항 시간 배분을 지킨다 | 실전 70분 | 문항별 시간(유효 데이터 0) | — | — | blocked | J1 |
| X2 | `x.sequence` | X | 원자 | hold | 풀이 순서 | (보류) | — | — | — | — | blocked | J2 |
| X3 | `x.recovery_adaptation` | X | 원자 | hold | 막힘 회복 | (보류) | — | — | — | — | blocked | J3 |
| X4 | `x.attention_stamina` | X | 원자 | hold | 집중 유지 | (보류) | — | — | — | — | blocked | J5 |
| X-O1 | `x.o.whole_test_stability` | X | 통합 관찰 | hold | 전체 시험 안정성(통합 관찰) | (보류) | — | — | 숙달도 계산 없음 | — | blocked | I4 |

- 통합 관찰(*-O1)은 TASK 로 계획 · 확인 대상이 되지만 **숙달도 · 막대를 계산하지 않는다**(정본 §3 머리말).
- TASK 가 아닌 층: `k.context_resource` 축 밖 지식·맥락 자원(A6) — 막대·목표·부족 판정 없음 · `context.performance` Performance Context(J4 · J5 컨디션) — 막대 없음 · `lens.question_type` Question Lens(B1–B13) — 어디서 관찰되나 · `feature.choice_trap` Item Feature(C1–C8) — 문항 쪽 특성 · `pedagogy.method` 학습 방법(I1–I10 · D6 · D8) · `plan.allocation` 학습 배분(D9) · `retired` vNext 개념에서 퇴출(D1 · D2 · D4 · D7) — 행 보존 · `legacy.alias` 옛 화면 · 데이터를 읽기 위한 별칭(D3) — 개념으로 쓰지 않음.

## 4. 라인 54 전수 감사

| 라인 | 명칭 | 현재 소속 | crosswalk(rev2.1) | 판단 | 목적 층 | 교육적 역할 | 수행 목표 | 연결 문항(item_no) | 연결 유형 | 관찰 가능한 수행 | 학습 방법 | 평가 방법 | rev4 TASK 후보 | 과제 | 판단 근거 | 검증 상태 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A1 | 어휘 | A 축 | retain_core | 유지 | domain | V 축 근거 | 예 | 0 | — | 어휘 인출·문맥 의미 | 간격 반복·문맥 확인 | 직접 확인 도구 필요 | `v.core_meaning` `v.contextual_sense` `v.multiword` `v.semantic_relation` | 3 | crosswalk §A retain_core — 정의만 「어휘·표현 의미」로 확장 | content_needed |
| A2 | 구문 | A 축 | retain_core | 분할 | domain | S 축 근거 | 예 | 0 | — | 뼈대·경계·풀어 쓰기 | 문장 풀어 쓰기(I2) | A2-4 직접 확인(채점 도구 없음) | `s.sentence_core` `s.chunk_boundary` `s.attachment` `s.structural_relation` `s.o.sentence_meaning_model` | 4 | 구문 하나가 S1–S4 + S-O1 로 갈린다(§3 S) | content_needed |
| A3 | 논리 흐름 | A 축 | retain_core | 분할 | domain | R 축 근거 | 예 | 0 | — | 참조·관계·역할·구조 | §13 Protocol 2–3 | cohesion-link · claim-support | `r.reference` `r.relation` `r.discourse_function` `r.discourse_structure` | 4 | 「논리 흐름」이 참조·관계·기능·구조로 나뉜다(crosswalk §A) | partial_live |
| A4 | 재진술 | A 축 | retain_as_facet | 분할 | facet | 재진술 — paraphrase 세 층 | 아니오 | 0 | — | 표현 동등성 | 재진술 사슬 | option-restate(A4-4 active) | `v.semantic_relation` `r.relation` `e.option_correspondence` | 4 | 단일 능력이 아니라 V4·R2·E3 facet(§8) | partial_live |
| A5 | 근거 판단 | A 축 | retain_core | 유지 | domain | E 축 근거 | 예 | 0 | — | 근거 위치·선지 대응 | 근거 표시·오답 반박 | evidence-locate(A5-4 active) | `e.task_demand` `e.evidence_location` `e.option_correspondence` `e.o.final_judgment` | 4 | crosswalk §A retain_core | partial_live |
| A6 | 배경지식 | A 축 | move_layer | 재분류 | k.context_resource | 배경지식 자원 | 아니오 | 0 | — | 주제 친숙도(데이터 없음) | 주제별 묶음 읽기 | 없음 | — | 3 | §3 축 밖 K — R proxy 계산은 legacy 유지 | none |
| A7 | 듣기 해독 | A 축 | retain_core | 보류 | domain | L 축 근거 | 예 | 0 | — | (데이터 없음) | 받아쓰기·쉐도잉 | 없음 | `l.sound` `l.sentence` `l.retain` `l.respond` | 3 | §20-5 듣기 보류 | blocked |
| A8 | 어법 | A 축 | retain_core | 재분류 | domain | 어법 → S5 | 예 | 0 | — | 어법 판정 | 포인트별 반복 | 어법 문항 | `s.form_scope` | 3 | crosswalk §A — S 의 원자 하위 능력 | content_needed |
| A9 | 속도·지구력 | A 축 | retain_core | 분할 | domain | 속도·지구력 | 예 | 0 | — | (시간 데이터 0) | 연속 풀이 | 없음 | `x.attention_stamina` `x.o.whole_test_stability` | 3 | 지구력 → X4, 속도 → 가로 측정 차원(§4) | blocked |
| B1 | 듣기 대의 | B 축 | move_layer | 재분류 | lens.question_type | 듣기 대의 유형 | 아니오 | 18(2025#1,2025#2,2025#3,2026#1,2026#2,2026#3…) | — | 유형 정오 | 발문 먼저 | 유형 정오(능력 아님) | `l.respond` `l.sentence` | 3 | Question Lens — DIAGNOSE_WITH | blocked |
| B2 | 듣기 세부 | B 축 | move_layer | 재분류 | lens.question_type | 듣기 세부 유형 | 아니오 | 36(2025#10,2025#4,2025#5,2025#7,2025#8,2025#9…) | — | 유형 정오 | 정보 위치 | 유형 정오 | `l.retain` | 4 | Question Lens | blocked |
| B3 | 듣기 계산 | B 축 | move_layer | 재분류 | lens.question_type | 듣기 계산 유형 | 아니오 | 6(2025#6,2026#6,M2509#6,M2606#6,M2609#6,M2706#6) | — | 유형 정오 | 메모 양식 | 유형 정오 | `l.retain` | 3 | Question Lens | blocked |
| B4 | 듣기 응답 | B 축 | move_layer | 재분류 | lens.question_type | 듣기 응답 유형 | 아니오 | 30(2025#11,2025#12,2025#13,2025#14,2025#15,2026#11…) | — | 유형 정오 | 마지막 발화 | 유형 정오 | `l.respond` | 4 | Question Lens | blocked |
| B5 | 듣기 세트 | B 축 | move_layer | 재분류 | lens.question_type | 듣기 세트 유형 | 아니오 | 12(2025#16,2025#17,2026#16,2026#17,M2509#16,M2509#17…) | — | 유형 정오 | 두 문항 메모 | 유형 정오 | `l.retain` | 3 | Question Lens | blocked |
| B6 | 독해 대의 | B 축 | move_layer | 재분류 | lens.question_type | 독해 대의 유형 | 아니오 | 0 | R-CLAIM,R-GIST,R-MOOD,R-PURPOSE,R-TITLE,R-TOPIC | 유형 정오 | 필자 주장 먼저 | B6-3 FIND active | `r.central_meaning` `e.option_correspondence` | 3 | Question Lens — 유형 성과를 축 숙달로 읽지 않는다 | partial_live |
| B7 | 함축 의미 | B 축 | move_layer | 재분류 | lens.question_type | 함축 의미 유형 | 아니오 | 0 | R-IMPLY | 유형 정오 | 밑줄 풀어 쓰기 | 유형 정오 | `r.inference` `v.contextual_sense` | 4 | Question Lens | content_needed |
| B8 | 세부 정보 | B 축 | move_layer | 재분류 | lens.question_type | 세부 정보 유형 | 아니오 | 0 | R-CHART,R-FACT,R-NOTICE | 유형 정오 | 선지별 대조 | 유형 정오 | `e.evidence_location` `e.option_correspondence` | 4 | Question Lens | content_needed |
| B9 | 어법·어휘 | B 축 | move_layer | 재분류 | lens.question_type | 어법·어휘 유형 | 아니오 | 0 | R-GRAMMAR,R-VOCAB | 유형 정오 | 출제 포인트 | 유형 정오 | `s.form_scope` `v.contextual_sense` | 3 | Question Lens | content_needed |
| B10 | 빈칸 추론 | B 축 | move_layer | 재분류 | lens.question_type | 빈칸 유형 | 아니오 | 0 | R-BLANK,R-BLANK2 | 유형 정오 | 예상 답 먼저 | evidence-locate 문항 | `r.central_meaning` `r.inference` `e.evidence_location` | 3 | Question Lens | partial_live |
| B11 | 흐름 | B 축 | move_layer | 재분류 | lens.question_type | 순서·삽입·무관 유형 | 아니오 | 0 | R-INSERT,R-IRRELEVANT,R-ORDER | 유형 정오 | 단서 표시 | cohesion-link 문항 | `r.reference` `r.relation` `r.discourse_structure` | 4 | Question Lens | partial_live |
| B12 | 요약 | B 축 | move_layer | 재분류 | lens.question_type | 요약 유형 | 아니오 | 0 | R-SUMMARY | 유형 정오 | 요약문 먼저 | 유형 정오 | `r.central_meaning` `v.semantic_relation` | 4 | Question Lens | content_needed |
| B13 | 장문 | B 축 | move_layer | 재분류 | lens.question_type | 장문 유형 | 아니오 | 0 | X-BLANK,X-BLANK2,X-FACT,X-ORDER,X-REFER,X-TITLE,X-VOCAB | 유형 정오 | 순서·지칭 절차 | 유형 정오 | `r.o.global_meaning_model` `x.time_allocation` | 4 | Question Lens | content_needed |
| C1 | 단어 재활용 | C 축 | move_layer | 재분류 | feature.choice_trap | 선지 함정 — 단어 재활용 | 아니오 | 0 | — | 문항 쪽 특성 | 함정 표시 | 능력 판정 금지 | — | 3 | Item Feature — 「C 선지를 골랐다 → E3 약함」 금지 | n/a |
| C2 | 핵심 아님 | C 축 | move_layer | 재분류 | feature.choice_trap | 핵심 아님 | 아니오 | 0 | — | 문항 쪽 특성 | 핵심 문장 먼저 | 능력 판정 금지 | — | 3 | Item Feature | n/a |
| C3 | 부분을 전체로 | C 축 | move_layer | 재분류 | feature.choice_trap | 부분을 전체로 | 아니오 | 0 | — | 문항 쪽 특성 | 범위어 표시 | 능력 판정 금지 | — | 3 | Item Feature | n/a |
| C4 | 인과 전도 | C 축 | move_layer | 재분류 | feature.choice_trap | 인과 전도 | 아니오 | 0 | — | 문항 쪽 특성 | 인과 화살표(cue 훈련) | 능력 판정 금지 | — | 3 | Item Feature | n/a |
| C5 | 범위·강도 변형 | C 축 | move_layer | 재분류 | feature.choice_trap | 범위·강도 변형 | 아니오 | 0 | — | 문항 쪽 특성 | 수식어 대조 | 능력 판정 금지 | — | 3 | Item Feature | n/a |
| C6 | 방향 반대 | C 축 | move_layer | 재분류 | feature.choice_trap | 방향 반대 | 아니오 | 0 | — | 문항 쪽 특성 | 필자 입장 표시 | 능력 판정 금지 | — | 3 | Item Feature | n/a |
| C7 | 상식 개입 | C 축 | move_layer | 재분류 | feature.choice_trap | 상식 개입 | 아니오 | 0 | — | 문항 쪽 특성 | 근거 번호 쓰기 | 능력 판정 금지 | — | 3 | Item Feature | n/a |
| C8 | 비유 선지 | C 축 | legacy_alias | 보류 | feature.choice_trap | 비유 선지(legacy_alias) | 아니오 | 0 | — | 대응 key 0 | 비유 풀어 쓰기 | 없음 | — | 4 | crosswalk §B legacy_alias — 사례가 생기면 재검토 | n/a |
| D1 | 선지에 끌림 | D 축 | retire_from_vnext | 보류 | retired | 선지에 끌림 | 아니오 | 0 | — | 포괄적 | 예상 답 먼저 | 오답 원인으로 분해 | — | 4 | retire_from_vnext(행 보존 · 개념 미사용) | n/a |
| D2 | 추측 풀이 | D 축 | retire_from_vnext | 보류 | retired | 추측 풀이 | 아니오 | 0 | — | 확신도 기록 | 찍음 표시 | 원인 아님 | — | 3 | retire_from_vnext | n/a |
| D3 | 상식 판단 | D 축 | legacy_alias | 보류 | legacy.alias | 상식 판단(legacy_alias) | 아니오 | 0 | — | B.outside_knowledge 관련 | 근거 번호 쓰기 | 오답 원인 경로 | — | 4 | legacy_alias(crosswalk §B) — B.outside_knowledge 와 관련되지만 같은 객체 아님, 옛 화면 대응용 별칭으로만 | n/a |
| D4 | 해석은 되는데 틀림 | D 축 | retire_from_vnext | 보류 | retired | 해석은 되는데 틀림 | 아니오 | 0 | — | 상태 묘사 | 원인 쪼개기 | 진단 시작점 | — | 3 | retire_from_vnext | n/a |
| D5 | 시간 붕괴 | D 축 | move_layer | 재분류 | domain | 시간 붕괴 → X | 아니오 | 0 | — | (시간 데이터 0) | 시간 기록 | 없음 | `x.time_allocation` `x.attention_stamina` | 3 | move_layer → X | blocked |
| D6 | 오답 분석 없음 | D 축 | move_layer | 재분류 | pedagogy.method | 오답 분석 습관 | 아니오 | 0 | — | 학습 행동 | 오답 4분류 | 행동 기록 | — | 3 | Pedagogy | n/a |
| D7 | 90점 커트라인 전략 | D 축 | retire_from_vnext | 보류 | retired | 90점 커트라인 전략 | 아니오 | 0 | — | — | — | — | — | 3 | retire_from_vnext — 목표는 csat_map_goal 이 맡는다 | n/a |
| D8 | EBS 암기 의존 | D 축 | move_layer | 재분류 | pedagogy.method | EBS 암기 의존 | 아니오 | 0 | — | 학습 행동 | 논지 요약 전환 | 행동 기록 | — | 3 | Pedagogy | n/a |
| D9 | 듣기 소홀 | D 축 | move_layer | 재분류 | plan.allocation | 듣기 소홀 = 배분 문제 | 아니오 | 0 | — | 배분 | 듣기 루틴 | PLAN 배분 | — | 4 | Goal/Route — L 숙달과 동일시 금지 | n/a |
| I1 | 기출 분해 | I 축 | move_layer | 재분류 | pedagogy.method | 기출 분해 = §13 Protocol 의 집 | 아니오 | 0 | — | 절차 수행 | §13 7단계 | — | — | 3 | Pedagogy — Workspace 방법 카드 | n/a |
| I2 | 문장 풀어쓰기 | I 축 | move_layer | 재분류 | pedagogy.method | 문장 풀어 쓰기 | 아니오 | 0 | — | 절차 | 풀어 쓰기 | — | — | 3 | Pedagogy | n/a |
| I3 | 오답 원인 분류 | I 축 | move_layer | 재분류 | pedagogy.method | 오답 원인 분류 | 아니오 | 0 | — | 절차 | 4분류 | — | — | 3 | Pedagogy | n/a |
| I4 | 실전 모의고사 운영 | I 축 | move_layer | 재분류 | pedagogy.method | 실전 모의고사 운영 | 아니오 | 0 | — | 절차 | 실전 조건 | — | — | 3 | Pedagogy | n/a |
| I5 | EBS 논지 요약 | I 축 | move_layer | 재분류 | pedagogy.method | EBS 논지 요약 | 아니오 | 0 | — | 절차 | 논지 한 줄 | — | — | 4 | Pedagogy | n/a |
| I6 | 어휘 간격 반복 | I 축 | move_layer | 재분류 | pedagogy.method | 어휘 간격 반복 | 아니오 | 0 | — | 절차 | FSRS | — | — | 3 | Pedagogy — WordVault 재사용 | n/a |
| I7 | 받아쓰기·쉐도잉 | I 축 | move_layer | 재분류 | pedagogy.method | 받아쓰기·쉐도잉 | 아니오 | 0 | — | 절차 | Dictation·EchoMatch | — | — | 4 | Pedagogy | n/a |
| I8 | 주제별 묶음 읽기 | I 축 | move_layer | 재분류 | pedagogy.method | 주제별 묶음 읽기 | 아니오 | 0 | — | 절차 | 묶음 읽기 | — | — | 3 | Pedagogy | n/a |
| I9 | 셀프 설명 | I 축 | move_layer | 재분류 | pedagogy.method | 셀프 설명 | 아니오 | 0 | — | 절차 | 선지별 설명 | — | — | 3 | Pedagogy | n/a |
| I10 | 예상 답 먼저 쓰기 | I 축 | move_layer | 재분류 | pedagogy.method | 예상 답 먼저 쓰기 | 아니오 | 0 | — | 절차 | 선지 가리기 | — | — | 4 | Pedagogy | n/a |
| J1 | 시간 배분 | J 축 | move_layer | 통합 | domain | 시간 배분 → X1 | 예 | 0 | — | (시간 데이터 0) | 기준 시간표 | 없음 | `x.time_allocation` | 4 | move_layer → X1 | blocked |
| J2 | 풀이 순서 | J 축 | move_layer | 통합 | domain | 풀이 순서 → X2 | 예 | 0 | — | (데이터 0) | 순서 설계 | 없음 | `x.sequence` | 4 | → X2 | blocked |
| J3 | 난이도 변동 대응 | J 축 | move_layer | 통합 | domain | 난이도 변동 → X3 | 예 | 0 | — | (데이터 0) | 하방 시나리오 | 없음 | `x.recovery_adaptation` | 3 | → X3 | blocked |
| J4 | 시험 불안 | J 축 | move_layer | 재분류 | context.performance | 시험 불안 | 아니오 | 0 | — | 자기보고 | 시작 루틴 | 없음 | — | 3 | Performance Context — 막대 없음 | n/a |
| J5 | 컨디션·집중 | J 축 | move_layer | 분할 | domain | 집중 → X4 · 컨디션 → Context | 예 | 0 | — | (데이터 0) | 시간대 풀이 | 없음 | `x.attention_stamina` | 4 | crosswalk §B 분리 | blocked |

> 연결 문항 수는 `csat_map_line_link`(link_kind=item_no) 실측. 라인별 연결 전체 148행 — attribute 8 · item_no 102 · type 25 · trap_family 7 · habit 6. 사용처: 모든 라인이 `load.ts` → `model.ts buildMapModel`(라인 목표율 · 성취율)과 54라인 상세 화면에 쓰인다.

## 5. 활동 183 전수 분류

| 과제 | 라인 | 제목 | 분류 | 기존 단계(TASK_STAGE) | 앱 실행 | rev4 TASK 대응 | 다른 라인 중복 후보 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A1-1 | A1 | 어휘 수준 측정 | DC | FIND | checklist | `v.core_meaning` `v.contextual_sense` `v.multiword` `v.semantic_relation` | B7-3 B7-4 B9-3 A4-3 |
| A1-2 | A1 | 간격 반복 학습 | LM | REPAIR | checklist | `v.core_meaning` `v.contextual_sense` `v.multiword` `v.semantic_relation` | I6-2 B9-2 B12-1 |
| A1-3 | A1 | 기출 어휘 점검 | DC | CHECK | checklist | `v.core_meaning` `v.contextual_sense` `v.multiword` `v.semantic_relation` | B7-3 B7-4 B9-3 A4-3 |
| A2-1 | A2 | 막히는 문장 수집 | DC | FIND | checklist | `s.sentence_core` `s.chunk_boundary` `s.attachment` `s.structural_relation` `s.o.sentence_meaning_model` | — |
| A2-2 | A2 | 문장 풀어쓰기 | LA | REPAIR | checklist | `s.sentence_core` `s.chunk_boundary` `s.attachment` `s.structural_relation` `s.o.sentence_meaning_model` | I2-2 I2-3 |
| A2-3 | A2 | 압축 연습 | LA | TRANSFER | checklist | `s.sentence_core` `s.chunk_boundary` `s.attachment` `s.structural_relation` `s.o.sentence_meaning_model` | I2-2 I2-3 |
| A2-4 | A2 | 문장 의미 직접 확인 | DC | FIND | checklist | `s.o.sentence_meaning_model` | — |
| A3-1 | A3 | 연결어 방향 표시 | LA | REPAIR | checklist | `r.relation` | A4-1 A4-2 B11-1 B11-2 |
| A3-2 | A3 | 문단 역할 적기 | LA | TRANSFER | checklist | `r.discourse_function` | — |
| A3-3 | A3 | 순서·삽입 재확인 | DC | CHECK | checklist | `r.reference` `r.relation` `r.discourse_function` `r.discourse_structure` | B11-4 A4-3 B6-3 |
| A3-4 | A3 | 흐름 놓친 단서 찾기 | DC | FIND | draft | `r.reference` `r.relation` | B11-4 A4-3 |
| A4-1 | A4 | 재진술 사슬 찾기 | LA | REPAIR | checklist | `v.semantic_relation` `r.relation` `e.option_correspondence` | B12-2 A3-1 B11-1 B11-2 |
| A4-2 | A4 | 바꿔 쓰기 확장 | LA | TRANSFER | checklist | `v.semantic_relation` `r.relation` `e.option_correspondence` | B12-2 A3-1 B11-1 B11-2 |
| A4-3 | A4 | 빈칸·요약 확인 | DC | CHECK | checklist | `v.semantic_relation` `r.relation` `e.option_correspondence` | A1-1 A1-3 B12-4 A3-3 |
| A4-4 | A4 | 바뀐 표현 대응 찾기 | DC | FIND | live | `e.option_correspondence` | A5-3 B8-4 |
| A5-1 | A5 | 근거 문장 표시 | LA | REPAIR | checklist | `e.evidence_location` | B8-1 B8-2 |
| A5-2 | A5 | 오답 반박 쓰기 | LA | TRANSFER | checklist | `e.option_correspondence` | A4-1 A4-2 B6-1 B8-1 |
| A5-3 | A5 | 상식 함정 점검 | DC | CHECK | checklist | `e.task_demand` `e.evidence_location` `e.option_correspondence` `e.o.final_judgment` | B10-2 B8-4 A4-3 A4-4 |
| A5-4 | A5 | 고른 이유 출처 확인 | DC | FIND | live | `e.evidence_location` | B10-2 B8-4 |
| A6-1 | A6 | 약한 주제 찾기 | DC | FIND | checklist | — (TASK 아님 층) | — |
| A6-2 | A6 | 주제별 묶음 읽기 | MC | REPAIR | checklist | — (TASK 아님 층) | — |
| A6-3 | A6 | 한국어 교양서 병행 | MC | TRANSFER | checklist | — (TASK 아님 층) | — |
| A7-1 | A7 | 놓친 구간 확인 | DC | FIND | checklist | `l.sound` `l.sentence` `l.retain` `l.respond` | B1-3 B2-4 B5-3 B4-3 |
| A7-2 | A7 | 받아쓰기·쉐도잉 | LM | REPAIR | checklist | `l.sound` `l.sentence` `l.retain` `l.respond` | B1-1 B3-1 B5-1 B4-1 |
| A7-3 | A7 | 배속 듣기 | LM | TRANSFER | checklist | `l.sound` `l.sentence` `l.retain` `l.respond` | B1-1 B3-1 B5-1 B4-1 |
| A8-1 | A8 | 어법 포인트 진단 | DC | FIND | checklist | `s.form_scope` | B9-3 |
| A8-2 | A8 | 포인트별 기출 반복 | LA | REPAIR | checklist | `s.form_scope` | — |
| A8-3 | A8 | 기초 문법 보강 | MC | REPAIR | checklist | `s.form_scope` | B9-1 |
| A9-1 | A9 | 읽기 속도 측정 | DC | FIND | checklist | `x.attention_stamina` `x.o.whole_test_stability` | J5-3 J5-4 |
| A9-2 | A9 | 쉬운 글 많이 읽기 | LM | REPAIR | checklist | `x.attention_stamina` `x.o.whole_test_stability` | D5-3 |
| A9-3 | A9 | 연속 풀이 지구력 | LA | TRANSFER | checklist | `x.attention_stamina` `x.o.whole_test_stability` | J5-1 |
| B1-1 | B1 | 발문 먼저 읽기 | LM | REPAIR | checklist | `l.respond` `l.sentence` | A7-2 A7-3 B4-1 B4-2 |
| B1-2 | B1 | 대의 문항 모음 풀이 | MC | TRANSFER | checklist | `l.respond` `l.sentence` | — |
| B1-3 | B1 | 결정 문장 찾기 | DC | FIND | checklist | `l.respond` `l.sentence` | A7-1 B4-3 B4-4 |
| B10-1 | B10 | 예상 답 먼저 쓰기 | LM | REPAIR | checklist | `r.central_meaning` `r.inference` `e.evidence_location` | B12-1 |
| B10-2 | B10 | 고른 오답 해부 | DC | FIND | checklist | `r.central_meaning` `r.inference` `e.evidence_location` | B12-4 B6-3 B7-3 B7-4 |
| B10-3 | B10 | 구문·재진술 병행 | MG | REPAIR | checklist | `r.central_meaning` `r.inference` `e.evidence_location` | B12-3 B7-2 |
| B11-1 | B11 | 단서 표시 | LA | REPAIR | checklist | `r.reference` `r.relation` `r.discourse_structure` | A3-1 A4-1 A4-2 |
| B11-2 | B11 | 무관한 문장 판단 | LA | REPAIR | checklist | `r.reference` `r.relation` `r.discourse_structure` | A3-1 A4-1 A4-2 |
| B11-3 | B11 | 논리 흐름 병행 | MG | REPAIR | checklist | `r.reference` `r.relation` `r.discourse_structure` | — |
| B11-4 | B11 | 흐름 오답 결정 단서 분류 | DC | FIND | checklist | `r.reference` `r.relation` `r.discourse_structure` | A3-3 A3-4 A4-3 B6-3 |
| B12-1 | B12 | 요약문 먼저 읽기 | LM | REPAIR | checklist | `r.central_meaning` `v.semantic_relation` | B10-1 A1-2 |
| B12-2 | B12 | 본문 표현 연결 | LA | REPAIR | checklist | `r.central_meaning` `v.semantic_relation` | B6-1 I1-3 I5-1 A4-1 |
| B12-3 | B12 | 재진술 병행 | MG | REPAIR | checklist | `r.central_meaning` `v.semantic_relation` | B10-3 |
| B12-4 | B12 | 요약 빈칸 실패 위치 확인 | DC | FIND | checklist | `r.central_meaning` `v.semantic_relation` | B10-2 B6-3 A1-1 A1-3 |
| B13-1 | B13 | 장문 시간 확보 | LM | REPAIR | checklist | `r.o.global_meaning_model` `x.time_allocation` | D5-3 |
| B13-2 | B13 | 순서·지칭 절차 | LM | REPAIR | checklist | `r.o.global_meaning_model` `x.time_allocation` | D5-3 |
| B13-3 | B13 | 쉬운 문항 지키기 | LM | CHECK | checklist | `r.o.global_meaning_model` `x.time_allocation` | D5-3 |
| B13-4 | B13 | 장문 실점 원인 구분 | DC | FIND | checklist | `r.o.global_meaning_model` `x.time_allocation` | J1-4 |
| B2-1 | B2 | 정보 위치 패턴 정리 | LA | REPAIR | checklist | `l.retain` | B3-3 |
| B2-2 | B2 | 세부 문항 모음 풀이 | MC | TRANSFER | checklist | `l.retain` | B3-2 B5-2 |
| B2-3 | B2 | 번복 표현 모으기 | LA | REPAIR | checklist | `l.retain` | B3-3 |
| B2-4 | B2 | 놓친 정보 위치 확인 | DC | FIND | checklist | `l.retain` | A7-1 B5-3 |
| B3-1 | B3 | 메모 양식 고정 | LM | REPAIR | checklist | `l.retain` | A7-2 A7-3 B5-1 |
| B3-2 | B3 | 계산 문항 모음 풀이 | MC | TRANSFER | checklist | `l.retain` | B2-2 B5-2 |
| B3-3 | B3 | 조건 함정 정리 | LA | FIND | checklist | `l.retain` | B2-1 B2-3 |
| B4-1 | B4 | 마지막 발화 집중 | LM | REPAIR | checklist | `l.respond` | A7-2 A7-3 B1-1 |
| B4-2 | B4 | 응답 대본 쉐도잉 | LM | REPAIR | checklist | `l.respond` | A7-2 A7-3 B1-1 |
| B4-3 | B4 | 응답 문항 확인 | DC | CHECK | checklist | `l.respond` | A7-1 B1-3 |
| B4-4 | B4 | 마지막 발화 받아쓰기 확인 | DC | FIND | checklist | `l.respond` | A7-1 B1-3 |
| B5-1 | B5 | 두 문항 함께 메모 | LM | REPAIR | checklist | `l.retain` | A7-2 A7-3 B3-1 |
| B5-2 | B5 | 세트 모음 풀이 | MC | TRANSFER | checklist | `l.retain` | B2-2 B3-2 |
| B5-3 | B5 | 놓친 항목 기록 | DC | FIND | checklist | `l.retain` | A7-1 B2-4 |
| B6-1 | B6 | 필자 주장 먼저 표시 | LA | REPAIR | checklist | `r.central_meaning` `e.option_correspondence` | B12-2 I1-3 I5-1 A4-1 |
| B6-2 | B6 | 대의 문항 모음 풀이 | MC | TRANSFER | checklist | `r.central_meaning` `e.option_correspondence` | B8-3 |
| B6-3 | B6 | 헷갈린 선지 비교 | DC | FIND | live | `r.central_meaning` `r.discourse_structure` | B10-2 B12-4 A3-3 B11-4 |
| B7-1 | B7 | 밑줄 풀어 쓰기 | LA | REPAIR | checklist | `r.inference` `v.contextual_sense` | I6-3 |
| B7-2 | B7 | 재진술 과제 병행 | MG | REPAIR | checklist | `r.inference` `v.contextual_sense` | B10-3 |
| B7-3 | B7 | 함축 문항 확인 | DC | CHECK | checklist | `r.inference` `v.contextual_sense` | B10-2 A1-1 A1-3 B9-3 |
| B7-4 | B7 | 밑줄 해석 방향 확인 | DC | FIND | checklist | `r.inference` `v.contextual_sense` | B10-2 A1-1 A1-3 B9-3 |
| B8-1 | B8 | 선지별 대조 | LA | REPAIR | checklist | `e.evidence_location` `e.option_correspondence` | A5-1 A4-1 A4-2 A5-2 |
| B8-2 | B8 | 도표 표현 점검 | LA | REPAIR | checklist | `e.evidence_location` `e.option_correspondence` | A5-1 A4-1 A4-2 A5-2 |
| B8-3 | B8 | 세부 문항 모음 풀이 | MC | TRANSFER | checklist | `e.evidence_location` `e.option_correspondence` | B6-2 |
| B8-4 | B8 | 어긋난 줄 대조 확인 | DC | FIND | checklist | `e.evidence_location` `e.option_correspondence` | A5-3 A5-4 B10-2 A4-3 |
| B9-1 | B9 | 출제 포인트 목록 | MC | REPAIR | checklist | `s.form_scope` `v.contextual_sense` | A8-3 |
| B9-2 | B9 | 문맥 어휘 절차 | LM | REPAIR | checklist | `s.form_scope` `v.contextual_sense` | A1-2 |
| B9-3 | B9 | 오답 이유 설명 | DC | FIND | checklist | `s.form_scope` `v.contextual_sense` | A8-1 A1-1 A1-3 B7-3 |
| C1-1 | C1 | 함정 표시 | LA | REPAIR | checklist | — (TASK 아님 층) | — |
| C1-2 | C1 | 단어 재활용 모음 풀이 | MC | TRANSFER | checklist | — (TASK 아님 층) | — |
| C1-3 | C1 | 끌린 이유 한 줄 | DC | FIND | checklist | — (TASK 아님 층) | — |
| C2-1 | C2 | 핵심 문장 먼저 | LA | REPAIR | checklist | — (TASK 아님 층) | — |
| C2-2 | C2 | 핵심 아님 모음 풀이 | MC | TRANSFER | checklist | — (TASK 아님 층) | — |
| C2-3 | C2 | 끌린 이유 한 줄 | DC | FIND | checklist | — (TASK 아님 층) | — |
| C3-1 | C3 | 범위어 표시 | LA | REPAIR | checklist | — (TASK 아님 층) | — |
| C3-2 | C3 | 부분을 전체로 모음 풀이 | MC | TRANSFER | checklist | — (TASK 아님 층) | — |
| C3-3 | C3 | 끌린 이유 한 줄 | DC | FIND | checklist | — (TASK 아님 층) | — |
| C4-1 | C4 | 인과 화살표 그리기 | LA | REPAIR | checklist | — (TASK 아님 층) | — |
| C4-2 | C4 | 인과 전도 모음 풀이 | MC | TRANSFER | checklist | — (TASK 아님 층) | — |
| C4-3 | C4 | 끌린 이유 한 줄 | DC | FIND | checklist | — (TASK 아님 층) | — |
| C5-1 | C5 | 수식어 대조 | LA | REPAIR | checklist | — (TASK 아님 층) | — |
| C5-2 | C5 | 범위·강도 변형 모음 풀이 | MC | TRANSFER | checklist | — (TASK 아님 층) | — |
| C5-3 | C5 | 끌린 이유 한 줄 | DC | FIND | checklist | — (TASK 아님 층) | — |
| C6-1 | C6 | 필자 입장 표시 | LA | REPAIR | checklist | — (TASK 아님 층) | — |
| C6-2 | C6 | 방향 반대 모음 풀이 | MC | TRANSFER | checklist | — (TASK 아님 층) | — |
| C6-3 | C6 | 끌린 이유 한 줄 | DC | FIND | checklist | — (TASK 아님 층) | — |
| C7-1 | C7 | 근거 번호 쓰기 | LA | REPAIR | checklist | — (TASK 아님 층) | — |
| C7-2 | C7 | 상식 개입 모음 풀이 | MC | TRANSFER | checklist | — (TASK 아님 층) | — |
| C7-3 | C7 | 끌린 이유 한 줄 | DC | FIND | checklist | — (TASK 아님 층) | — |
| C8-1 | C8 | 비유 풀어 쓰기 | LA | REPAIR | checklist | — (TASK 아님 층) | — |
| C8-2 | C8 | 비유 선지 모음 풀이 | MC | TRANSFER | checklist | — (TASK 아님 층) | — |
| C8-3 | C8 | 어휘 폭 병행 | MG | REPAIR | checklist | — (TASK 아님 층) | — |
| C8-4 | C8 | 비유 선지 풀어 보기 | DC | FIND | checklist | — (TASK 아님 층) | — |
| D1-1 | D1 | 선지 가리고 읽기 | LM | REPAIR | checklist | — (TASK 아님 층) | — |
| D1-2 | D1 | 예상 답 먼저 쓰기 | LM | REPAIR | checklist | — (TASK 아님 층) | — |
| D1-3 | D1 | 끌림 확인 | DC | CHECK | checklist | — (TASK 아님 층) | — |
| D1-4 | D1 | 예상 답 유무 표시 | DC | FIND | checklist | — (TASK 아님 층) | — |
| D2-1 | D2 | 찍음 표시 | MG | FIND | checklist | — (TASK 아님 층) | — |
| D2-2 | D2 | 구문 훈련 | MG | REPAIR | checklist | — (TASK 아님 층) | — |
| D2-3 | D2 | 쉬운 문항 정확도 | DC | CHECK | checklist | — (TASK 아님 층) | — |
| D3-1 | D3 | 근거 번호 쓰기 | LA | REPAIR | checklist | — (TASK 아님 층) | — |
| D3-2 | D3 | 상식 함정 모음 | MC | TRANSFER | checklist | — (TASK 아님 층) | — |
| D3-3 | D3 | 셀프 설명 | LM | CHECK | checklist | — (TASK 아님 층) | — |
| D3-4 | D3 | 근거 문장 번호 적어 보기 | DC | FIND | checklist | — (TASK 아님 층) | — |
| D4-1 | D4 | 원인 쪼개기 | DC | FIND | checklist | — (TASK 아님 층) | — |
| D4-2 | D4 | 원인별 본질 처방 | MG | REPAIR | checklist | — (TASK 아님 층) | — |
| D4-3 | D4 | 4주 뒤 재풀이 | DC | CHECK | checklist | — (TASK 아님 층) | — |
| D5-1 | D5 | 시간 기록 | MG | FIND | checklist | `x.time_allocation` `x.attention_stamina` | J1-1 J1-3 J5-2 |
| D5-2 | D5 | 시간 배분표 적용 | MG | REPAIR | checklist | `x.time_allocation` `x.attention_stamina` | J1-1 J1-3 J5-2 |
| D5-3 | D5 | 넘기기 기준 | LM | REPAIR | checklist | `x.time_allocation` `x.attention_stamina` | B13-1 B13-2 B13-3 A9-2 |
| D6-1 | D6 | 오답 4분류 | LM | FIND | checklist | — (TASK 아님 층) | — |
| D6-2 | D6 | 오답 다시 풀기 | LA | CHECK | checklist | — (TASK 아님 층) | — |
| D6-3 | D6 | 처방 연결 | MG | FIND | checklist | — (TASK 아님 층) | — |
| D7-1 | D7 | 목표 다시 잡기 | MG | FIND | checklist | — (TASK 아님 층) | — |
| D7-2 | D7 | 고난도 세트 | MC | TRANSFER | checklist | — (TASK 아님 층) | — |
| D7-3 | D7 | 여유 폭 점검 | MG | CHECK | checklist | — (TASK 아님 층) | — |
| D8-1 | D8 | 연계·비연계 비교 | DC | FIND | checklist | — (TASK 아님 층) | — |
| D8-2 | D8 | 논지 요약 전환 | LM | REPAIR | checklist | — (TASK 아님 층) | — |
| D8-3 | D8 | 비연계 고난도 풀이 | MC | TRANSFER | checklist | — (TASK 아님 층) | — |
| D9-1 | D9 | 듣기 루틴 고정 | MG | REPAIR | checklist | — (TASK 아님 층) | — |
| D9-2 | D9 | 듣기 해독 과제 | MG | REPAIR | checklist | — (TASK 아님 층) | — |
| D9-3 | D9 | 듣기 만점 확인 | DC | CHECK | checklist | — (TASK 아님 층) | — |
| D9-4 | D9 | 듣기 공백 대조 | DC | FIND | checklist | — (TASK 아님 층) | — |
| I1-1 | I1 | 실전처럼 풀기 | LA | FIND | checklist | — (TASK 아님 층) | — |
| I1-2 | I1 | 분해 표시 | LM | REPAIR | checklist | — (TASK 아님 층) | — |
| I1-3 | I1 | 논지 한 줄 정리 | LA | REPAIR | checklist | `r.central_meaning` | B12-2 B6-1 I5-1 |
| I10-1 | I10 | 선지 가리기 | LM | REPAIR | checklist | — (TASK 아님 층) | — |
| I10-2 | I10 | 예상 답 쓰기 | LA | REPAIR | checklist | `e.task_demand` | — |
| I10-3 | I10 | 방향 대조 | LA | REPAIR | checklist | — (TASK 아님 층) | — |
| I10-4 | I10 | 예상 답 방향 비교 | DC | FIND | checklist | — (TASK 아님 층) | — |
| I2-1 | I2 | 문장 고르기 | LA | FIND | checklist | — (TASK 아님 층) | — |
| I2-2 | I2 | 뼈대 찾기 | LA | REPAIR | checklist | `s.sentence_core` | A2-2 A2-3 |
| I2-3 | I2 | 풀어 쓰기 | LA | REPAIR | checklist | `s.structural_relation` | A2-2 A2-3 |
| I3-1 | I3 | 4분류 기록 | LM | FIND | checklist | — (TASK 아님 층) | — |
| I3-2 | I3 | 원인별 집계 | MG | FIND | checklist | — (TASK 아님 층) | — |
| I3-3 | I3 | 라인 연결 | MG | FIND | checklist | — (TASK 아님 층) | — |
| I4-1 | I4 | 실전 조건 맞추기 | LM | TRANSFER | checklist | — (TASK 아님 층) | — |
| I4-2 | I4 | 묶음별 시간 기록 | MG | FIND | checklist | — (TASK 아님 층) | — |
| I4-3 | I4 | 다음 날 리뷰 | LM | FIND | checklist | — (TASK 아님 층) | — |
| I5-1 | I5 | 논지 한 줄 | LA | REPAIR | checklist | `r.central_meaning` | B12-2 B6-1 I1-3 |
| I5-2 | I5 | 같은 주제 묶기 | MC | TRANSFER | checklist | — (TASK 아님 층) | — |
| I5-3 | I5 | 반대 논지 써 보기 | LA | TRANSFER | checklist | — (TASK 아님 층) | — |
| I5-4 | I5 | EBS 지문 기억 방식 확인 | DC | FIND | checklist | — (TASK 아님 층) | — |
| I6-1 | I6 | 단어 등록 | MG | FIND | checklist | — (TASK 아님 층) | — |
| I6-2 | I6 | 간격 복습 | LM | REPAIR | checklist | `v.core_meaning` | A1-2 |
| I6-3 | I6 | 문맥 확인 | LA | TRANSFER | checklist | `v.contextual_sense` | B7-1 |
| I7-1 | I7 | 받아쓰기 | LM | REPAIR | checklist | — (TASK 아님 층) | — |
| I7-2 | I7 | 쉐도잉 | LM | REPAIR | checklist | — (TASK 아님 층) | — |
| I7-3 | I7 | 배속 듣기 | LM | TRANSFER | checklist | — (TASK 아님 층) | — |
| I7-4 | I7 | 받아쓰기 막힘 구간 표시 | DC | FIND | checklist | — (TASK 아님 층) | — |
| I8-1 | I8 | 주제 고르기 | MG | FIND | checklist | — (TASK 아님 층) | — |
| I8-2 | I8 | 연속 읽기 | MC | REPAIR | checklist | — (TASK 아님 층) | — |
| I8-3 | I8 | 개념 정리 | LA | REPAIR | checklist | — (TASK 아님 층) | — |
| I9-1 | I9 | 선지별 설명 | LM | REPAIR | checklist | `e.o.final_judgment` | — |
| I9-2 | I9 | 막힌 설명 표시 | DC | FIND | checklist | — (TASK 아님 층) | — |
| I9-3 | I9 | 다시 설명 | LA | CHECK | checklist | — (TASK 아님 층) | — |
| J1-1 | J1 | 기준 시간표 | MG | REPAIR | checklist | `x.time_allocation` | D5-1 D5-2 |
| J1-2 | J1 | 실전 적용 | LA | TRANSFER | checklist | `x.time_allocation` | — |
| J1-3 | J1 | 시간표 조정 | MG | CHECK | checklist | `x.time_allocation` | D5-1 D5-2 |
| J1-4 | J1 | 버린 문항 위치 확인 | DC | FIND | checklist | `x.time_allocation` | B13-4 |
| J2-1 | J2 | 풀이 순서 설계 | MG | REPAIR | checklist | `x.sequence` | — |
| J2-2 | J2 | 멀티태스킹 연습 | LA | REPAIR | checklist | `x.sequence` | — |
| J2-3 | J2 | 순서 점검 | MG | CHECK | checklist | `x.sequence` | — |
| J2-4 | J2 | 실제 풀이 순서 기록 | DC | FIND | checklist | `x.sequence` | — |
| J3-1 | J3 | 하방 시나리오 확인 | MG | FIND | checklist | `x.recovery_adaptation` | — |
| J3-2 | J3 | 어려운 회차 실전 | MC | TRANSFER | checklist | `x.recovery_adaptation` | — |
| J3-3 | J3 | 최저 전략 점검 | MG | CHECK | checklist | `x.recovery_adaptation` | — |
| J4-1 | J4 | 흔들린 순간 기록 | DC | FIND | checklist | — (TASK 아님 층) | — |
| J4-2 | J4 | 시작 루틴 만들기 | MG | REPAIR | checklist | — (TASK 아님 층) | — |
| J4-3 | J4 | 실전 차이 확인 | DC | CHECK | checklist | — (TASK 아님 층) | — |
| J5-1 | J5 | 수능 시간대 풀이 | LA | TRANSFER | checklist | `x.attention_stamina` | A9-3 |
| J5-2 | J5 | 수면 고정 | MG | REPAIR | checklist | `x.attention_stamina` | D5-1 D5-2 |
| J5-3 | J5 | 듣기 집중 점검 | DC | CHECK | checklist | `x.attention_stamina` | A9-1 |
| J5-4 | J5 | 집중 끊긴 구간 기록 | DC | FIND | checklist | `x.attention_stamina` | A9-1 |

- 「기존 단계」 열은 `apps/web/src/lib/csat/map/prescription.ts` 의 `TASK_STAGE`(에이전트 판정 v1)를 렌더 때 읽은 값이다. 생애주기 단계(FIND …)와 활동 분류(DC …)는 다른 축이다 — 예: FIND 인데 MG 인 과제는 「찾기 단계의 기록 관리」다.
- 「중복 후보」는 같은 rev4 TASK 를 겨누고 같은 분류인 **다른 라인** 과제다. 자동 계산이라 실제 중복인지는 사람 확인이 필요하다 — 특히 C1-3 … C7-3 「끌린 이유 한 줄」 7개와 D1-2 · B10-1 · I10-2 「예상 답 먼저 쓰기」 계열은 **같은 활동이 여러 라인에 복제**된 것이 확인된다(제목 동일).
- 라인 대응이 없는 활동(— 표시)은 Question Lens · Item Feature · Pedagogy · Context 층에 남는다. 지울 대상이 아니다(데이터 보존).

