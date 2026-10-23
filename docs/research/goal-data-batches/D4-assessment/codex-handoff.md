# D4 → Codex 독립 검증 요청

- 대상: 이 폴더의 `task-assessment-matrix.json` · `instrument-gap.json` · `content-inventory.json` · `assessment-review.md`(브랜치 `data/goal-batches-20261023`, 입력 HEAD는 각 JSON의 `input_head`).
- 성격: Claude C의 AI 감사 결과다. 사람 Gold · 출시 승인이 아니다. 검증된 항목만 제품 담당 Claude에 넘긴다.
- 금지: 코드북 · 평가 정본 · 제품 코드 · DB 쓰기. 결과 파일은 이 폴더의 `codex-verdict.json` 하나에만 쓴다.

## 검증할 것

1. **판정 코드 주장** — `skill-diagnosis.ts`의 확정(맞힌 문항 없이 2개 막힘) · 해소(확정 뒤 연속 2) 규칙이 다른 날 · 서로 다른 지문 · 역할(transfer/delayed)을 정말로 검사하지 않는지. 다른 경로(`v62/supply.ts`, `load.ts`, `lifecycle-evidence.ts`, `evidence-claims.ts`)에 경과 시간 판정이 있으면 M2 · R5/E2 분류가 틀린 것이다.
2. **M1** — 첫 확인부터 맞힌 학습자가 `checking`에 머물고 `resolved`(도달)에 닿지 못한다는 주장. 목표 PLAN 엔진(`feat/goal-plan`)이 `checking`을 도달로 읽는 경로가 있는지는 **읽기만** 해서 확인한다.
3. **5분류 21건** — 특히 R2 · E3(실제 평가 가능)의 정본 확인 키가 실제 기출 문항에 연결되는지, V4 · R6(사람 승인 대기)에 놓친 도달 조건이 없는지.
4. **M4 · M7 방어 주장** — 연습 기록 제외, 중심 TASK 1개 Template에만 확인 키를 붙이는 규칙이 우회되는 경로가 있는지.
5. **누락** — 이 감사가 보지 못한 평가 계약 충돌.

## 산출

`codex-verdict.json`: 항목별 `{id, verdict: confirmed|refuted|unclear, evidence: 파일:줄, note}`와, 목표 달성 시스템 영향 기준 공백 우선순위 상위 5개. `unclear`를 `confirmed`로 올리지 않는다.
