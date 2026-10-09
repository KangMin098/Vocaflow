# UG-c8315ad8-0002 설계 v2 검토 · 1차 구현 범위 (2026-10-10)

대상: REQ-20261009-c8315ad8-005 응답(Work PR #9 · verdict revise · v2 PROPOSED) · 패킷 main `a4fde994e`.
비교: 담당 세션 `feat/map-contracts-abc` `98ca3f552`(main 미병합) · 현재 main `a4fde994e`.
상태: **검토만.** v2 는 PROPOSED 그대로 · 승인 결정 없음 · 제품 코드·DB·정본 변경 없음 · 0002 owner·worktree 변경 없음.

## 1. v2 항목별 판정

| v2 항목 | 판정 | 이유 · 수정 |
|---|---|---|
| D-7 수정 (b): 진단 전 일반 Practice 허용 · 처방과 분리 | **채택(승인 후보)** | 정본 §14 는 REPAIR·TRANSFER·CHECK 를 묶고 별도 Practice 는 언급하지 않는다 → 「처방 아님」 으로 분리하면 §14 의 처방 경계와 충돌하지 않는다. 다만 §14 명시 문구 추가는 정본 변경 → 별도 승인 |
| 일반 Practice 기록은 진단 근거·처방 진행에 쓰지 않음 | **채택** | main 실측: Practice 결과는 StepSheet 표시(`PracticeResultLine`)와 `load.ts:343` 다음 링크 계산에만 쓰이고 `prescription`·`learner-path`·`core` 는 읽지 않는다 → 지금도 대체로 지켜짐. 남은 오염원은 명칭(`practice-results.ts` `transfer` 필드·`transferKeysOf`·「전이 횟수」)뿐 |
| confirmed_need = 우선순위 신호(진단 아님) | **채택(수정)** | 브랜치 `find-feedback.ts` 는 `prioritySignal: false` 고정(D-2 결정 대기). v2 는 신호로 쓰자고 한다 → 신호 계산은 순수 함수로 추가하되 화면 반영은 D-2 승인 뒤 |
| verified 상태 머신 insufficient→candidate→verified→stale/conflicted | **보류(순수 함수만 채택)** | 상태 머신 계산은 순수 함수로 가능. `verified` 를 **실제로 내보내는 경로**는 CURRENT_BASIS 전환과 같아 승인 전 금지 → 1차는 `candidate` 까지만 산출, `verified` 는 타입만 |
| 임계값 3문항 · source_revision 2 · 반대 0 · 90일 | **보류(연구 설정)** | 근거 없음(실제 진단 사용자 1 · 새 학습 기록 0). `PROVISIONAL_CONFIG`(validated:false) 로 버전 고정, 테스트·시뮬레이션 입력으로만 |
| Anchor valid = revision·source hash·span·sentence hash 모두 일치 | **채택 — 이미 구현됨** | 브랜치 `evidence-anchor.ts:103-115 checkAnchor` 가 같은 규칙(+ judgment revision → `context_changed`). v2 allowed_paths 에 이 파일이 없다(패킷이 main 만 봄) → 새로 만들지 않고 브랜치 파일을 쓴다 |
| relocated → relocated_candidate 명칭 | **수정 채택(명칭 유지)** | 브랜치 `relocated` 는 이미 「재검토 대상 · 자동 승격 금지」. 이름만 바꾸는 이익 < 문서·테스트 동시 변경 비용 → 의미 동일 확인 후 `relocated` 유지 |
| CHECK: 첫 시도 보존 · 미노출 새 문항으로만 진단 갱신 | **채택** | main `learning_first_attempts` 뷰 · `summarizePractice` 첫 시도 고정 · `schedulePracticeReview` 는 같은 문항 다시 보기(복습)로 이미 분리. 남은 것: 「진단 갱신 표본 자격」(다른 item_id · 미노출 · 자격 있는 첫 시도) 순수 판정 함수 |

## 2. 정본 §14 충돌 해소 방식
- 해석(정본 변경 없음): 진단 전 Practice = 「처방 생애주기 밖의 비개인화 자기 주도 연습」. 원인·축을 근거로 고르지 않고, 결과는 진단·단계 상태를 바꾸지 않는다.
- PR #164 「같은 원리를 다른 기출로 연습하기」 는 TRANSFER 정의(§14 표)와 문구가 겹친다 → 1차 구현에서 **문구만** 「스스로 연습하기」 계열로 바꾸고 「적용·전이」 표현을 뺀다(링크는 유지 — 사용자 지시 「무조건 삭제하지 않음」).
- 정본에 예외를 **명시**하는 문구 추가는 정본 변경 → 승인 항목 ①.

## 3. 비DB 1차 구현 범위(승인되면 바로 가능) — 실제 파일

기준 브랜치: `feat/map-contracts-abc`(담당 세션 소유 · 브랜치 수명 1일) 위에서. main 에서 새로 시작하면 브랜치의 Anchor·환류 함수를 중복 구현한다.

| 묶음 | 파일 | 변경 | 기존 코드 대비 |
|---|---|---|---|
| A 활동 유형 | `lib/csat/map/prescription.ts` (+test) | `ActivityKind = find_measurement \| general_practice \| repair \| transfer \| check` · `openActivities(basis)` — rule_proxy·item_tagged 에서 find_measurement·general_practice 만 | 지금 `reachablePhase`·`TASK_STAGE` 유지, 위에 얹기 |
| B Practice 의미 분리 | `lib/knowledge/practice-server.ts` 주석·반환 의미 · `components/csat/diagnosis/map/StepSheet.tsx` 문구 · `lib/csat/map/practice-results.ts` (+test) | 화면 문구 「스스로 연습」 · `PracticeResult.transfer` → 의미 주석/별칭(`otherItems`) · `transferKeysOf` 이름 유지+별칭 | **`lib/csat/map/load.ts:343·408` 가 `transfer`·「전이 횟수」 를 쓴다 — v2 allowed_paths 밖** → 범위에 추가 필요(승인 항목 ②) |
| C FIND → 우선순위 신호 | `lib/knowledge/find-feedback.ts` (+test, 브랜치) | `priorityCandidates(outcomes)` 순수 계산 · `prioritySignal` 은 D-2 승인 전 화면 반영 안 함 | 브랜치 함수 확장 |
| D 진단 후보 상태 머신 | 새 `lib/csat/map/diagnosis-candidate.ts` (+test) | `insufficient → candidate`(+`conflicted`) 계산 · `PROVISIONAL_CONFIG {minItems:3, minRevisions:2, maxContrary:0, validDays:90, validated:false}` · `verified` 산출 금지(타입만) · `now` 주입 | 신규(v2 allowed_paths 밖 → 승인 항목 ②) |
| E Anchor 판정 | `lib/csat/map/evidence-anchor.ts` (+test, 브랜치) | 변경 거의 없음 — v2 수용 기준 6·7 대조 테스트만 추가 | 이미 구현 |
| F CHECK 독립성 | `lib/csat/map/practice-results.ts` 또는 `lib/knowledge/find-outcome.ts` (+test) | `diagnosisSampleEligible(attempt, priorExposures)` — 다른 item_id · 미노출 · independent · !after_explanation · !timing_uncertain · 첫 시도만 | `find-outcome.ts:7-10` 자격 규칙 재사용 |

보존: `CURRENT_BASIS='rule_proxy'` · observation→diagnostic_need→verified→prescription · G2 멱등 · M8 timing_uncertain · F7 · `learning_first_attempts` 불변 · S 수직 경로 · 기존 테스트(prescription · learner-path · core · practice-results · find-outcome · practice-server · evidence-anchor · find-feedback).

## 4. 교육적 임계값 검증 상태
- 3문항 · 2 revision · 반대 0 · 90일: **미검증**(Work 스스로 provisional 이라 함). 실제 진단 사용자 1 · 새 학습 기록 0(담당 세션 2026-10-09 실측) — 보정 불가.
- FIND confirmed_need 의 「서로 다른 문항 2」: main `find-outcome.ts` 의 구현 규칙일 뿐 교육적 검증 없음.
- 처리: 연구 설정으로 버전 고정 · 화면·처방·basis 에 영향 0 · 테스트 입력으로만.

## 5. 사용자 승인이 필요한 정확한 범위
1. **설계 v2 의 1차 범위 승인**(위 §3 A~F, 비DB) — 결정 요약에 「UG-c8315ad8-0002@v2」 + 범위 `--paths` 로. v2 allowed_paths 13개 + 추가 4개(`lib/csat/map/load.ts`, `lib/csat/map/diagnosis-candidate.ts`+test, `lib/csat/map/evidence-anchor.ts`+test, `lib/knowledge/find-feedback.ts`+test — 앞 2개는 v2 밖이라 범위 확장이므로 v2 승인이 아닌 **재질의 또는 사용자 명시 확장**이 필요).
2. **작업 기준 브랜치**: `feat/map-contracts-abc` 를 먼저 main 에 병합할지(담당 세션 PR · 반대 에이전트 리뷰) — 병합 없이 그 위에 쌓으면 의존이 길어진다.
3. D-2(우선순위 신호 화면 반영) — 1차는 계산만.
4. 정본 §14 예외 문구 추가 — 별도.
5. DB·스키마(verified·Anchor 영속화) · CURRENT_BASIS 전환 · 자동 맞춤 처방 · 실제 학습자 자료 수집 — 별도, 1차 범위 아님.

## 6. FIND → REPAIR → TRANSFER → CHECK 완결 의존 작업
1. 직접 진단 형태 설계(축만 겨냥한 문항 세트 · 미노출 풀) — 정본 §10-1 「설계 미정」, 사람 dry run(오답 원인) 결과 필요.
2. Evidence Anchor 표본 연구(정답 근거 3,408 중 정규화 가능 비율) → validated_anchor 확보 → item_tagged basis.
3. verified 영속화 스키마 + 승인 SQL(DB 승인).
4. 임계값 보정용 파일럿(합성 학습자로 규칙 검증 → 실제 사용자 표본).
5. CURRENT_BASIS 전환 결정 → REPAIR·TRANSFER·CHECK 개방 → CHECK 재평가 경로(미노출 문항) 연결.
6. 정본 §14 문구 · ERROR_EVIDENCE_DESIGN·코드북의 main 반영(정본 참조 무결성 — 지금 main 에 없음).
