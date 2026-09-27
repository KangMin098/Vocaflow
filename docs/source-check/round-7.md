# 원문 점검 회차 7

> 기준 버전 v4 · 판정 163건 · 소스 6곳
> 생성: `node scripts/csat/source-round-report.mjs --round 7` · 근거 태그: 이 문서의 수치는 전부 [측정](이 회차 판정 파일 집계)이다.

## 1. 판정 분포

전체 보관 147(90.2%) · 보류 5(3.1%) · 폐기 11(6.7%)

보류 사유: `processing-unclear` 2 · `borderline` 3

| 소스 | 건수 | 보관 | 보류 | 폐기 | 보관 비율 |
|---|---|---|---|---|---|
| eia_kids | 63 | 57 | 1 | 5 | 90.5% |
| gdl | 20 | 19 | 0 | 1 | 95.0% |
| global_storybooks | 20 | 13 | 2 | 5 | 65.0% |
| global_voices | 20 | 19 | 1 | 0 | 95.0% |
| nih_news_in_health | 20 | 19 | 1 | 0 | 95.0% |
| wikinews | 20 | 20 | 0 | 0 | 100.0% |

## 2. 칸별 집계 — 보관된 원천이 채우는 칸

| 연령 | 보관 원천 수 | 보관 중 비율 |
|---|---|---|
| `high1` | 95 | 64.6% |
| `high2` | 84 | 57.1% |
| `mid` | 77 | 52.4% |
| `elem` | 41 | 27.9% |
| `high3` | 36 | 24.5% |
| `adult` | 24 | 16.3% |

| 목적 | 보관 원천 수 | 보관 중 비율 |
|---|---|---|
| `reading` | 141 | 95.9% |
| `mock` | 86 | 58.5% |
| `school` | 70 | 47.6% |
| `csat` | 33 | 22.4% |
| `vocab` | 23 | 15.6% |

| 문항 유형 | 보관 원천 수 | 보관 중 비율 |
|---|---|---|
| `content_match` | 115 | 78.2% |
| `order` | 93 | 63.3% |
| `main_point` | 69 | 46.9% |
| `blank` | 29 | 19.7% |
| `title` | 28 | 19.0% |
| `insert` | 27 | 18.4% |
| `topic` | 19 | 12.9% |
| `mood` | 17 | 11.6% |
| `summary` | 12 | 8.2% |
| `irrelevant` | 12 | 8.2% |
| `claim` | 7 | 4.8% |
| `long_reference` | 7 | 4.8% |
| `vocab_choice` | 5 | 3.4% |
| `purpose` | 3 | 2.0% |
| `grammar_choice` | 0 | 0.0% |
| `grammar_fix` | 0 | 0.0% |

| 난이도 | 보관 원천 수 | 보관 중 비율 |
|---|---|---|
| `V5` | 88 | 59.9% |
| `V6` | 81 | 55.1% |
| `V4` | 43 | 29.3% |
| `V7` | 32 | 21.8% |
| `V3` | 24 | 16.3% |
| `V2` | 17 | 11.6% |
| `V1` | 11 | 7.5% |
| `V0` | 3 | 2.0% |
| `V8` | 2 | 1.4% |

**플랫폼 고유 속성(잠정 [추론]) — 소스별 보유 건수**

| 소스 | audio | data-claim | myth-rebuttal | claim-evidence | then-now |
|---|---|---|---|---|---|
| eia_kids | 2 | 4 | 2 | 3 | 10 |
| gdl | 0 | 0 | 0 | 0 | 0 |
| global_storybooks | 0 | 0 | 0 | 0 | 0 |
| global_voices | 0 | 2 | 1 | 3 | 1 |
| nih_news_in_health | 0 | 2 | 3 | 2 | 2 |
| wikinews | 0 | 1 | 0 | 2 | 1 |

## 3. 이중 판정 일치도

