# Factory Integration v1.1 검증 분모

원본82/historyFAIL과최신코드의 원본입력79/82,독립정정82/82를분리한다. 모든입력은합성contract fixture이고실제교재·학생·권리승인기록이아니다.

| 단계 | 실행검사 | 안전기대 PASS/FAIL |
|---|---:|---|
| 원본입력재실행 |82|79/3|
| 독립정정재실행 |82|82/0|
| Claude수용검사 |82|82/0|
| 원본회귀·wire |19+7|26/0|
| Claudefixture capture |82|82/0, 비교용반복|
| 새정상/공격진단 |46|42/4|

신규46의전체ID·기대·실제결과는[adversarial.json](data/adversarial.json)에있다. 아래표는핵심종료대조다.

| 이슈 | 정상대조 | 공격대조 | 판정 |
|---|---|---|---|
| I01 | trusted-receipt후보1 | 9개비사용상태+boundverdict→0 | 종료 |
| I02 | 정상subject→1 |중복·stale/ID-only→0|종료|
| I03 |실행ID동일정상→1|실행ID불일치/mode·mock충돌→0|종료|
| I05 |사전검증serverfixture정상→1|untrustedJSON/brand문자열→0; lifecycle선언변이는1|재개|
| I06 |legacy seven-true→1, rightsunknown표시유지|false/null→0; missing필드→1|재개|
| I07 |동일subject→1|id/kind/rev/hash/source/analysis/Gold7변이→0|결속종료·실제readerBLOCKED|
| I04 |정확한요청role/단위|role/TASK불일치→0|종료|
| I08 |requestBody parse/reuse|기존비표준JSON반례해결|종료|
| I09 |v2동일값nestedorder|support/PLAN변경new서명, v1불일치|종료·DB미적용|
| I10 |candidate1+delivery0|G는null,납품unknown/zero별도|종료|
| I11 |instruction정상|trusted source_analysis Dfail→부적격|종료|

검사수는실행분모이며독립증거수/교육성공률이아니다. old82의D/H 상당수가context없음에서먼저보류되므로그결과만으로뒤조건을검증했다고하지않는다. 신규trusted path가그한계를보완했고새P1을찾았다. 현재 --acceptance는4FAIL때문에exit1이다.
