# TASK ↔ 교재공장 Crosswalk(`vf.task-factory-crosswalk/1`)

> 구현: `apps/web/src/lib/csat/map/v62/factory-bridge/crosswalk.ts`.
> 공장 정본: `origin/feat/textbook-factory-main` `663f2eee8` · `packages/library-pipeline/src/textbook/academic-reading.ts`. 이 파일들은 main 에 없다.
> 공장 쪽에는 분류 전용 버전 문자열이 없어서, 분류 버전은 `READING_ENGINE_VERSION=1@663f2eee8` 로 출처를 묶었다.

## 원칙

- 모든 행은 **`candidate` · `claimScope: search_only`** 다. 자료 검색에만 쓴다.
- 검증 증거 id 와 검수자가 생기기 전에는 공급 적합 · 주문 봉인 근거가 아니다(`crosswalkUsable`).
- 평가(독립 확인 · 전이 · 지연)는 어떤 상태에서도 공장 자료로 대신하지 않는다. 그래서 대응의 `materialRole` 에 평가 역할이 없다.
- **문자열 id 로 잇지 않는다.** 학습지도 R5 `r.central_meaning`(중심 의미)는 공장 **R4 Main Idea** 에 후보로 잇는다. 공장 **R5 는 Function** 이므로 잇지 않는다.

## 후보 표

| 학습지도 TASK | 공장 스킬 | 제품군 | 공장 문항 유형 | 관계 | 메모 |
|---|---|---|---|---|---|
| V2 `v.contextual_sense` | R1 Vocabulary in Context | P05 | vocab_choice · long_vocab | overlaps | 「문맥에 맞지 않는 낱말」 = V2 의 B 판별과 겹침. D 문맥 뜻 · C 근거는 다루지 않음 |
| S5 `s.form_scope` | R2 Sentence Meaning | P06 | grammar_choice · grammar_fix · word_order | related | P06 문항은 어법 형태. S5 의미 범위 능력으로 승격 금지(S04) |
| R5 `r.central_meaning` | R4 Main Idea | P07 | topic · title · main_point | overlaps | 공장 R5(Function) 아님 |
| E2 `e.evidence_location` | R9 Evidence | P11 | content_match · long_match | related | 내용 일치 ≠ 빈칸 근거 위치 |
| E3 `e.option_correspondence` | R9 Evidence | P11 | content_match · long_match | related | R7 / R9 미결 |

## 검증으로 바꾸는 절차(I1 이후)

1. 공장 제품군 표본 문항을 TASK 정의(목표 · 조건 · 증거)에 맹검 판정한다.
2. 일치율과 표본을 증거 id 로 남긴다.
3. 검수자를 기록하고 `status: validated` 로 바꾸며, `effectiveRevision` 을 올린다.

`validated` 가 되어도 쓸 수 있는 용도는 `supply_fit` · `seal_order` 까지다. `assessment` 는 계속 불가다.

독립 보완 revision: `vf.task-factory-crosswalk/1#1`. E1은 발문 요구 파악, E2가 근거 위치다. E3↔P06 어법 전용 후보는 선지-본문 대응을 가르칠 근거가 없어 제거했다. 나머지 대응도 전부 candidate/search_only이며 교육 검증 완료가 아니다.
