# 원문 점검 회차 6

> 기준 버전 v3 · 판정 140건 · 소스 7곳
> 생성: `node scripts/csat/source-round-report.mjs --round 6` · 근거 태그: 이 문서의 수치는 전부 [측정](이 회차 판정 파일 집계)이다.

## 1. 판정 분포

전체 보관 124(88.6%) · 보류 7(5.0%) · 폐기 9(6.4%)

보류 사유: `borderline` 5 · `incomplete-source` 2

| 소스 | 건수 | 보관 | 보류 | 폐기 | 보관 비율 |
|---|---|---|---|---|---|
| eia_kids | 20 | 18 | 1 | 1 | 90.0% |
| gdl | 20 | 18 | 0 | 2 | 90.0% |
| global_storybooks | 20 | 17 | 1 | 2 | 85.0% |
| global_voices | 20 | 19 | 1 | 0 | 95.0% |
| nih_news_in_health | 20 | 20 | 0 | 0 | 100.0% |
| openstax | 20 | 15 | 2 | 3 | 75.0% |
| wikinews | 20 | 17 | 2 | 1 | 85.0% |

## 2. 칸별 집계 — 보관된 원천이 채우는 칸

| 연령 | 보관 원천 수 | 보관 중 비율 |
|---|---|---|
| `high2` | 71 | 57.3% |
| `high1` | 66 | 53.2% |
| `high3` | 57 | 46.0% |
| `mid` | 51 | 41.1% |
| `adult` | 39 | 31.5% |
| `elem` | 30 | 24.2% |

| 목적 | 보관 원천 수 | 보관 중 비율 |
|---|---|---|
| `reading` | 117 | 94.4% |
| `mock` | 90 | 72.6% |
| `csat` | 55 | 44.4% |
| `school` | 52 | 41.9% |
| `vocab` | 7 | 5.6% |

| 문항 유형 | 보관 원천 수 | 보관 중 비율 |
|---|---|---|
| `content_match` | 95 | 76.6% |
| `order` | 76 | 61.3% |
| `main_point` | 45 | 36.3% |
| `topic` | 41 | 33.1% |
| `insert` | 36 | 29.0% |
| `blank` | 35 | 28.2% |
| `mood` | 23 | 18.5% |
| `summary` | 18 | 14.5% |
| `long_reference` | 17 | 13.7% |
| `claim` | 14 | 11.3% |
| `title` | 11 | 8.9% |
| `irrelevant` | 9 | 7.3% |
| `purpose` | 2 | 1.6% |
| `vocab_choice` | 1 | 0.8% |
| `grammar_choice` | 0 | 0.0% |
| `grammar_fix` | 0 | 0.0% |

| 난이도 | 보관 원천 수 | 보관 중 비율 |
|---|---|---|
| `V5` | 58 | 46.8% |
| `V6` | 49 | 39.5% |
| `V4` | 41 | 33.1% |
| `V7` | 31 | 25.0% |
| `V2` | 29 | 23.4% |
| `V3` | 29 | 23.4% |
| `V1` | 15 | 12.1% |
| `V8` | 10 | 8.1% |
| `V0` | 5 | 4.0% |

**플랫폼 고유 속성(잠정 [추론]) — 소스별 보유 건수**

| 소스 | audio | data-claim | myth-rebuttal | claim-evidence | then-now |
|---|---|---|---|---|---|
| eia_kids | 0 | 0 | 1 | 2 | 3 |
| gdl | 0 | 0 | 0 | 0 | 0 |
| global_storybooks | 0 | 0 | 0 | 0 | 0 |
| global_voices | 0 | 0 | 1 | 2 | 0 |
| nih_news_in_health | 0 | 1 | 0 | 2 | 3 |
| openstax | 0 | 0 | 1 | 3 | 2 |
| wikinews | 0 | 1 | 1 | 6 | 1 |

## 3. 이중 판정 일치도

| 소스 | 건수 | 일치율 | κ |
|---|---|---|---|
| eia_kids | 20 | 95.0% | 0.730 |
| gdl | 20 | 95.0% | 0.778 |
| global_storybooks | 20 | 80.0% | 0.470 |
| global_voices | 20 | 100.0% | 1.000 |
| nih_news_in_health | 20 | 100.0% | 1.000 |
| openstax | 20 | 100.0% | 1.000 |
| wikinews | 20 | 95.0% | 0.835 |

