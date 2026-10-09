# 학습 지도 계약 A · B · C(v1 · 2026-10-09 · PROPOSED — 사용자 승인 전)

> 목표 UG-c8315ad8-0002 · design v1. 정본 [LEARNING_MAP_VNEXT](./LEARNING_MAP_VNEXT.md) rev2.1 §10–§11 · §14 · §17, ERROR_EVIDENCE_DESIGN §9(EC 브랜치 `feat/ec-smoke` 9380c68c8 — main 에 없음, MC-16), 코드북 rev3(사람 dry run 고정) · rev4.3(초안).
> **원칙**:
> - 정본의 교육 원칙을 바꾸지 않는다.
> - 서로 다른 판정 체계를 합치지 않는다.
> - 정본이 「설계 미정」으로 둔 것은 이 문서가 결정하지 않는다 — 결정 질문으로만 올린다(§D).
> - DB 변경은 이 문서에 없다. 필요하면 SQL · SHA · 영향을 따로 승인받는다.

## A. 직접 확인 원인 판정 계약

### A-1. 판정 체계(합치지 않는다)

| 체계 | 단위 | 값 | 정본 | 쓰임 |
|---|---|---|---|---|
| 코드북 판정 결과 | attempt × 원인 | identified · multiple_plausible · insufficient_evidence · inconsistent_evidence | 코드북 §L50–65 | 사람 · AI 판정의 **증거 형태** |
| EC 판정 행 | judgment(phase blind · verify · adjudication) | code · no_cause · insufficient_evidence · no_fitting_code(+ verdict accept · reject · unsure) | `csat_ec_judgment` | 실제 저장 |
| `cause_adjudicated` | attempt × 원인 코드 | 코드 확인 / 기각 / 보류 | EED §9 집계 ① · VNEXT §10-1 | 사람 검수 결과 |
| `cause_confirmed` | student × axis(V · S · R · E) | 충족 / 미충족(계산값 · 저장 안 함) | EED §9 집계 ② · 8조건 | 우선 확인 후보 순서만 바꾼다 |
| **FIND 확인 결과**(`findOutcome`) | student × FIND 과제(같은 원리의 확인 문항 묶음) | untried · in_progress · confirmed_need · not_needed · mixed | `find-outcome.ts` | 그 원리를 지금 연습할 필요가 있는지의 **학습 요구** |
| `verified_diagnosis` | student × skill/axis | 있음 / 없음 | VNEXT §10-1 「직접 진단 설계(미정)」 | 지도 상태 변경 · 처방(REPAIR 등) 개방의 **유일한** 근거 |

- 네 가지 「결과」(코드북 4종 · EC 판정 4종)는 서로 다른 단계의 값이다. 대응을 정의할 때는 **표로만** 하고, 한 열로 합치지 않는다.
  - insufficient_evidence 는 두 체계에서 같은 뜻이다.
  - identified ↔ code 는 「사람이 accept 했을 때만」 코드 확인으로 간다.
  - multiple_plausible · inconsistent_evidence ↔ 보류다.
  - no_fitting_code 는 보류다(반증 아님).
  - no_cause 는 「전원 blind no_cause + verify accept 없음」일 때만 반증이다.
- **「confirmed」 세 가지는 서로 다르다.**
  - `confirmed_need`(FIND · 문항 2개)
  - `cause_confirmed`(8조건 · 문항 4개 이상)
  - `verified_diagnosis`(직접 진단)
  - 화면 · 코드 · 문서에서 이름을 바꿔 쓰지 않는다. 이 문서는 `confirmed_need` 를 학생 화면 문구에서 「확인된 학습 요구(이 원리)」로만 부른다.

### A-2. 최소 판정 단위 · 관찰과 확인의 차이

| 단계 | 근거 | 지도에 주는 영향 |
|---|---|---|
| 관찰(rule_proxy) | 기출 응답 × 문항 유형 → 역량 기본값 | 「관찰」 표현만. 숫자 · 「취약」 금지 |
| 학습 요구 확인(FIND) | **서로 다른 확인 문항 ≥ 2** · 각 문항의 **독립 첫 시도**만 | 그 FIND 과제의 「확인된 학습 요구 / 필요 없음 / 섞임」 — 단계 상태 · basis 는 그대로 |
| 원인 확정(cause_confirmed) | EED §9 8조건 | 우선 확인 후보 순서(최대 2) |
| 직접 진단(verified_diagnosis) | 그 축만 겨냥한 직접 진단에서 축 실패가 다시 관찰되고, 보정(calibration) 기준이 있을 것 | 단계 상태 · 처방 개방 |

