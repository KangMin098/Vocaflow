# 원문 점검 회차 1 — round-1-v2

> 기준 버전 v2 · 판정 442건 · 소스 25곳
> 생성: `node scripts/csat/source-round-report.mjs --round 1` · 근거 태그: 이 문서의 수치는 전부 [측정](이 회차 판정 파일 집계)이다.

## 1. 판정 분포

전체 보관 364(82.4%) · 보류 30(6.8%) · 폐기 48(10.9%)

보류 사유: `processing-unclear` 4 · `incomplete-source` 13 · `borderline` 13

| 소스 | 건수 | 보관 | 보류 | 폐기 | 보관 비율 |
|---|---|---|---|---|---|
| african_storybook | 4 | 4 | 0 | 0 | 100.0% |
| econstor | 14 | 14 | 0 | 0 | 100.0% |
| elife | 20 | 20 | 0 | 0 | 100.0% |
| europe_pmc | 20 | 16 | 3 | 1 | 80.0% |
| factbook | 7 | 7 | 0 | 0 | 100.0% |
| frontiers | 20 | 19 | 1 | 0 | 95.0% |
| frym | 20 | 17 | 3 | 0 | 85.0% |
| futurity | 20 | 19 | 1 | 0 | 95.0% |
| nasa | 20 | 13 | 0 | 7 | 65.0% |
| nist | 20 | 16 | 1 | 3 | 80.0% |
| noaa | 20 | 9 | 2 | 9 | 45.0% |
| olh | 20 | 17 | 3 | 0 | 85.0% |
| openalex | 16 | 14 | 0 | 2 | 87.5% |
| original | 20 | 20 | 0 | 0 | 100.0% |
| owid | 13 | 9 | 0 | 4 | 69.2% |
| plos | 20 | 17 | 2 | 1 | 85.0% |
| scielo | 20 | 18 | 1 | 1 | 90.0% |
| simple_wikipedia | 20 | 10 | 3 | 7 | 50.0% |
| space_place | 20 | 13 | 3 | 4 | 65.0% |
| storyweaver | 20 | 10 | 4 | 6 | 50.0% |
| the_conversation | 20 | 19 | 1 | 0 | 95.0% |
| usgs | 20 | 17 | 1 | 2 | 85.0% |
| voa | 20 | 20 | 0 | 0 | 100.0% |
| wikipedia | 20 | 19 | 0 | 1 | 95.0% |
| wikivoyage | 8 | 7 | 1 | 0 | 87.5% |

## 2. 칸별 집계 — 보관된 원천이 채우는 칸

| 연령 | 보관 원천 수 | 보관 중 비율 |
|---|---|---|
| `high2` | 258 | 70.9% |
| `high3` | 246 | 67.6% |
| `adult` | 224 | 61.5% |
| `high1` | 138 | 37.9% |
| `mid` | 74 | 20.3% |
| `elem` | 30 | 8.2% |

| 목적 | 보관 원천 수 | 보관 중 비율 |
|---|---|---|
| `reading` | 345 | 94.8% |
| `mock` | 270 | 74.2% |
| `csat` | 247 | 67.9% |
| `school` | 88 | 24.2% |
| `vocab` | 12 | 3.3% |

| 문항 유형 | 보관 원천 수 | 보관 중 비율 |
|---|---|---|
| `content_match` | 228 | 62.6% |
| `main_point` | 220 | 60.4% |
| `blank` | 207 | 56.9% |
| `order` | 199 | 54.7% |
| `topic` | 174 | 47.8% |
| `insert` | 126 | 34.6% |
| `summary` | 90 | 24.7% |
| `claim` | 62 | 17.0% |
| `title` | 51 | 14.0% |
| `irrelevant` | 40 | 11.0% |
| `mood` | 26 | 7.1% |
| `purpose` | 17 | 4.7% |
| `long_reference` | 16 | 4.4% |
| `vocab_choice` | 4 | 1.1% |
| `grammar_fix` | 1 | 0.3% |
| `grammar_choice` | 0 | 0.0% |

| 난이도 | 보관 원천 수 | 보관 중 비율 |
|---|---|---|
| `V6` | 156 | 42.9% |
| `V7` | 129 | 35.4% |
| `V5` | 128 | 35.2% |
| `V8` | 106 | 29.1% |
| `V9` | 82 | 22.5% |
| `V4` | 71 | 19.5% |
| `V10` | 42 | 11.5% |
| `V3` | 40 | 11.0% |
| `V2` | 24 | 6.6% |
| `V1` | 12 | 3.3% |
| `V11` | 12 | 3.3% |

**플랫폼 고유 속성(잠정 [추론]) — 소스별 보유 건수**

