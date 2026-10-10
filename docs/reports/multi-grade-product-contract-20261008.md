# 단일·복수 학년 교재 계약: Product Order group과 benchmark 판정

기존 `textbook-product-order/1`은 한 학년의 각색·문항 생산 단위로 그대로 둔다. `textbook-product-order-group/1`이 단일 학년, 연속 학년 범위(`grade_range`), 비연속 학년 묶음(`multi_grade`)을 한 제품으로 묶고, 학년마다 서로 다른 기존 자식 주문을 요구한다. 초5·초6은 제품 범위에서는 구분하지만, 기존 Reading Target의 `upper_elementary` 대역에 각각 별도 자식 주문으로 연결한다. 자식 주문의 시리즈·판본·상품 유형·권리/출처/trust/benchmark 정책 해시가 다르면 그룹을 봉인하지 않는다.

전달 방식은 `single_grade`, `shared_passage_grade_specific_items`, `grade_specific_adaptations`, `grade_specific_units`다. 그룹 hash와 자식 주문 hash를 각각 봉인한다. 초5·초6 자식 주문은 `grade_detail_target`을 각자 주문 해시에 포함해야 한다. 학년별 evidence에는 공통 source/rights hash, 학년별 passage/adaptation/item/activity/unit-set/analysis hash, benchmark version/snapshot hash, Gold-S *candidate* hash를 분리한다. 공통 지문 방식에서 본문과 각색 해시는 같아야 하고 문항 해시는 달라야 한다. 각색 분기 방식에서는 학년별 본문 해시가 달라야 한다. 단원 분기 방식에서는 학년별 단원 집합 해시가 달라야 한다. `planMultiGradeVolume`은 혼합 단원의 모든 학년·주문·권리·본문·각색·문항·활동·benchmark·단원 집합 hash를 다시 확인하고 계획 hash를 만든다. 이 계획은 `render_eligible=false`이며 기존 단일 주문 조판 CLI를 자동으로 다학년 조판으로 바꾸지 않는다.

`multi-grade-benchmark-contract/1`은 실제 교재 corpus와 별개로 합성 fixture에서 비교 수학을 검증한다. 학년별 단일 표기 표본과 범위 전체를 표기한 표본은 별도 풀이다. 한 지문 hash를 두 풀에 중복 계수하지 않는다. 학년당 비교가능한 표본 30개·출판사 3개, 범위 표기 표본 12개·출판사 3개, 출판사당 시리즈 2개가 모자라면 `insufficient_benchmark`다. 출판사 비중 40%, 시리즈 비중 20% 상한도 각 풀에서 확인한다. 결과는 아래를 따로 기록한다.

- 최저/최고 학년 fit 및 모든 학년의 sub-fit
- 범위 표기 표본에 대한 모든 학년의 shared-core fit
- 학년별 문항 유형 난도 compatibility
- **인접 학년마다** separation: 공통 본문 방식은 문항 난도, 각색 방식은 어휘·구문·담화·추론 등의 상승을 확인

이 함수는 아직 실제 admission receipt의 독립 검증이나 9축 판정자 기록 검증을 수행하지 않는다. 따라서 수학적 `status=pass`여도 `evidence_level=contract_only`, `admissible=false`, `gold_s_candidate=false`, `gold_s=false`, `db_seed=false`다. 기존 `single_grade_only` v2 봉인본을 덮어쓰지 않았다. 운영 경로에서 이 그룹을 사용하려면 다학년 주문·evidence를 promotion/authoring/render 입력에 결속하고, 실제 benchmark 선정·receipt·분포 재계산 및 조판 직전 stale 확인을 추가해야 한다.

현재 실제 교재 corpus=0, 9축 실분포=0, Gold-S=0, DB seed=0이다. 이번 단위는 제품 모델·증거 계보·비교 판정·혼합 단원 **계약과 합성 실패 주입**까지만 검증한다.
