# 수능 지문 원문 출처 심화 조사 — 2026-10-05

미확인 수능 등록행 268개 모두에 기존과 다른 구절 검색을 실시하고, 기존 서지 후보 12개를 다시 추적했다. 실제 도서·논문·기관 자료에서 지문 전체와 서지를 대조한 **20등록행·21문항을 DB에 추가 확정**했다. 현재 수능 확정은 **77/338등록행(22.8%)·81/382문항**이다. 이번 검색 단계는 완료했으며 전체 원문 출처 확보는 끝나지 않았다.

## 범위와 집계

수치는 `knowledge_csat_origins`와 연결 `csat_items`를 직접 질의한 회차 스냅샷이다. `/admin/knowledge/sources/csat`에서 사용하는 원문 출처 등록부이며 생성 콘텐츠의 `/admin/csat/sources` 판정과 구분한다. 모의평가를 새로 조사하거나 원천 등록행을 새로 만들지 않았다.

| 범위 / 상태 | 전 등록행 | 후 등록행 | 후 연결 문항 |
|---|---:|---:|---:|
| 수능 확정 | 57 | 77 | 81 |
| 수능 서지 후보 | 12 | 10 | 10 |
| 수능 계보만 확인 | 1 | 1 | 1 |
| 수능 미확인 | 268 | 250 | 290 |
| 수능 합계 | 338 | 338 | 382 |
| 모의평가 확정 | 14 | 14 | 15 |
| 모의평가 미확인 | 361 | 361 | 405 |
| 전체 합계 | 713 | 713 | 802 |

전체 확정은 71→91등록행이다. 이번 20개는 후보 2개와 미확인 18개의 승격이며, 검토 대상 280개 중 260개는 기존 판정을 유지했다. Cumming 단서는 268개에 포함되어 중복 합산하지 않는다. 2017#41/#42는 같은 본문이나 과거 canonical 해시 차이로 별도 등록행이며 병합하지 않았다. 따라서 신규 확정 20등록행은 서로 다른 본문·출처 문서로 각각 19개다.

## 추가 확정

각 행의 저자·출판사·열람 판본·근거 URL·편집 차이는 [검수 manifest](./csat-source-origin-deep-review-20261005.json)에 보존했다. 표의 문항 번호는 대표 번호이며 2014B#41은 #42에도 연결된다. 책의 실제 시험 사용 판본이 불명인 경우 열람 서지를 기록하고 불명을 명시했다.

| 대표 문항 | 실제 대조 자료 | 대조 위치 |
|---|---|---|
| 2014B#35 | Harvey C. Mansfield, Science and Non-Science in Liberal Education | The New Atlantis, Summer 2013, 과학과 비과학 절 |
| 2014B#37 | Jane Ebinger·Walter Vergara, Climate Impacts on Energy Systems | World Bank 2011, p.30 / PDF72 |
| 2014B#41 | Sherry Turkle, Alone Together | Basic Books 2011, 결론 pp.284–285, Stanford 스캔 PDF6 |
| 2015#21 | Bruno Bettelheim, The Importance of Play | The Atlantic March 1987, 공식 기사와 대학 리더 p.41 |
| 2015#31 | Gary Keller·Jay Papasan, The ONE Thing | Bard Press 첫 인쇄 2013, Chapter 5 |
| 2015#39 | Susan Cain, Quiet | Crown 2012, Chapter 9, Lippa 실험 |
| 2017#41, #42 | Robert Levine, A Geography of Time | Oneworld 2006, pp.27–28 / PDF49–50 |
| 2018#34 | Kevin Kelly, The Inevitable | Penguin 2017 paperback, TED 허가 발췌, ©2016 |
| 2020#23 | Wendell Wallach·Colin Allen, Moral Machines | Oxford 2009, Chapter 7, p.99 / PDF112 |
| 2020#24 | Nico Eisenhauer 외, Animal Ecosystem Engineers Modulate the Diversity-Invasibility Relationship | PLOS ONE 2008, 서론 첫 문단, DOI 10.1371/journal.pone.0003489 |
| 2020#31 | Mel Thompson, Philosophy of Science: Teach Yourself | 2012, Chapter 1의 공개 본문 미리보기 |
| 2021#23 | Don Norman, The Design of Everyday Things | Basic Books 2013 개정증보판, Chapter 5 |
| 2021#33 | Wendy L. Ostroff, Understanding How Young Children Learn | ASCD 2012, Introduction p.5 / PDF16 |
| 2022#40 | Robert N. Brandon, Adaptation and Environment | ©1990 / 1995 paperback 인쇄, §5.1 pp.159–160 |
| 2023#23 | Loewenstein·Sunstein·Golman, Disclosure: Psychology Changes Everything | Annual Review of Economics 2014, p.392 / PDF2 |
| 2023#34 | Henry Shue, The Pivotal Generation | Princeton 2022, 출판사 발췌 p.3 / PDF5 |
| 2023#39 | Lewicki·Barry·Saunders, Negotiation | McGraw-Hill/Irwin 2010 6판, pp.494–495 / 장 PDF21–22 |
| 2026#24 | Stuart Moss, The Entertainment Industry: An Introduction | 열람 사본 ©2009, Culturtainment p.310 |
| 2026#26 | UC Davis Animal Science, Max Kleiber | 공식 전기 여러 단락, 최초 게시 연도 미표시 |

