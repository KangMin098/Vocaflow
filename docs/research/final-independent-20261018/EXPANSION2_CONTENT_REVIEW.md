<!-- docs/research/final-independent-20261018/EXPANSION2_CONTENT_REVIEW.md -->
# 추가10 TASK 세트와4형식 독립 검토

고정 HEAD `3c15ba23c5c60d51fd035a00a5ec3eef2b442b5f`. **현재 PARTIAL · REWORK**. 총괄105문항 중 이번에는 새10세트60문항만 판독했다. 앞의 R5 9/확장36 판독과 기존6형식 검사는 재사용하고 불변 범위를 다시 돌리지 않았다.

## 봉인 판독과 현재 채점

[본문 패킷](./expansion2-body-packet.json)에서 Gold·교수 단계·힌트·작성자 리뷰를 제외했다. SHA-256 `08e4a34fe68378cb2c5af8a6fd1e186124a56164c0e837afb49e7ce63cc473c3`. [독립 풀이60건](./expansion2-codex-reading.json)을 Gold 전에 봉인했다(SHA-256 `a1015e9cc0a6bb96c68a4e2706917b7060e9f569b02f49a9ae8d82176f2f28a2`). 기존 design-annotation-criteria v1.1의 역할/패턴 기준을 읽었고 타당한 대안과 사실성 미확인을 따로 적었다. 사람 Gold 승인은 아니다.

[실제 후보 채점 대조](./expansion2-reading-comparison.json), [실행기](../../../apps/web/scripts/final-independent/probe-expansion2-reading.mjs): 형식 검증 오류0/60, 선택형 정답42/42 일치, 의미 관계6/6 일치, 구조 패턴12/12 수용, 역할62/75 수용, 전체 응답49/60 수용. 불일치11건 전부를 결함으로 계산하지 않는다.

| TASK | 문항 | 전체 응답 수용 | 범위/불일치 |
|---|---:|---:|---|
| e.task_demand | 6 | 6 | 발문이 요구하는 연산·범위 구별 |
| r.discourse_function | 6 | 4 | 역할의 background/support/example 경계2건 |
| r.discourse_structure | 6 | 2 | 주제/해결책·예시/결과·Yet 전환 분류4건 |
| r.reference | 6 | 6 | 지시어 대상과 근거 위치 |
| s.attachment | 6 | 6 | 뒤 문맥을 이용해 수식의 모호성 해소 |
| s.chunk_boundary | 6 | 2 | 올바른 덩어리지만 이유 범주4건 불일치(FI-014) |
| s.sentence_core | 6 | 6 | 긴 주어·내포절·도치에서 주어 핵심과 본동사 |
| s.structural_relation | 6 | 6 | 병렬·삽입·생략 복원·도치 |
| v.multiword | 6 | 5 | mw-ind-1의 추가 단서 문장 허용 범위 누락 |
| v.semantic_relation | 6 | 6 | 문맥상 바꿔 말하기·상/하위 방향·반대 |

## FI-014 · 핵심 P2 · 맞는 구조 이유를 단일 라벨 때문에 오답 처리

`cb-ind-2`는 문장의 **주어 덩어리 전체**를 묻는다. 선택한 첫 덩어리는 `A sudden rise ... across the region`이라는 완전한 주어 명사구이며 문장의 finite predicate는 뒤의 worried다. 독립 응답은 이 덩어리와 이유 **문장의 주어(main_subject)**를 선택했다. 실제 채점은 choiceOk=true/reasonOk=false/isCorrect=false다. Gold가 이유를 **구의 경계(phrase_boundary)** 하나로만 받기 때문이다. Gold 자체의 why/segments 설명도 이 덩어리를 긴 명사구 주어 전체라고 설명한다.

`cb-guided-1`도 refused에서 시작하는 덩어리가 **문장의 진짜 동사**임을 묻는다. 맞는 덩어리에 **문장의 본동사(main_verb)**를 고르면 오답이고 **절의 경계(clause_boundary)**를 골라야만 맞다. 본동사 시작은 절 경계라는 성격과 양립하며 두 선택지는 상호 배타적인 이유가 아니다. cb-ind-1/cb-delayed-1의 생략절 시작에서도 clause_boundary/ellipsis_restored가 겹친다.

기대: 정확한 구조 이해를 드러내는 대체 이유를 문항별로 표현·수용하거나, 서로 배타적인 구체적 설명문을 선택하게 구성한다. 이유 없이 덩어리만 맞힌 응답까지 전부 통과시키라는 요구는 아니다. 정당한 이유를 고른 응답을 운으로 위치만 맞힌 경우처럼 기록해서는 안 된다. 이는 FI-012의 결정 근거/지문 선택과 다른 segment_choice 이유 계약이다.

## 새4형식의 실제 컴포넌트/채점 연결

[독립 Chromium 실행기](../../../apps/web/scripts/final-independent/probe-expanded-format-ui.mjs)는 실제3c15 Runner/CSS와 실제3c15 FORMAT_SPECS를 연결했다. API 저장·결속/Link만 대체했다. 기존6형식 정상 검사를 반복하지 않고 discourse_roles/demand_choice/segment_choice/equivalence에 새로운 합성 원문으로 검사했다.

