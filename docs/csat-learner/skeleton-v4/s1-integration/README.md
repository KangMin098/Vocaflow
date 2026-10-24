# S1 최종 통합 상세설계 (G2·G4·G5)

- AI-Control **T-0138** · 작성 owner `csat-s1-integration`(Claude Code) · 독립 검증 owner `csat-s1-codex-review`(Codex, 작성 미참여) · 2026-10-24
- 브랜치 `docs/csat-s1-integration-20261024`(기준 `81d6732b2`, T-0136 수용 커밋). G3(T-0137, Codex `csat-v4-s0`)와 파일을 공유하지 않는다.
- 상태: **S1 설계 정리 종료(2026-10-24).** T-0138·T-0141·T-0142 모두 Codex 공식 ACCEPT·COMPLETED(아래 표). S1 설계 수용 ≠ 제품 구현 ≠ S2 전체 착수 ≠ main 통합. 학습 효과는 어떤 항목도 검증하지 않았다.

## 공식 수용 기록

| TASK | 범위 | 검증 커밋 | 리뷰(AI-Control `verification/reviews/`) | 남은 비차단 |
|---|---|---|---|---|
| T-0138 | S1 통합 상세설계 01~05 | `102245ee9` | `T-0138-codex-review-102245ee9.md`(run 1 반려: `T-0138-codex-cue-sidecar-15831882a-20261024.md`) | 01 근거 표기·02 R-IRRELEVANT 사례 → T-0141에서 정정 |
| T-0139 | G1 연구(입력 근거) | `810a463ac` | `T-0139-codex-review-810a463ac-r2.md`(DB 독립 재현) | 일치율 0.8498<0.85 · 역사 서술 읽는 순서 |
| T-0141 | 06 잔여 보완 | `ff57a8b2b` | `T-0141-codex-review-ff57a8b2b.md`(run 1 반려: `…-7d31fde74.md`) | T141-03 → 이 정리 커밋에서 정정 |
| T-0142 | 07 S2-d 준비도 실측 | `7f0983141` | `T-0142-codex-review-7f0983141.md` | T142-01·02 → 이 정리 커밋에서 정정 |

연관 수용: T-0136 `81d6732b2`(34 이관 설계·D1·D2) · T-0137 `fb6bf663e`(G3 차이분석).

## 산출물

| 지시 산출물 | 위치 |
|---|---|
| 1 S1 통합 교수설계 계약 · 4 공개/강의/기록 계약 · 5 콘텐츠/버전/권한/데이터 결속 | [01_CONTRACT](./01_CONTRACT.md) A~F |
| 2 전체 유형 × 판단 기능 매트릭스 · 3 공통/유형 전용 UI 계약 · G4 교차 검증 | [02_TYPES_UI_CROSSCHECK](./02_TYPES_UI_CROSSCHECK.md) |
| 6 연구↔제품 충돌 해결 · 7 34번 이관 차이분석 · 9 독립 검증 근거와 이견 | [03_CONFLICTS_TRANSFER_EVIDENCE](./03_CONFLICTS_TRANSFER_EVIDENCE.md) |
| 8 유형별 구현 준비도·우선순위 · 10 S2 제한 착수 후보 | [04_READINESS_S2](./04_READINESS_S2.md) |
| 4·5 보강: 강의 cue 공개 수준 자료·조기 공개 34·공개 게이트 | [05_CUE_DISCLOSURE](./05_CUE_DISCLOSURE.md) |
| T-0141 잔여 보완: 44유형 대응표 · 34 cue 공개×강의 제어 충돌 · S2-a~d 소유·착수·AT | [06_RESIDUAL](./06_RESIDUAL.md) |
| T-0142 S2-d: 44유형 실제 코드·DB 준비도(대응표 대비 차이) | [07_S2D_READINESS](./07_S2D_READINESS.md) |

## 입력과 보존