### A-3. 응답 자격(모든 집계 공통)

| 응답 | 처리 |
|---|---|
| 합성 계정 · 관리자 미리보기 | 제외(synthetic · preview) |
| 해설 · 힌트를 본 뒤 판단(after_explanation · help_level ≠ independent) | 독립 아님 → 제외 |
| 시각 불확실(timing_uncertain · M8) | 판정 보류(제외 · 행은 보존) |
| 같은 문항 반복 수행 | 첫 시도만 판정에 쓴다. 반복은 연습 기록으로만 남긴다 |
| 재전송(같은 mutation id) | 한 행(G2 멱등) |
| 문항 주석 서명 불일치(원문 · 단위 변경) | 채점 안 함 → 판정에서 제외(계약 B) |

### A-4. 복수 원인 · 근거 부족 · 판정 변경

- **복수 원인**:
  - 코드북 multiple_plausible 은 primary 를 비운다 → 원인 확정 집계에서 보류다.
  - FIND 는 원인이 아니라 학습 요구를 다루므로, 한 학생이 여러 FIND 에서 `confirmed_need` 를 가질 수 있다(서로 배타가 아니다).
- **근거 부족**:
  - A0 · A1 은 판정하지 않는다.
  - FIND 는 확인 문항 < 2 이면 `in_progress` 다.
  - 대상 문항이 2개 미만이면 `needsMoreItems` 로, 화면에서 「확인 문항을 더 준비 중」으로 둔다.
- **판정 변경 · 재검토**:
  - EED §9 「판단 변경」(blind 에서 배제한 축을 verify 에서 accept)은 보류다.
  - FIND 판정은 저장하지 않고 조회할 때마다 계산한다. 그래서 새 첫 시도가 들어오거나 자격이 바뀌면(시각 불확실 · 원문 변경) 바로 다시 계산된다.
  - 바뀐 판정은 이력으로 남기지 않는다(감사용 스냅샷만).

### A-5. 지도에 표현할 불확실성

| 상태 | 학생 화면 문구 원칙 |
|---|---|
| 관찰 | 「기출 기록에서 관찰됐어요 — 원인을 확인하기 전이라 실력으로 판정하지 않아요」 |
| in_progress | 「한 문항을 더 확인하면 이 원리가 필요한지 알 수 있어요」 |
| confirmed_need | 「서로 다른 두 문항에서 같은 곳을 다시 볼 필요가 보였어요(이번 확인 기준)」 — **약점 · 원인 확정 표현 금지** |
| not_needed | 「두 문항에서 이 원리를 바르게 썼어요 — 다른 단계로 넘어가도 돼요」 |
| mixed | 「결과가 섞였어요 — 한 문항 더 해 보면 분명해져요」 |
| verified(미래) | 직접 진단 설계가 승인되기 전에는 표시하지 않는다 |

## B. Evidence Anchor 계약

### B-1. 필드(정본 §17-2 · 확장 없음 · 구현은 순수 타입만)

`source_id` · `item_id` · `source_revision`(= source_text_version) · `source_text_hash`(정규화 본문 sha256) · `segmentation_version` · `anchor_type`(passage · stem · option(n) · underline · blank · given_sentence) · `unit`(문장 index + **문장 텍스트 해시**) 또는 `char_start/char_end` · `quote_hash` · `evidence_type`(answer_anchor · task_annotation · student_evidence · human_tag) · `provenance` · `validation_status`(legacy_candidate · validated_anchor · reviewed_anchor) · `judgment_revision`.

### B-2. 정규화 · 해시

- **정규화(v1)**:
  - NFC
  - 줄바꿈 · 연속 공백 → 공백 1
  - 앞뒤 공백 제거
  - 곧은 · 굽은 따옴표 통일
  - 대소문자 유지
- 해시는 sha256(hex)이다. 정규화 규칙이 바뀌면 `normalization_version` 을 올린다. 그러면 모든 앵커가 재검증 대상이 된다.
- **문장 단위는 「위치 + 문장 텍스트 해시」로 묶는다.** 길이만 같은 다른 문장은 같은 근거가 아니다. 지금 과제 주석의 `skeletonSig`(문장 길이 해시)는 경계 서명일 뿐이고, 원문 결속이 아니다.

