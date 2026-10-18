# LM-G1.4 — 수용 자료(Codex 독립 검증 전)

> 기준 main `8ee927dce`. 코드 `b6e8b93cb`, 증거 실행 `8227bdc19`(문서만 추가 · `dirtyTree: false`).
> 증거 층위: ① 순수 단위 ② 개발 DB · 기존 API(합성 계정 본인 · 원장은 서비스 키로 읽기만) ③ Chromium 1280×900 · 1440×900.
> 지연 유지 = **NOT_ESTABLISHED**, 학습 효과 = **NOT_CLAIMED**. **T4 ACCEPT 를 선언하지 않는다.**
> 계약: [LM-G1_4_EVIDENCE_CONTRACT](./LM-G1_4_EVIDENCE_CONTRACT.md) · 승인 대기: [LM-G1_4_PENDING_POLICY](./LM-G1_4_PENDING_POLICY.md).

## 1. 반례 E01–E20(단위 · `evidence-claims.test.ts` 21/21)

| ID | 반례 | 결과 |
|---|---|---|
| E01 | 새 문항 혼자 첫 시도 | independent_check |
| E02 | 같은 문항 반복 | 두 번째는 condition_success · 「반복」 사유 |
| E03 | 같은 지문의 다른 문항 | sharedPassageGroups |
| E04 | 다른 과제 키 | 섞이지 않음 |
| E05 · E06 | 도움 · 해설 뒤 | INELIGIBLE |
| E07 | 시각 불확실 | held(UNKNOWN) · 먼저 보기 확정이면 INELIGIBLE · 도움 기록 없음은 held |
| E08 | 주석 해시 변경 | STALE · performed_only |
| E09 | 루브릭 · 정책 버전 | UNKNOWN · rubricVersion null |
| E10 | 바로잡기 성공 | 지금 확인은 그대로(need_confirmed) |
| E11 | 적용 2편 | experienced · 지금 확인 그대로 |
| E12–E14 | resolved · 다음 날 · 120일 만료 | 지연 유지 NOT_ESTABLISHED |
| E15 | 계보 누락(옛 입력) | UNKNOWN · not_counted |
| E16 | 원장 못 읽음 | ledger unknown · 적용 unknown |
| E17 | 목표 변경 | 같은 기록 → 같은 증거(목표는 입력 아님) |
| E18 | 단계 · 키 접미 섞임 | 첫 시도는 단계별 |
| E19 | 합성 계정 | effectSample INELIGIBLE |
| E20 | 요구 확정 뒤 적용 자료 없음 | no_content(요구 전 계획 없음은 none) |

## 2. 브라우저 · DB — `e2e-lm-g1-4.mjs`

| ID | 내용 | 1440 | 1280 |
|---|---|---|---|
| V01 | 시작 — 세 표면 같은 값 · 아직 확인 전 · 지연 NOT_ESTABLISHED · 실패 문구 없음 | PASS | PASS |
| V02 | FIND 2 실패 — 연습이 필요하다고 확인됨 · 혼자 푼 첫 확인 2 | PASS | PASS |
| V03 | 바로잡기 정답 — 「맞혀 봤어요」 · 지금 확인 그대로 | PASS | PASS |
| V04 | 적용 2 — 「해 봤어요 · 2 / 2편」 · 능력 판정 아님 | PASS | PASS |
| V05 | 새 확인 2 정답 — 통과(지금 기준) · 혼자 처음 푼 문항 4개 · 지연 「아직 근거 없음」 | PASS | PASS |
| V06 | 도구 범위 표시 · 단계마다 실패 문구 없음 | PASS | PASS |
| V07 | 가로 넘침 0 | PASS | PASS |
| V08 | 먼저 보기(viewed_first) 뒤 정답 — 원장 1행 · 독립 확인 0 · 「혼자 확인은 아님」 · 사유 | PASS | PASS |

계정은 실행마다 2개를 만들고 삭제한 뒤 부재 2/2를 확인했다. [1440](./evidence/lm-g1-4-20261016/final-1440/results.json) · [1280](./evidence/lm-g1-4-20261016/final-1280/results.json)(팝업 · 서랍 · 창 화면 18장씩).
「세 표면 같음」은 팝업 칩 · Workspace 창 칩의 값 · 문구가 같고, 서랍의 지금 확인 값이 같다는 뜻이다.

## 3. 회귀(코드 `b6b818231` — 첫 증거 커밋)

| 묶음 | 결과 |
|---|---|
| LM-G1.3a 목표 1440 · 1280 | 20/0 · 20/0 |
| LM-G1.2 R5 수직 1440 · 1280 · 시각 보류 | 20/0 · 20/0 · 2/0 |
| T1 `e2e-lm-g1-1` | 9/0 |
| LM-W1 통합 화면 · 복귀 · 해부 · 공급 | 36/0 · 7/0 · 6/0 · 6/0 |
| 단위(`lib/csat` · `components/csat` · `lib/learner` · `lib/knowledge`) | 215 파일 · 2,552/0(22 파일 묶음) |
| tsc · eslint · check.mjs | 0 · 0 · 15/15 |

기록할 것:
- 회귀는 `b6b818231` 에서 돌렸다. 그 뒤 `b6e8b93cb` 는 서랍 문구 한 줄과 e2e 검사 한 줄만 바꿨고, 그 커밋에서는 LM-G1.4 시나리오만 다시 돌렸다.
- G1.3a 1280 실행 중에 CHANGELOG 를 편집해 그 결과 파일에 `dirtyTree: true` 가 남았다. 코드 차이는 없다.
- 첫 실행에서 찾아 고친 것:
  - 통과 뒤 서랍이 「혼자 푼 확인 0문항」(판정 창 수)과 시도 집계 4를 함께 보였다. 시도 집계로 통일했다.
  - 먼저 보기 확정이 시각 불확실보다 뒤에 판정돼 「보류」로 나왔다. INELIGIBLE 이 먼저 오게 바꿨다.
  - API 는 `hint` 도움 수준을 받지 않는다(400). 그래서 도움 사례는 `viewed_first` 로 검증했다.

## 4. 상태

| 항목 | 상태 |
|---|---|
| 네 값 분리 · 세 표면 같은 값 | PASS(①②③) |
| 독립성 · 반복 · 같은 지문 · 주석 현재성 | PASS(①) · 브라우저는 반복 · 도움 사례만(②③) |
| STALE 실제 데이터 | NOT_TESTED — 개발 DB 에 주석 해시가 바뀐 행 0 |
| 같은 지문 묶음 실제 데이터 | NOT_TESTED — 단위만 |
| 원장 읽기 실패 화면 | NOT_TESTED — 단위만(ledger unknown 문구는 구현) |
| 지연 유지 · 루브릭 버전 · C2 · G | BLOCKED_APPROVAL([승인 대기](./LM-G1_4_PENDING_POLICY.md)) |
| 학습 효과 | NOT_CLAIMED |
