# 원문 corpus 확장 — 2026-09-19

## Gate 0 · Gate 1: 외부 탐색 전 확인

기준 브랜치는 `feat/csat-source-policy-v3`의 `98b24044`다. 작업은 별도 `feat/csat-corpus-expansion`에서 진행한다. 이 절은 탐색 전 기준값을 보존한다. 링크된 JSON은 승인 적용 후 재측정한 최신값이며, 마지막 절에서 두 시점을 구분한다. 운영 DB를 직접 질의했고 문서의 과거 통계를 재사용하지 않았다.

- [전수 집계 SQL](../../scripts/audit/csat-corpus-coverage.sql)과 [실측 결과](./csat-corpus-coverage-20260919.json): 109,043편, ready/published 87,716편. 최신 v3 캐시의 usable 9,103편, 조건부 excerpt 4,296편. 조건부를 그대로 쓸 수 있는 원문과 합산하지 않는다.
- 실제 원문 출처 21종, `csat_source_registry` 18종. 재고가 있는 Europe PMC·Frontiers·NIST가 등록부에서 빠졌다. DB source CHECK 28종, TS ArticleSource 29종(OpenStax만 DB 불허), daily collector 14종 등 능력 목록은 서로 다르다. 등록되어 있다는 말이 자동 수집 가능하다는 뜻은 아니다.
- [본문 기반 주제 재측정](./csat-usable-topics-20260919.json): usable 9,103편을 모두 읽어 기존 `lib-topic.mjs` v2를 실행했다. DB 변경은 없다. 저장 주제 누락 9,092편(99.88%)이어서 저장값만으로 주제별 공급 부족을 단정할 수 없다.
- 재측정 결과도 분류불가 6,771편(74.38%)이다. 과학·자연 925, 역사·인류 483, 교육·언어 333, 예술·문화 250, 심리·인지 127, 사회·경제 116, 철학·윤리 66, 기술·매체 32편은 **키워드 추정**이며 검증된 분야 재고가 아니다. 인물 이야기의 `mind`, 철도의 `platform` 등이 개념 설명문으로 오인되는 사례가 표본에서 드러났다.
- usable의 8,516편(93.55%)은 Gutenberg 한 출처다. 초·중 전용 feed에서 usable로 판정된 8,516편도 모두 이 출처다. 따라서 저학령 재고의 제공자 다양성 부족은 주제 추정의 오류와 무관하게 확인된다.
- 저장 register는 설명문 8,627·news 442·narrative 34·argumentative 0 usable이다. 그러나 Gutenberg 서사문도 expository, 자체 제작 논증문도 news로 저장되어 있어 **장르의 실제 분포로 인용하면 안 된다**. 설명문 숫자를 공급 충분의 근거로 삼지 않는다.
- A1 122, A2 2,130, B1 5,200, B2 1,651 usable. C1/C2 usable 0은 현재 수능 파생 정책의 CEFR 상한에 따른 결과이며 일반 성인 독서용 원문의 부족을 뜻하지 않는다.
- 학습자 개별 나이는 저장되어 있지 않다. `vocaflow_levels.age_range`는 권장 연령 대역이며, `kid-excerpt`의 학교급은 목표 독자다. 둘 다 본문 내용의 연령 적합성을 검증한 값이 아니다. `gate.purpose`의 csat/kids/library/raw는 운영 용도, `csat_fit.type`은 문장 형태 측정이므로 문항 유형 적합성으로 바꾸어 표시하지 않는다.
- 자체 제작 1,519편 중 queued 888편은 `compose_batch_id IS NULL` 큐 필터 때문에 제외된다. 제약은 반대로 original의 batch ID를 요구한다. 기존 ready 631편은 기초 분석이 있고 내용 판정만 10편 부족하다. 신규 외부 수집과 별개로 큐 조건을 수정한다.
- `source_fetched_at`은 109,043편 모두 NULL. 마지막 생성 시각을 수집 성공 시각이라고 부르지 않는다. 영구 저장된 수집 시도/파서 실패 모수가 없어 fetch/parser 성공률은 미측정이다.
- 저장 hash의 초과 중복 행 172개. 동일 URL은 같은 책의 다른 발췌일 수 있어 중복 삭제 근거가 아니다. 원천별 ID 유니크만으로 교차 출처의 정규화/근접 중복이 방지되지는 않는다.

### 탐색 우선순위와 보류 기준

