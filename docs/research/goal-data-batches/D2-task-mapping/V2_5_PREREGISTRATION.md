# 계약 v2.5 사전 등록 — 봉인 판단용 비교 설계 (rev4 · T-0115 반영)

> 원칙: v2.5 를 도출한 b7 갈림 9문항에 v2.5 를 적용한 일치는 맞춤(과적합)이라 봉인 근거가 아니다. 규칙 · 계산 · 프롬프트를 먼저 고정하고, **아직 판정하지 않은 문항**에 미리 정한 지표로 v2.4 와 비교한다.
> rev2 → rev3(T-0114): P1-01 계산 · 선정 선택 고정 · P1-02 열람 금지 입증 방식 · P1-03 재등록 · 동결 대상 · 유형별 결론 금지.
> rev3 → rev4(T-0115): 비교 계산이 d2-run 과 같은 공용 로더(청크 검사 포함)를 쓴다 · b10 경로 구현(gate · 합집합) · 독립 대조 10 선정 규칙 고정 · 자기 트랙만 검증 · 최초 출력 snapshot 순서. **rev3 시도는 판정 전이라 본 문항이 없어 폐기할 표본이 없다.**

## 1. 동결 집합 — 결과 계산 전까지 한 바이트도 바꾸지 않는다

| 파일 | sha256 |
|---|---|
| `docs/csat-learner/v62/data-expansion/ANALYST_CONTRACT.md` | `91eecbbf158e20e98d5f783aa5d4640bc97ab608c9e98995c2c67e1869acdb32` |
| `docs/research/goal-data-batches/D2-task-mapping/CONTRACT_V2.md` | `586e814bc9629885cf2d8a4f146121bf1afd8efbc3eef363fea763c72e1ed949` |
| `docs/research/goal-data-batches/D2-task-mapping/CONTRACT_V2_1.md` | `4d1bc84c81879f3242b6d5525b68078c3fa368af153fc8e4c6b38381271e79fe` |
| `docs/research/goal-data-batches/D2-task-mapping/CONTRACT_V2_2.md` | `eb00328d84e76eb3da75e60fea0c9c0909587b250accbfc093e934a0bb77fec1` |
| `docs/research/goal-data-batches/D2-task-mapping/CONTRACT_V2_3.md` | `565da9c4a42efe242cbf9deb024fce17dbbc47feca0024520943a29231f3ea4d` |
| `docs/research/goal-data-batches/D2-task-mapping/CONTRACT_V2_4.md` | `434e43791f4e0bbea90bb09db5e5d8d4bebf3f6f7388f15ad44b5402a5404e62` |
| `docs/research/goal-data-batches/D2-task-mapping/CONTRACT_V2_5.md` | `6a9ac5e7de81cdf2a507cdb1dec35fa6d24261a125827b8b26d764bbbd26fbd6` |
| `docs/csat-learner/v4/codebook.json` | `e53141985380c410be02cc8cf84e204479f075520b92448a40dde366551c1c6a` |
| `scripts/csat/map/v62/data/pilot-lib.mjs` | `9e0e8a9f6126a0e3569d1837d61fd5d55f53cc55d6908c14e65ca93ed12826b2` |
| `scripts/research/goal-data/d2-validate.mjs` | `a75219fc66d641bef4ed9b2f49765851e9bf8751290cfcb3abcd04b3bac439ca` |
| `scripts/research/goal-data/d2-validate.check.mjs` | `08ed083a5d7f75d0e01f51721966c7cd3dd740979544908b7e902a9afcbef787` |
| `scripts/research/goal-data/d2-run.mjs` | `ee8f9361df77a399945fefebb37e208b6514f6f5611bf11c25eb105021e40f5e` |
| `scripts/research/goal-data/d2-export.mjs` | `b6b89f3c125079ed25e0d41efd2d9d1e5cdedb7785e1a50c88ab547f1c6043f9` |
| `scripts/research/goal-data/insert-split.mjs` | `7dce076dd5a2d8c899e68b36ef1260b1de104739ef1aecd3367cc666c1bffffb` |
| `scripts/research/goal-data/prereg-compare.mjs` | `f8b0a41a66746cde1719db1f20d0caa1b72d655685a417fa4c0498af10915bcb` |
| `docs/research/goal-data-batches/D2-task-mapping/prereg-prompts/comparison-analyst.md` | `218b46c3465e446ccf3cdb1dea50434fb0a2cd044e8f9da5a131f8ae7778849b` |