**κ 0.6 미만인 소스가 있다 — 기준 §9 에 따라 이 회차의 적재를 멈추고 어긋난 편의 why 를 대조한다.**

## 4. 사람 확인 표본 — 보관·보류·폐기 각 10건

| 판정 | 소스 | 원천 | 이유 | 칸(유형 · 목적 · 연령 · 난이도) |
|---|---|---|---|---|
| keep | eia_kids | Curie (1867) `d16d4d2e` | 가난 속 유학부터 라듐 발견·노벨상까지 시간순 전기가 한 편으로 서 있어 내용 일치·순서·서사 칸을 채운다. | content_match,order,insert,title · school,mock,reading · mid,high1 · V2,V3,V4 |
| keep | gdl | Gold Shoes `4d84ba98` | 싫던 황마 신발이 길 잃은 날 발자국으로 집을 찾게 해 준다는 짧은 이야기와 황마 설명 노트로 심경 변화·내용일치 칸을 채운다. | mood,content_match,order · reading,school · elem,mid · V1,V2,V3 |
| keep | global_storybooks | How Tembe spends her day in life `f576c13a` | 기상부터 취침까지 하루 일과가 시각 순으로 이어져 초등 읽기·순서·내용일치 칸을 채운다(일부 문장 비문은 손질 필요). | order,content_match · reading,school · elem,mid · V1,V2 |
| keep | global_voices | Amid political and economic pressure, Brazil sees  `2c5e8d28` | 토지 경계 획정(Marco Temporal) 논쟁과 원주민 살해 증가를 잇는 중반 단락이 인과 논지를 세워 요지·빈칸·내용일치 칸을 채운다(포르투갈어 인용은 걷어 낸다). | main_point,blank,content_match · csat,reading · high3,adult · V7,V8 |
| keep | nih_news_in_health | Sleep On It `983e87d2` | 수면 전·후 학습이 기억을 굳힌다는 논지를 REM·서파수면 단락과 노화 연구로 받쳐 주제·요지·빈칸 칸을 채운다. | topic,main_point,blank,order,insert,content_match · mock,csat,reading · high1,high2,high3 · V5,V6 |
| keep | openstax | Physics: Definitions and Applications `0636f66f` | 물리 갈래의 역사와 고전·현대 물리 구분(상대성·시간 지연 단락)이 한 편으로 서서 주제·요지·순서·내용 일치 칸을 채운다. | topic,main_point,order,insert,content_match,blank · csat,mock,reading · high1,high2,high3 · V5,V6 |
| keep | wikinews | UK bans export of fraudulent bomb detector; arrest `58c428c4` | 폭탄 탐지기 기사가 「원리 주장 → 기판 분해·Sandia 시험 반증 → 사기 결론」으로 흘러 통념 교정·주장-근거 칸과 내용일치·장문을 채운다. | topic,title,content_match,long_reference,order · csat,mock,reading · high2,high3,adult · V6,V7,V8 |
| keep | eia_kids | Electricity `2be53544` | 전기가 2차 에너지원·에너지 운반자라는 정의와 전기 이전 생활 대조 단락이 논지를 세워 주제·빈칸·일치 칸을 채운다. | topic,blank,content_match,irrelevant · school,mock,reading · mid,high1,high2 · V4,V5 |
| keep | gdl | No Ordinary Herbs `4fef8a5d` | Tinuk 이 약초음료를 맛·병·상표·전단으로 고쳐 가며 자전거 값을 모으는 사건 흐름이 뚜렷해 순서·삽입·심경 칸을 채운다. | order,insert,mood,summary,long_reference · reading,school,mock · elem,mid,high1 · V2,V3,V4 |
| keep | global_storybooks | Teeth `3ba03367` | 동물별 이빨 특징을 한 문장씩 나열하고 마지막 두 문장이 화자로 돌아와 초등 어휘·읽기 칸만 채운다. | content_match · reading,vocab · elem · V0,V1 |
| hold(borderline) | eia_kids | Crosthwait (1898) `3f9c71ad` | 냉난방 권위자의 학위·직책·특허 수 나열이 대부분이나 라디오시티 난방 설계와 은퇴 후 강의라는 사건 두 개가 있어 칸 성립이 애매하다. | content_match · school · high1 · V5 |
| hold(borderline) | global_storybooks | Our wonderful world `7b321d29` | 신이 인간을 만드는 창조 설화에서 인종을 피부색으로 나누고 「eyes that slanted」 같은 외모 고정관념을 쓰는 단락이 편견인지 설화 표현인지 갈려 보류한다. | order,main_point · reading · elem,mid · V2,V3 |
| hold(borderline) | global_voices | Russian TikTokers wanted to vote for an anti-war a `a0c1b0de` | 야블로코 지지 릴스를 하나씩 묘사하는 중반부가 실린 영상 없이는 뜻이 약하고 도입의 일방적 조소 어조도 있어 칸 판단이 갈린다. | content_match · reading · adult · V6 |
| hold(incomplete-source) | openstax | The Right to Enforce Patents `a2a34003` | 균등론 단락은 서지만 끝의 「Several options exist」 뒤 선택지 목록이 통째로 빠진 채 끝나 원천이 중간에서 끊겼다. | blank,content_match · csat,reading · high3,adult · V7 |
| hold(incomplete-source) | wikinews | Comedians lampoon Bush at White House Corresponden `cfc56bce` | 콜베어 만찬 풍자 기사가 「Colbert didn't spare the White House correspondents, either:」로 인용을 예고하고 인용 본문이 통째로 빠져 끊겼다. | content_match · reading · high3,adult · V7 |
| hold(borderline) | openstax | The Small Business Administration `3f491d64` | SBA 의 대출 보증·컨설팅 프로그램을 나열한 기관 안내라 내용 일치 칸 하나뿐인데 흐름 있는 설명이 조금 있어 폐기와 보관 사이에 걸린다. | content_match · reading,mock · high1,adult · V5 |
| hold(borderline) | wikinews | Satanism: An interview with Church of Satan High P `39b62303` | 사탄교회 대표 인터뷰는 구어 문답이라 받아쓰기·요지 칸 후보지만 강간·낙태·태아 가치·타인 비방 발언이 교리적 자기주장으로 이어져 학령 칸을 가를 기준이 없다. | main_point · reading · adult · V8 |
| discard | eia_kids | Roberts (1913) `fc197cc9` | 연도별 학위·직함·재직 기간 나열이 전부이고 「1950년부터 현재까지」 같은 낡은 현재형이 섞여 떼어 낼 사건 흐름이나 논지가 없다. | — · — · — · — |
| discard | gdl | Naughty Dog `2b769c1d` | 개의 시점 짧은 문장들이 그림 없이는 이어지지 않고 끝이 action sentences 연습 활동으로 바뀌어 채울 칸이 없다. | — · — · — · — |
| discard | global_storybooks | Come back, cat `855ae038` | 「Come back, cat!」 명령문만 반복되고 고양이가 무엇을 하는지는 그림에만 있어 글만으로 사건이 서지 않는다. | — · — · — · — |
| discard | openstax | 📝 Abigail Adams: "Remember the Ladies" Mini DBQ `fedd8d91` | 교사용 수업 지시문(문서 꾸러미를 나눠 분석시키라)뿐이고 편지 원문은 없어 읽을 글로 채울 칸이 없다. | — · — · — · — |
| discard | wikinews | Australian state of Victoria swears in new cabinet `28190020` | 빅토리아주 내각 기사는 첫 단락 뒤가 장관 이름과 부처 나열뿐이라 떼어 낼 논지·사건 흐름이 없다. | — · — · — · — |
| discard | gdl | A Very Special Plush `301df829` | 인형 축제에 가자는 부름과 노래 가사가 반복될 뿐 그림 없이는 Tuntun 이 무엇인지도 서지 않아 채울 칸이 없다. | — · — · — · — |
| discard | global_storybooks | A cow is my friend `6d066245` | 소에게 하는 말 뒤에 아버지 고기·엄마 가방·신발이 이어지는 네 문장이 서로 무관해 채울 칸이 없다. | — · — · — · — |
| discard | openstax | Getting Started `2971427c` | 특허 소송 절차를 연방민사소송규칙 조문 인용과 함께 단계별로 늘어놓은 법률 절차문이라 읽는 글로 설 문단이 없다. | — · — · — · — |
| discard | openstax | Vector Addition and Subtraction: Analytical Method `20964ed9` | 수식과 그림 기호가 빠져 「Since, by definition, , we can find」처럼 문장이 비어 있어 뜻이 서는 문단이 없다. | — · — · — · — |