[1280/1440 결과](./formats-3c15/results.json)의42개 관찰: 새4형식 불완전 제출 차단/완성 제출/정상 채점/가로 넘침·활성 크기32개, 실제 cb-ind-2의 동일 상호작용·오답 관찰8개, 런타임/외부 요청·Gold JSON 번들 확인2개. 런타임 오류0, 외부 요청0, 가로 넘침0, 44px 미만 활성 요소0, authored Gold JSON browser 입력0. 오답 재현 단언 통과를 교육적 정답 처리 PASS로 세지 않는다.

[1280 cb-ind-2](./formats-3c15/1280-cb-ind-2.png)·[1440 cb-ind-2](./formats-3c15/1440-cb-ind-2.png)에서 「덩어리: 맞음 / 이유: 다름」과 오답 표시를 독립 육안 확인했다. [1280 역할](./formats-3c15/1280-roles-normal.png)·[1440 의미 관계](./formats-3c15/1440-equivalence-normal.png)은 정상 합성 컴포넌트 화면이다. 전체 CsatShell/인증/실제 DB/모든 콘텐츠/전이/PLAN 환류 E2E나 참조 디자인 일치를 증명하지 않는다.

## 나머지 불일치와 내용의 근거 수준

- 역할 분류6건은 단순 정답 오선택이 아니다. 예를 들어 ds-guided-1은 해결책 문장4를 topic으로, 작성자는 문제 문장1을 topic으로 잡았다. 연구 설계/결과의 example 대 background/support, Yet 문장의 turn 대 support도 갈린다. 현재 기준/해설과 허용 대안을 사람이 일관되게 확정해야 하며 독립 판독의 모든 분류를 자동 정답으로 강제하지 않는다. 패턴 대안 수용은12건에서 작동했다.
- mw-ind-1에서 답과 구별의 단서 문장1·2는 맞고, 손님이 로스팅 과정을 보고 향을 맡는 문장3을 더 고르면 cueOk=false다(Gold 허용은 문장1·2·4·5). 이 문장3은 앞 문장의 현장 로스팅이 손님에게 드러나는 방식을 설명한다. 사람이 단서 범위를 확정할 때 포함 타당성을 검토해야 한다. FI-012의 단일 decisive 코드 문제로 잘못 합치거나 중복 이슈를 만들지 않았다.
- ds-delayed-1은 월동 행동이 신체 변화와 함께 나타날 가능성을 배제하며 마지막에 이 동물들은 두꺼운 털이 자라지 않는다고 단정한다. [NPS Abert squirrel](https://home.nps.gov/band/learn/nature/aberts-squirrel.htm)은 먹이 수집과 계절성 두꺼운 겨울 털을 함께 설명하고, [NPS 겨울 생태](https://home.nps.gov/glac/learn/education/winter-wanderings.htm)도 먹이 저장/털 변화가 양립하는 적응임을 설명한다. 특정 종을 명시하지 않은 이 초안의 배타적 대조는 근거 부족으로 표시한다. 모든 사례 종이 직접 반증됐다고 확대하지 않으며, 행동 사례를 설명하는 주장으로 범위를 좁히거나 해당 생물학 근거를 확정해야 한다.
- ds-transfer-1의 장식 교실 실험은 아홉 살 두 집단으로 쓰였으나 원천은 미확인이다. 식별 가능한 유사 Fisher/Godwin/Seltman 연구의 [학회 1차 발표](https://www.psychologicalscience.org/news/releases/heavily-decorated-classrooms-disrupt-attention-and-learning-in-young-children.html)는 유치원생24명·두 조건에서6수업을 설명한다. 이 유사성만으로 바로 그 연구라고 확정하지 않는다. 실제 연구를 서술한 것인지 합성 사례인지 밝히고 연령/설계/결과의 근거를 확인할 사람 쟁점으로 남긴다. 원문 논문/기출 문장을 복제하지 않았다.

## 현재 CI와 전체 수용

CI run39115796299(동일3c15 HEAD)는 verify/build/e2e/e2e-gate-faultclosed **FAILURE**이며 공통 원인은 Runner83행의 사용하지 않는 DEMAND_LABEL lint 오류다. e2e가 새 콘텐츠에서 실패했다는 뜻으로 오해하지 않는다. 브라우저 실행 전에 build가 막혔다. 앞선 e913의 통과는 [그 HEAD 범위](./PR303_BROWSER_EVIDENCE.md)로 보존한다. 이 CI는 수정 후 새 HEAD의 필수 체크로 확인해야 한다.

[전체30 TASK 대조](./TASK_EXPANSION_COVERAGE.md)는17 TASK/105초안을 기록한다. 세트 없는4 TASK가 모두 미구현이라고 단정하거나 산출 TASK마다 새 문항을 요구하는 게이트를 만들지 않는다. 실제 개발 DB의 마지막 READ ONLY 관찰09:27Z에서는 창작 표 미설치/FQ·납품·결속 근거0이며 이 관찰을 최신 적용 완료로 바꾸지 않았다. 사람 Gold·권리·실학습 효과는 미승인/미검증이다. A~H 전체 REWORK를 유지하고 임무를 계속한다.