- 확인: `node scripts/research/goal-data/prereg-freeze-check.mjs` 가 이 표를 읽어 작업 트리 바이트와 대조한다(이 검사 스크립트의 sha256 은 rev4 확정 커밋 메시지에 남긴다). **export 직전 · 판정 시작 직전 · 비교 계산 직전** 세 번 실행하고 출력을 `local/b9-v24/prompts/freeze-check-<시점>.txt` 로 저장한다.
- 이 문서(rev4) 자체의 sha256 은 확정 커밋 메시지와 `b9-v24-selection.json` 을 만든 뒤 `local/b9-v24/prompts/manifest.json` 에 남긴다.

## 2. 재등록 규칙(P1-03)

- 동결 집합의 어떤 파일이든 결과 계산 전에 바뀌면 **이번 시도를 폐기**한다: 이번 시도에서 판정자가 본 문항(b9 대상 · 필요 시 b10 대상)은 이후 비교에 쓰지 않는다. 새 rev 를 등록하고 **새 미관측 표본**을 사전 지정 순서(M2306 대상 → 2021 수능 대상)에서 뽑는다.
- 동결 집합 밖 파일(mapping-review 등 기록 문서)은 바뀌어도 된다.

## 3. 표본 — 대상 유형 ≥ 12, 선택 여지 없음(P1-01)

- **대상 유형**: R-FACT · R-NOTICE · X-FACT · R-IMPLY · R-MOOD.
- **b9**(export 전): 2022 수능 핵심 유형 밖 18–45(도표 제외) 15 + M2406 18–45(도표 · 장문 43 · 44 사전 제외) 25 = 40. 대상 12 = 시험마다 R-MOOD 1 · R-IMPLY 1 · R-FACT 1 · R-NOTICE 2 · X-FACT 1(platform-goal DB 실측 · 모두 적격).
- **유효 대상** = 대상 문항 중 A · B · C · D · E · F 여섯 판정이 **모두 검증기(d2-validate) 구조 검사를 통과**한 문항. 「검증 실패」 = 분석자가 최대 2회 수정한 뒤에도 그 문항 행에 검증 결함이 남은 경우(형식 검사만 — 내용 판단은 실패 사유가 아니다).
- **b10 확장** = b9 유효 대상이 12 미만일 때만, 그리고 **지표를 계산하기 전에** 정한다. 구현: `prereg-compare.mjs` 는 b9 유효 < 12 이면 지표를 계산하지 않고 `decision = insufficient_extend_b10` 만 기록한다 → `d2-export` 의 `b10-v24`(M2309 18–45 중 대상 유형만) 는 **그 결정이 기록돼 있을 때만** export 된다(gate) → 파생 `b10t-v25` · `b10t-v24` 를 같은 프롬프트 · 같은 동결 집합 · 같은 순서(C–F 먼저)로 판정 → `prereg-compare` 가 b9 유효 전부 뒤에 b10 유효 전부를 **합집합**으로 붙여(순서 고정 · 선택 없음) 계산한다. b9 유효 ≥ 12 인데 b10 이 있으면 계산을 거부한다. b9 + b10 유효 < 12 이면 `insufficient_after_b10` — 결론 없음 · 추가 확장 없음.
- b2–b8 문항은 쓰지 않는다.

## 4. 설계 — 같은 문항 · 세 쌍

| 쌍 | 분석자 | 계약 | 배치 | 문항 |
|---|---|---|---|---|
| (A, B) | 평소 배치 분석자 | v2.4 | b9-v24 | 40 |
| (C, D) | 새 분석자 | **v2.5** | b9t-v25(b9 입력에서 대상 행만 그대로 복사) | 대상 12 |
| (E, F) | 새 분석자(C/D 와 같은 프롬프트 틀) | v2.4 | b9t-v24(같은 복사) | 대상 12 |

- 주 비교 = (C,D) 대 (E,F). (A,B) 는 평소 절차 기준선(봉인 조건에 쓰지 않는다).

## 5. 열람 금지 입증(P1-02)