| 입력 | 위치 · 고정값 |
|---|---|
| v6.0 기준서 | 사용자 제공 `Vocaflow_CSAT_5인_최종교차심사_목표우선_통합설계_v6.0_20261023.md`(저장소 밖) |
| G1 전체 유형 연구 | 브랜치 `research/csat-all-types-20261024` 커밋 **`810a463acf8e9221fca3484d66f31d843f4a543d`**(원격 일치). 문서 00~21 · `cue-audit/sidecar-reviewed/*.disclosure.json` 29 · `review-summary.json` · `review/group-{1..5}.{A,B}.json` · `sidecar-build.mjs`/`review-merge.mjs`. 원본 강의 `e3e0a6a0e` 29파일 blob·SHA256·cue SHA256 결속. 정답 출처 DB `csat_items.answer` SELECT. 미검수·미커밋 `cue-audit/sidecar/` 30파일은 정본 아님. 연구 산출물. **T-0139 ACCEPT·COMPLETED @`810a463ac`(연구 범위)**. 이후 연구 커밋(원격 `research/csat-all-types-20261024` = `144eaba3f`)은 수용 승계 없음 |
| T-0136 수용 범위 · 34번 이관 명세 | `skeleton-v4/s1-v6/correction/r2/`@`81d6732b2`(COMPLETED, 리뷰 `T-0136-R2-claude-review-81d6732b2.md`) |
| 강의 학습자 제어 | 설계 입력 시점 `feat/lecture-learner-control`@`0e36138e3`. 현재 원격 `5807c6f70`(T-0140 보정 포함, owner `csat-lecture-disclosure`, BLOCKED_AUTH, main 미통합) |
| S0 수용 | DL-0201 @`68633c195` |

## 이번에 직접 재확인한 사실 (2026-10-24)

- main `e3e0a6a0e`: `AnalysisTheater.tsx:851` 재생 중 `selectScene(target,'replace')`, `LectureStage.tsx:303` cue마다 `scrollIntoView` — 존재.
- main 강의 대본 29개 회차 모두 「정답은」 23~30회.
- `feat/lecture-learner-control`@`0e36138e3`는 main `e3e0a6a0e`의 자손이며 앞선 커밋 6개(변경 파일 5).
- 2026-34 v3: ① false/fails · ② unknown/fails · ③ true/satisfies / 2026-22 ③ true/fails · ① true/satisfies / 2026-38 전 선지 n_a, ⑤ satisfies(이전 검토에서 `inquiry-data.json` 원자료로 확인).

그 밖의 수치는 G1 연구·T-0136 기록 인용이며 문서마다 출처를 적었다.

## 하지 않은 것

제품 코드·DB·원본 v3·강의 원본·다른 owner 파일 변경 없음. 미승인 콘텐츠(34② 진위 서술, 38⑤ C1, 강의 수정 후보)를 확정 설명으로 쓰지 않음. 새 분류·숫자·근거 생성 없음.


## run 2 정정 (공식 반려 T138-CUE-01·02·03 · `T-0138-codex-cue-sidecar-15831882a-20261024.md`)

| ID | run 1(`15831882a`) | run 2 |
|---|---|---|
| CUE-01 P1 | 「cue 공개 태그 0」 · S2-c = 신규 전수 태깅 · G1 출처 = 미커밋 해시 | sidecar v1 존재 인정. F07b를 연구 CONDITIONAL / 내용 CONTENT_REVIEW_REQUIRED / 제품 CONDITIONAL / 효과 NOT_EVALUATED로 분리(04). S2-c = 기존 sidecar 품질 보완·독립 검수·승인·제한 적용(04). 출처를 `810a463ac`에 결속(위 표) |
| CUE-02 P1 | 자동 경계 R1/R2/R7로 정답 전 구간 정의 가능하다는 전제 | 경계보다 앞선 2인 합의 DECISIVE/ANSWER 34 cue 전수 원문·공식 정답 대조(05 §2). 모두 OFFICIAL_ANSWER 동급 경계. 놓친 패턴 4종을 검출 대상으로 |
| CUE-03 P1 | B4 3값(none/hint/answer), UNKNOWN 규칙 없음 | 5값 + UNKNOWN fail-closed + 런타임 노출 이력 + 채널 일관 + 노출 단조(05 §3, 01 B4~B6) |
| 품질 조건 | — | 일치율 0.8497718498 < 0.85 원비율 표기, κ 0.701 한계 명시(05 §1) |
| 작성자 보류 P6·P7 | 따라가기 기본 켜짐 조건부 허용 · 34 이관 대조가 T-0136 기준 | G3(T-0137 ACCEPT)에 맞춰 기본 수동(01 C2, 03 K12), 이관 대조 갱신(03 §2) |

보존: T-0136 제한 수용 · F08 미선정 · C1 콘텐츠 미승인 · F02/F06/F09/F10 BLOCKED_EVIDENCE · 공통 교수설계 계약(01 A·D·E·F). run 2는 이후 `102245ee9`에서 Codex 공식 ACCEPT.
