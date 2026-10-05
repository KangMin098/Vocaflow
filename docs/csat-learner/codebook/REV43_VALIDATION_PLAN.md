# rev4.3 R6 마지막 targeted 재검증 — 사전 등록 (2026-10-05 · 사례 작성 · 실행 전에 고정)

> 코드북: [CODEBOOK.rev4.3.md](./CODEBOOK.rev4.3.md) `b3090d5c8425`(초안). rev4.2 와 R6 행만 다르다 — **의미 도달 경로(meaning provenance)**: V/R 은 학생 해석이 사전에 있는 뜻인지가 아니라 학생이 그 뜻에 어떻게 도달했는지로 가른다. **사전 뜻 우연 일치**(기본 뜻에서 도출한 틀린 비유가 우연히 다른 사전 뜻과 같음 → R.inference). ③ 은 두 실패가 각각 독립 최소 증거를 갖출 때만. multiple_plausible 은 드물지만 금지하지 않는다.
> 근거: [REV42_EVAL.md](./REV42_EVAL.md)(holdout 7/7, C4-11 만 미해결) · [ADJUDICATION_REV42_C411.md](./ADJUDICATION_REV42_C411.md)(RULE_INSUFFICIENT / SHARED_MODEL_BIAS 갈림 — Claude 가 짚은 공백).
> **이 경계의 마지막 targeted 패치**다. 다시 실패하면 rev4.4 를 만들지 않고 ① 경계 재설계 ② seed 에서 명시적 unresolved 경계 ③ Pilot 까지 두 코드 provisional ④ 필요 시 사람 전문가 검증 중에서 고른다.
> §6/R9 · R12 는 채택됐다. 다른 규칙은 고치지 않는다. 절차: 같은 4중 blind, 이전 회차 결과는 판정자에게 주지 않는다. 사람 검증 아님.

## 세트(18건)

| 세트 | 사례 |
|---|---|
| Holdout(새 4) | R43-HA 사전 뜻 우연 일치 → `R.inference` · R43-HB 다른 사전 뜻을 직접 고름 → `V.wrong_sense` · R43-HC 틀린 사전 뜻을 먼저 고르고 그 위 추론도 틀림 → `V.wrong_sense` primary(R.inference contributing 은 기존 규칙으로) · R43-HD 최종 오역만 있고 도달 경로 증거 없음 → 작성자가 rev4.3 로 정해 봉인(insufficient 등) |
| Regression(기대 일치) | rev4.2 holdout 7(R42-H1–H7 — **훼손되면 안 된다**) · C4-11(`R.inference` — 사전 뜻 우연 일치의 원래 사례) · H-13 · H-05 · C4-07 · R4-H2 |
| Regression(수렴) | C2-02 · R4-H1 |

## 사례 작성 · 봉인

새 context 작성 에이전트(rev4.3 코드북 · 새 문항 후보만 읽음) → Codex 증거 설계 검토(새 context, 자료 인라인) → 약점 수정 → 기대 판정 sha256 봉인 → 실행. 결과를 본 뒤 고치지 않는다.

## 채택 기준 — [data/rev43-eval-spec.json](./data/rev43-eval-spec.json)

- holdout 4 모두 `FINAL_VERIFIED` + 기대와 같음(HA 와 HB 가 반대 방향으로 갈려야 한다).
- regression 기대 일치 12 모두 같음 — 특히 rev4.2 holdout 7 과 C4-11.
- 수렴 2 모두 수렴. 퇴행 없음: 기대가 정해진 11건(C4-11 제외 — rev4.2 에서 미해결)이 11/11.
- 미해결 · 불일치가 나오면 **같은 묶음 안에서** adjudication(v2)을 돌린다. 사례 · 증거 한계(CASE_CONSTRUCTION · GENUINELY_UNRESOLVED · GOLD_WRONG)면 규칙 실패로 세지 않고, RULE_INSUFFICIENT · TAXONOMY_OVERLAP 면 R6 실패.
- 한계: 한 회차로 「회차마다 뒤집히는 현상」 이 해소됐는지는 증명되지 않는다 — C4-11 이 이번 회차에서 4판정 모두 같은 방향인지(Gate 1 · 반대검증 포함)를 보조 지표로 본다.

## R6 통과 시 — v0.1 seed candidate 판단

[ADJUDICATION_PLAN.md](./ADJUDICATION_PLAN.md) 의 사전 등록 seed 조건 6개를 rev4.3 기준으로 적용해 `SEED_DECISION.md` 에 판정한다. 검증 전에는 seed 를 만들지 않는다.

## 봉인 기록

(사례 작성 · 증거 설계 검토 뒤, 실행 전에 채운다)
