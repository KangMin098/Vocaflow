# 대량작업 E — 기출분석 학습 효과·전이 평가 환경 (2026-10-24)

독립 연구 경로. 원본 콘텐츠·제품 코드·DB 를 바꾸지 않는다(DB 는 SELECT 만). 실제 학습자 결과는 **NOT_EVALUATED**.

근거 자료(읽기 전용): G1 연구 수용본 `810a463ac`(research/csat-all-types-20261024) · S1 T-0141/T-0142 수용본(docs/csat-s1-integration-20261024) · P6 마이그레이션 `20261023194123`·`20261024012226`(T-0144).

| 파일 | 내용 |
|---|---|
| [01_DESIGNER_THINKING_RUBRIC.md](01_DESIGNER_THINKING_RUBRIC.md) · `rubric/levels.json` | U0–U5 정의 · 증거 코드 · 함정 · 2026-34/22/38 사고 구조 |
| [02_EVIDENCE_CONDITION_SCOPE.md](02_EVIDENCE_CONDITION_SCOPE.md) · `rubric/type-evidence.json` | 유형군별 근거·조건·범위 기준, 범위 오류 SE-* |
| [03_ANSWER_DISTRACTOR_LOGIC.md](03_ANSWER_DISTRACTOR_LOGIC.md) · `rubric/distractor-logic.json` | trap-atlas 기반 오답 실패 코드 · U3 채점 |
| [04_TRANSFER_CONTRACT.md](04_TRANSFER_CONTRACT.md) · `transfer/candidates.json` | 전이 게이트 · 후보 17건(적격 0) |
| [05_EXPOSURE_ELIGIBILITY_MODEL.md](05_EXPOSURE_ELIGIBILITY_MODEL.md) · `rubric/p6-exposure-map.json` | P6 → X0–X3 · 독립 자격 |
| [06_PATHS_USABILITY_LOAD.md](06_PATHS_USABILITY_LOAD.md) · `instruments/load-usability.json` | 경로별 평가 · 공정성 · 부담/사용성 도구 |
| [07_TOOLING.md](07_TOOLING.md) · `tool/` | 평가 보조 코드 · 일치율 · 불일치 검토 HTML · 비교 · 점검 |
| [08_INTEGRATION_PILOT_PROTOCOL.md](08_INTEGRATION_PILOT_PROTOCOL.md) | 통합 판정 · 전후 분석 방법 · 파일럿 선행 조건 |

테스트: `node --test docs/research/csat-learning-eval-20261024/tool/__tests__/*.test.mjs`
