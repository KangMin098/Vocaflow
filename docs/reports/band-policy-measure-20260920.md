# CEFR 밴드 정책 — 측정 먼저 (결정 보류)

> 2026-09-20 · 읽기 전용 측정 · 요청: #104 의 남은 미판정 12,123편을 「학습자 V-Level 최상위 밴드 · CSAT 트랙 기준으로 적합」이라 보면 얼마가 열리는가.
> **DB 를 고치지 않았다.** 이 문서는 근거이고, 결정은 DD-57 초안(아래 §4)을 사람이 승인한 뒤에 한다.

## 0. 지금 규칙 — C1 을 허용하는 밴드가 **없다**

`cefrFitsBand(cefr, band)`(`packages/library-pipeline/src/textbook/assemble-unit.ts:180`):

| 밴드 | 상한 | 근거 |
|---|---|---|
| `article_v_level ≤ 4`(초·중) | **B1** | `SCHOOL_BAND_MAX_CEFR` |
| `article_v_level ≥ 5`(고1+) | **B2** | `HIGH_BAND_MAX_CEFR` |

즉 **C1·C2 는 어떤 밴드에서도 적합이 아니다.** 상한이 두 개뿐이라 "학습자가 더 높은 밴드면 열린다" 가 성립하지 않는다 —
`cefr_above_band` 는 학습자와 무관하게 **글에만 붙는 판정**이다. 이것이 이 측정의 출발점이다.

## 1. 학습자 V-Level 분포 (DB 실측)

| 항목 | 값 |
|---|---|
| 프로필 | **4**(그중 하나는 이번 디자인 작업용 빈 계정 `design-empty`) |
| `current_v_level` | **0 · 5** (최댓값 **5**) |
| `target_v_level` | 전부 `null` |
| segment | 전부 `general` |

**최상위 밴드 = V5** → 규칙상 상한 **B2**. 즉 지금 학습자 기준으로도 C1 은 열리지 않는다.
CSAT 트랙은 문항 `v_level` 이 **5~8** 에 분포하므로(아래 §2) 트랙 기준을 써도 상한은 B2 그대로다.

## 2. 무엇이 얼마나 막혀 있나 — 차단 사유 조합별 (문항이 붙은 글만)

| 차단 사유(정확 일치) | 글 | 문항 | CEFR | `article_v_level` |
|---|---|---|---|---|
| `cefr_above_band` **하나뿐** | **11,242** | **212,433** | B2/C1/C2 | 1~9 |
| `raw_content_unjudged` + `cefr_above_band` + `base_judgement` | **12,121** | **483,964** | C1/C2 | 5~8 |
| `content_rejected` + `cefr_above_band` | 314 | 42,562 | B2/C1 | 4~7 |
| `raw_content_unjudged` + `cefr_above_band` + `base_safety` | 44 | 1,626 | C1 | 5~7 |
| `cefr_above_band` + `base_safety` | 43 | 720 | C1 | 5~7 |
| 그 밖(법적·형식·안전 등, 밴드 무관) | 172 | 1,386 | A1~B2 | 1~7 |

### 2-1. 「밴드 하나만 걸린」 11,242편의 구성 — **판정 없이 바로 열리는 몫**

| CEFR | 밴드 | 글 | 문항 |
|---|---|---|---|
| C1 | V≥5(상한 B2) | **10,220** | **201,310** |
| B2 | V≤4(상한 B1) | 871 | 9,409 |
| C1 | V≤4(상한 B1) | 78 | 1,140 |
| C2 | V≥5(상한 B2) | 73 | 574 |

### 2-2. 요청한 12,123편(미판정)의 구성 — **판정 + 밴드 둘 다** 필요

| CEFR | `article_v_level` | 글 | 문항 |
|---|---|---|---|
| C1 | 7 | 2,457 | **284,904** |
| C1 | 6 | 9,359 | 176,646 |
| C1 | 5 | 271 | 20,830 |
| C2 | 7 | 11 | 993 |
| C1 | 8 | 15 | 467 |
| C2 | 8 · 6 | 8 | 124 |

## 3. 시나리오별로 열리는 규모

기준선(2026-09-20 판정 드레인 뒤): 연습 가능 **119,559 / 879,534 = 13.59%**.

| 시나리오 | 추가로 열리는 글 | 추가 문항 | 연습 가능 비율 |
|---|---|---|---|
| **S0** 지금 | — | — | 13.59% |
| **S1** 밴드 판정을 적격에서 빼고 **서빙 시 적합 필터**로만 쓴다(판정 작업 0) | +11,242 | **+212,433** | **37.75%** |
| **S2** S1 + 남은 raw 12,121편을 내용 판정(드레인) | +23,363 | **+696,397** | **92.79%** |
| **S3** S2 + `content_rejected`·`base_safety` 건은 그대로 둔다(권장) | = S2 | = S2 | 92.79% |