| 소스 | 건수 | 일치율 | κ |
|---|---|---|---|
| eia_kids | 63 | 95.2% | 0.729 |
| gdl | 20 | 100.0% | 1.000 |
| global_storybooks | 20 | 95.0% | 0.905 |
| global_voices | 20 | 95.0% | 0.643 |
| nih_news_in_health | 20 | 85.0% | 0.211 |
| wikinews | 20 | 95.0% | 0.000 |

**κ 0.6 미만인 소스가 있다 — 기준 §9 에 따라 이 회차의 적재를 멈추고 어긋난 편의 why 를 대조한다.**

## 4. 사람 확인 표본 — 보관·보류·폐기 각 10건

| 판정 | 소스 | 원천 | 이유 | 칸(유형 · 목적 · 연령 · 난이도) |
|---|---|---|---|---|
| keep | eia_kids | Natural gas `f005664f` | 생성→탐사→시추→처리→수송 절차 단락과 끝의 수압파쇄 환경 영향 단락이 각각 떼어져 순서·삽입·내용일치 칸을 채운다. | order,insert,content_match,topic · school,mock,reading · mid,high1,high2 · V5,V6,V7 |
| keep | gdl | Can’t Get in My Way `459940f6` | 첫 생리와 농구 시합을 엮은 서사가 걱정→도움→결승골로 이어져 중등 심경·순서·내용일치 칸을 채운다. | mood,order,content_match,summary · reading,school · mid,high1 · V3,V4 |
| keep | global_storybooks | What is wrong child? `4298d53b` | 엄마가 무엇을 해도 우는 아기를 「When ~, Matende cried」 반복으로 이어 가는 짧은 사건 흐름이라 초등 읽기 칸이 선다. | order,mood · reading,vocab · elem · V0,V1 |
| keep | global_voices | What India’s ‘Cockroach’ protests reveal about dig `4b1c1297` | 「The deeper importance」~「This is the paradox」 단락이 디지털 동원과 감시의 역설을 한 논지로 세워 주제·요지·빈칸 칸을 채운다. | topic,main_point,blank,summary,insert · csat,mock,reading · high2,high3,adult · V6,V7 |
| keep | nih_news_in_health | What is Palliative Care? `7da3b8ea` | 완화의료 정의 → 호스피스와의 구분 → 상담 권유로 다섯 단락이 이어져 주제·내용일치·순서 칸을 채운다. | topic,content_match,order · school,mock,reading · mid,high1 · V4,V5 |
| keep | wikinews | GMTV ends broadcasting in UK after 17 years `5bfe766c` | 종영 → 마지막 인사 → 후속 프로그램 순서가 네 단락에서 이어져 고1~고2 내용 일치·순서 칸을 채운다. | content_match,order · mock,reading · high1,high2 · V5 |
| keep | eia_kids | Latimer (1848) `4abffb4e` | 제도공에서 에디슨 팀 유일한 흑인 기술자가 되기까지 두 단락이 시간순으로 이어져 전기 내용일치·순서 칸이 선다. | content_match,order,title · school,reading · mid,high1 · V4,V5 |
| keep | gdl | The Poet: Sufia Kamal `d2fbd677` | 수피아 카말의 생애가 출생·조혼·과부·운동가로 시간순 전개되어 전기 요지·내용일치 칸이 선다. | content_match,main_point,title,order · reading,school · mid,high1 · V4,V5 |
| keep | global_storybooks | A Tiny Seed: The Story of Wangari Maathai `fa64f7ba` | 마타이의 유년, 유학, 귀국, 나무 심기, 노벨상까지 시간순 전기가 한 편으로 서서 초등·중등 내용 일치·순서 칸을 채운다. | content_match,order,insert,title · reading,school,vocab · elem,mid · V2,V3 |
| keep | global_voices | In Cameroon, before the scroll, there was the danc `e2520bcf` | 「Perhaps the most interesting thing」 단락이 휴대폰과 마을 춤을 대비해 대면 공동체의 가치를 말하고, 앞부분은 행사 묘사라 내용일치·순서 칸도 된다. | main_point,topic,content_match,order · mock,school,reading · mid,high1,high2,adult · V4,V5 |
| hold(processing-unclear) | eia_kids | In industry `717f55fa` | 산업 부문 연료·원료 구분 설명이 있으나 본문 대부분이 MECS 비중 수치라 떼어 낸 단락이 논지로 서는지 애매하다. | content_match · reading · high2,high3 · V7 |
| hold(borderline) | global_storybooks | Ms Phone `36e8a2a6` | 휴대폰 다섯 대 용도 나열이 본문 대부분이고 뒷부분 선행과 인기의 인과는 약해 초등 최소선 경계에 걸린다. | content_match · reading,vocab · elem · V1 |
| hold(borderline) | global_voices | From north to south, protests sweep across Tunisia `197fdec8` | 시위 경과보다 야당 인사 압데살렘의 「쿠데타 당국」 발언 인용이 대부분이라 일방적 정치 논박인지 보도인지 갈려 보류한다. | content_match · reading · adult · V6,V7 |
| hold(borderline) | nih_news_in_health | Considering Hip Replacement? `8d450279` | 고관절 치환술 웹사이트 새 주제를 알리는 공지인데 안내 URL 이 옛 경로라 목적 칸이 서는지 애매하다. | purpose · school · high1 · V5 |
| hold(processing-unclear) | global_storybooks | Soccer game Chiefs and Aces `ad609328` | 시합 응원·연습·유니폼 받기 장면이 시간 순서가 뒤섞이고 화자가 바뀌어 한 편의 흐름으로 가공될지 애매하다. | mood · reading,vocab · elem · V1,V2 |
| discard | eia_kids | In commercial buildings `f34c5c52` | 상업 건물 용도별 에너지 비중(32%·10%·60%)을 늘어놓는 세 단락뿐이라 떼어 낸 문단에 논지·흐름이 없고 내용일치 칸만 수치로 채운다. | — · — · — · — |
| discard | gdl | The Big Juicy Mango `7432bdfd` | 망고 나무 성장을 각운 2행 연으로 노래한 운문이며 같은 연이 반복되어 차단 장르에 해당한다. | — · — · — · — |
| discard | global_storybooks | The Big Juicy Mango `b7061b8d` | 망고나무 성장을 각운 맞춘 2행 연으로 노래하는 동시라 운문 차단 장르에 해당한다. | — · — · — · — |
| discard | eia_kids | Alcorn (1940) `17806b2e` | 학위·장학금·특허·연구 분야를 이력서처럼 나열한 두 단락이라 사건 흐름이나 논지가 없어 채울 칸이 없다. | — · — · — · — |
| discard | global_storybooks | Tell me...now! Colours `0c545785` | 「왜 ~색인가」 질문과 짧은 답이 서로 무관하게 나열될 뿐 문장 사이 사건·이유 연결이 없어 초등 최소선에 못 미친다. | — · — · — · — |
| discard | eia_kids | Roberts (1913) `fc197cc9` | 직위와 재임 기간을 연도별로 늘어놓은 이력 나열이고 「to the present」 현재형이 낡아 떼어 낼 사건·논지 단락이 없다. | — · — · — · — |
| discard | global_storybooks | Animals ,Animals `4e986a16` | 가축의 특징·울음소리 문장이 서로 연결 없이 나열돼 초등 최소선(사건·이유·순서 연결)에 못 미친다. | — · — · — · — |
| discard | eia_kids | Gourdine (1929) `0ca48bc9` | 학위와 직장·직위를 연도별로 나열한 이력이라 떼어 낸 단락에 사건 흐름이나 논지가 없다. | — · — · — · — |
| discard | global_storybooks | The Animals of Uganda `6237f055` | 동물마다 「What colour is ~?」로 그림을 보라고 묻는 캡션 반복에 끝에 편집 메모가 붙어 그림 없이는 서지 않는다. | — · — · — · — |
| discard | eia_kids | Crosthwait (1898) `3f9c71ad` | 학위·직위·특허 수·저술을 늘어놓은 이력 두 단락이라 사건 연결이나 논지가 없다. | — · — · — · — |

