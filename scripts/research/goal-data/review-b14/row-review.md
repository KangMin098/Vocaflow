# T-0121 · 반복 패턴 적발 5트랙의 행별 판정 필드 대조

원문·전체 판정은 guards.local.json에 보존한다. 아래 140행은 모든 적발 트랙의 최종행을 포함한다. 표의 S/P/C는 각각 문항별 결정 경로/primary 이유/반사실 결속이다. labels 자체의 반복과 계약 고정 무관·unknown은 틀 판정으로 쓰지 않았다. 정확히 같은 문장 0이라는 결과만으로 의미 Gold를 확정하지 않고 문항별 인과·선지·근거를 읽어 비교했다. b3은 primary_reason 계약 도입 전이라 P가 n/a다. C 없음은 indirect 없는 행이며 검증 누락이 아니다.

|배치/트랙|문항|why 반복 적발|S/P/C|판정|파일:줄|
|---|---|---|---|---|---|
|b3-insert/B|2026#38|없음|고유/n/a/1개 개별 결속|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b3-insert/chunk-B-01.out.json:4; scripts/research/goal-data/local/b3-insert/input.json:7|
|b3-insert/B|2026#39|없음|고유/n/a/1개 개별 결속|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b3-insert/chunk-B-01.out.json:219; scripts/research/goal-data/local/b3-insert/input.json:162|
|b3-insert/B|M2706#38|없음|고유/n/a/1개 개별 결속|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b3-insert/chunk-B-01.out.json:434; scripts/research/goal-data/local/b3-insert/input.json:313|
|b3-insert/B|M2706#39|있음|고유/n/a/2개 개별 결속|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b3-insert/chunk-B-01.out.json:639; scripts/research/goal-data/local/b3-insert/input.json:468|
|b3-insert/B|M2609#38|없음|고유/n/a/1개 개별 결속|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b3-insert/chunk-B-01.out.json:865; scripts/research/goal-data/local/b3-insert/input.json:652|
|b3-insert/B|M2609#39|있음|고유/n/a/2개 개별 결속|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b3-insert/chunk-B-01.out.json:1080; scripts/research/goal-data/local/b3-insert/input.json:823|
|b3-insert/B|2025#38|없음|고유/n/a/2개 개별 결속|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b3-insert/chunk-B-01.out.json:1310; scripts/research/goal-data/local/b3-insert/input.json:1000|
|b3-insert/B|2025#39|있음|고유/n/a/2개 개별 결속|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b3-insert/chunk-B-01.out.json:1540; scripts/research/goal-data/local/b3-insert/input.json:1152|
|b6-v23/A|M2506#18|없음|고유/고유/3개 개별 결속|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b6-v23/chunk-A-01.out.json:4; scripts/research/goal-data/local/b6-v23/input.json:16|
|b6-v23/A|M2506#19|없음|고유/고유/해당 없음|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b6-v23/chunk-A-01.out.json:147; scripts/research/goal-data/local/b6-v23/input.json:163|
|b6-v23/A|M2506#20|없음|고유/고유/1개 개별 결속|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b6-v23/chunk-A-01.out.json:259; scripts/research/goal-data/local/b6-v23/input.json:317|
|b6-v23/A|M2506#21|없음|고유/고유/2개 개별 결속|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b6-v23/chunk-A-01.out.json:383; scripts/research/goal-data/local/b6-v23/input.json:481|
|b6-v23/A|M2506#22|없음|고유/고유/1개 개별 결속|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b6-v23/chunk-A-01.out.json:521; scripts/research/goal-data/local/b6-v23/input.json:649|
|b6-v23/A|M2506#23|없음|고유/고유/해당 없음|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b6-v23/chunk-A-01.out.json:645; scripts/research/goal-data/local/b6-v23/input.json:825|
|b6-v23/A|M2506#24|없음|고유/고유/1개 개별 결속|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b6-v23/chunk-A-01.out.json:758; scripts/research/goal-data/local/b6-v23/input.json:986|
|b6-v23/A|M2506#26|없음|고유/고유/해당 없음|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b6-v23/chunk-A-01.out.json:882; scripts/research/goal-data/local/b6-v23/input.json:1151|
|b6-v23/A|M2506#27|없음|고유/고유/해당 없음|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b6-v23/chunk-A-01.out.json:1001; scripts/research/goal-data/local/b6-v23/input.json:1288|
|b6-v23/A|M2506#28|없음|고유/고유/해당 없음|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b6-v23/chunk-A-01.out.json:1120; scripts/research/goal-data/local/b6-v23/input.json:1424|
|b6-v23/A|M2506#29|없음|고유/고유/해당 없음|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b6-v23/chunk-A-01.out.json:1232; scripts/research/goal-data/local/b6-v23/input.json:1569|
|b6-v23/A|M2506#30|없음|고유/고유/2개 개별 결속|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b6-v23/chunk-A-01.out.json:1337; scripts/research/goal-data/local/b6-v23/input.json:1702|
|b6-v23/A|M2506#31|없음|고유/고유/해당 없음|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b6-v23/chunk-A-01.out.json:1470; scripts/research/goal-data/local/b6-v23/input.json:1843|
|b6-v23/A|M2506#32|없음|고유/고유/1개 개별 결속|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b6-v23/chunk-A-01.out.json:1582; scripts/research/goal-data/local/b6-v23/input.json:1990|
|b6-v23/A|M2506#33|없음|고유/고유/1개 개별 결속|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b6-v23/chunk-A-01.out.json:1716; scripts/research/goal-data/local/b6-v23/input.json:2156|
|b6-v23/A|M2506#34|없음|고유/고유/2개 개별 결속|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b6-v23/chunk-A-01.out.json:1846; scripts/research/goal-data/local/b6-v23/input.json:2303|
|b6-v23/A|M2506#35|없음|고유/고유/해당 없음|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b6-v23/chunk-A-01.out.json:1991; scripts/research/goal-data/local/b6-v23/input.json:2451|
|b6-v23/A|M2506#36|없음|고유/고유/해당 없음|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b6-v23/chunk-A-01.out.json:2104; scripts/research/goal-data/local/b6-v23/input.json:2619|
|b6-v23/A|M2506#37|없음|고유/고유/해당 없음|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b6-v23/chunk-A-01.out.json:2209; scripts/research/goal-data/local/b6-v23/input.json:2776|
|b6-v23/A|M2506#38|없음|고유/고유/해당 없음|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b6-v23/chunk-A-01.out.json:2314; scripts/research/goal-data/local/b6-v23/input.json:2958|
|b6-v23/A|M2506#39|없음|고유/고유/해당 없음|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b6-v23/chunk-A-02.out.json:4; scripts/research/goal-data/local/b6-v23/input.json:3115|
|b6-v23/A|M2506#40|없음|고유/고유/3개 개별 결속|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b6-v23/chunk-A-02.out.json:112; scripts/research/goal-data/local/b6-v23/input.json:3273|
|b6-v23/A|M2506#41|없음|고유/고유/해당 없음|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b6-v23/chunk-A-02.out.json:261; scripts/research/goal-data/local/b6-v23/input.json:3421|
|b6-v23/A|M2506#42|없음|고유/고유/해당 없음|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b6-v23/chunk-A-02.out.json:376; scripts/research/goal-data/local/b6-v23/input.json:3566|
|b6-v23/A|M2506#43|없음|고유/고유/1개 개별 결속|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b6-v23/chunk-A-02.out.json:480; scripts/research/goal-data/local/b6-v23/input.json:3719|
|b6-v23/A|M2506#44|없음|고유/고유/1개 개별 결속|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b6-v23/chunk-A-02.out.json:596; scripts/research/goal-data/local/b6-v23/input.json:3870|
|b6-v23/A|M2506#45|없음|고유/고유/해당 없음|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b6-v23/chunk-A-02.out.json:713; scripts/research/goal-data/local/b6-v23/input.json:4021|
|b6-v23/A|2023#38|있음|고유/고유/해당 없음|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b6-v23/chunk-A-02.out.json:831; scripts/research/goal-data/local/b6-v23/input.json:4170|
|b6-v23/A|2022#22|없음|고유/고유/1개 개별 결속|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b6-v23/chunk-A-02.out.json:939; scripts/research/goal-data/local/b6-v23/input.json:4352|
|b6-v23/A|2022#23|없음|고유/고유/해당 없음|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b6-v23/chunk-A-02.out.json:1065; scripts/research/goal-data/local/b6-v23/input.json:4521|
|b6-v23/A|2022#29|없음|고유/고유/해당 없음|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b6-v23/chunk-A-02.out.json:1176; scripts/research/goal-data/local/b6-v23/input.json:4697|
|b6-v23/A|2022#31|없음|고유/고유/1개 개별 결속|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b6-v23/chunk-A-02.out.json:1280; scripts/research/goal-data/local/b6-v23/input.json:4848|
|b6-v23/A|2022#32|없음|고유/고유/해당 없음|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b6-v23/chunk-A-02.out.json:1402; scripts/research/goal-data/local/b6-v23/input.json:5013|
|b6-v23/A|2022#33|없음|고유/고유/해당 없음|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b6-v23/chunk-A-02.out.json:1523; scripts/research/goal-data/local/b6-v23/input.json:5161|
|b6-v23/A|2022#34|없음|고유/고유/1개 개별 결속|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b6-v23/chunk-A-02.out.json:1640; scripts/research/goal-data/local/b6-v23/input.json:5325|
|b6-v23/A|2022#36|없음|고유/고유/1개 개별 결속|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b6-v23/chunk-A-02.out.json:1772; scripts/research/goal-data/local/b6-v23/input.json:5472|
|b6-v23/A|2022#37|없음|고유/고유/1개 개별 결속|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b6-v23/chunk-A-02.out.json:1888; scripts/research/goal-data/local/b6-v23/input.json:5655|
|b6-v23/A|2022#38|있음|고유/고유/해당 없음|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b6-v23/chunk-A-02.out.json:2004; scripts/research/goal-data/local/b6-v23/input.json:5806|
|b6-v23/A|2022#39|있음|고유/고유/해당 없음|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b6-v23/chunk-A-02.out.json:2112; scripts/research/goal-data/local/b6-v23/input.json:5959|
|b6-v23/A|2022#40|없음|고유/고유/2개 개별 결속|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b6-v23/chunk-A-02.out.json:2220; scripts/research/goal-data/local/b6-v23/input.json:6112|
|b8-v24/A|M2706#18|있음|고유/고유/2개 개별 결속|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b8-v24/chunk-A-01.out.json:4; scripts/research/goal-data/local/b8-v24/input.json:16|
|b8-v24/A|M2706#19|있음|고유/고유/해당 없음|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b8-v24/chunk-A-01.out.json:148; scripts/research/goal-data/local/b8-v24/input.json:160|
|b8-v24/A|M2706#20|있음|고유/고유/1개 개별 결속|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b8-v24/chunk-A-01.out.json:269; scripts/research/goal-data/local/b8-v24/input.json:308|
|b8-v24/A|M2706#21|있음|고유/고유/3개 개별 결속|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b8-v24/chunk-A-01.out.json:402; scripts/research/goal-data/local/b8-v24/input.json:479|
|b8-v24/A|M2706#24|있음|고유/고유/2개 개별 결속|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b8-v24/chunk-A-01.out.json:557; scripts/research/goal-data/local/b8-v24/input.json:649|
|b8-v24/A|M2706#26|있음|고유/고유/해당 없음|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b8-v24/chunk-A-01.out.json:701; scripts/research/goal-data/local/b8-v24/input.json:808|
|b8-v24/A|M2706#27|있음|고유/고유/해당 없음|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b8-v24/chunk-A-01.out.json:835; scripts/research/goal-data/local/b8-v24/input.json:955|
|b8-v24/A|M2706#28|있음|고유/고유/해당 없음|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b8-v24/chunk-A-01.out.json:969; scripts/research/goal-data/local/b8-v24/input.json:1108|
|b8-v24/A|M2706#30|있음|고유/고유/1개 개별 결속|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b8-v24/chunk-A-01.out.json:1097; scripts/research/goal-data/local/b8-v24/input.json:1252|
|b8-v24/A|M2706#35|있음|고유/고유/2개 개별 결속|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b8-v24/chunk-A-01.out.json:1236; scripts/research/goal-data/local/b8-v24/input.json:1393|
|b8-v24/A|M2706#41|있음|고유/고유/1개 개별 결속|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b8-v24/chunk-A-01.out.json:1381; scripts/research/goal-data/local/b8-v24/input.json:1543|
|b8-v24/A|M2706#42|있음|고유/고유/1개 개별 결속|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b8-v24/chunk-A-01.out.json:1520; scripts/research/goal-data/local/b8-v24/input.json:1684|
|b8-v24/A|M2706#43|있음|고유/고유/해당 없음|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b8-v24/chunk-A-01.out.json:1653; scripts/research/goal-data/local/b8-v24/input.json:1838|
|b8-v24/A|M2706#44|있음|고유/고유/해당 없음|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b8-v24/chunk-A-01.out.json:1774; scripts/research/goal-data/local/b8-v24/input.json:1984|
|b8-v24/A|M2706#45|있음|고유/고유/해당 없음|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b8-v24/chunk-A-01.out.json:1895; scripts/research/goal-data/local/b8-v24/input.json:2136|
|b8-v24/A|M2409#18|있음|고유/고유/2개 개별 결속|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b8-v24/chunk-A-01.out.json:2029; scripts/research/goal-data/local/b8-v24/input.json:2289|
|b8-v24/A|M2409#19|있음|고유/고유/해당 없음|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b8-v24/chunk-A-01.out.json:2173; scripts/research/goal-data/local/b8-v24/input.json:2435|
|b8-v24/A|M2409#20|있음|고유/고유/2개 개별 결속|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b8-v24/chunk-A-01.out.json:2294; scripts/research/goal-data/local/b8-v24/input.json:2586|
|b8-v24/A|M2409#21|있음|고유/고유/1개 개별 결속|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b8-v24/chunk-A-01.out.json:2438; scripts/research/goal-data/local/b8-v24/input.json:2760|
|b8-v24/A|M2409#22|있음|고유/고유/2개 개별 결속|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b8-v24/chunk-A-01.out.json:2577; scripts/research/goal-data/local/b8-v24/input.json:2932|
|b8-v24/A|M2409#23|없음|고유/고유/2개 개별 결속|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b8-v24/chunk-A-02.out.json:4; scripts/research/goal-data/local/b8-v24/input.json:3113|
|b8-v24/A|M2409#24|없음|고유/고유/2개 개별 결속|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b8-v24/chunk-A-02.out.json:133; scripts/research/goal-data/local/b8-v24/input.json:3262|
|b8-v24/A|M2409#26|없음|고유/고유/해당 없음|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b8-v24/chunk-A-02.out.json:262; scripts/research/goal-data/local/b8-v24/input.json:3411|
|b8-v24/A|M2409#27|없음|고유/고유/해당 없음|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b8-v24/chunk-A-02.out.json:383; scripts/research/goal-data/local/b8-v24/input.json:3548|
|b8-v24/A|M2409#28|없음|고유/고유/해당 없음|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b8-v24/chunk-A-02.out.json:504; scripts/research/goal-data/local/b8-v24/input.json:3683|
|b8-v24/A|M2409#29|없음|고유/고유/해당 없음|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b8-v24/chunk-A-02.out.json:617; scripts/research/goal-data/local/b8-v24/input.json:3834|
|b8-v24/A|M2409#30|없음|고유/고유/1개 개별 결속|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b8-v24/chunk-A-02.out.json:721; scripts/research/goal-data/local/b8-v24/input.json:3985|
|b8-v24/A|M2409#31|없음|고유/고유/해당 없음|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b8-v24/chunk-A-02.out.json:838; scripts/research/goal-data/local/b8-v24/input.json:4133|
|b8-v24/A|M2409#32|없음|고유/고유/2개 개별 결속|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b8-v24/chunk-A-02.out.json:951; scripts/research/goal-data/local/b8-v24/input.json:4303|
|b8-v24/A|M2409#33|없음|고유/고유/3개 개별 결속|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b8-v24/chunk-A-02.out.json:1080; scripts/research/goal-data/local/b8-v24/input.json:4473|
|b8-v24/A|M2409#34|없음|고유/고유/3개 개별 결속|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b8-v24/chunk-A-02.out.json:1226; scripts/research/goal-data/local/b8-v24/input.json:4643|
|b8-v24/A|M2409#35|없음|고유/고유/1개 개별 결속|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b8-v24/chunk-A-02.out.json:1372; scripts/research/goal-data/local/b8-v24/input.json:4789|
|b8-v24/A|M2409#36|없음|고유/고유/해당 없음|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b8-v24/chunk-A-02.out.json:1498; scripts/research/goal-data/local/b8-v24/input.json:4937|
|b8-v24/A|M2409#37|없음|고유/고유/해당 없음|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b8-v24/chunk-A-02.out.json:1602; scripts/research/goal-data/local/b8-v24/input.json:5091|
|b8-v24/A|M2409#38|없음|고유/고유/해당 없음|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b8-v24/chunk-A-02.out.json:1706; scripts/research/goal-data/local/b8-v24/input.json:5274|
|b8-v24/A|M2409#39|없음|고유/고유/해당 없음|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b8-v24/chunk-A-02.out.json:1808; scripts/research/goal-data/local/b8-v24/input.json:5453|
|b8-v24/A|M2409#40|없음|고유/고유/3개 개별 결속|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b8-v24/chunk-A-02.out.json:1910; scripts/research/goal-data/local/b8-v24/input.json:5636|
|b8-v24/A|M2409#41|없음|고유/고유/2개 개별 결속|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b8-v24/chunk-A-02.out.json:2051; scripts/research/goal-data/local/b8-v24/input.json:5788|
|b8-v24/A|M2409#42|없음|고유/고유/1개 개별 결속|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b8-v24/chunk-A-02.out.json:2180; scripts/research/goal-data/local/b8-v24/input.json:5940|
|b8-v24/A|M2409#43|없음|고유/고유/해당 없음|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b8-v24/chunk-A-02.out.json:2296; scripts/research/goal-data/local/b8-v24/input.json:6093|
|b9t-v24/A|2022#19|없음|고유/고유/1개 개별 결속|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b9t-v24/chunk-A-01.out.json:3; scripts/research/goal-data/local/b9t-v24/input.json:18|
|b9t-v24/A|2022#21|없음|고유/고유/2개 개별 결속|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b9t-v24/chunk-A-01.out.json:32; scripts/research/goal-data/local/b9t-v24/input.json:166|
|b9t-v24/A|2022#26|없음|고유/고유/해당 없음|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b9t-v24/chunk-A-01.out.json:61; scripts/research/goal-data/local/b9t-v24/input.json:338|
|b9t-v24/A|2022#27|없음|고유/고유/해당 없음|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b9t-v24/chunk-A-01.out.json:90; scripts/research/goal-data/local/b9t-v24/input.json:494|
|b9t-v24/A|2022#28|없음|고유/고유/해당 없음|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b9t-v24/chunk-A-01.out.json:119; scripts/research/goal-data/local/b9t-v24/input.json:630|
|b9t-v24/A|2022#45|있음|고유/고유/해당 없음|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b9t-v24/chunk-A-01.out.json:148; scripts/research/goal-data/local/b9t-v24/input.json:779|
|b9t-v24/A|M2406#19|없음|고유/고유/해당 없음|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b9t-v24/chunk-A-01.out.json:177; scripts/research/goal-data/local/b9t-v24/input.json:933|
|b9t-v24/A|M2406#21|없음|고유/고유/1개 개별 결속|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b9t-v24/chunk-A-01.out.json:206; scripts/research/goal-data/local/b9t-v24/input.json:1082|
|b9t-v24/A|M2406#26|있음|고유/고유/해당 없음|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b9t-v24/chunk-A-01.out.json:235; scripts/research/goal-data/local/b9t-v24/input.json:1253|
|b9t-v24/A|M2406#27|있음|고유/고유/해당 없음|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b9t-v24/chunk-A-01.out.json:264; scripts/research/goal-data/local/b9t-v24/input.json:1390|
|b9t-v24/A|M2406#28|없음|고유/고유/해당 없음|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b9t-v24/chunk-A-01.out.json:293; scripts/research/goal-data/local/b9t-v24/input.json:1525|
|b9t-v24/A|M2406#45|있음|고유/고유/해당 없음|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b9t-v24/chunk-A-01.out.json:322; scripts/research/goal-data/local/b9t-v24/input.json:1675|
|b13-v24/A|M2206#18|없음|고유/고유/1개 개별 결속|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b13-v24/chunk-A-01.out.json:4; scripts/research/goal-data/local/b13-v24/input.json:16|
|b13-v24/A|M2206#19|없음|고유/고유/1개 개별 결속|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b13-v24/chunk-A-01.out.json:129; scripts/research/goal-data/local/b13-v24/input.json:193|
|b13-v24/A|M2206#20|없음|고유/고유/1개 개별 결속|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b13-v24/chunk-A-01.out.json:248; scripts/research/goal-data/local/b13-v24/input.json:344|
|b13-v24/A|M2206#21|없음|고유/고유/1개 개별 결속|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b13-v24/chunk-A-01.out.json:373; scripts/research/goal-data/local/b13-v24/input.json:494|
|b13-v24/A|M2206#22|없음|고유/고유/2개 개별 결속|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b13-v24/chunk-A-01.out.json:498; scripts/research/goal-data/local/b13-v24/input.json:668|
|b13-v24/A|M2206#23|없음|고유/고유/2개 개별 결속|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b13-v24/chunk-A-01.out.json:625; scripts/research/goal-data/local/b13-v24/input.json:819|
|b13-v24/A|M2206#24|없음|고유/고유/2개 개별 결속|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b13-v24/chunk-A-01.out.json:751; scripts/research/goal-data/local/b13-v24/input.json:966|
|b13-v24/A|M2206#26|없음|고유/고유/해당 없음|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b13-v24/chunk-A-01.out.json:878; scripts/research/goal-data/local/b13-v24/input.json:1138|
|b13-v24/A|M2206#27|없음|고유/고유/해당 없음|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b13-v24/chunk-A-01.out.json:1000; scripts/research/goal-data/local/b13-v24/input.json:1295|
|b13-v24/A|M2206#28|없음|고유/고유/해당 없음|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b13-v24/chunk-A-01.out.json:1122; scripts/research/goal-data/local/b13-v24/input.json:1431|
|b13-v24/A|M2206#29|없음|고유/고유/해당 없음|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b13-v24/chunk-A-01.out.json:1236; scripts/research/goal-data/local/b13-v24/input.json:1582|
|b13-v24/A|M2206#30|없음|고유/고유/1개 개별 결속|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b13-v24/chunk-A-01.out.json:1341; scripts/research/goal-data/local/b13-v24/input.json:1734|
|b13-v24/A|M2206#31|없음|고유/고유/해당 없음|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b13-v24/chunk-A-01.out.json:1458; scripts/research/goal-data/local/b13-v24/input.json:1886|
|b13-v24/A|M2206#32|없음|고유/고유/1개 개별 결속|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b13-v24/chunk-A-01.out.json:1572; scripts/research/goal-data/local/b13-v24/input.json:2052|
|b13-v24/A|M2206#33|없음|고유/고유/1개 개별 결속|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b13-v24/chunk-A-01.out.json:1687; scripts/research/goal-data/local/b13-v24/input.json:2198|
|b13-v24/A|M2206#34|없음|고유/고유/1개 개별 결속|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b13-v24/chunk-A-01.out.json:1812; scripts/research/goal-data/local/b13-v24/input.json:2371|
|b13-v24/A|M2206#35|없음|고유/고유/1개 개별 결속|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b13-v24/chunk-A-01.out.json:1937; scripts/research/goal-data/local/b13-v24/input.json:2545|
|b13-v24/A|M2206#36|없음|고유/고유/해당 없음|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b13-v24/chunk-A-01.out.json:2061; scripts/research/goal-data/local/b13-v24/input.json:2717|
|b13-v24/A|M2206#37|없음|고유/고유/해당 없음|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b13-v24/chunk-A-01.out.json:2164; scripts/research/goal-data/local/b13-v24/input.json:2868|
|b13-v24/A|M2206#38|없음|고유/고유/해당 없음|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b13-v24/chunk-A-01.out.json:2267; scripts/research/goal-data/local/b13-v24/input.json:3052|
|b13-v24/A|M2206#39|없음|고유/고유/해당 없음|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b13-v24/chunk-A-02.out.json:4; scripts/research/goal-data/local/b13-v24/input.json:3229|
|b13-v24/A|M2206#40|없음|고유/고유/1개 개별 결속|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b13-v24/chunk-A-02.out.json:107; scripts/research/goal-data/local/b13-v24/input.json:3412|
|b13-v24/A|M2206#41|없음|고유/고유/1개 개별 결속|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b13-v24/chunk-A-02.out.json:232; scripts/research/goal-data/local/b13-v24/input.json:3560|
|b13-v24/A|M2206#42|없음|고유/고유/2개 개별 결속|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b13-v24/chunk-A-02.out.json:357; scripts/research/goal-data/local/b13-v24/input.json:3714|
|b13-v24/A|M2206#43|없음|고유/고유/해당 없음|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b13-v24/chunk-A-02.out.json:483; scripts/research/goal-data/local/b13-v24/input.json:3853|
|b13-v24/A|M2206#44|없음|고유/고유/해당 없음|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b13-v24/chunk-A-02.out.json:586; scripts/research/goal-data/local/b13-v24/input.json:4003|
|b13-v24/A|M2206#45|있음|고유/고유/해당 없음|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b13-v24/chunk-A-02.out.json:688; scripts/research/goal-data/local/b13-v24/input.json:4154|
|b13-v24/A|2021#18|없음|고유/고유/1개 개별 결속|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b13-v24/chunk-A-02.out.json:812; scripts/research/goal-data/local/b13-v24/input.json:4300|
|b13-v24/A|2021#19|없음|고유/고유/1개 개별 결속|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b13-v24/chunk-A-02.out.json:927; scripts/research/goal-data/local/b13-v24/input.json:4473|
|b13-v24/A|2021#20|없음|고유/고유/1개 개별 결속|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b13-v24/chunk-A-02.out.json:1034; scripts/research/goal-data/local/b13-v24/input.json:4624|
|b13-v24/A|2021#21|없음|고유/고유/1개 개별 결속|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b13-v24/chunk-A-02.out.json:1149; scripts/research/goal-data/local/b13-v24/input.json:4798|
|b13-v24/A|2021#22|없음|고유/고유/1개 개별 결속|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b13-v24/chunk-A-02.out.json:1284; scripts/research/goal-data/local/b13-v24/input.json:4965|
|b13-v24/A|2021#23|없음|고유/고유/1개 개별 결속|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b13-v24/chunk-A-02.out.json:1399; scripts/research/goal-data/local/b13-v24/input.json:5131|
|b13-v24/A|2021#24|없음|고유/고유/해당 없음|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b13-v24/chunk-A-02.out.json:1514; scripts/research/goal-data/local/b13-v24/input.json:5305|
|b13-v24/A|2021#26|있음|고유/고유/해당 없음|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b13-v24/chunk-A-02.out.json:1628; scripts/research/goal-data/local/b13-v24/input.json:5480|
|b13-v24/A|2021#27|있음|고유/고유/해당 없음|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b13-v24/chunk-A-02.out.json:1751; scripts/research/goal-data/local/b13-v24/input.json:5636|
|b13-v24/A|2021#28|없음|고유/고유/해당 없음|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b13-v24/chunk-A-02.out.json:1874; scripts/research/goal-data/local/b13-v24/input.json:5772|
|b13-v24/A|2021#29|있음|고유/고유/해당 없음|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b13-v24/chunk-A-02.out.json:1987; scripts/research/goal-data/local/b13-v24/input.json:5923|
|b13-v24/A|2021#30|있음|고유/고유/해당 없음|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b13-v24/chunk-A-02.out.json:2090; scripts/research/goal-data/local/b13-v24/input.json:6061|
|b13-v24/A|2021#31|없음|고유/고유/해당 없음|설명 반복과 별개로 판정 근거 유지; 의미 Gold unclear|scripts/research/goal-data/local/b13-v24/chunk-A-02.out.json:2192; scripts/research/goal-data/local/b13-v24/input.json:6200|

판정 필드에도 같은 문장을 id만 바꿔 넣은 행은 확인되지 않았다. b3의 유형별 배경 why, b8의 부정 발문 표현, b13의 선지 대조 문형은 반복되나 결정 경로와 선택지·반사실 대상이 각각 달라 일괄 재판정 근거로 보지 않는다. b8 A 20행(90+10설명, 두 그룹의 합집합20), b13 A 5행, b9t-v24 A 4행의 반복 설명은 개별 문항 근거로 쓰지 않는다. b3 B 3행은 전개 수행의 비관측이라는 공통 한계, b6 A 3행은 삽입 E2 격리라는 계약상 공통 한계로 구분한다. b3의 현재 삽입 단독평가 부적격 정책은 기존 결합기의 격리를 그대로 따른다.
