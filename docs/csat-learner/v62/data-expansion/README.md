# 학습 지도 데이터 확대 — 1차 감사 · 문항↔TASK 표본 (2026-10-23)

> 목적: 목표 시험별 TASK 관련도를 **근거와 함께** 계산할 수 있게 문항↔TASK 연결을 확보한다. 데이터 건수 증가는 완료 기준이 아니다.
> 이 문서의 수치는 생성물(`coverage.json` · `pilot-agreement.json`)에서 옮겼다. 다시 재려면 아래 명령을 실행한다 — 이 표를 근거로 쓰지 않는다.
> DB 변경 0 · 학습자 노출 0 · 사람 검수 0 · 학생 자료 0. 모든 AI 판정은 R0~R1(제품 `relevance` = unknown).

## 1. 시험 · 원천 커버리지 (`coverage.json`, 읽기 전용 실측)

| 시험군 | 시험 | 독해 문항 | 정답 | 분석 published / in_review / 없음 | 속성 사람 검토 | 함정 | 문장 단위 |
|---|---:|---:|---:|---|---:|---:|---:|
| 수능(2013–2025 시행) | 14 | 382 | 382 | 382 / 0 / 0 | 28 | 382 | 0 |
| 평가원 모평 | 16 | 420 | 420 | 420 / 0 / 0 | 112 | 420 | 0 |
| 학평 고1 | 35 | 980 | 980 | 868 / 65 / 47 | 0 | 1 | 980 |
| 학평 고2 | 35 | 980 | 980 | 877 / 65 / 38 | 0 | 0 | 980 |
| 학평 고3 | 34 | 952 | 952 | 862 / 56 / 34 | 0 | 44 | 952 |

- 분석 `published` 는 v3 드레인 **AI 분석의 공개 상태**다 — 사람 검수 · Gold 아님.
- 기관 공식 오답률 · 등급 통계(`csat_exams.official_*` · `csat_items.official_error_rate`): **전 시험 0건**.
- 사설 집계 정답률(`csat_item_response_stats`, 메가스터디): **127회 · 5,715행** — 같은 날 main 에 적재(migration `20261023020321`). 기관 공식 통계가 아니며 응시 집단이 출처 범위로 한정된다. 난도 · 오답률로 쓸 때 출처 · 시험 범위를 반드시 결속하고 등급 기준으로 일반화하지 않는다.
- 듣기(1–17) 문항은 DB 에 없다 → L 축 보류 유지.
- 무결성: `M2009` 문항 0 · 2014 A/B형 지문 공유 3쌍(정상 가능 — 분모 중복 합산 금지) · 정답 범위 이탈 0 · 번호 중복 0 · 보류(embargo) 판정 ok.

## 2. TASK · 평가 도구 · 공급

- 코드북: 비보류 21 · 보류 9(L·X) — 정의는 바꾸지 않았다.
- 창작 세트(저장소 파일): 17 TASK · 파일 20(R5 cycle supplement v1·v2 별도 revision) · 교수/안내/독립/전이/지연 역할 보유. V1 · S-O1 · R-O1 · E-O1 · L · X 는 세트 없음.
- 공유 DB 공급 원장 `authored_item` · `content_qualification` · `content_release_approval` · `workspace_content_delivery` = **전부 0행** → 실제 공급 가능한 적격 창작 콘텐츠 0. 사람 Gold · 권리 결정 대기(`docs/final/APPROVAL_PACKAGE.md`).

## 3. 문항↔TASK 심층 매핑 표본 (map-data-pilot-1)

- 표본: 2026 수능 독해 28 + 2027학년도 6월 모평 핵심 유형 12 = 40문항 × 21 TASK = 840쌍. 고정 규칙(`pilot-selection.json`, sha 동결). **평가원·수능 802문항(DB) 전체의 대표 표본이 아니다.**
- 방법: A(원문+기존 분석 참고) · B(원문만) 두 독립 AI. 계약 [ANALYST_CONTRACT.md](./ANALYST_CONTRACT.md) · 검증기 `pilot-lib.mjs`(원문 인용 실재 · 공식 정답 · 21 TASK 전수 · 오답 전수 · 상투문 반복).
- 결과: 일치 **0.789** · κ **0.584** · 주 TASK 일치 31/40. 일치 판정(R1 후보) 663쌍 · 갈림(DISPUTED) 177쌍.