## 5. 재판정 — 기준 개정 전후로 바뀐 건수

이번 회차는 비교할 이전 판정이 없다(`--compare` 없음).

## 6. 오판 분석

사람 확인(§4 표본) 결과를 받은 뒤 채운다 — 잘못 보관한 것 · 잘못 폐기한 것 · 기준에 없어서 갈린 것(보류 `criteria-gap`).

## 7. 다음 회차 계획

오판 분석 뒤에 정한다 — 개정한 기준 버전 · 재판정 범위 · 다음 회차 소스별 건수.

## 5. 운영 기록 (손으로 적음 — 재생성 시 다시 붙인다)

**기준 v4 첫 회차.** 판정자 14(6곳 × 2 + 회차 6 global_storybooks v4 재판정 2).

### 5-1. v4 검증 — 회차 6 global_storybooks 를 v4 로 다시 판정

| | v3(회차 6) | v4(재판정) |
|---|---|---|
| 분포 A / B | 17·1·2 / 14·1·5 | 15·0·5 / 15·0·5 |
| κ | 0.470 | **1.000** |

v3 에서 갈린 네 건(Teeth · Cooking · The girl with one breast · Our wonderful world)이 전부 같은 판정으로 모였다 — 개정이 겨냥한 자리였다.
회차 7 새 표본에서도 κ 0.905.

