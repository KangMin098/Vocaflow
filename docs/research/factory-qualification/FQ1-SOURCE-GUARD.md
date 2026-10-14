# 원천·형·키·revision 사전 검사

v15 원천 감사와 이번 공장 metadata를 재사용했다. 새 전체 기출 수집·DB교정·파일재명명·생산은 하지 않았다.

`sourceGuard()`는 관찰 metadata의 명시 충돌을 차단하고, 필요한 관찰이 없으면unknown으로남긴다. 입력 metadata의 실물 대조 자체를 대신하는 PDF파서는 아니다.

| 실패fixture | 검출 코드 | 대응 |
|---|---|---|
| 2014 A/B에17듣기·18읽기시작대입 | 2014_regime_mismatch | 실제22듣기·23~45읽기체제입력복구 |
| A문제/B정답 또는 다른형 | key_exam/form_mismatch | 동일형키직접대조 |
| M2009 이름, M2106 머리글/동일hash | exam_header_mismatch | 등록원천차단;해당역사시험부재주장금지 |
| 정답표파일명인데듣기대본내용 | transcript_is_not_answer_key | kind/content/hash/45행·100점대조 |
| generated source/analysis/Gold와declared revision불일치 | binding_conflict | 생산중단,원래버전회복또는명시수정재검수 |
| 새analysis가있는데pinnedoldGold를자동변경 | newer_analysis_requires_conflict_review | unknown;oldbinding유지와새분석의영향검토 |
| 원천캐시의source_updated_at과현재article불일치 | stale_source_eligibility | 캐시usable/blocked를현재허가/거절로승격하지않음 |
| 생성시점원천revision없음 | generation_source_revision_unbound | 현재원문비교와당시생성입력보존을구별 |

선택DCP12에는 생성revision 전용 열이 없다. created_at을 revision으로대체하지않고 연구용 immutable row/payload hash를 결속한다. 실제 source cache는fresh5/stale5/missing2로관찰됐다. 전체재고의비율이나인과로일반화하지않는다.

v15의최신analysis4~6와이전version3의개별내용은추가원장에그대로있다. 기존Gold/첫판정을덮지않으며revision mismatch가확인된생성물을현재분석검수로위장하지않는다. 기사source에는시험형/시험정답표를강제하지않지만실제기사identity/hash/생성시점sourcebinding을요구한다.
