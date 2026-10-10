# 학습 지도 rev4.0 — 아키텍처(설계 제안 · 2026-10-10 · 미승인)

> **2차 구현(2026-10-10)**: 첫 수직 경로가 앱에 들어갔다 — [LEARNING_MAP_V4_IMPLEMENTATION](./LEARNING_MAP_V4_IMPLEMENTATION.md). 아래 설계는 그대로 유효하다.
> **상태(1차)**: 설계 문서. 코드 · DB · UI 변경 없음. 정본 [LEARNING_MAP_VNEXT](./LEARNING_MAP_VNEXT.md) rev2.1 을 **바꾸지 않고 그 위에 얹는다** — rev2.1 의 층 분리 · 금지 추론 · 근거 수준 규칙은 모두 그대로 유효하다.
> 짝 문서: [ASIS_AUDIT](./LEARNING_MAP_ASIS_AUDIT.md) · [DOMAIN_TASK_CODEBOOK](./LEARNING_MAP_DOMAIN_TASK_CODEBOOK.md) · [RELATIONSHIP_MODEL](./LEARNING_MAP_RELATIONSHIP_MODEL.md) · [WORKSPACE_CONTRACT](./LEARNING_MAP_WORKSPACE_CONTRACT.md) · [EXAM_INPUT_CONTRACT](./LEARNING_MAP_EXAM_INPUT_CONTRACT.md) · [MIGRATION_PLAN](./LEARNING_MAP_MIGRATION_PLAN.md).
> 구조화 원천: [v4/](./v4/) — `codebook.json` · `relations.json` · `workspaces.json` · `asis-snapshot.json`.

## 0. 한 줄

**rev2.1 은 「무엇을 관찰해도 되는가」를 정했고, rev4 는 「목표가 주어졌을 때 무엇을 얼마나 어떤 묶음으로 배울까」를 그 규칙 안에서 정한다.** 새 능력 taxonomy 를 만들지 않는다 — TASK 30 은 모두 rev2.1 §3 후보(+ 듣기 4단계)이고, rev4 가 더한 것은 TASK 의 수행 목표 · 조건 · 관찰 · 기준, 관계 타입, Workspace, 시험 입력 · 목표 계약이다.

## 1. 흐름

```
시험기록(csat_dx_session · response)
   │  as_of 필터 · 입력 신뢰도(isDiagnosable) · 진단 반영(diagnosis_ready)
   ▼
As-Is Map ── TASK 별 근거 상태(rule_proxy | item_tagged | verified) · 미측정/측정 불가/근거 부족   ← 목표 없이도 생성
   │ (+ 목표 버전)
   ▼
To-Be Map ── TASK 별 학습 요구(confirm · repair · integrate · transfer · maintain) · 목표 관련도(splitMust)
   │ 학습자별 학습 필요 그래프(공통 관계 approved ∩ 필요 노드)
   ▼
Workspace 편성 ── Template(중심 · 보조 TASK) → Learner Workspace(개인 계획량 · 자료)
   ▼
PLAN ── Workspace 우선순위 · 활동량 · 예상/실제 일정 · 변경 이력 · 학습자 조정
   ▼
학습 실행(learning_sessions · learning_task_attempts) ──► 독립 확인(skill-diagnosis) ──► As-Is 갱신
```

자동 승격 없음(정본 §10-1 구조도): 관계 · 목표 · 계획은 **순서**를 바꿀 뿐 근거 상태를 바꾸지 않는다. 근거 상태를 바꾸는 것은 응답(rule_proxy) · 문항 태깅(item_tagged) · 직접 확인(verified)뿐.

## 2. 이름 분리(감사에서 나온 결정)

| 이름 | 뜻 | 바꾸지 않는 이유 |
|---|---|---|
| **영역(Domain)** V · S · R · E · L · X | rev4 의 학습 영역 = rev2.1 축 | 정본 |
| **legacy 축** A · B · C · D · I · J | DB `csat_map_node(kind=axis)` — 54라인의 묶음 | 데이터 보존 · 기존 화면 |
| **TASK** `v.core_meaning` … | 수행 목표 단위(코드북 §3) — 영구 ID = semantic slug | 정본 §3 |
| **활동(Activity)** `A1-1` … | DB `csat_map_task` 183 — 이름은 task 지만 **TASK 가 아니다** | DB 이름 유지 · 문서에서 「활동」 |
| **확인 과제 키** `claim-support` … | 채점되는 문항 과제(`knowledge_applications.surface_ref`) | 기존 |
| **Workspace** `ws.*` | TASK 묶음 + 계획 · 자료 · 기록 관리 단위 | 신규 |

## 3. 층(rev2.1 §12 확장)

| 층 | rev2.1 | rev4 추가 |
|---|---|---|
| Learning Map | V/S/R/E/L/X + 통합 관찰 | TASK 30 의 수행 정의 · As-Is 상태 |
| Goal / Route | 목표 점수 · 경로 | 목표 버전 · To-Be 요구 · 학습자별 필요 그래프 |
| Pedagogy | 과제 · 공부 방법 | Workspace Template · 활동 분류(LA · DC · LM · MC · MG) |
| (신규) Plan | — | Learner Workspace 계획 · 변경 이력 |
| Question Lens · Item Feature · Attempt Evidence · Rationale · K · Context | 그대로 | 관계 `DIAGNOSE_WITH` 로만 TASK 와 연결 |