스캔 PDF는 추출 텍스트가 비어도 실제 페이지를 렌더링하여 확인했다. Turkle는 PDF6 한 면의 두 인쇄 쪽에서 지문 전체를 읽었다. Bettelheim은 대학 리더 스캔 확인 후 공식 기고문 전체도 대조해 원래 기사에 귀속했다. 논문 인용 학자나 도서 편집자를 해당 문단 저자로 잘못 기록하지 않았다. UC Davis 전기는 최초 게시 연도가 없으므로 `source_year=null`로 두고 2018-08-01 마지막 갱신과 구분했다.

## 조사 방법과 확인된 한계

기존 검색 자산을 먼저 확인하고, 시험 표지·요약 꼬리를 제외한 문장 안에서 짧은 8단어 구절을 골랐다. 기존과 동일한 검색을 피하고 각 미확인 등록행에 새 구절 하나를 실제 질의했다. 대학 서버·저자 제공 PDF·출판사 발췌·공식 기관 본문까지 추적한 뒤, 빈칸과 제시문 위치·순서 바꿈을 복원하여 문단 전체를 읽었다. 검색 결과와 짧은 부분 일치는 확정으로 올리지 않았다.

이번 추가 검색에서 기존 미확인 268개 중 18등록행(6.7%)이 확정됐다. 후보 검수에서는 12개 중 2개가 확정됐다. 이 값은 이번 실행 결과이며 검색 방법 변경만의 인과 효과나 남은 지문의 예상 수율은 아니다. 서평·시험 재게시물이 반복해서 검색됐으며, Tadelis의 dominated 전략이나 Congressional Record처럼 단어만 공유하는 오탐도 실제 본문 대조로 탈락시켰다.

미확인이 남는 이유는 책 본문/미리보기 범위 제한과 접근 실패, 시험 편집에 따른 구절 변화, 재인용·다른 판본, 원작 단서 부족이다. 이 사유들이 남은 250개에서 각각 몇 개를 차지하는지 전량 확정한 것은 아니다. 일부 사례를 근거로 대부분이 유료 책이거나 평가원 창작이라고 단정하지 않는다. 268개에 새 구절 검색을 했다는 사실도 각 지문의 모든 변형 구절·판본을 끝까지 조사했다는 뜻은 아니다.

## 남은 후보와 서지 교정 단서

보류 행은 현재 본문 SHA 및 모든 연결 문항을 [280행 판정 기록](./csat-source-origin-deep-decisions-20261005.json)에 묶었다. 아래 대체 서지는 단서이며 DB의 확정 서지로 덮어쓰지 않았다.