1. 현대적인 독립 산문으로 된 사회·경제, 철학·윤리, 예술·문화, 역사·인류 설명·논증 자료를 우선 탐색한다. 이는 검증되지 않은 주제 숫자에 대한 절대 부족 판정이 아니라, 보유 원문 및 제공자 편중과 읽은 표본을 함께 고려한 pilot 가설이다.
2. A2~B2의 초·중·고 대상 글을 기존 Gutenberg 이외의 제공자로 확보할 수 있는지 검증한다. 연령 적합성은 표본을 직접 읽어 별도 기록한다.
3. 기존 과학 논문 전문을 더 모으는 작업은 낮은 우선순위다. PLOS는 이미 47,939편이며 usable 0, 조건부 1,954편이므로 대규모 추가가 바로 학습 가능한 공급을 늘린다는 근거가 없다.
4. OpenStax·Pressbooks 등 도서 파이프라인에 존재하는 제공자는 새 발견으로 세지 않고 기존 통합 개선으로 분류한다. 사실 재저작용 FactSource 23종의 비보관 계약과 원문 재배포 계약을 혼동하지 않는다.
5. 개별 원문 권리·자동 접근·재배포·상업 이용이 불분명하면 REVIEW REQUIRED로 두고 자동 수집하지 않는다. pilot 결과가 기존 정책에서 부적합하면 등록하지 않는다.

### 구조적 결함

읽기 전용 코드 감사에서 daily cursor의 조기 저장, 원문 재발견 시 본문과 분석/해시 불일치, Europe PMC의 목록/전문 라이선스 충돌, restricted 출처의 파생 정책 표시 오류를 확인했다. 확대 전에 재현 테스트와 가드를 추가한다. 원문/문항을 일괄 덮어쓰지 않는다.

재현 자료: `csat-usable-topics.mjs`는 현재 캐시와 원문 revision을 비교하고 본문을 로컬 비공개 산출물에 보관한다. 공개 리포트에는 본문을 넣지 않는다. 페이지별 읽기는 단일 트랜잭션이 아니며 스캔 중 stale 0편이었다.

## 공식 자료 탐색 결과

Gate 0/1 뒤 기존 21개 출처와 기존 도서 통합을 대조하고 18건을 조사했다. [동일 15항목 scorecard와 SourceProfile](../../apps/web/src/lib/textbook/source-discovery-profiles.json)에 근거·미측정·역할 추천을 함께 보관한다. 임의 점수 합산으로 순위를 만들지 않았다. OpenStax/Pressbooks는 기존 통합 개선이며 ASP/Storybooks Canada도 같은 원천 계열로 중복 계산하지 않는다.