> ⚠️ **S1 의 함정**: 적격에서 빼면 문항이 *서빙 가능 후보*가 되지만, **서빙 시 적합 필터가 학습자 밴드를 보므로
> 지금 학습자(최상위 V5 · 상한 B2)에게는 C1 이 여전히 안 나간다.** 즉 S1 의 +212,433 은 **잠재 공급**이고,
> 실제로 학습자에게 닿으려면 (a) 밴드 상한에 C1 칸을 추가하거나 (b) CSAT 트랙에 별도 상한을 두어야 한다.
> **수치를 "열렸다" 로 읽지 말 것** — 이 저장소의 실패 모드가 공급 과대 계상이다.

## 4. DD-57 초안 — 「`cefr_above_band` 를 적격 게이트에서 서빙 시 적합 필터로 이동」

**아직 결정이 아니다.** 변경 범위를 먼저 적는다(사용자 요청).

### 4-1. 함수

| 대상 | 변경 |
|---|---|
| `packages/library-pipeline/src/textbook/source-eligibility.ts` | `blockers.push('cefr_above_band')` 를 **`warnings`** 로 이동(등급 계산에서 빠진다). `ELIGIBILITY_SPEC_VERSION` 3 → **4** |
| `packages/library-pipeline/src/textbook/assemble-unit.ts` | `cefrFitsBand` 는 그대로 둔다 — **호출 지점만** 바뀐다(조판 시 사용 유지) |
| `public.csat_source_is_eligible(uuid)` (DB) | `policy_version = 3` → `= 4`. 판정 논리는 그대로(블로커 배열이 비는지만 본다) |
| `public.prescribe_today` · `textbook_practice_items` · `grade_dcp_item` | **여기에 적합 필터를 넣는다** — 학습자 밴드(`user_profiles.current_v_level`) 대비 글 CEFR 상한. `grade_dcp_item` 은 채점이라 **막지 않는다**(이미 받은 문항을 채점 거부하면 학습자가 막힌다 — #104 의 증상이 그것이었다) |

### 4-2. 캐시

- `csat_source_eligibility` 전량(**109,043행 규모**)을 `policy_version = 4` 로 재적재해야 한다 → `source-policy-refresh --commit --all`(배치 500 · 백업 · 재검증). 소요는 배치당 ~9초 실측 기준 **약 35분**.
- 재적재 전에 `--plan --all` 로 변경 건수를 먼저 본다. `policy_version` 이 바뀌므로 **전 행이 changed** 로 잡힌다 — 그게 정상이다.
- 되돌리기: 배치별 `before.json` 이 남는다. 게이트 함수는 `policy_version` 상수 한 줄이라 롤백이 빠르다.

### 4-3. 테스트

| 파일 | 무엇을 바꿔야 하나 |
|---|---|
| `packages/library-pipeline/src/textbook/source-eligibility.test.ts` | `cefr_above_band` 가 blocker 가 아니라 warning 임을 단언하는 케이스로 교체 |
| `packages/library-pipeline/src/textbook/assemble-unit.test.ts` | 조판 쪽 밴드 검사는 **그대로 통과해야 한다**(회귀 없음 확인) |
| `apps/web/src/lib/learner/__tests__/dcp-grade-records.integration.test.ts` | #104 의 4건 — 적합 필터가 채점을 막지 않는다는 단언을 추가 |
| 새로 필요 | **서빙 적합 필터 회귀**: V5 학습자에게 C1 문항이 나가지 않고, V-Level 을 올리면 나간다(표본 고정) |
| `scripts/textbook/__tests__/source-policy-batch.test.mjs` | `ELIGIBILITY_SPEC_VERSION` 4 반영 |

### 4-4. 결정이 필요한 것 (이 초안이 답하지 않는 것)

1. **밴드 상한에 C1 칸을 두는가** — 두지 않으면 S1 의 잠재 공급이 학습자에게 닿지 않는다.
2. CSAT 트랙에 **별도 상한**(예: 수능 지문은 C1 허용)을 두는가 — 수능 실제 지문 난이도가 C1 대에 걸친다면 이쪽이 사실에 맞다. **근거 자료를 먼저 재야 한다**(기출 지문의 CEFR 분포 — 아직 안 쟀다).
3. `content_rejected` 314편(42,562문항)은 **열지 않는다** 가 맞는지(내용 판정이 reject 였다).