- **순서로 막는다**: C · D · E · F 를 먼저(동시에) 판정하고, 넷이 모두 끝나 스냅샷을 남긴 뒤에 A · B 를 판정한다 → C–F 판정 중에는 A/B 출력이 존재하지 않는다.
- **입력을 가른다**: C–F 는 각자 `chunk-<TRACK>-01.json` 만 받는다(prior 분석 · 트랩은 A 트랙 입력에도 넣지 않는다 — 비교 배치 A 트랙 = C · E 도 원문만). 
- **자기 트랙만 검증한다**: 분석자는 `d2-run <batch> validate <TRACK>` 만 쓴다(트랙 생략 시 두 트랙 결함 · 선택 이유가 함께 출력되기 때문 — T-0115 RECHECK-P1-02). 출력을 처음 다 쓴 직후 고치기 전에 `d2-run <batch> snapshot <라벨>-first` 로 최초 출력을 보존한다.
- **기록한다**: 실행 프롬프트 전문(동결 틀에서 네 자리만 치환)을 `local/<배치>/prompts/<라벨>.md` 로 저장 · sha256 manifest · 모델 설정(Agent 도구 general-purpose · 상위 모델 상속 · 새 대화 — 이전 대화 · b7 결론 · 이 사전 등록 문서를 프롬프트에 넣지 않음) · 판정 직후 `d2-run <batch> snapshot` · 분석자 최종 보고의 「읽은 파일 목록」.
- **남는 한계(사전 명시)**: 분석자는 파일 시스템에 접근할 수 있어 금지 파일을 실제로 열지 않았음을 기술적으로 증명할 수 없다 — 순서(A/B 출력 부재) · 입력 분리 · 자기 보고 · C–F 간 동시 실행으로 위험을 줄일 뿐이다. C–F 서로의 출력은 동시 실행 중 일부가 먼저 생길 수 있다.

## 6. 지표 · 봉인 조건(P1-01 — 계산은 `prereg-compare.mjs` 그대로)

| 지표 | 정의(분모) | 봉인 조건 |
|---|---|---|
| 주 TASK 일치 | 유효 대상 n 문항에서 쌍 안 두 primary 가 같은 비율(null = null 은 같음) | (C,D) − (E,F) **> 0**(부호 있는 차) **이고** 불일치 문항 전부(C,D · E,F) 원문 대조에서 v2.5 쪽 판정이 계약 문구로 설명된다 |
| 링크 일치 | 유효 대상 n × 6 TASK 쌍을 **합산**한 일치 비율 | (C,D) ≥ (E,F) − 0.05 |
| 링크 κ | 같은 합산 쌍의 4범주 Cohen κ | (C,D) ≥ (E,F) − 0.05 · **κ 가 null 이면 판단 불가 → 봉인하지 않음** |
| 대상 외 영향 | R5 · R6 · E1 · R4(E2 · E3 제외) n × 4 쌍 합산 일치 | \|(C,D) − (E,F)\| ≤ 0.05 · v2.5 절별 적용 범위 문서 대조 |
| null primary secondary | v2.5 §3 | (C,D) null primary 행 전부 검증기 통과(secondary = indirect 집합) |
| 독립 원문 대조 | 유효 대상을 (시험 id, 문항 번호) 오름차순으로 정렬한 **앞 10**(`independent_review_sample_CD` — 결과 열람 후 선택 없음) · 주 TASK 불일치 전수 대조는 이와 별도 | 반박 0 |

- 비교는 **반올림 없는 원값**(보고만 4자리). 다중 비교: 조건은 **모두** 충족해야 한다(하나라도 아니면 봉인하지 않음 — 지표를 골라 쓰지 않는다).
- **유형별 결론 금지**: 대상 유형별 n 이 2–4 라 유형별 일치 · 차이로 결론을 내지 않는다. 전체 결론만.
- 결과가 애매하면(차 = 0 · 불일치 원문 대조가 양쪽 다 계약으로 설명됨) 봉인하지 않는다.

## 7. 한계

- 12(±b10) 문항 · AI 판정자 두 쌍 비교 — 학생 측정 타당도 · relevance 승격 근거가 아니다(relevance=unknown · NeedRank 금지 유지).
- 새 분석자 효과는 (E,F) 로 통제하지만 개별 분석자 차는 남는다.
- b7 갈림 9문항 재판정은 쓰지 않는다.
