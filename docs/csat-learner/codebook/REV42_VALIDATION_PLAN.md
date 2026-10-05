# rev4.2 R6 재검증 — 사전 등록 (2026-10-05 · 사례 작성 · 실행 전에 고정)

> 코드북: [CODEBOOK.rev4.2.md](./CODEBOOK.rev4.2.md) `c7001aff97b0`(초안). §6/R9 · R12(+ R12 ② 고정 표현 판별)는 채택됐다 — R12 는 N-04 adjudication(두 adjudicator GOLD_WRONG, [ADJUDICATION_REV41_N04.md](./ADJUDICATION_REV41_N04.md))으로 7/8 → 기준 충족. rev4.1 의 **R6 ④ 결정성 검사는 뺐다**(C4-11 을 새로 틀리게 함) — R6 은 rev4 의 ①②③ 과 같은 문구다.
> 이번에는 **R6 만** 새 사례로 다시 본다. 절차: 같은 4중 blind. 사람 검증 아님.
> 참고: N-04 adjudication 근거에 R6 ④ 도 언급됐지만, 두 adjudicator 모두 R12 ② 만으로 V.multiword 가 배제된다고 적었다 — R6 ④ 제거가 R12 채택 근거를 무너뜨리지 않는다.

## 세트(15건 → 실행 전 수정 14건, 아래 봉인 기록)

| 세트 | 사례 |
|---|---|
| Holdout(새 사례 8) | R42-H1 · H2 명백한 `V.wrong_sense` · H3 · H4 명백한 `R.inference` · H5 둘 다 나타나지만 낱말 실패가 먼저(`V.wrong_sense`, R.inference contributing 가능) · H6 둘 다 나타나지만 실제 원인은 구절 대응뿐(`R.inference`) · H7 증거 부족 control(`insufficient_evidence`) · H8 어려운 경계(두 후보가 각각 최소 증거 · 단계 순서로 못 가름 → `multiple_plausible` V.wrong_sense · R.inference) |
| Regression R6 | C4-11 · H-13 · H-05 · C4-07 · R4-H2(기대 일치) · C2-02 · R4-H1(수렴) |

## 사례 작성 — 증거 설계를 먼저 검증

1. 새 context 작성 에이전트(rev4.2 코드북 · 새 문항 후보만 읽음)가 8건을 쓴다. 학생 증거에 「의도한 정답 코드」를 직접 쓰지 않되, **무엇을 어떻게 해석했는지는 실제로 드러나야** 한다(R.inference 사례면 「낱말 뜻은 제대로 설명했지만 구절이 글에서 뜻하는 바를 잘못 설명」이 과정 증거로 보여야 한다).
2. **봉인 전 증거 설계 검토**: 다른 모델(Codex, 새 context, 읽기 전용)이 사례마다 「이 증거로 엄격한 판정자가 기대 판정에 도달하는가 · 경쟁 코드가 배제되는가 · 증거가 정답을 누설하는가」를 본다. 약점이 나온 사례는 작성자가 고친 뒤 봉인한다(검토 결과는 실행 폴더에 남긴다).
3. 기대 판정을 sha256 으로 봉인한 뒤 실행. 결과를 본 뒤 고치지 않는다.

## 채택 기준 — [data/rev42-eval-spec.json](./data/rev42-eval-spec.json)

- R6 채택: holdout 8건 모두 `FINAL_VERIFIED` + 기대와 같음 · regression 기대 일치 5건 모두 같음 · 수렴 2건 모두 수렴.
- 퇴행 없음: regression 5건 일치가 rev4 회차(5/5)보다 낮으면 보류.
- holdout 기대와 모델 합의가 다르면 adjudication(v2) 뒤에만 판단한다.

## 그 뒤 — v0.1 seed candidate 판단

[ADJUDICATION_PLAN.md](./ADJUDICATION_PLAN.md) 의 사전 등록 seed 조건 6개를 그대로 적용한다(R6 결과를 반영한 코드북 기준). R6 이 채택되지 않으면 seed 후보로 올리지 않는다 — R6 경계를 seed 범위에서 빼는 것은 최후의 선택지로만 남긴다.

## 봉인 기록

- 2026-10-05 실행 전 **사전 등록 수정**: holdout 을 8 → **7건**(H8 제외) · spec 에서 R42-H8 삭제. 이유 — H8(어려운 경계 · multiple_plausible V.wrong_sense · R.inference)을 두 번 설계 · Codex 증거 설계 검토 두 번 모두 FAIL: 두 후보에 각각 증거가 있으면 R6 ③ · R3 이 V 를 먼저 세우고, 한쪽 증거가 약하면 그 후보가 최소 증거 미달이다. **rev4.2 에서 이 경계의 multiple_plausible 은 구조적으로 거의 생기지 않는다** — 규칙이 결정적이라는 뜻이기도 하다(발견으로 기록, 실행 폴더 h8-dropped.json).
- 증거 설계 검토(Codex, 새 context, 자료 인라인): 1차 OK 3 · WEAK 3(H3 · H4 · H6) · FAIL 2(H7 · H8) → 작성자 수정 → 2차 OK 6 · WEAK 1(H7 「시간 안에」 가 X.time 으로 읽힘) · FAIL 1(H8). H7 은 운영자가 시간 표현만 지움(「무슨 말인지 잘 모르겠어서 그냥 찍었어요」) — 판정 대상 증거의 다른 부분은 그대로. 검토 기록은 실행 폴더(rev42-authoring/evidence-review*.txt).
- 봉인: 말뭉치 `data/rev42-corpus.json`(`rev42-v1`, 14건 = holdout 7 · regression 7) · 코드북 `c7001aff97b0…` · 기대 판정 `data/sealed/rev42-expected.json` `6328b56964ff…`.
