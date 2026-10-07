# G6-S — 합성 학습자 Pilot (실제 사람 없음)

> 2026-10-07. 실제 참가자를 쓸 수 없는 단계에서 G6 파이프라인(수집 → 감지기 → probe → 판정 → R6 분석)을 끝까지 돌리는 시뮬레이션.
> **결과는 모두 `synthetic` — 실제 학생 증거 · 실제 run 과 섞지 않는다.** 판정은 파일로만 두고 v0.1 실제 회차 · 판정 표에 적재하지 않는다.

## 역할

| 일 | 담당 |
|---|---|
| 설계 · 하니스 · 분석 보고 | Claude Code |
| 합성 학습자 생성(페르소나별 답 · 과정 증거 · 숨은 정답 원인) | Claude Code 서브에이전트(LLM 배치 드레인) |
| 실제 DB 경로 실행(테스트 계정 · 수집 · 감지기 · probe · 완료 · 정리) | 하니스 `run-synthetic.mts` |
| 독립 blind 판정 | **Claude**(서브에이전트) · **Codex**(`codex exec`) — 같은 비식별 packet, 서로 결과 안 봄 |
| 코드 리뷰 | Codex Stop 훅(커밋 마일스톤 · P0/P1) |

## 설계

- 시험: M2409 · M2406(평가원 · 독해). **대상 문항(정오 무관 · 사전 고정)**: 21(함축) · 24(제목) · 30(어휘) · 31–34(빈칸) · 40(요약) — 회차당 8, 페르소나 6 × 2회 = **96 attempt**.
- 페르소나 6(`personas.json`): 오류 경향이 다르다 — 특히 S01(V.wrong_sense) · S02(R.inference) · S03(V/R 경계 혼재)가 R6 연구 대상.
- 합성 학습자는 attempt 마다 **숨은 정답 원인**(`true_cause`, 정답 문항은 null)을 갖는다 → 판정 정확도와 「probe 가 판정을 정답 원인 쪽으로 옮기는가」를 잴 수 있다(실제 Pilot 에서는 못 재는 것).
- 잡음: 해석 모름/건너뜀, 학생 범주 오표시, probe 응답의 확률적 어긋남(정답 원인 V → A 위주, R → B 위주) — 생성 지시(`GEN_SPEC.md`)에 고정.
- pre-probe packet(targeted_probe 뺀 증거) · post-probe packet(전체)을 각 판정자가 따로 판정. 판정자는 정답 원인을 보지 않는다.

## 산출물

- 저장소: 페르소나 · 생성 지시 · 하니스 · 분석 스크립트 · **집계 보고**(`docs/csat-learner/pilot-runs/synthetic-<date>.md`).
- 저장소 밖(`.pilot-private/synthetic/`): 문항 원문 덤프 · 생성 결과 · packet · 판정 원본 · 매핑.
