# Codex 독립 검증 결과 — 판정 규칙 v2 · R5/R6 확대

> codex-cli 0.163.0-alpha.11.1 · `exec -s read-only` · 2026-10-23 · 질문: [CODEX_REVIEW_PACKET.md](./CODEX_REVIEW_PACKET.md) · 검토 대상 HEAD `66cda9be8`
> 조치: P1 ①③ → RULES_V2 §1 · §2 수정(v2.1, 재판정 전). 판단불가 ⑤⑦ → README · RULES_V2 에 한계로 명시. 아래는 Codex 출력 원문(경로 링크만 상대 경로로 바꿈).

P0는 발견하지 못했습니다. **P1은 ① direct 정의의 축소와 ③ E2 거리 기준의 충돌입니다.** v2 확정 보류가 타당합니다.

1. **P1 — 기존 direct 정의보다 좁아집니다.**  
   기존 계약은 **한 실제 경로에서** 고유 수행이 결정적으로 쓰이면 direct입니다([ANALYST_CONTRACT.md:11](../../../../docs/csat-learner/v62/data-expansion/ANALYST_CONTRACT.md:11)). 반면 v2는 그 수행을 제거해도 **다른 합리적 경로가 남는지**를 묻습니다([RULES_V2.md:10](../../../../docs/csat-learner/v62/data-expansion/RULES_V2.md:10)).  
   서로 다른 두 풀이 경로가 각각 다른 TASK를 결정적으로 사용하는 문항은 기존 정의에서 둘 다 direct일 수 있지만, v2에서는 대체 경로 때문에 direct에서 제외됩니다. 따라서 기존 98검토·46링크와 동일 정의의 결과로 직접 비교하면 안 됩니다.

2. **PASS — 기본값 unknown이 현재 계산에서 ‘필요 없음’으로 전환되지는 않습니다.**  
   연결 미확인은 `unrelated`와 분리해 `relevanceUnknown`에 남기고([to-be.ts:158](../../../../apps/web/src/lib/csat/map/v4/to-be.ts:158)), NeedRank에는 `RELEVANCE_UNKNOWN`, `confirmed:false`로 추가합니다([rank.ts:47](../../../../apps/web/src/lib/csat/map/v62/rank.ts:47)). 통합 TASK의 단계 대기는 별도 `notComputable` 사유로 기록됩니다. 이번 배치의 unknown이 이 계산을 변경하는 연결도 발견하지 못했습니다.

3. **P1 — E2는 근거의 거리만으로 판정을 강제합니다.**  
   [RULES_V2.md:20](../../../../docs/csat-learner/v62/data-expansion/RULES_V2.md:20)은 근거가 표시 바로 곁에 있으면 indirect로 제한합니다. 그러나 **여러 표시 후보 중 정답을 가르는 근거를 특정해야 하는 수행**은 근거가 같은 문장 안에 있어도 결정적일 수 있습니다. 이는 §1의 결정성 기준과 충돌합니다.  
   실제 재판정에서도 2026#38·#39는 같은 결정 근거를 두고 표시와의 거리를 다르게 해석하여 A=indirect, B=direct로 갈립니다([rules-v2-links.json:4490](../../../../docs/csat-learner/v62/data-expansion/rules-v2-links.json:4490)). E2는 40쌍 중 15쌍이 갈렸고 κ는 **0.3392**입니다. R2에서는 별도 P0/P1 반례를 확인하지 못했습니다. 복수 TASK가 동시에 direct인 것 자체는 기존 출력 계약에 허용됩니다.

4. **PASS — makeLink 가드와 일치합니다.**  
   배치는 `relevance:'unknown'`을 유지하고, 비결함 문항의 일치한 direct·indirect만 후보에 넣습니다([batch-run.mjs:107](../../../../scripts/csat/map/v62/data/batch-run.mjs:107)). 이는 비인간 출처의 검토값·R2 이상 승격을 금지하는 가드와 일치합니다. 확인한 **3,084링크 모두 relevance가 unknown**이었습니다.

5. **판단불가 — 인위적 일치는 식별할 수 있지만 타당성 개선은 입증되지 않았습니다.**  
   재계산하면 같은 9 TASK의 κ는 **v1 0.4408 → v2 0.8051**입니다. 기본값 정책 대상 4 TASK를 제외한 200쌍에서도 **0.4868 → 0.6620**으로 올라, 상승 전체가 기본값 강제 때문은 아닙니다.  
   다만 S-O1·E-O1은 각각 40/40 unknown이며 κ가 정의되지 않습니다([rules-v2-agreement.json:79](../../../../docs/csat-learner/v62/data-expansion/rules-v2-agreement.json:79)). 독립 기준 판정 없이 이 수치로 **판정이 더 옳아졌다**고 결론 내릴 수는 없습니다.

6. **PASS — R1 후보 집계에 한정한 direct 사용은 타당합니다.**  
   R6의 755쌍에서 4값 κ는 **0.7005**, direct 이분 κ는 **0.9527**입니다([r5r6-agreement.json:30](../../../../docs/csat-learner/v62/data-expansion/r5r6-agreement.json:30)). 이는 direct 후보만 별도로 집계할 근거이며 정확도 검증은 아닙니다.  
   `exam-relevance`는 R6 direct만 세고 결과를 문서용 JSON으로 출력합니다([exam-relevance.mjs:28](../../../../scripts/csat/map/v62/data/exam-relevance.mjs:28)). 현재 목표 관련도·NeedRank에 이 배점을 소비하는 경로는 발견하지 못했습니다.

7. **판단불가 — 현재 7문항 분리는 확인했지만 전체 오탐·누락 부재는 입증되지 않았습니다.**  
   현재 원천에서 공백을 정규화해 재집계한 중복 그룹은 기록된 세 그룹과 일치했습니다. 결함 **7문항·14쌍**은 `SOURCE_DEFECT`, 후보 null이며 κ 분모에서 제외됩니다([batch-run.mjs:104](../../../../scripts/csat/map/v62/data/batch-run.mjs:104)).  
   다만 탐지 조건은 **같은 시험·동일한 정규화 발문·60자 초과**로 한정됩니다([coverage-audit.mts:109](../../../../scripts/csat/map/v62/data/coverage-audit.mts:109)). 이 조건 밖 원천 결함의 누락 여부까지 확인한 근거는 없습니다.

검증: 배치 `validate`는 v2 A/B 각 **40문항**, R5/R6 A/B 각 **762문항**, 모두 결함 0으로 통과했습니다. 이는 형식·원문 결속 검사 결과이며 내용 타당성 통과를 뜻하지 않습니다. 파일은 수정하지 않았습니다.