### B-3. 승격 · 무효화

| 판정 | 조건 | 결과 |
|---|---|---|
| valid | source_text_hash 같음 · unit 텍스트 해시 같음 · 위치 유일 | 사용 가능(상태는 그대로) |
| relocated | 본문이 바뀌었지만 같은 텍스트 해시의 문장이 **정확히 한 곳**에 있다 | 재검토 대상(자동 승격 금지) · 새 위치 후보 제시 |
| ambiguous | 같은 텍스트 해시의 문장이 둘 이상이다 | 보류 |
| stale | 그 문장 텍스트가 사라졌거나 · source_text_hash 는 같은데 단위가 다르다(분할 버전 변경) | 무효 → 재검토 |
| boundary_only | 경계(units_hash · skeletonSig)만 같고 원문 해시가 없다 | 원문 검증 아님 → legacy_candidate 유지 |

- validated 이상만 문항 근거(item_tagged)로 쓴다. 학생 진단 표시는 reviewed 부터다.
- 원문 · 판정 revision 이 바뀌면 그 앵커를 쓰는 판정(과제 채점 · 원인 판정)은 다시 계산된다.

## C. FIND 결과 → 진단 환류 계약

### C-1. 바꾸는 것 / 바꾸지 않는 것

| 대상 | 바꾸나 | 이유 |
|---|---|---|
| `DiagnosisBasis` · 단계 상태(관찰) | **아니오** | 정본: 상태를 바꾸는 것은 verified_diagnosis 뿐이다(§10) |
| 생애주기 개방(REPAIR · TRANSFER · CHECK) | **아니오**(verified 전) | §14 |
| 그 단계의 「지금 할 일」 순서 | **예** | `confirmed_need` 인 FIND 과제를 단계 시트 맨 위에 「확인된 학습 요구」로 올린다. `not_needed` 는 아래로 내린다 |
| 우선 확인 후보(Diagnostic Priority Signal) | **제안**(§D 결정) | `confirmed_need` 를 cause_confirmed 와 같은 칸에 넣지 않는다. 별도 칸 「이 원리 연습 필요」 로 보인다 |
| 다음 행동 | **예** | confirmed_need → 같은 원리 Practice(다른 지문) · 복습 예약. not_needed → 다음 단계 FIND. mixed · in_progress → 확인 문항 하나 더 |
| 재평가 | **예**(링크 → 측정) | CHECK(독립 · 미노출 문항)의 첫 시도로 FIND 결과를 다시 계산한다. 새 기출 기록은 관찰(rule_proxy)만 갱신한다 |

### C-2. 계산 위치 · 순수성

- 서버가 조회할 때마다 계산한다. 저장하지 않고, `now` 를 주입한다.
- 입력: 학습자 첫 시도 뷰(learning_first_attempts · 본인)와 FIND 대상 문항 목록이다.
- 출력: `FindFeedback` = { outcome, eligibleCount, needsMoreItems, nextAction, priorityHint } — 순수 함수 `findFeedback()`.

## D. 결정이 필요한 질문(ChatGPT 재검토 · 사용자 승인)

1. **verified_diagnosis 정의**: 「그 축만 겨냥한 직접 진단」의 형태와 보정 기준. FIND `confirmed_need` 를 직접 진단의 한 구성 요소로 인정할지(인정한다면 문항 수 · 유효 기간 · 원리 → 축 대응).
2. **Diagnostic Priority Signal 에 FIND 결과를 넣을지** — 넣는다면 cause_confirmed 와 같은 무게인지.
3. **EED §9 · 코드북의 main 이관**(MC-16) — 정본 참조 무결성.
4. **코드북 결과 4종 ↔ EC 판정 4종 대응표 확정**(코드북 L65 「CHECK 확장 마이그레이션 미결」).
5. **E 코드 이름 버전**(seed v0.1 evidence/choice ↔ 코드북 evidence_location/option_mismatch).
6. **Anchor 정규화 v1 규칙 승인** · 문장 텍스트 해시를 과제 주석 서명에 추가하는 이관(주석 파일 형식 변경 · DB 무관).
