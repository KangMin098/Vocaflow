# 원문 점검 회차 9

> 기준 버전 v5 · 판정 20건 · 소스 1곳
> 생성: `node scripts/csat/source-round-report.mjs --round 9` · 근거 태그: 이 문서의 수치는 전부 [측정](이 회차 판정 파일 집계)이다.

## 1. 판정 분포

전체 보관 19(95.0%) · 보류 1(5.0%) · 폐기 0(0.0%)

보류 사유: `criteria-gap` 1

| 소스 | 건수 | 보관 | 보류 | 폐기 | 보관 비율 |
|---|---|---|---|---|---|
| nih_news_in_health | 20 | 19 | 1 | 0 | 95.0% |

## 2. 칸별 집계 — 보관된 원천이 채우는 칸

| 연령 | 보관 원천 수 | 보관 중 비율 |
|---|---|---|
| `high1` | 16 | 84.2% |
| `high2` | 16 | 84.2% |
| `adult` | 10 | 52.6% |
| `high3` | 9 | 47.4% |
| `mid` | 6 | 31.6% |
| `elem` | 0 | 0.0% |

| 목적 | 보관 원천 수 | 보관 중 비율 |
|---|---|---|
| `reading` | 19 | 100.0% |
| `mock` | 17 | 89.5% |
| `csat` | 10 | 52.6% |
| `school` | 5 | 26.3% |
| `vocab` | 1 | 5.3% |

| 문항 유형 | 보관 원천 수 | 보관 중 비율 |
|---|---|---|
| `content_match` | 12 | 63.2% |
| `main_point` | 10 | 52.6% |
| `blank` | 9 | 47.4% |
| `topic` | 7 | 36.8% |
| `summary` | 6 | 31.6% |
| `order` | 5 | 26.3% |
| `purpose` | 4 | 21.1% |
| `claim` | 3 | 15.8% |
| `title` | 2 | 10.5% |
| `insert` | 2 | 10.5% |
| `irrelevant` | 1 | 5.3% |
| `mood` | 0 | 0.0% |
| `long_reference` | 0 | 0.0% |
| `vocab_choice` | 0 | 0.0% |
| `grammar_choice` | 0 | 0.0% |
| `grammar_fix` | 0 | 0.0% |

| 난이도 | 보관 원천 수 | 보관 중 비율 |
|---|---|---|
| `V5` | 15 | 78.9% |
| `V6` | 7 | 36.8% |
| `V4` | 7 | 36.8% |
| `V3` | 3 | 15.8% |
| `V2` | 1 | 5.3% |

**플랫폼 고유 속성(잠정 [추론]) — 소스별 보유 건수**

| 소스 | audio | data-claim | myth-rebuttal | claim-evidence | then-now |
|---|---|---|---|---|---|
| nih_news_in_health | 0 | 3 | 2 | 2 | 2 |

## 3. 이중 판정 일치도

| 소스 | 건수 | 일치율 | κ |
|---|---|---|---|
| nih_news_in_health | 20 | 100.0% | 1.000 |



## 4. 사람 확인 표본 — 보관·보류·폐기 각 10건