| 소스 | audio | data-claim | myth-rebuttal | claim-evidence | then-now |
|---|---|---|---|---|---|
| african_storybook | 0 | 0 | 0 | 0 | 0 |
| econstor | 0 | 4 | 2 | 10 | 1 |
| elife | 0 | 3 | 2 | 5 | 0 |
| europe_pmc | 0 | 1 | 3 | 4 | 0 |
| factbook | 0 | 0 | 0 | 0 | 3 |
| frontiers | 0 | 1 | 5 | 2 | 0 |
| frym | 0 | 1 | 1 | 1 | 1 |
| futurity | 0 | 1 | 2 | 2 | 0 |
| nasa | 0 | 0 | 0 | 0 | 0 |
| nist | 0 | 0 | 0 | 1 | 0 |
| noaa | 0 | 4 | 2 | 6 | 2 |
| olh | 0 | 2 | 2 | 4 | 4 |
| openalex | 0 | 0 | 1 | 3 | 0 |
| original | 0 | 0 | 4 | 7 | 1 |
| owid | 0 | 5 | 2 | 6 | 1 |
| plos | 0 | 1 | 0 | 2 | 1 |
| scielo | 0 | 0 | 0 | 3 | 0 |
| simple_wikipedia | 0 | 0 | 0 | 2 | 1 |
| space_place | 0 | 1 | 1 | 0 | 0 |
| storyweaver | 0 | 0 | 0 | 0 | 0 |
| the_conversation | 0 | 1 | 5 | 4 | 2 |
| usgs | 0 | 0 | 2 | 0 | 1 |
| voa | 14 | 2 | 1 | 4 | 4 |
| wikipedia | 0 | 2 | 1 | 3 | 2 |
| wikivoyage | 0 | 0 | 3 | 1 | 5 |

## 3. 이중 판정 일치도

| 소스 | 건수 | 일치율 | κ |
|---|---|---|---|
| europe_pmc | 20 | 95.0% | 0.864 |
| nasa | 20 | 100.0% | 1.000 |
| noaa | 20 | 90.0% | 0.818 |
| storyweaver | 20 | 95.0% | 0.918 |
| the_conversation | 20 | 95.0% | 0.000 |

**κ 0.6 미만인 소스가 있다 — 기준 §9 에 따라 이 회차의 적재를 멈추고 어긋난 편의 why 를 대조한다.**

## 4. 사람 확인 표본 — 보관·보류·폐기 각 10건

