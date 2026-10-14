# 합성 응답의 채점 일관성과 반례

사전 등록된 16합성 응답(각 TASK 8종)을 두 새 AI 문맥이 원문·과제·기존 rubric만으로 독립 채점했다. 작성자 기대 판정과 다른 판정을 제공하지 않았다. 첫 완성본은 각각 2026-10-14 10:08:07/10:08:36 UTC에 봉인했다. 이후 기대 판정을 열어 비교했다. 실제 학생 응답이 아니다. [등록](data/v15/assessment-registration.json)·[실행](data/v15/assessment-execution.json)

| 비교 | 분모 | 결과 | 해석 |
|---|---:|---:|---|
| 최초 의미 facet 일치 | 16응답 내 64facet | 64/64, κ=1 | 작은 합성 표본의 두 AI 일치. 64독립 학생이 아니다 |
| 절차 자격 일치 | 16응답 | 16/16 | 14 defer·2 ineligible, eligible 0 |
| 작성자 기대와 각 첫 판정 | 각 64facet | A/B 각각 64/64 | 기대 자체가 인간 Gold가 아니며 정확도 입증이 아니다 |
| 기대 절차와 각 첫 판정 | 각 16 | 각각 16/16 | 작성자의 unknown은 비교용으로 defer에 대응; 원래 바이트는 그대로 |

완전·부분·동등·강화·근거 부족·맞는 답과 잘못 설명·복사/암기 시나리오·모호 보류를 각각 다뤘다. 정확한 뜻이나 수치와 잘못된 근거가 함께 있으면 근거 facet의 결함을 보존한다. 일부 올바른 내용을 모든 facet의 충족으로 확산시키지 않는다. 복사된 정확한 설명은 의미 산출물이 읽히더라도 독립 수행 자격이 되지 않는다. 실제 암기 여부는 문체로 추정하지 않고 합성 노출 기록만 사용했다.

**일치가 100%여도 채점 명세의 모호성은 남았다.** 두 평가자가 동일한 네 응답에서 결합의 partial/defer 경계, 지시적으로 생략된 비교 대상, 실제 비교값과 단위 facet의 귀속, 잘못된 근거를 다른 facet에 전파하는 범위를 지적했다. 관찰된 4응답의 쟁점이며 8독립 결함 표본으로 복제하지 않는다. 최초 상태와 근거를 수정해 일치율을 높이지 않았다. [첫 집계](data/v15/assessment-agreement.json)·[사후 검토](data/v15/assessment-review.json)

별도 [운영 규칙 후보](data/v15/assessment-operational-proposal.json)는 해석 가능한 구성 요소가 있는 부분 응답과 해석 가능한 응답 부재를 구별하고, 대상 식별·실제 근거 값·단위·형식 결합을 따로 기록하도록 제안한다. 잘못된 근거가 어떤 facet를 손상시키는지 명시하되 전체 숙달 판정을 만들지 않는다. 이 규칙은 사후 제안이며 최초 rubric이나 첫 수치에 소급 적용하지 않았다. 새 다양한 응답과 인간 판정이 필요하다.

연구용 채점 스크립트는 ID·facet·상태·정보 입력 해시를 확인하고 독립 판정을 비교한다. 자유 응답을 제품에서 자동 진단하는 분류기를 배포한 것이 아니다. 실제 학생 응답·인간 독립 채점·전이/지연 관찰·효과 검증은 0이다. **직접 평가 도구 자격 승인 0**을 유지한다. 상세 합성 응답·예상 상태·판정 근거는 ignored local에만 있다.

```powershell
node scripts/research/csat-reading/v15-assessment.mjs
node scripts/research/csat-reading/v15-assessment-review.mjs
node --test scripts/research/csat-reading/v15-assessment.test.mjs scripts/research/csat-reading/v15-guard.test.mjs
```

재계산에는 해시가 같은 비공개 입력·기대·첫 판정 파일이 필요하다.