| 판정 | 소스 | 원천 | 이유 | 칸(유형 · 목적 · 연령 · 난이도) |
|---|---|---|---|---|
| keep | nih_news_in_health | Managing Menopause `c18a050c` | 폐경 이행기 증상과 호르몬 요법 평가의 변화(20년 전 기피 → 최근 연구로 재평가) 단락이 논지를 세워 주제·요약·빈칸·내용 일치 칸을 채운다. | topic,summary,blank,content_match · csat,mock,reading · high2,high3,adult · V5,V6 |
| keep | nih_news_in_health | Out of Breath? Get Tested for COPD `90c995e8` | COPD 를 모르는 사람에게 폐활량 검사를 받으라고 권하는 짧은 안내로 누가·누구에게·무엇을이 서서 목적·내용 일치 칸을 채운다. | purpose,content_match · mock,reading · mid,high1 · V3,V4 |
| keep | nih_news_in_health | The Benefits of Botulinum Toxin `dceb538d` | 「치명적 독이 어떻게 치료제가 되나」라는 역설 단락이 논지를 세워 빈칸·요지·주제·내용 일치 칸을 채운다. | blank,main_point,topic,content_match · csat,mock,reading · high1,high2,high3,adult · V5,V6 |
| keep | nih_news_in_health | Unexplained Cases of Allergic Reactions Linked to  `2622294b` | 원인 모를 과민증 70명 중 6명이 진드기 물림과 연결된 붉은 고기 알레르기였다는 연구 흐름이 서서 요약·내용 일치 칸을 채운다. | summary,content_match,title · mock,reading · high1,high2,adult · V5 |
| keep | nih_news_in_health | Health Coaching May Improve Surgery Recovery `c68cad3f` | 맞춤형 사전 재활 집단과 표준 집단 비교 결과가 수치 주장과 근거로 이어져 요약·내용 일치·빈칸 칸을 채운다. | summary,content_match,blank · mock,reading · high1,high2,adult · V4,V5 |
| keep | nih_news_in_health | Manage Stress and Build Resilience `9b5fc868` | 스트레스 관리 단계(신호 인식 → 대처 → 관계 → 재구성 → 전문가)가 순서대로 이어져 요지·순서·삽입 칸을 채운다. | main_point,order,insert · school,mock,reading · mid,high1 · V3,V4 |
| keep | nih_news_in_health | The Powerful Placebo `f43780bb` | 「진짜 약이라 믿어야 위약이 듣는가」라는 물음을 연구로 뒤집는 단락과 「내면의 약국」 설명이 주제·제목·빈칸 칸을 채운다. | topic,title,blank,claim · csat,mock,reading · high1,high2,high3,adult · V5,V6 |
| keep | nih_news_in_health | Safe Sleep for Baby `920bd46a` | 영아돌연사 위험을 줄이는 수면 자세·환경의 까닭을 설명하고 부모에게 실천을 권해 요지·목적·내용 일치 칸을 채우되 영아 사망 소재라 고1 이상이다. | main_point,purpose,content_match · mock,reading · high1,high2,adult · V4 |
| keep | nih_news_in_health | Dr. Stacey Missmer on Painful Periods in Teens `b7171c19` | 학교 연극을 망설이는 소녀의 예로 골반통이 청소년 발달을 바꾼다는 주장과 「모든 진료에서 묻자」는 주장이 서서 주장·요지·빈칸 칸을 채운다. | claim,main_point,blank · csat,mock,reading · high2,high3,adult · V5 |
| keep | nih_news_in_health | Learn About Obesity and Cancer Risk `bd261f4b` | 비만과 암의 연관이 인과가 아니라는 단락이 상관·인과 구분 논지를 세워 요지·빈칸·무관한 문장 칸을 채운다. | main_point,blank,irrelevant · csat,mock,reading · high1,high2,high3 · V5 |
| hold(criteria-gap) | nih_news_in_health | Readers’ Favorite Online Health Stories `e42c13de` | 인기 기사 다섯 편의 요약을 이어 붙인 모음이라 한 편의 논지는 없고, 신장 단락처럼 개별 항목은 따로 서서 mixed 폐기와 개별 보관 사이에서 갈린다. | content_match · reading · mid,high1 · V4,V5 |

## 5. 재판정 — 기준 개정 전후로 바뀐 건수

이번 회차는 비교할 이전 판정이 없다(`--compare` 없음).

## 6. 오판 분석

사람 확인(§4 표본) 결과를 받은 뒤 채운다 — 잘못 보관한 것 · 잘못 폐기한 것 · 기준에 없어서 갈린 것(보류 `criteria-gap`).

## 7. 다음 회차 계획

오판 분석 뒤에 정한다 — 개정한 기준 버전 · 재판정 범위 · 다음 회차 소스별 건수.

## 5. 운영 기록 (손으로 적음)

**기준 v5 검증 회차 — nih_news_in_health.**

| | v4(회차 7) | v5 재판정(회차 7 청크) | v5 회차 9 새 표본 |
|---|---|---|---|
| 일치 | 85% · κ 0.211 | **20/20** | **20/20** |
| 분포 A / B | 19·1·0 / 17·1·2 | 20·0·0 / 20·0·0 | 19·1·0 / 19·1·0 |

v4 에서 갈린 공지문 3편(Spanish-Language · Hip Replacement · Fibromyalgia)이 v5 로 전부 purpose 칸 보관으로 모였다. 회차 9 에서도 공지·권유형(COPD 검사 · DS-Connect)을 두 판정자가 같게 보관했다. 판정이 전부 보관 쪽으로 쏠려 κ 는 쓰지 않고 일치율로 본다(§9).

**두 회차 연속 통과 → 대량 판정 가능**(남은 약 760편). 적재: 재판정 20 + 회차 9 20 = 40편(`--rebase-unjudged` — source_id 정정으로 updated_at 만 바뀌었다).

남은 v5 후보: 여러 기사 요약 모음(「Readers' Favorite」 — 두 판정자 모두 보류 · 하나는 criteria-gap)을 mixed 로 볼지.