| 판정 | TASK(κ) | 다음 조치 |
|---|---|---|
| 확대 가능 | R5 중심 의미(.86) · R6 추론(.94 — 전량 .70 으로 정정, §7) | 같은 계약으로 평가원·수능 802문항 확대 → **완료(§7)** |
| 제3 판정 후 확대 | V2(.73) · E3(.72) · S1(.65) · R1(.59) | 갈림만 제3 판정 |
| 규칙 먼저 | E2(.44) · R2(.36) · V4(.54) · R4(.54) · S3 · S4 · S5 · V1 · V3 · R3 | direct/indirect 경계 판정 규칙 필요 |
| 정의 문제 | E1 · E-O1 · S-O1 · R-O1(κ ≤ .18) | 모든 문항에 깔린 배경 수행 — 문항 단위 판정 대상인지부터 결정 |

갈림 표본을 눈으로 확인했다: 무작위 오류가 아니라 **경계 정의 공백**이다(E2: 밑줄 바로 앞 단서만으로 풀리는 문항 · R2: 연결어 존재만으로 관련인가 · 통합 TASK: 한쪽은 늘 무관, 다른 쪽은 늘 간접).

### 품질 사고와 가드

- 분석자 8명 모두 첫판에서 생성 스크립트 · 상투문으로 형식 검증을 통과했다. 검증기에 문항 간 · TASK 간 반복 검사를 추가했고 전 청크를 재작성시켰다.
- 「`other` 과반 금지」 규칙은 **허위 왜곡 유형을 고르게 만들어** 삭제했다(`true_statement` 추가).
- 근거로 쓰지 않는 필드: A 트랙의 `not_applicable` why · `task_distinction` · `not_observable` why 일부는 상투문이 남아 있다. 일치 계산은 관련성 값만 쓴다.
- 커밋 파일의 원문 인용은 sha256 으로만 남긴다. 원문 · 전체 판정은 `scripts/csat/map/v62/data/local/`(git 제외).

## 4. 계획 엔진 입력 검증

- 목표 시험별 TASK 관련도: **아직 계산 불가** — 제품 검토 링크 0, AI R1 후보는 840쌍 중 일치분뿐이고 NeedRank 입력으로 쓰면 안 된다(`relevance.ts` 계약).
- 활동 소요 시간 실측: 없음(기본 10분은 배분 기본값 · `GOAL_ACHIEVEMENT.md`). 학습량 = 콘텐츠 재고가 아니다.
- 확인된 공백: 기관 공식 통계 0(사설 정답률은 출처 결속으로만) · 듣기 원천 0 · 평가원 문장 단위 0 · 적격 공급 0 · 사람 검토 링크 0.

## 5. 사람 검토 · 권리 · Gold 대기

- 문항↔TASK: 갈림 177쌍 + 일치 663쌍 전부 사람 검수 전(R1 이하).
- 창작 17세트: B · B2 · C 사람 결정(`APPROVAL_PACKAGE.md`) · T-0087 R5 패킷 · SHA 변경 없음.

## 6. 다음 우선순위

1. 판정 규칙 보강안(E2 · R2 · 통합 TASK 처리) → Codex 독립 검증 → 계약 v2. **TASK 정의 자체는 바꾸지 않는다** — 규칙은 분석 계약에 둔다.
2. R5 · R6 를 평가원·수능 802문항으로 확대(같은 A/B · 검증기).
3. V2 · E3 · S1 · R1 갈림 제3 판정.
4. 평가원 `csat_item_units`(문장 단위) 공백 — S 축 직접 확인 도구의 선행 조건.
5. 사설 정답률(메가스터디)을 문항↔TASK 표본과 결합할 때의 출처 · 범위 계약 — 기관 등급컷은 권리 있는 공개 자료만.

## 7. 확대 2차 (같은 날) — 규칙 v2 실측 · R5/R6 평가원 전 문항