| 판정 | 소스 | 원천 | 이유 | 칸(유형 · 목적 · 연령 · 난이도) |
|---|---|---|---|---|
| keep | african_storybook | Punishment `5c8e8ece` | 과일을 몰래 먹은 라힘이 배탈로 벌을 받고 사과하는 사건이 끝까지 이어져 초중등 읽기·심경·순서 칸을 채운다. | mood,order,content_match,topic · reading,school · elem,mid · V2,V3 |
| keep | econstor | Influence of Climatic Changes on Farmers’ Particip `edb492a6` | 4.2절 「농민은 실측 기상보다 자기 체감에 반응한다」 단락이 대조 논지로 서서 주제·요지·빈칸·삽입 칸을 채운다. | topic,main_point,blank,insert,summary · csat,reading · high3,adult · V9,V10 |
| keep | elife | Verbal Episodic Processing in Newborns `263ac92c` | 신생아가 화자 정보와 낱말을 묶어 기억한다는 발견을 물음→실험→의미로 풀어 주제·빈칸·순서 칸을 채운다. | topic,title,main_point,blank,order,summary · csat,mock,reading · high2,high3,adult · V5,V6 |
| keep | europe_pmc | Mycotoxins in Basidiomycete Mycelium and Fruiting  `e60aff44` | 첫 단락이 규제의 신중함과 균사체 안전성 증거를 대비시키고 둘째 단락이 균사체 재배 이점을 나열해 주제·빈칸·순서 칸을 채운다. | topic,blank,order · csat,mock,reading · high2,high3,adult · V6,V7 |
| keep | factbook | Saudi Arabia `893b8c4d` | 둘째 단락(압둘라·살만 국왕의 단계적 개혁: 여성 운전·투표 허용)이 개혁의 흐름으로 읽혀 순서·내용일치·요약 칸을 채운다. | content_match,order,summary,insert · mock,csat,reading · high2,high3,adult · V6,V7 |
| keep | frontiers | Content and Language Integrated Scientific Modelli `0d66b37a` | 서론의 모형 오개념 단락(학생들은 모형을 실물의 정확한 복제로 믿는다)과 고찰의 CLIL 인지부하 해석이 떼어 쓸 논지를 갖춰 주제·빈칸·요약 칸을 채운다. | topic,blank,summary · csat,reading · high3,adult · V8,V9 |
| keep | frym | The Hidden Life of Fungi `d5119ce9` | 균류가 숲 밑에서 뿌리를 잇고 분해·빵·약에 쓰인다는 사실이 한 편으로 서서 초중등 읽기·내용일치·주제 칸을 채운다 | topic,content_match,irrelevant · reading,school,vocab · elem,mid · V1,V2,V3 |
| keep | futurity | How do plants know when it's time to bloom? `218a5e9a` | Q&A 두 번째 답(따뜻한 겨울이 개화를 앞당기거나 늦춘다·춘화 처리)이 원인-결과 논지로 서서 빈칸·요지·순서 칸을 채운다. | main_point,blank,order,content_match · mock,csat,reading · high1,high2 · V5,V6 |
| keep | nasa | NASA Opens New Flight Dynamics Research Facility i `a944ddd3` | 새 풍동의 크기·풍속·팬 구성 단락이 옛 시설과 비교되며 사실이 여럿 서므로 내용 일치·주제 칸을 채운다. | content_match,topic,title · mock,reading · high1,high2 · V5,V6 |
| keep | nist | New SRM for Bullet Casings `e6583080` | 범죄 감식 현미경 교정이 왜 법정 증거 채택을 좌우하는지 설명하는 캘리포니아·캔자스 탄피 예시 단락이 떼어져 서므로 요지·빈칸·내용 일치 칸을 채운다. | main_point,blank,content_match,order · csat,mock,reading · high2,high3,adult · V7,V8 |
| hold(processing-unclear) | europe_pmc | Tirzepatide and SGLT2 Inhibitors for Heart Failure `a886be00` | 티르제파타이드·SGLT2 억제제의 효과를 약물·시험명 나열로 전하는 단락이 대부분이고 마지막 단락만 병용 검토 목적을 말해 가공 경로가 애매하다. | purpose,content_match · csat,mock,reading · high2,high3,adult · V8,V9 |
| hold(borderline) | frontiers | Colombian university journalism as a virtual stage `94c84361` | 대학 언론 플랫폼 소개 글로 추상적 이론어와 인용 잔재('44) puts it')가 섞였고 핵심 절이 지도 인터페이스 조작 설명이라, 떼어 쓸 단락이 대학의 평화 매개 역할 한 곳뿐이어서 판단이 갈린다. | topic · reading · adult · V9,V10 |
| hold(incomplete-source) | frym | Aliens From an Underwater World `e4f2d899` | 외래종 글의 도입 예고만 받아 정의·사례 본문이 빠졌으므로 칸은 보이나 원천이 불완전해 보류한다 | topic · reading · mid,high1 · V4,V5 |
| hold(processing-unclear) | futurity | Does using e-cigarettes boost cancer risk? `6cad0860` | 전자담배 사용자의 엑소좀 마이크로RNA 상향 결과가 짧게 나오고 나머지는 연구비·기관 나열이라 논지 단락이 얇아 가공이 애매하다. | content_match · reading · high3 · V8,V9 |
| hold(incomplete-source) | nist | High Efficiency in the Fastest Single-Photon Detec `3ee83bc7` | 초전도 나노선 검출기 원리 단락은 쓸 만하나 「이상적 장치는」 뒤 목록과 텅스텐 화합물 앞 비교 문단이 빠진 채 받혀 본문이 불완전하다. | content_match,order · csat,reading · high3,adult · V8,V9 |
| hold(borderline) | noaa | August 2020: The warmest summer on record for the  `32be9431` | 대부분 순위 나열이지만 1998년 기록과 비교하는 「타임머신」 단락은 논지가 서서 v2 §3-2 최소선과 한 단락 가공 사이에서 갈린다. | main_point,blank,content_match · mock,reading · high1,high2,high3 · V5,V6 |
| hold(borderline) | olh | Planetary Thinking in a Time of Crisis: Active Evo `7b8786c7` | 노스피어·러시아 코스미즘 계보를 실리콘밸리 가속주의와 잇는 논지는 서지만, 후반이 트럼프·머스크 등 실존 인물을 '브롤리가르키'로 몰아붙이는 일방적 정치 논박이라 차단 장르 경계에 걸린다. | topic,main_point,summary · reading · adult · V10,V11 |
| hold(processing-unclear) | plos | High-resolution global recombination mapping in C. `c696fa38` | 서론의 성별 교차 분포 차이 단락은 떼어지지만 crossover·synapsis 등 전문어가 문장마다 겹쳐 몇 낱말 교체로는 밴드를 못 내려 가공 가능성이 애매하다. | topic · reading · adult · V11 |
| hold(borderline) | scielo | 제임스 콘의 흑인 해방신학이 억압받는 공동체의 경험에서 신학을 다시 세우는 방식 `b3f64967` | 코튼 매더·스태핀의 노예제 옹호 논변 절은 사실 서술로 쓸 만하나 글 전체가 「미국 백인 신학은 인종주의다」라는 일방 논박과 교리적 단언이어서 차단 장르 경계에 걸린다. | content_match,main_point · reading · adult · V10,V11 |
| hold(incomplete-source) | simple_wikipedia | P. T. Barnum (도입부 발췌) `6810c129` | 노예 조이스 헤스를 161세로 속여 전시한 뒤 박물관을 세운 도입 서사는 내용 일치 칸이 되지만 도입부 95어만 받아 원천 전체를 가늠할 수 없다. | content_match · reading · high1,high2 · V3,V4 |
| discard | europe_pmc | Machine learning and AI for cancer research and ca `ba8bc0a7` | 문헌 검색 데이터베이스·기간·포함 배제 기준을 적은 방법 절차 절이라 읽는 글의 논지가 없어 채울 칸이 없다. | — · csat,mock,reading · high2,high3,adult · — |
| discard | nasa | NISAR’s L-Band Radar Reveals ‘Hummingbird’ in Anta `a27eaebe` | 편광 신호 색이 이미지에서 자홍·초록으로 보인다는 설명이 전부라 그림을 봐야 뜻이 서는 사진 해설이다. | — · — · — · — |
| discard | nist | NIST Advisory Committee Welcomes New Member `842f80bf` | 자문위원 신임 소식으로 경력·위원직·수상 이력을 나열할 뿐 떼어 낸 문단에 논지나 사건 흐름이 없어 내용 일치 칸 하나도 보관 최소선에 못 미친다. | — · — · — · — |
| discard | noaa | A look at all 173 of NOAA's new global temperature `1290db35` | 포스터 이미지의 파란·빨간 지구본 색을 봐야 뜻이 서는 해설이라 v2 §5 그림 전제 글로 폐기하며 떼어 낼 논지 단락이 없다. | — · — · — · — |
| discard | openalex | Morphometric evaluation and quantification using F `f6b4f072` | Fiji 소프트웨어로 거리·각도·면적을 재는 메뉴 조작 절차(Analyze→Set Scale 등)와 그림 설명뿐이고, 서론도 두 단 조판이 뒤섞여 떼어 낼 논지 문단이 없다. | — · — · — · — |
| discard | owid | We have a new Urbanization topic page `b63237b1` | 도시화 주제 페이지 개편 공지로, 본문은 새 차트를 둘러보라는 안내와 슬라이드 소개뿐이라 떼어 쓸 논지가 없다. | — · — · — · — |
| discard | plos | Synergy between surfactants’ stiffness and concent `9c0708f2` | 역마이셀 모의실험의 수식·상관함수 서술과 선행연구 나열뿐이라 떼어 낸 서론 단락에도 논지가 없어 채울 칸이 없다. | — · — · — · — |
| discard | scielo | 개 방광 결석(스트루바이트)의 X선 회절 분석에서 나타난 이상 강도 패턴과 그 원인 `bed7cdea` | 개 방광결석 X선 회절 단보로 본문이 그림 번호와 격자 간격·EDAX 측정 절차에 기대어 있고, 떼어 낸 칼륨 치환 단락도 방법 기술뿐이라 읽는 글 칸이 서지 않는다. | — · — · — · — |
| discard | simple_wikipedia | G4 countries (도입부) `dd60a0b0` | G4 네 나라 이름과 지지국·반대국 나열뿐이고 비교·의견 절 제목만 남아 논지나 흐름이 없어 내용 일치 칸조차 수치·이름 나열로만 채워진다. | — · — · — · — |
| discard | space_place | All About the Planets `73410727` | 행성 목록 페이지의 도입부로 「사이드바의 행성을 클릭하라」는 조작 전제 글이라 v2 §5 에 따라 폐기한다 | — · — · — · — |

## 5. 재판정 — 기준 개정 전후로 바뀐 건수

`scripts/csat/source-round/round-1` 와 같은 원천 442건 중 **61건** 바뀜 — hold→keep 13 · discard→hold 2 · discard→keep 1 · hold→discard 19 · keep→hold 10 · keep→discard 16

## 6. 오판 분석

사람 확인(§4 표본) 결과를 받은 뒤 채운다 — 잘못 보관한 것 · 잘못 폐기한 것 · 기준에 없어서 갈린 것(보류 `criteria-gap`).

## 7. 다음 회차 계획

오판 분석 뒤에 정한다 — 개정한 기준 버전 · 재판정 범위 · 다음 회차 소스별 건수.
