# 2014A#29 감수 판정 B (Claude)

근거: official_2014A_29.txt — Hours 별표 각주 "* The museum is closed on the first Monday of every month." · 선지 ③ 「매주 월요일에 휴관한다」 · ⑤ 주차 할인(Parking 단락) = 정답 ⑤와 일치. ① 추가 비용(additional fee) · ② 주말이 1시간 짧음 · ④ 12세 미만 무료 → 모두 불일치로 정답 ⑤와 모순 없음. DB 는 조회하지 않았다(공식 원문만으로 판정 가능).

| 항목 | 판정 | 근거 | 고친 문안 |
|---|---|---|---|
| 1 강의 c9 | APPROVE | (a) 각주 '매월 첫째 월요일'과 일치 (b) ③ 불일치 판정, ⑤ 언급 없음 (c) 분석 v6·탐구 문안과 같은 논리(주기 대조) (d) target reject:3 · focus [4](s4 = 다섯 번째 문장, Hours+각주) 유지, 낭독체, 영어 인용 없음 (e) 현행 c9의 「모든 성분이 확인되는 선지로 답을 정합니다」가 빠져 정답 암시가 오히려 줄었고 c9 는 경계(stopBefore 4) 뒤 | — |
| 2 choice_analysis[n=3].how_to_reject | APPROVE | 인용 'the first Monday of every month' 는 원문 그대로(6단어) · verdict distractor 유지 · 정답과 모순 없음 | — |
| 3 design_intent ③ 문장 | MODIFY | 선지는 month→week 만이 아니라 'first'(첫째)도 지웠다. 「month 를 week 로 바꾼」만 쓰면 변형의 절반만 설명해 항목 4(every week / every month · first 대조)와 어긋난다 | 「③(매주 월요일 휴관)은 Hours 별표 각주의 '매월 첫째 월요일'에서 first 를 지우고 month 를 week 로 바꿔 휴관 주기를 어긋나게 한 함정이다.」 |
| 4 solve_procedure 단계 | APPROVE | 원문 확인 가능한 사실 기준 절차로 바뀌고 주기 낱말(first·every month) 대조가 정확 | — |
| 5 inquiry-data 4곳 | MODIFY | §4 의 note·decisive·text·limitation 문안 자체는 사실·정답과 일치한다. 그러나 current.json 에는 「잘려/보류」 전제를 담은 필드가 2곳 더 있다 — principle.statement(「원문이 잘려 확인할 수 없는 성분은 판정을 보류한다」) · v3.requirement.conditions.1(「휴관 각주는 … 확인할 수 없다」). 이를 두면 (c) 일관성이 깨진다. 또 text 필드 경로는 v3.design.claims.1.text 임을 명시 | note·decisive·text·limitation = README §4 문안 그대로. 추가 2곳: principle.statement → 「안내문 일치는 선지의 대상·조건·수치를 원문 해당 줄(각주 포함)에 하나씩 대야 하고, 한 성분이라도 다르면 불일치로 지운다」 · v3.requirement.conditions.1 → 「휴관 정보는 Hours 별표 각주에 있으며 매월 첫째 월요일로 정해져 있다」 |
| 6 공개 경계 | (owner 확인) 기대: stopBefore 4 유지 · digest 재생성 | c9 는 경계 뒤 cue 이고 새 문안은 정답 ⑤를 말하지 않는다. preStopRisk 는 none 유지 예상. cue 문장이 바뀌므로 digest a2ca82e2… 는 반드시 재생성. 항목 3 수정은 DB 분석이라 digest 와 무관 | — |

## 종합
APPROVE 3(1·2·4) · MODIFY 2(3·5) · REJECT 0 · 6 owner 확인(stopBefore 4 유지, digest 재생성 기대). 핵심 사실(매월 첫째 월요일 휴관, ③ 불일치, 정답 ⑤)은 교체안 전부와 공식 원문이 일치한다. 반영 전 항목 5의 누락 2필드를 같은 커밋에 포함해야 탐구 자료에 「잘림·보류」 전제가 남지 않는다.
