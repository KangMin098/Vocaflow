# S1 최종 통합 상세설계 (G2·G4·G5)

- AI-Control **T-0138** · 작성 owner `csat-s1-integration`(Claude Code) · 독립 검증 owner `csat-s1-codex-review`(Codex, 작성 미참여) · 2026-10-24
- 브랜치 `docs/csat-s1-integration-20261024`(기준 `81d6732b2`, T-0136 수용 커밋). G3(T-0137, Codex `csat-v4-s0`)와 파일을 공유하지 않는다.
- 상태: **DRAFT — 독립 검증 전.** S1 설계 수용 ≠ 제품 구현 ≠ S2 전체 착수 ≠ main 통합. 학습 효과는 어떤 항목도 검증하지 않았다.

## 산출물

| 지시 산출물 | 위치 |
|---|---|
| 1 S1 통합 교수설계 계약 · 4 공개/강의/기록 계약 · 5 콘텐츠/버전/권한/데이터 결속 | [01_CONTRACT](./01_CONTRACT.md) A~F |
| 2 전체 유형 × 판단 기능 매트릭스 · 3 공통/유형 전용 UI 계약 · G4 교차 검증 | [02_TYPES_UI_CROSSCHECK](./02_TYPES_UI_CROSSCHECK.md) |
| 6 연구↔제품 충돌 해결 · 7 34번 이관 차이분석 · 9 독립 검증 근거와 이견 | [03_CONFLICTS_TRANSFER_EVIDENCE](./03_CONFLICTS_TRANSFER_EVIDENCE.md) |
| 8 유형별 구현 준비도·우선순위 · 10 S2 제한 착수 후보 | [04_READINESS_S2](./04_READINESS_S2.md) |

## 입력과 보존

| 입력 | 위치 · 고정값 |
|---|---|
| v6.0 기준서 | 사용자 제공 `Vocaflow_CSAT_5인_최종교차심사_목표우선_통합설계_v6.0_20261023.md`(저장소 밖) |
| G1 전체 유형 연구 00~19 | `D:/workspace/Vocaflow/docs/csat-learner/all-types-research-20261024/` — **미커밋 파일**(다른 세션 산출물, 이 작업은 옮기거나 커밋하지 않음). sha256 앞 16자: 00 `95b79686652d9535` · 01 `abaf05e9970fb464` · 02 `b56785eb49d9cf82` · 03 `bdf800bc7689ecfb` · 04 `cae0d6f7771a7371` · 05 `fd5b0601c172bb76` · 06 `327d22f4c9e497f9` · 07 `43adb132c9dfbfb7` · 08 `a4ccadac029a410d` · 09 `6988a307f3068cb0` · 10 `dcd8a708b2b1b7aa` · 11 `9a57b6b248568ebb` · 12 `931cb056ea762758` · 13 `e7372a7c55c21d1e` · 14 `723c25ebeaf8d642` · 15 `3d1518a676a830bf` · 16 `ca8a2045367e7470` · 17 `3eb26a8ad8b276bb` · 18 `a8ae52a333b3ee3c` · 19 `1434a2bebb730e1e` |
| T-0136 수용 범위 · 34번 이관 명세 | `skeleton-v4/s1-v6/correction/r2/`@`81d6732b2`(COMPLETED, 리뷰 `T-0136-R2-claude-review-81d6732b2.md`) |
| 강의 학습자 제어 | `feat/lecture-learner-control`@`2bd99a0f1`(main `e3e0a6a0e` 위 5커밋, 미통합) |
| S0 수용 | DL-0201 @`68633c195` |

## 이번에 직접 재확인한 사실 (2026-10-24)

- main `e3e0a6a0e`: `AnalysisTheater.tsx:851` 재생 중 `selectScene(target,'replace')`, `LectureStage.tsx:303` cue마다 `scrollIntoView` — 존재.
- main 강의 대본 29개 회차 모두 「정답은」 23~30회.
- `feat/lecture-learner-control`는 현재 main의 자손이며 앞선 커밋 5개.
- 2026-34 v3: ① false/fails · ② unknown/fails · ③ true/satisfies / 2026-22 ③ true/fails · ① true/satisfies / 2026-38 전 선지 n_a, ⑤ satisfies(이전 검토에서 `inquiry-data.json` 원자료로 확인).

그 밖의 수치는 G1 연구·T-0136 기록 인용이며 문서마다 출처를 적었다.

## 하지 않은 것

제품 코드·DB·원본 v3·강의 원본·다른 owner 파일 변경 없음. 미승인 콘텐츠(34② 진위 서술, 38⑤ C1, 강의 수정 후보)를 확정 설명으로 쓰지 않음. 새 분류·숫자·근거 생성 없음.
