# FQ1.1 역할별 공급 경계

연구용 [검사기](../../../scripts/research/factory-qualification-v11/role-gates.mjs)는 명시된 기록·범위·revision·노출의 결속을 검사한다. 자연어 의미, 실제 권리나 승인자의 진정성을 스스로 확정하지 않는다. 테스트의 양성 대조는 명시적인 unit fixture이며 실제 승인/학생 자료가 아니다.

| 사례 | 기대 결과 | 구현 검사 |
|---|---|---|
| 지도 연습 내용 후보, 권리·출시 기록 없음 | 후보 유지·공급 보류 | 서버 승인 원장 부재 차단 |
| 의미/해설 충돌 | 해당 revision 보류 | B fail 차단 |
| 유형 검색과 실제 TASK 불일치 | 해당 TASK 공급·직접 평가 불가 | 수요/검수 TASK·role 결속 |
| 정답 키만 존재, 루브릭 미검증 | 독립·전이·지연 평가 불가 | E unknown 차단 |
| 해설·힌트·동일 본문 사전 노출 | 새 독립 수행 근거 불가 | 공급 시점 사용자/공유·동일본문/도움 로그 |
| 콘텐츠 변경 후 이전 검수·승인 사용 | 새 revision 재검수 | artifact id/revision/hash 및 승인 범위 |
| 현재 source와 오래된 캐시 | 현재 적격 승인으로 사용 불가 | 현재/cache revision 차이와 생성 당시 결속 |

원문 분석·모델 설명은 Gold를 포함하지 않는 계약일 수 있다. 그때 E가 필수가 아니어도 원천·의미·TASK·교수·권리·학습자 접근·실행은 검증해야 한다. 같은 source 설명을 봤다는 이유로 자료 전체를 폐기하지 않지만 독립 확인의 미노출 증거로는 쓸 수 없다. 지도 연습은 힌트 기록·assisted 표시·최종 지도 응답 봉인 뒤 Gold 공개가 필요하다. 전이는 다른 학습 본문/동일 수행 목표/공유본문 제외, 지연은 실제 경과 시간/중간 노출/동일 문항 재인 구별을 추가로 요구한다.

## 승인과 공급 시점

연구용 `true`나 `verified` 하나를 승인으로 보지 않는다. 제품 서버가 권한 있는 실제 actor·유효한 record·정확한 artifact/source/analysis/Gold/policy revision/hash·TASK·role을 확인한 원장 snapshot을 제공해야 한다. 연구 검사기의 입력 신뢰 경계는 서버에 있다. 연구 JSON을 클라이언트가 보내 원장 snapshot으로 인정하는 구현은 금한다.

학습자 접근과 노출 snapshot은 공급 요청 user/artifact/현재 시각과 같아야 한다. 과거 캐시 또는 다른 사용자 기록을 재사용하지 않는다. 중복 공급은 서버의 원자적 unique claim과 기존 공급 여부로 보장해야 한다. 이 검사기는 DB 트랜잭션·RLS·실제 권리 승인을 구현하지 않는다.

승인안 C의 `producible/rights/content/teaching/gold/assessment/runnable`을 파생 요약한다. `learner`는 이 7열에 없으며 공급 시점 검증으로 분리한다. F pass도 실제 rights record가 없으면 요약 rights는 null이다. content에 A/B/C를 축약하더라도 각 축 이유·evidence·검수 revision을 보존한다. unknown/NA를 true로 바꾸지 않는다.

```powershell
node --test scripts/research/factory-qualification-v11/role-gates.test.mjs
```

현재 테스트는 7필수 사례와 승인자·사용자·중복·근거·분석/policy 변경·Gold 없는 역할 경계를 포함한다. 실제 제품 E2E 또는 학습자 공급 성공 수로 세지 않는다. 현재 콘텐츠의 공개·직접 평가 자격은 별도 원장을 따르며 외부 승인 없이 부여하지 않는다.