- **규칙 v2**([RULES_V2.md](./RULES_V2.md) §7–8): 같은 40문항 9 TASK 재판정 κ .805. R4 .96 · R2 .77 개선, E2 .34 · V4 .42 미해결, 통합 TASK 일치 1.0 은 기본값 강제에 따른 인위적 일치. **v2 미확정**. Codex 독립 검증([결과](./CODEX_REVIEW_RESULT.md)): P0 0 · P1 2(direct 정의 축소 · E2 거리 기준) → RULES_V2 v2.1 로 수정, **재판정 전**. 판단불가 2: κ 상승이 타당성 개선이라는 증거 없음(기본값 TASK 제외 200쌍도 .49→.66 상승) · 결함 가드는 「같은 시험 · 같은 60자 초과 발문」 밖의 원천 결함을 잡지 못한다.
- **R5 · R6 확대**: 표본 밖 평가원 · 수능 762문항 × 2 TASK × A/B(원문만). 검증 결함 0 · 원천 결함 7문항 분리.

| TASK | κ(4값) | direct 이분 κ | R1 direct | R1 indirect | 갈림 | 사용 |
|---|---:|---:|---:|---:|---:|---|
| R5 중심 의미 | **.889** | .935 | 190 | 161 | 55 | direct · indirect 후보 |
| R6 추론 | .700 | **.953** | 138 | (122) | 141 | **direct 만** — indirect ↔ 무관 경계가 불안정(순서 · 삽입 · 지칭) |

- 시험별 관련 문항 · 배점: [exam-relevance.json](./exam-relevance.json) — 29회 평균 R5 direct 14.4점 · R6 direct 13.4점 / 독해 62.3점. **R1 후보이며 사람 검수 · NeedRank 입력이 아니다.** 한 문항이 두 TASK 에 걸리면 각각 센다(TASK 간 배점 합산 금지).
- 표본 40 의 R6 κ .94 는 작은 표본 값이었다 — 전량 .70 으로 하향 정정.

### 원천 결함 (DB 수정은 승인 대상 · 미수정)

| 문항 | 결함 |
|---|---|
| M2306#38 · #39 | 두 삽입 문항 발문이 같음 — 각자의 「주어진 문장」 대신 옆 문항 문장 |
| M2406#38 · #39 | 같음 — #40 지문 첫 문장이 발문에 들어감 |
| M2406#43 · #44 · #45 | 세 문항 발문이 같음 — 세트 머리글 + #45 질문이 합쳐짐(순서 · 지칭 문항 발문 소실) |

- 가드: `coverage-audit` 의 `integrity.duplicate_long_stems`(같은 시험 · 서로 다른 문항 · 같은 60자 초과 발문). 처음 장문 세트를 「정상 공통 발문」으로 제외했다가 판정자 보고로 틀린 제외임을 확인하고 되돌렸다(제외 전후 오탐 0).
- 링크 배치는 이 문항들을 `SOURCE_DEFECT` 로 두고 R1 후보 · 일치 계산에서 뺀다.

## 8. AI-Control 등록 독립 검증 T-0089 (Codex · [review.md](./review/review.md) · [verdict.json](./review/verdict.json))

P0 0 · P1 3. 등록: owner `map-data-independent`(Codex) · 리뷰 worktree main 기준 · 쓰기는 `review/` 만.