## 5. 재판정 — 기준 개정 전후로 바뀐 건수

이번 회차는 비교할 이전 판정이 없다(`--compare` 없음).

## 6. 오판 분석

사람 확인(§4 표본) 결과를 받은 뒤 채운다 — 잘못 보관한 것 · 잘못 폐기한 것 · 기준에 없어서 갈린 것(보류 `criteria-gap`).

## 7. 다음 회차 계획

오판 분석 뒤에 정한다 — 개정한 기준 버전 · 재판정 범위 · 다음 회차 소스별 건수.

## 5. 운영 기록 (손으로 적음 — 재생성 시 다시 붙인다)

**대상**: 소스GET 3·4차로 들어온 새 원천 7곳의 첫 회차. 판정자 14(원천마다 2) · 전량 이중 판정.

### 5-1. 모음 단계 사전검증 검산 — 규칙이 틀렸다

표본 wikinews 20편 중 **7편이 사전검증(제목 부적합)으로 이미 보관(archived)** 돼 있던 글이다.
판정자 둘의 판정은 **보관 13 · 보류 1 / 14** — 막은 글이 거의 전부 쓸 만했다
(가짜 폭탄 탐지기 수출 금지 → 통념 교정 · 호주 의무투표 항소 → 주장-근거 · 발라랏 기후 토론 · 펠로시 탄핵 → 시대 비교).
제목 표본을 눈으로 보고 「정확하다」고 판단했던 것이 오판이었다 — 제목의 사건 신호는 「지문으로 못 쓴다」가 아니다.