## 4. 교육 구조 결정(요약 — 근거는 코드북)

- **6영역 유지.** 재검토 6기준(독립성 · 관찰 · 교수 · 성장 · 전이 · 한국 평가 관련성) 결과는 코드북 §2. 관찰 가능성이 지금 「live」인 영역은 R · E 뿐이고 V · S 는 도구 부족, L · X 는 정본 보류.
- **TASK 30**: canon_candidate 21 · hold 9(L4 · X5). 직접 확인 live 5(R3 · R4 · R5 · E2 · E3) · ready 2(R1 · R2) · content_needed 14 · blocked 9. 「36 후보」 목록은 저장소에 없어 대조하지 못했다 — 과도한 분해 검토는 rev2.1 의 병합(S7→S-O1 · R5/R6 병합 · E4–E7→facet)을 그대로 따르고, 추가 병합 후보 2(S2+S3 · R3+R4 — 둘 다 「Gold tagging 에서 독립 관찰 안 되면」 조건부)만 기록한다.
- **라인 54**: 유지 2 · 통합 3 · 분할 5 · 재분류 37 · 보류 7(삭제 0). 수행 목표 성격 라인 11 — 요구를 만들 수 있는 것 5(A1 · A2 · A3 · A5 · A8), 대상 TASK 전부 보류 6(A7 · A9 · J1 · J2 · J3 · J5). crosswalk(rev2.1) 상태와 다른 판단은 코드북에 근거를 적고 테스트가 강제한다.
- **활동 183**: 수행 목표 TASK 0 · 학습 활동 45 · 직접 확인 55 · 방법 31 · 자료 24 · 관리 28. 앱 안 실행 3(+ draft 1).
- 섞지 않는 것: 문항 유형(B) · 선지 함정(C) · 풀이 습관(D) · 공부 방법(I) · 시험 운영 일부(J4) — TASK 가 아니라 렌즈 · 특성 · 방법 · 맥락 층.

## 5. MAP · PLAN · WORKSPACE 데이터 책임

| | MAP | PLAN | WORKSPACE |
|---|---|---|---|
| 질문 | 나는 어디에 있고 무엇이 필요한가 | 무엇을 언제 얼마나 | 지금 이 묶음을 어떻게 배우나 |
| 보여 주는 것 | 영역 · TASK · 관계 · As-Is 근거 상태 · 목표 · 근거 수준 · TASK 계획량 · 정성 조건 · 잔여 요구 · 관련 Workspace | Workspace 우선순위 · 활동량 · 예상/실제 일정 · 변경 근거 · 학습자 조정 | 목표 · TASK 묶음 · 교재/가이드 · 실제 수행 · 피드백 · 새 지문 적용 · 독립 재확인 · MAP/PLAN 반영 |
| 소유 데이터 | 없음(계산) — 정의 테이블 읽기 | `learner_workspace_plan`(append-only) | `learner_workspace` · 실행은 기존 `learning_*` 조회 |
| 계산 함수 | `asIsMap()` · `toBeMap()` · `needGraph()` | `planFor(workspaces, toBe, history)` | `skill-diagnosis` · `lifecycle-evidence` · `practice-results`(기존) |
| 쓰기 | 목표 버전 | 계획 확정 · 학습자 조정 | 시도 기록(기존 경로) |

**공유 규칙**: 세 화면은 같은 `(user, TASK id, as_of, canon_version)` 계산 결과를 읽는다. 어느 화면도 다른 화면의 판정을 다시 계산하지 않는다 — 판정은 순수 함수 한 곳(`lib/csat/map/v4/*`, 2차)에 있다.

**학습자 자율 조정**: 학습자는 Workspace 순서 · 주당 분량 · 보류를 바꿀 수 있다. 바꿔도 근거 상태 · 요구 유형은 그대로이고, 변경 사유가 `plan_version` 에 남는다. 목표 관련도가 높은 confirm 요구를 뒤로 미루면 「목표와 관련이 큰 확인이 남아 있어요」를 보인다(차단하지 않는다).

## 6. 표현 규칙(정본 §11 · 학습자 화면 절 유지)

- rule_proxy 근거로 TASK 세부 상태(숙달 · 취약)를 보이지 않는다 — 「축 기록에서 보인 모습」까지만.
- 퍼센트 · 막대: 통합 관찰 · facet · LP · K · Context 금지(그대로). TASK 에도 숙달 퍼센트를 두지 않고 상태 칸(확인 전 · 확인 필요 · 확인됨 · 해소 · 만료)을 쓴다.
- 계획량은 개수(문항 · 지문)로만. 시간 예상은 실측 중앙값이 생긴 뒤.
- 효과 주장 금지: 「이 Workspace 를 하면 N점」 없음.

## 7. 아직 가설인 것

- TASK 정성 기준의 「서로 다른 2문항 · 다른 날 재확인」을 V · S 에도 그대로 쓸 수 있는지(지금 근거는 R · E 합성 검증뿐).
- 목표 관련도(splitMust 배점)가 학습 우선순위로 타당한지 — 파일럿 전 가설.
- Workspace 9 묶음의 교육적 적절성 — 관계 34 가 approved 되기 전까지 「제안 묶음」.