- **R1 direct 관련성 29/30 confirmed**, 반박 0 · unclear 1(M2609#32 R6 → `REVIEW_UNCLEAR` · 후보 내림). 갈림 30 중 28 판정 가능.
- **P1-01 인접 TASK 오정의**: 표본 18쌍(R4 를 「세부 · 사실 확인」으로 설명 16쌍 등). 원인 — R5/R6 청크에 인접 TASK 정의를 주지 않아 판정자가 R4 뜻을 짐작했다. 전량에서 좁은 패턴만으로 85링크(A 53 · B 32)를 확인했다. 조치: 앞으로 청크에 비보류 21 정의 전체(`reference_tasks`), r5r6 배치의 `task_distinction` 은 **근거로 쓰지 않음**(`task_distinction_reliable:false`). 관련성 값은 유지.
- **P1-02(goal-batches 대상)**: 「삽입 262문항 주어진 문장 결손」은 refuted — 8문항은 지문 선두에 대상 문장이 있다(이 작업의 「짧은 발문은 정상 형식」 판단과 일치). 2023#38 choices=null 은 별도 실제 결손.
- **P1-03 두 작업의 E2 기준 불일치**: goal-batches 계약 v2(거리 기준)와 이 작업 v2.1(경쟁 후보 특정)이 같은 이름 아래 다르다 → 합의 필요(열린 질문으로 등록).
- 결함 링크 tier 를 R0 로 정정(이전 13개가 R1 표기). 겹치는 80문항 · 160 논리쌍 — 두 작업 문항 수를 합산하지 않는다.

## 9. 원천 발문 DB 수정 · 교차 모델(Claude–Codex) 판정 (같은 날)

**DB 수정(사용자 승인)**: `csat_items.stem` 8행(M2306#38–39 · M2406#38–39 · 43–45 · M2206#44)을 표준 발문으로 복원 — 지문 · 선지 · 정답 · 유형 불변, 결함 값 해시 일치 행만 · 8행 아니면 롤백 조건. 백업 `csat_items_stem_fix_20261023_bk`(RLS · 정책 없음). 기록 [source-fixes.json](./source-fixes.json). 이후 `duplicate_long_stems` 0.
**발문 형식 가드** `stem_format`(잘림 · 섞임, [N점] 제외): 20건 — 2차 수정안 [stem-fix-proposal-2.json](./stem-fix-proposal-2.json)(복원 11 · 원문 필요 9, **미적용**). Codex(T-0094)가 old_md5 20/20 · 판단 confirmed.

**교차 모델 판정(T-0094, A=Claude · B=Codex)** — 같은 모델 A/B 일치가 부풀었다:

| | Claude–Claude | Claude–Codex |
|---|---:|---:|
| 9 TASK κ(규칙 v2 → v2.1) | .805 | **.695** |
| R4 글 구조 | .96 | **.30** |
| R2 인접 관계 | .77 | .48 |
| E2 근거 찾기 | .34 | .14 |
| V1 기본 의미 | .60 | ≈0 |
| 발문 수정 8문항 R5 · R6 일치 | — | .375 |

갈림은 주로 `indirect` 경계에서 두 모델이 **체계적으로 반대 방향**(R6: Claude indirect ↔ Codex 무관, R5 · R4: Claude 무관 ↔ Codex indirect, E2: Claude indirect ↔ Codex direct). → **규칙 v2.1 미확정 유지 · R4 「확대 가능」 철회.** R5/R6 762문항(두 트랙 모두 Claude)도 같은 모델 일치이므로 교차 모델 표본(T-0101, 94문항 층화)으로 R1 direct 유지율을 잰 뒤 인계 범위를 정한다.

## 10. R5/R6 교차 모델 표본(T-0101 · [xmodel-agreement.json](./xmodel-agreement.json))

762문항 중 유형 층화 94문항을 Codex 가 원문만 보고 판정해 Claude A · B 와 비교.

| TASK | κ Claude–Claude | κ Claude–Codex | R1 direct 유지 | Codex 만 direct | 인계 |
|---|---:|---:|---:|---:|---|
| R5 | .90 | .68–.71 | **23/23** | 13(빈칸 8 · 무관 문장 3) | **direct 하한으로 인계 가능** — 배점은 과소 추정 |
| R6 | .67 | .41–.44 | 13/19 | 5 | **보류** — 뒤집힌 6 전부 빈칸 |

빈칸에서 정답 의미가 본문에 재진술되면 Codex 는 R5 · R6 무관, Claude 는 R6 direct 로 귀속했다(RULES_V2 §8-7). `exam-relevance.json` 의 `handoff` 가 이 상태를 기계 판독용으로 담는다 — R5 direct 만 `handoff_lower_bound`, R6 · indirect 는 보류.

## 재실행

```bash
cd apps/web && node --tls-max-v1.2 --env-file=<메인 apps/web/.env.local> --import tsx ../../scripts/csat/map/v62/data/coverage-audit.mts
node scripts/csat/map/v62/data/pilot-run.mjs validate && node scripts/csat/map/v62/data/pilot-run.mjs agree
node scripts/csat/map/v62/data/batch-run.mjs validate r5r6 && node scripts/csat/map/v62/data/batch-run.mjs agree r5r6   # rules-v2 도 같은 형식
node scripts/csat/map/v62/data/exam-relevance.mjs
```
