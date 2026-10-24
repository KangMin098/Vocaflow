# 대량작업 C 종료 후속 A~D (2026-10-24)

> 연구 브랜치 산출물이다. 강의 원본·분석·공식 정답·DB·main 변경 없음(DB 는 SELECT 만). 새 TASK 없음. 사람 콘텐츠 승인 0건. 학습 효과: NOT_EVALUATED.

| 갈래 | 결과 | 파일 |
|---|---|---|
| A T-0148 | 평가 계약 확정(블라인드 1단계 → 반례 자료 2단계 → 키 재감수, 재개 기준 H1~H5). 반례 점검: 과잉 일반화 14 중 반례 7 · 정상 12 중 반례 후보 3(키 오류 가능 — 사람 판정 대상). **BLOCKED 유지 · 생성 지침 main 통합 보류** | `A_T0148_HUMAN_EVAL_CONTRACT.md` · `CE1~3.jsonl` · `../f1/HUMAN_SCORING_KIT.md` · `../f1/human_scores_TEMPLATE.csv` |
| B validate.ts | owner HEAD 253a6f34e 와 충돌 없음 · ESLint 0 · Vitest lecture 82 통과(csat 전체 3 실패는 패치 없이도 같은 기존 실패) · tsc 0 · **Codex APPROVE**(P2 2 · P3 1, 미수정) · ok/issues · 게이트 불변 | `../f1/validate-candidate/validate-warning.patch` · AI-Control `runtime/c-lecture-validate-warning-20261024/DELIVERY.md` · `verification/reviews/T-0148-validate-warning-codex-253a6f34e.md` |
| C 콘텐츠 | 인계표 30(27 + 신규 2 + 2014A#29) + 보류 1(2025#30). 지문 문장 30/30 공식 일치, 차이는 선지 끝 추출 잔여물뿐. 분석 판본 기록 | `C_CONTENT_REVIEW_30.md` · `OT1·OT2.jsonl` |
| D DB 정정 | 4행 SQL · sha256 · 비파괴 복구 · 왕복 검증 · 영향 범위(해설 서술 불일치 · 재동기화 재발) · 전체 규모 후보 441 | `db-fix/README.md` · `forward.sql` · `recovery.sql` — **미적용** |

## 도표 20건 — 「18 외 2건」

| 상태 | 수 | 문항 |
|---|---|---|
| 공식 이미지 대조 완료 · 수치 완전 일치(MATCH) | 18 | 2017#24 · 2018#24 · 2020~2026#25 · M2006 · M2206 · M2309 · M2406 · M2409 · M2506 · M2509 · M2609 · M2706#25 |
| 공식 이미지 대조 완료 · **근사 일치** | 1 | M1809#24 — 막대에 수치 라벨이 없어 눈금 어림. 정답 성립 · 강의와 모순 없음, 정밀 수치는 미확정 |
| 공식 이미지 대조 완료 · **추출 오류 → 콘텐츠 오류** | 1 | 2014A#29 — 도표가 아니라 안내문 표. 각주 누락 → 강의 c9 판정 보류. D 정정 대상 |

**DB 수치 공백과 이미지 대조 완료는 다른 상태다.** 20건 모두 DB `csat_items.passage` 에는 도표 수치가 여전히 없다(구조적 추출 공백 — 해소되지 않음). 수치는 분석 `confirmed_at` 과 이번 공식 이미지 판독 기록(`../f5/`)에만 있다. 「DATA_GAP 0」은 **내용 판정에 필요한 공식 자료를 확인했다**는 뜻이고, DB 에 수치가 들어갔다는 뜻이 아니다. 판독은 서브에이전트 1명이 했다(교차 없음).