| 후보 | 결정 | 확인한 공식 근거와 한계 |
|---|---|---|
| African Storybook | B · 한정 실험 | [기계 판독 corpus](https://github.com/global-asp/asp-source)의 개별 CC BY 3.0/4.0만 선별. [Canada 다운로드](https://www.storybookscanada.ca/downloads/)는 NC 작품도 섞임. 허가 충돌은 제외한다. |
| NARA Prologue | B · 권리 검토 | [기관 작성물 CC0 정책](https://www.archives.gov/global-pages/privacy.html). 소장 자료·외부 작성·인턴·인용까지 포괄하지 않는다. REST 50편 확보, blog robots 확인. |
| Public Domain Review | HOLD | [재사용 안내](https://publicdomainreview.org/reusing-material)의 작품별 예외·SA·paywall 조건 확인 필요. |
| Wellcome | HOLD | [API](https://developers.wellcomecollection.org/api/content)는 본문 없는 metadata. [robots](https://wellcomecollection.org/robots.txt)에 AI crawler 금지. 본문 접근 우회 안 함. |
| Saylor | B | [권리](https://www.saylor.org/LicensingInformation)는 자체 교과 구조와 제3자 자료·시험을 구분한다. 전체 course를 CC BY로 간주하지 않는다. |
| OpenLearn | REJECT | [공식 copyright](https://about.open.ac.uk/strategy-and-policies/policies-and-statements/copyright-openlearn)의 NC 조건이 현재 상업 재배포 용도와 맞지 않는다. |
| Aeon | REJECT | [약관](https://aeon.co/terms-of-use)의 개인 사용 허가가 corpus 복제·개작·배포 허가가 아니다. |
| OpenStax · 기존 | HOLD | [현재 라이선스](https://help.openstax.org/s/article/Licensing-information-of-OpenStax-textbooks)는 NC-SA. 과거 CC BY 판본의 권리를 소급해서 부정하지 않는다. |
| BCcampus · 기존 | B | [Sociology 3rd edition](https://opentextbc.ca/introductiontosociology3rdedition/front-matter/about-bccampus/)은 CC BY 4.0 except noted. 보유 2nd edition과 장별 차이를 확인해야 한다. |
| DPLA | HOLD | [약관](https://dp.la/about/terms-conditions)의 자체 해설 CC BY와 원본 사료 권리는 별개. [API](https://pro.dp.la/developers)는 metadata, robots의 crawler 제한 확인. |
| LOC | HOLD | [정부 작성물과 holdings 권리](https://www.loc.gov/legal/security-copyright-and-privacy/understanding-copyright/), [API 제한](https://www.loc.gov/apis/json-and-yaml/working-within-limits/) 확인. robots 요청 403, 우회 안 함. |
| NPS | HOLD | [disclaimer](https://www.nps.gov/aboutus/disclaimer.htm), [API](https://home.nps.gov/subjects/developer/api-documentation.htm). 국제 권리·개별 제3자 자료·자동 접근 미확정. |
| Smithsonian | HOLD | [약관](https://www.si.edu/termsofuse), [Open Access FAQ](https://www.si.edu/openaccess/faq)의 CC0는 지정 자산·데이터에 한정. |
| World History Encyclopedia | REJECT | [약관](https://www.worldhistory.org/static/terms-of-use/)의 NC·대량 재배포 제한. |
| Smarthistory | REJECT | [FAQ](https://smarthistory.org/faq/)의 CC BY-NC-SA. |
| USHMM | HOLD | [약관](https://www.ushmm.org/copyright-and-legal-information/terms-of-use)의 개별 권리·상업 사용·AI/ML 개발 조항 확인 필요. 역사적 민감 맥락도 검토한다. |
| Federal Reserve Board | HOLD | [disclaimer](https://www.federalreserve.gov/disclaimer.htm). Board와 지역은행은 다른 권리 주체이며 자동 접근·국제 범위 미검증. |
| NEH EDSITEment | HOLD | [현재 project](https://www.neh.gov/project/edsitement)로 이동. 옛 교육 소개를 현재 확보 가능한 원문 corpus로 세지 않는다. |

## 파일럿: 기대와 실제 결과

[편별 판독·난이도·판정·provenance](./csat-corpus-pilot-20260919.json). 공개 보고서에는 본문을 넣지 않는다. 아래 표는 적재 전 99편 분석이며, 이후 승인받은 ASP 4편만 DB 적재·분석·캐시 검증을 완료했다. 발행은 0편이다.

| 측정 | African Storybook | NARA Prologue |
|---|---:|---:|
| 시도 / 본문 확보 | 50 / 49 | 50 / 50 |
| 실제 본문 판독 | 49 | 12 (38 미판정) |
| clean / 판독 모수 | 26 / 49 | 0 / 12 |
| 가상 ready에서 규격 통과 | 4 / 50 (8%) | 0 / 50 (권리 미확정) |
| 규격 제외 / 검토 대기 | 29 / 16 | 50 / 0 (학습 품질 반려율 아님) |
| CEFR 추정 | A1 4 · A2 24 · B1 16 · B2 4 · C1 1 | B2 29 · C1 21 |
| 평균 확보 어수 | 289 | 764.3 |
| 규격 통과 후보 평균 어수 | 149.5 | 해당 없음 |
| 저자 누락 / 발행일 누락 | 0 / 49 | 50 / 0 |

ASP는 CC BY 후보 목록 전체에서 등간격 50편을 골랐다. 전체 ASP의 대표 표본이 아니며, 파일 0044는 목록과 개별 라이선스가 달라 제외했다. 파일 HTTP 확보는 50/50, 허가 확인 후 parsing은 49/49다. 49/50은 권리 gate를 포함한 확보 수율이며 네트워크·파서 실패율이 아니다. NARA 50편은 API 요청 한 번으로 받았다. 내용 판독은 use 1/narrative 25/review 18/reject 5, 구조 품질은 clean 26/needs_context 14/fragmentary 3/malformed 6이었다. 짧은 글도 독립적인 사건·감정 근거가 있으면 내용상 수용했지만 정책의 100어 하한을 낮추지는 않았다.

규격 통과 4편은 `0136 Hamisi's lucky day`(111어/A2), `0216 The day the sun went away`(190어/B1), `0335 The friend I miss`(166어/A2), `0342 Punishment`(131어/B1)이다. 부모 에이전트도 네 본문을 다시 읽었다. 0136의 마지막 셔츠 선택은 본문에 답이 없어 문항화하지 않는다. 0216은 의인화 서사이며 과학적 인과 설명으로 쓰지 않는다. 0335의 친구가 사라진 원인은 추측하지 않는다. 제목·감정·내용 근거·서사 순서 후보이지 완성 문항 적격을 보장하지 않는다.

NARA는 최근 글 50편의 편의 표본이다. 12편에서 이미지 참조 잔재, 전시/기념품 홍보, 역사 인용, 원문 문법 오류와 저자 구분 문제가 드러났다. uploader ID를 정부 직원 저자라고 확정하지 않았다. 기관 작성 해설만 따로 완결 발췌하고 권리를 확인하기 전에는 자동 적재하지 않는다. 장기 fetch/parser 안정성·boilerplate 비율은 측정 모수가 없어 미측정이다.

기존 WLP→사전 exact lookup(합집합 5,313 lemma)→LV→CEFR 어휘/Flesch 합의→내용 gate→정본 eligibility를 실행했다. CEFR confidence는 두 신호의 합의이며 외부 검증 정확도가 아니다. 단어 exact miss도 학습자 headword resolution을 통과하지 못한다는 뜻이 아니다. VLevel은 실제 SQL의 distinct type/p75/V11 제외 방식을 읽기 전용으로 동일 계산했다. 구문은 운영 IMMUTABLE RPC의 실제 출력을 사용했다.

이 결과는 **저학령 서사의 제공자 다양성에 작은 보완**을 제안한다. 현대 사회·인문 논증 공급의 가설은 이번 파일럿으로 충족하지 못했다. 대량 수집이나 모든 후보 등록을 진행하지 않는다.

## 중복과 구문 공식 불일치

- 전수 109,043편의 metadata 중 저장 hash는 91,460편. 파일럿 99편과 stored exact hash·정규화 제목·canonical URL 일치 0이었다. 본문은 usable 9,103과 StoryWeaver 136의 합집합 9,205편에 한정해 정규화 hash 및 5어 shingle(Jaccard ≥0.8 또는 containment ≥0.9, 공유 shingle ≥20)를 비교했고 일치 0이었다. 전체 본문의 근접 중복률 0이라는 뜻이 아니다.
- 직접 판독은 ASP `0037`과 `0074`의 같은 민담 변형을 발견했다. 어휘 중복만으로 의미 중복을 막을 수 없다는 실제 반례이며 두 편은 선별 4편에 포함되지 않는다. URL은 같은 책의 다른 발췌일 수 있어 삭제 기준으로 쓰지 않는다.
- 적용 전 운영 `compute_syntax_score`가 저장소 보정 공식과 달랐다. 짧은 문장/긴 문장/복문의 실제 score는 12/88/100, 저장소 공식은 0/34/59였다. sent_p90·clause_depth는 같아 점수 공식 차이로 확인했다. 승인 후 복구했으며 실제 RPC 재검증은 0/34/59로 일치했다.
- 전수 109,043편의 저장 요약 점검: syntax 없음 17,611, 비교 가능 91,432. 구식만 일치 75,693, 새식만 0, 둘 다 181, 둘 다 불일치 15,558, 100점 포화 44,407. 불일치에는 반올림 손실이 있어 제3의 공식이라고 단정하지 않는다. 저장 요약으로 새식을 계산하면 91,251편 값이 달라지지만 **원문 재계산 실측치가 아니다**. 기존 행을 백필하지 않았다.
- 선별 4편은 구문 score 0/100 경계에서도 현재 canonical 상태가 바뀌지 않았다. 신규 분석은 복구된 함수를 적용한 후 실행했다. 기존 점수·cache 전수 보정은 별도 원문 재계산·영향 검증이 필요하다.

## 구현과 검증·적용 경계

수집 cursor/수집시각, seed 재발견 덮어쓰기, Europe PMC BY/SA 충돌, restricted 표시 가드를 고쳤다. original 큐는 정확한 CSAT compose 소유권을 허용한다. 추가 검토에서 발견한 분석 중 본문 변경/보관 경쟁은 preview→원자 RPC로, publisher의 중복 점유는 queued 연결만 수행하도록 해결했다. 다른 legacy 분석 호출자 전체가 원자화됐다는 뜻은 아니다.

코퍼스 분포와 파일럿 적재 후 22개 기존 원천/18개 후보 프로필을 추가했다. null·미검증·저장 기본값을 명시하고, 역할 추천과 자동 수집 active를 분리했다. 상단 “사용 가능”과 조건부 발췌의 잘못된 합산도 수정했다. 브라우저 1280 light/390 dark, 키보드/초점/히스토리/새로고침 E2E 3개 통과, 가로 넘침·Axe 위반 0. 오래된 API 오류는 재현을 확인했으며 마지막 DB REST 및 브라우저 요약은 200이었다.

SQL 3개는 사용자 승인 후 **적용 완료**했다: `20260919023610` 원자 분석 커밋, `20260919023620` 구문 공식 복구, `20260919023622` SourceProfile/ASP 허용·누락 registry 보완. 선별 4편을 queued로 적재하고 1편 검증 후 나머지 3편을 분석·캐시 적재했다. 원문 전체를 자동 발행하거나 기존 원문·정답을 덮어쓰지 않는다. 로컬 PostgreSQL 원자성 15개는 실패·본문 변경·보관·1µs revision 변경 시 롤백을 검증했으며 운영 DB 테스트와 구분한다.

최종 코드 검증: 단위·회귀 272개, 로컬 PostgreSQL 15개, 브라우저 E2E 3개 통과. web와 library-pipeline 타입 검사, web lint, 프로덕션 build 통과. 첫 빌드는 공유 PC 메모리 압박으로 중단하고 Node heap 4 GiB 제한 후 성공했다. 기존 lint 경고 및 일부 공개 페이지의 build-time trust-signals 집계 경고는 남아 있으며 이를 원문 API 검증 성공과 혼동하지 않는다. 변경된 `/admin/csat/sources`는 dynamic route, 빌드 산출물 23.7 kB / First Load JS 298 kB였다. 실제 배포는 하지 않았다.

승인 범위: SQL 3개, ASP 4편 한정 적재·분석·파생 캐시 검증과 프로필/측정 스냅샷 갱신, 준비된 45개 변경 파일 및 재생성 스냅샷의 커밋·브랜치 push. 사용자 승인 후 해당 범위를 실행했다. 대상 브랜치는 `feat/csat-corpus-expansion`, 이전 작업 브랜치 위에 쌓은 별도 worktree다. main merge와 운영 배포는 포함하지 않는다.

## 승인 적용 후 확인

2026-09-19 02:38 UTC 검증: ASP 4편 모두 ready·usable, A2 2편/B1 2편, 어휘 166행, 품질 flag 0건. 원문 SHA256은 적재 전 자료와 일치했다. 최신 revision 캐시 4편을 재적재한 결과 변경 0·검증 4였고, 원문 importer 재실행은 추가 적재 0편이었다. source registry는 자동 수집 inactive를 유지한다.

전체 재측정은 109,047편·실제 원천 22종·registry 22종, usable 9,107편·조건부 4,306편이다. 이 작업의 증가분은 원문·usable 각 4편이다. 탐색 기준값과의 조건부 +10 차이는 적용 전 다른 세션의 판정 갱신에서 이미 발생했으며 이번 성과에 포함하지 않는다. 최신 usable 본문 9,107편 재측정에서 저장 주제 누락 9,096편, 키워드 분류불가 6,773편이며 의미 판독 결과로 해석하지 않는다.

체크포인트 `csat-corpus-expansion-20260919`는 before 02:32:31 UTC / after 02:38:56 UTC다. 수집 축 누락은 회전 표본인 bloat 두 대상의 교체뿐이며 연결 사용률 55.0→53.3%, DB 크기 +0.1 MiB, 시간 경과 지표 외 이상 변화는 없었다. 기존 구문 점수의 일괄 재계산, 원문 발행, main merge와 운영 배포는 수행하지 않았다.

02:49:39 UTC 적용 후 전체 감사 `--check`가 통과했다. 109,047편 metadata, 87,720편 ready/published 판정, 문항 참조 원문 38,605편을 검사했고 findings 0건·orphan 참조 0건·집계 차이 0건이다. usable 9,107·conditional 4,306·발췌 준비 필요 10,861·내용 미판정 48,797·blocked 14,649로, 무결성 검사 통과를 전체 내용 검수 완료라고 해석하지 않는다. 갱신된 자료로 화면 회귀 10개·importer 31개·로컬 PostgreSQL 15개와 web 타입/린트를 다시 통과했다. 허가 미확정 registry의 null과 실제 수집 시각을 보존하도록 타입·회귀를 보완했다.