조치: `precheck.ts` 판본 2 — wikinews 제목 규칙 **막음 → 표시만**(global_voices 는 앞서 같은 이유로 낮춤).
보관했던 6,434편은 `precheck-backfill.mjs --restore --commit` 으로 되돌려 다시 분석했다. 제목으로 막는 원천은 이제 0이고,
테스트가 그것을 고정한다(새로 막으려면 원문 점검 회차로 먼저 검산).

### 5-2. κ — 원천별 판정

| 원천 | κ | 이번 회차 | 대량 판정 |
|---|---|---|---|
| global_voices · nih_news_in_health · openstax | 1.000 | 통과 | 한 회차 더(연속 두 회차 필요) |
| wikinews | 0.835 | 통과 | 한 회차 더 |
| gdl | 0.778 | 통과 | 한 회차 더 |
| eia_kids | 0.730 | 통과 | 한 회차 더 · **전량 63편이라 회차 대신 전량 이중 판정이 싸다** |
| global_storybooks | **0.470** | **미달** | 멈춤 — 기준 보강 후 재회차 |

nih_news_in_health 는 두 판정자 모두 20/20 보관이라 κ 가 구조적으로 1 로 찍힌다 — 일치율 100% 로 읽는다.

### 5-3. 기준 보강 후보 (criteria.md) — global_storybooks 에서 갈린 셋

| 글 | 판정자 1 | 판정자 2 | 기준에 없는 것 |
|---|---|---|---|
| Teeth · Cooking (문장 몇 개 나열) | 보관(초등 어휘 칸만) | 폐기(reference · fragmentary) | **초등 원천의 최소선** — 짧은 나열형이 초등 읽기·어휘 칸만으로 보관되는가 |
| The girl with one breast (폭력 교훈 설화) | 보관(고등 이상 칸만) | 보류(borderline) | **민감 소재의 연령 칸 제한**으로 보관할 수 있는가 |
| Our wonderful world (인종 외모 묘사 창조 설화) | 보류(borderline) | 폐기(bias) | **전통 설화 속 고정관념 묘사**의 선 |

### 5-4. 가공 때 걸릴 점 (판정자 보고에서 모음)

- nih_news_in_health: 본문 중간 용어 풀이 문장 · 끝의 URL·전화번호 줄 · 시점 묶인 글(COVID·엠폭스·지카) then-now 표시
- eia_kids: 연도별 비율·순위 나열 절은 떼어 낸다 · 과학자 이력서형 글은 폐기 대상
- gdl: 책 끝의 설명 노트(명절·음식·인물)는 떼면 독립 설명문이 된다
- openstax: 수식·그림이 빠진 물리 절은 예시 문단만 · 교사용 지시문은 폐기
- global_voices: 포르투갈어 병기 단락 · 앞부분이 다른 기사 소개인 칼럼