### 5-2. 두 회차 연속 판정 (§9 · §10)

§9: 한 판정이 95% 이상으로 쏠리면 κ 대신 일치율(90% 이상)로 본다.

| 원천 | 회차 6 | 회차 7 | 두 회차 연속 | 대량 판정 |
|---|---|---|---|---|
| wikinews | κ 0.835 | 일치 95% (보관 쏠림 · κ 무의미) | 통과 | **가능 — 승인 대기** |
| gdl | κ 0.778 | κ 1.000 | 통과 | **가능 — 승인 대기** |
| eia_kids | κ 0.730 | κ 0.729 (63편 전량) | 통과 | **전량 판정 끝** — 적재만 남음 |
| global_voices | 일치 100% (쏠림) | κ 0.643 | 통과 | **가능 — 승인 대기**(수집 100편뿐) |
| global_storybooks | κ 0.470 → v4 재판정 1.000 | κ 0.905 | v4 로 통과 | **가능 — 승인 대기** |
| nih_news_in_health | 일치 100% (쏠림) | **일치 85% · κ 0.211** | **미달** | 멈춤 — 기준 보강 |
| openstax | κ 1.000 | — (재고 20편뿐 · 회차 제외) | — | 수집 확대 뒤 |

### 5-3. 기준 v5 후보

| 자리 | 사례 | 갈린 방식 |
|---|---|---|
| **기관 안내·홍보 공지문을 목적(purpose) 지문으로 보관하는가** | nih 「Spanish-Language Health Materials」 · 「Considering Hip Replacement?」 · 「Mind and Body Therapy for Fibromyalgia」 | 보관(목적 칸) ↔ 폐기(reference) ↔ 보류 |
| 한쪽 인용 위주 진행 중 정치 기사 — 보도인가 polemic 인가 | global_voices 튀니지 시위(두 회차 연속 보류) · 호르무즈 파병 반대(보관 ↔ 보류) | 두 회차 연속 경계로 짚였다 |
| 가벼운 폭력(체벌)의 연령 칸 하한 | gdl 「Golden Pig」 · 「Counting on Moru」 | 판정은 같고 연령 칸만 mid ↔ high1 |

### 5-4. 원천 간 중복

「The Big Juicy Mango」가 gdl 과 global_storybooks 표본에 모두 나왔다 — 같은 책이 두 원천으로 들어와 있다. 적재 재고의 제목 중복을 세어 둘 중 하나를 파생으로 묶어야 한다.