| 문항 | 보류 이유 / 다음 확인 위치 |
|---|---|
| 2022#20 | Blanchard의 Social Media ROI는 목차 preview만 확보. 다른 HR 책 PDF를 탈락시켰으며 해당 장 원문 필요 |
| 2022#24 | Strasser의 Waste and Want 수선 문단 전문 필요 |
| 2022#31 | Comic Relief에서 해당 문단을 찾지 못함. Morreall의 Humour and the Conduct of Politics / Beyond a Joke 장 부분 인용·판본 추적 필요 |
| 2022#35 | The Immersive Internet의 Holmström 장 pp.204–213 서지 확인. 편집자와 장 저자를 구분하고 전문 대조 필요 |
| 2026#21 | The Gig Economy의 플랫폼 이동성 문단 전문·판본 필요 |
| 2026#22 | Sport Entrepreneurial Ecosystems의 coopetition 문단 전문 필요 |
| 2026#29 | Boyd의 A Different Kind of Animal 단서가 기존 Henrich 후보와 충돌. 원문 전체 확보 필요 |
| 2026#31 | Jennifer Clapp의 Food 단서가 기존 Sophia Murphy 후보와 충돌. Oxfam 문서는 해당 문단이 없어 탈락 |
| 2026#33 | Interior Design Illustrated 후보의 이해관계자 문단 전문 필요 |
| 2026#38 | Effective Data Storytelling 공개 범위에서 해당 문단 미확보. Stories Beat Statistics 장 추적 필요 |
| 2026#41 | Cumming 서지와 후대 부분 인용만 확보. Understanding Fashion History 원본 문단 필요 |

이 밖에 Iyengar의 IBPA 기고문은 지문 앞부분만 포함해 보류했다. 스캔인 Rutgers 장, 요청에 실패한 Wiley·Interaction Design 도서 등의 단서도 판정 기록에 남겼다. 남은 미확인 전체는 대체 구절 검색이 가능하며, 이미 단서가 있는 대상은 해당 문단 확보와 재인용 관계 확인부터 수행할 수 있다. 새로운 수율 예측은 전량 실행 후에만 기록한다.

## DB 반영과 검증

기존 `source-origin-review.mjs`를 재사용했다. 기존 canonical SHA, 대표/연결 문항 ID, 연결 문항별 현재 raw 본문 SHA, 전후 10개 필드를 대조했다. 확정과 보류 기록 모두 조사 시작·반영 직전의 연결 ID/본문 SHA가 같은지 확인했다. preview 20개 전부 `ready` 후 원천 20개와 기존 공백 1개를 **한 트랜잭션**으로 갱신했고, 현재 본문·서지가 달라지면 전체 중단하는 조건을 유지했다. 재검사 20개 전부 `already_applied`다.

미확인 공백 `affected_count`는 전체 범위 629→611이며 수능 250+모의평가 361과 일치한다. 다음 작업에서도 이미 끝난 268개 검색을 대기 단계로 표시하지 않는다. 마이그레이션·라우트·학습자 지문 변경 없음. 본문·도서 전문·PDF 이미지와 서명된 URL은 저장소 산출물에 포함하지 않았다.

체크포인트 `csat-origin-deep-20261005` 전후에서 표본 bloat의 subject 교체와 경과 시간 지표 변화만 확인됐다. 사라진 지표는 회전 표본 bloat 한 건으로 정상 양성 조건에 해당한다. 검증 결과와 직접 집계는 [DB 검증 JSON](./csat-source-origin-deep-verification-20261005.json)에 보존한다.

검증: 원천 검수 SQL 회귀 5개 통과, 관리자 도움말 타입 검사, 에이전트 설정 검사, DB 통계 생성 및 목적 대조 리뷰. 검색 기록은 [268개 실행 질의](./csat-source-origin-deep-search-20261005.jsonl), [우선 후보 검색 31개](./csat-source-origin-deep-priority-search-20261005.json)에 URL·질의·날짜만 보존하며 전체 책이나 검색 결과 본문을 싣지 않는다. 우선 후보 기록의 31개는 보존한 제목/구절 검색이며 추가 서지 검색·페이지 열람까지 합친 총 도구 호출 수가 아니다.
