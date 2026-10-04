# Academic Reading Engine — 교재 타기팅·처리 설계

2026-10-04 사용자 첨부안 반영. 공통 정본은 `packages/library-pipeline/src/textbook/academic-reading.ts`와 `academic-reading-contract.ts`다. 생성 처리에는 기존 각색·문항 드레인을 사용한다.

원문 → 문서별 권리 → 언어·담화·독해 능력 분석 → 독자 연령과 언어·사고 목표 → 자식 각색 → 근거가 있는 질문/활동 설계 → 기존 문항 생성·검수 → 권/과정/과제 구성 순서다. 원문은 각색으로 덮지 않는다. 하나의 corpus에서 여러 목적을 파생한다.

| 결정 | 구현·처리 계약 |
|---|---|
| 독자 | 초등 고학년 / 중1 / 중2 / 중3 / 고1 / 고2 / 고3의 age_band |
| 언어 | 기존 어휘 스파인의 language_band와 요청 passage_v_level; 실제 VRL은 분석 공정이 계산 |
| 사고 | reasoning_band와 R0~R13 skills; 언어·독자 연령과 독립 |
| 제품 | P01~P20 family; 각각 목적·주요 능력·집필 지시를 공통 정본에서 읽음 |
| 시험 | none / PSAT 8/9 / SAT / ACT / TOEFL / CSAT / LSAT; 실제 문항·원문 복제가 아니라 능력 구조 참고 |
| 분량 | target.words; 지문 분량과 기존 조판 문항의 유형별 창은 별도로 검증 |
| 원문 평가 | 원문과 각색문의 lexical/syntax/abstraction/information_density/discourse/inference/background_knowledge/age_appropriateness/exam/overall을 각각 분석 |
| 문항 평가 | passage_level / item_reasoning_level / item_difficulty / difficulty_evidence / 본문 근거를 별도 저장 |

원문·각색문의 일곱 요소 및 overall은 요소별 0~11 서열척도와 근거를 가진다. age는 boolean과 발달 적합성 근거, exam은 닫힌 시험 enum과 근거다. 이 값은 에이전트 분석이며 V-Level·학년 calibration·정답률 실측을 대신하지 않는다. KICE benchmark calibration과 학습자 수행 기반 난이도 조정은 추후 실측 단계다.

| 학년 | Core Progression | Vertical Series |
|---|---|---|
| 초등 고학년 | R0~R4 정보 처리·문장 의미 | Foundation Reading |
| 중1 | R1~R4, 관계 중심 | Bridge Reading |
| 중2 | R2~R5, 문단·기능 | Bridge Reading |
| 중3 | R3~R7, paraphrase 입문 | Academic Reading Starter |
| 고1 | R3~R8, 학술 문장·담화 | Academic Reading I |
| 고2 | R5~R10, 추론·근거·논증 | Academic Reading II |
| 고3 | R5~R13 중 목표 능력 선택 | CSAT Academic Reading |
| 심화 선택 | 논증·비교·고밀도 추론 | Advanced Reading |

고3 progression은 선택 범위다. R11/R12를 실제 target으로 선택하려면 자료를 제공한다. P13은 두 번째 텍스트, P14는 실제 수치 자료가 필수이며 자료별 권리·출처·확인일·귀속을 target에 포함한다.

| P | 제품군 | P | 제품군 |
|---|---|---|---|
| P01 | AI Multi-Level Reader | P11 | Evidence Reading |
| P02 | Narrative Reading | P12 | Argument & Critical Reading |
| P03 | Knowledge Reader | P13 | Comparative Reading |
| P04 | Science/Social/History Reader | P14 | Text + Data Reading |
| P05 | Vocabulary-in-Context | P15 | Current Issues Reader |
| P06 | Academic Sentence Reading | P16 | Knowledge Builder |
| P07 | Main Idea Reading | P17 | Exam Bridge |
| P08 | Structure Reading | P18 | KICE Academic Reading |
| P09 | Relation Reading | P19 | Reading Intervention |
| P10 | Inference Reading | P20 | Advanced Academic/LSAT Bridge |

가족 등록은 20개 완성 교재의 발행을 뜻하지 않는다. 현재 기존 조판이 지원하는 유형은 그 계약을 계속 쓰고, R0/R11/R12/R13의 신규 활동/다지문/자료/시간 측정은 구조화된 item_plan으로 보존한다. 이들을 기존 수능 유형 코드에 억지로 넣지 않는다. 독해 가족은 기존 읽기 시리즈로 조판할 수 있는 부분만 넘기며, 7개 vertical series의 별도 판매·과정 라우트는 이번 변경에서 추가하지 않는다.

원천 역할은 generation / age_anchor / benchmark / discovery / restricted로 구분한다. age_anchor는 연령 기준인 동시에 문서별 권리 확인 후 생성 재료가 될 수 있다. bridge/academic master는 generation 안의 원천 우선순위로 표현한다. `SOURCE_PRIORITIES`는 학년별 순서를 제공하며 규칙이 개별 글의 소재 적합성을 확정하지 않는다.

OpenAlex/Europe PMC/DOAJ/EconStor는 discovery이며 직접 각색에서 제외한다. 발견한 글은 발행처 원문 레코드·문서별 권리를 확보해 generation 입력으로 등록한다. OpenStax/The Conversation/상용 읽기 서비스와 KICE/해외 시험은 사용자 설계에 따라 benchmark로 분류한다. 이 역할 변경은 기존 원문을 삭제하거나 기존 공개 읽기 서비스의 권리를 변경하지 않는다.

문서별 권리 계약은 canonical_source/url, original_author, published_at, license/url, commercial_use, derivative_use, ai_processing, third_party_text/image, attribution_required, share_alike, original_work_id, discovered_via, checked_at, evidence다. 미확인 AI 처리·제3자 본문·비상업/변형 불가·ShareAlike 이행 누락은 생성 보류다. 기관별 일반 안내만으로 이번 원문 허가를 채우지 않는다. 이 경로는 이미지를 복제하지 않는다.

공식 자료 확인: [NASA Space Place](https://science.nasa.gov/sciact-team/spaceplace/)는 초등 고학년 대상임을 명시한다. [FYM 저자 지침](https://kids.frontiersin.org/participate/authors)은 8–11/12–15 독자 범위와 원 연구의 adaptation을 설명한다. [BLS 권리 안내](https://www.bls.gov/opub/copyright-information.htm)는 기존 저작권 사진·삽화 예외를 두며, [NPS 투고 지침](https://www.nps.gov/subjects/parkscience/submit.htm)도 그림 권리 확보를 별도로 요구한다. 기관별 안내는 본문별 권리 검증의 참고이며 자동 허가값이 아니다.

11개 분야 배합(18/10/12/10/10/8/8/8/6/6/4%)과 100점 원문 평가축은 사용자 설계 목표다. 현재 corpus 또는 KICE의 측정 분포라고 표시하지 않는다. source_score는 권리 검증을 통과시켜 주지 않으며 자동 선별 문턱도 아니다. BLS/NPS는 경제·역사·인문 보완의 등록된 우선 원천이고, 이번 변경은 수집기·DB source CHECK를 추가하지 않는다.

운영 명령(저장소 루트):

```powershell
pnpm exec tsx --tsconfig apps/web/tsconfig.json scripts/textbook/adapt-drain-export.mjs --target scripts/textbook/targets/knowledge-middle1.json --source noaa --limit 2 --size 2
pnpm exec tsx --tsconfig apps/web/tsconfig.json scripts/textbook/adapt-drain-export.mjs --target scripts/textbook/targets/knowledge-high1-simple.json --source noaa --limit 2 --size 2
```

이 두 target은 같은 V3·같은 원문에서 중1과 고1 독자·사고 목표를 따로 처리한다. 폴더는 `scripts/textbook/adapt-drain/reading-<교육 설정·자료 식별자/본문 hash·버전 hash>`다. 명세 키 순서만 달라지면 같은 hash다. 자료의 권리 확인일·근거 설명은 입력/계보에 보존하지만 식별키에는 넣지 않으므로 권리 재확인이 같은 목적의 새 판을 만들지 않는다. source_id는 `reading:<원문 UUID>:<target hash>`이며 같은 학령·V-Level이어도 다른 목적은 별도 자식이다. 서로 다른 target의 정당한 본문 공유는 허용한다. 같은 target의 DB 및 청크 중복은 건너뛴다. `.json/.out.json` 둘 다 예약으로 보고 기존 번호를 덮지 않는다.

에이전트가 [집필 계약](../scripts/textbook/academic-reading-brief.md)을 읽고 `.out.json`을 채운 뒤 같은 `--target`으로 `adapt-drain-import.mjs` 예행을 실행한다. 해시·revision·원문 출처·권리·열 분석축·명제 대응·문항 근거가 빠지거나 변경되면 이유와 건너뛴 수를 출력한다. import는 DB 쓰기 직전 최신 원문을 다시 확인한다. 통과 후 DB checkpoint와 `--commit`은 queued 자식만 삽입하며 원문·기존 JSONB를 수정하지 않는다. 같은 실행의 중복도 막는다. insert의 유일키 충돌은 덮어쓰지 않고 실패한다.

그 다음 기존 `process-queue.mjs` 분석·내용 판정·원문 적격 검증을 수행한다. 요청 V-Level과 실제 측정값이 다르면 target을 재검토하고 새 명세로 재생성한다. 기존 `item-drain-export.mjs --type ... --band ...`는 실제 밴드와 요청 밴드가 일치하고 해당 유형이 목표 skill을 지원하는 각색만 뽑는다. 청크의 reading 메타데이터를 채워 `item-selfcheck.mjs` → import 예행 → checkpoint → `item-drain-import.mjs --commit` 순서로 처리한다. payload.academic_reading에 타깃·난이도·근거·각색문의 hash/revision을 보존한다. 실제 제시문을 원본과 대조하고 빈칸·어휘 치환 전 본문은 evidence_passage에 보존한다. 단일 각색에 같은 유형은 기존 DB 유일키대로 한 문항이다. 같은 유형의 다른 사고 버전은 다른 target의 자식으로 관리한다.

재실행·복구: export는 읽기만 하며 이미 예약/적재한 target을 건너뛴다. out 파일의 미완성 행은 DB에 쓰지 않는다. 임의로 청크를 지우고 다시 뽑으면 중복 예약 근거가 사라지므로 오류·보류 이유를 먼저 고친다. 원문이 바뀌면 새 입력을 별도 디렉터리로 뽑는다. import는 원문을 덮거나 기존 각색을 upsert하지 않는다. 부분 배치 삽입 실패 후 같은 청크를 재실행하면 이미 있는 판을 건너뛴다. DB 유일키가 중복 INSERT를 막는다. 원문 revision의 마지막 확인과 insert 사이를 DB 트랜잭션으로 묶는 RPC는 아직 없다. 실제 import 작업 구간에는 관련 원문 수정·수집·분석·권리/내용 판정·다른 각색/문항 import까지 모두 멈추고 한 작업으로 직렬 실행한다. 이 전제를 확보할 수 없으면 예행까지만 하고 --commit을 실행하지 않는다. 최종 재조회는 이 운영 전제를 대체하지 않는다. 대량 처리 전후 DB checkpoint와 `pnpm docs:db-stats`를 실행한다.

FYM 연구–학생용 연결(후속 구현, 2026-10-04): 수집기는 본문 정리 전에 **Original Source Article(s)** 구간을 읽어 `csat_fit.research_origin`에 보존한다. 학생용 DOI/URL·페이지/본문 SHA256·확인 시각·원 연구 DOI/doi.org URL·명시적 구간의 인용을 저장한다. 일반 References는 연결 근거로 쓰지 않는다. 여러 원 연구를 지원하며 명시적 구간 없음(`no_explicit_original_source`)과 DOI 없음(`original_source_without_doi`)을 구분한다. 기존 학습 본문과 기사별 권리 정보는 그대로 유지한다. 새 수집 INSERT만 메타데이터를 보존하며 기존 원천을 자동 갱신하지 않는다.

기존 재고는 아래 읽기 전용 명령으로 점검한다. 페이지 `og:url`이 요청 DOI와 일치하고 추출한 본문이 현재 DB 원문과 같은 경우만 계보를 내보낸다. 네트워크 조회 뒤 DB revision/hash를 다시 확인한다. 페이지·DB 본문이 다르면 보류 이유를 남기며 본문을 덮지 않는다. `--limit`은 1~100, `--ids-file`은 선택한 UUID를 한 줄에 하나씩 담는다. 출력 파일이 있으면 실패하므로 재실행에는 새 경로를 쓴다. DB와 수집 커서는 변하지 않는다.

```powershell
pnpm exec tsx --tsconfig apps/web/tsconfig.json scripts/textbook/frym-pairs-export.mjs --ids-file <UUID파일> --limit 3 --output <새계보.json>
pnpm exec tsx --tsconfig apps/web/tsconfig.json scripts/textbook/adapt-drain-export.mjs --target scripts/textbook/targets/knowledge-middle1.json --source frym --research-origins <새계보.json> --limit 3 --dir <새청크폴더>
```

`--research-origins`는 해당 파일의 원천 UUID 범위에서만 뽑으며 source_id/URL/revision/hash를 현재 DB와 대조한다. DB에 메타데이터가 없어도 계보를 각색 청크에 넘길 수 있다. 입력 `research_origin` 및 `database_research_origin`을 그대로 유지하며 importer는 현재 원문과 DB 메타데이터를 대조한다. `analysis.parallel_pair`는 보존된 relations 중 DOI·URL·전체 인용이 일치하는 연결만 허용하고 자식 provenance에 스냅샷을 보존한다. 연결 자체가 원 연구 본문의 이용권리나 calibration 승인을 뜻하지 않는다.

정밀 검증(2026-10-04): DB에서 직접 확인한 FYM 전문 원천 152편을 50/100/2 UUID 배치로 읽었다. 명시적 연결 37편·구간 없음 115편 중 source_id 순 연결 첫 20편을 고정했다. 20편 모두 DOI·제목·주요 저자 연결을 확인했지만 원 연구 전문은 8편, 초록만 9편, 미확보 3편이다. 전문 8편의 선택 정렬 10개는 aligned 5·partial 2·contradicted 3, 전문 미확보 12편은 held다. **링크 정확도 20/20과 정렬 정확도 5/10을 분리**하며 보류·대표성·기사 전체 정확성은 성공률에 포함하지 않는다. 모든 기록 정렬이 일치하는 후속 gold 검토 후보는 4쌍이며 전문가 인증이나 학생 calibration은 아니다. [주석 데이터](../scripts/textbook/frym-precision/round-1.json) · [검토 보고서](./reports/frym-precision-20261004.md).

`parallel-precision.ts`에 original_claim/original_evidence/fym_claim/fym_explanation/omitted_detail/simplification_type/lexical_shift/syntactic_shift/conceptual_shift/age_band/confidence를 저장하는 계약을 추가했다. FYM 인용·양쪽 읽은 범위·선정 이유도 보존한다. confidence는 관찰자의 근거 있는 판단이고 age_band는 목표 제안이며 실제 FYM 연령을 추정하지 않는다. 명시적 연결·전문 확보·구절 의미 대응은 각각 다른 상태다. 부정·부분 정렬은 모범 각색에서 제외하고 실패 검증 사례로 남긴다.

로컬 검토 절차는 `frym-precision-select.mjs` → `frym-precision-prepare.mjs` → 직접 검토 → `frym-precision-verify.mjs`다. [회차 절차](../scripts/textbook/frym-precision/README.md)에 명령·재실행·복구를 적었다. 전문/HTML/XML/원본 메타데이터는 ignored 로컬 증거 폴더에, 짧은 인용·offset·해시·판정은 결과 JSON에 보존한다. 검증기는 원본에서 추출을 재현하고 source/revision/DOI/인용/읽은 범위/분모 변조를 거부한다. 정렬 결과를 전체 기사 승인으로 자동 승격하지 않는다. 별도 `parallel_adaptation_pairs` 테이블은 향후 SQL 검토·승인 후 만든다. 학령별 규칙의 학생 calibration·NIH 우선 처리·BLS/NPS 수집·비STEM 배합 보완·KICE calibration은 후속 작업이다.

후속 보존 규칙(2026-10-04): 후보 F02/F06/F14/F18의 정렬 ID와 양쪽 짧은 증거에 [규칙 4개](../scripts/textbook/frym-precision/preservation-rules-1.json)를 묶었다. 기능 차이를 절대적 감각 순위로 바꾸지 않고, 서식처의 가능한 기능을 세계 모든 정원의 보장 효과로 확대하지 않으며, 증상 집단 비교를 개인의 시간 변화·임상 진단·확정 인과로 바꾸지 않고, 종 간 양의 상관을 개체 예측·인과로 강화하지 않는다. 문장 분해·용어 설명·수치 압축은 이 관계와 한정을 보존하는 범위에서 제안한다. FYM에서 생략된 연구 범위/한계를 다시 명시한 부분도 있어 FYM 표현을 그대로 모범으로 복제한 것은 아니다.

`adapt-drain-export/import.mjs`는 `--preservation-rules <규칙.json> --precision-review <회차.json>`을 함께 받는다. UUID 범위를 좁히고 source key/URL/hash/revision·연구 DOI/hash·정렬 anchor·회차 SHA를 대조한다. 검토 목록에서 VRL 미측정은 null로 유지하며 내보낼 수 있다. DB 실조회에서 후보 4편 모두 queued/VRL null을 확인했고, 수정 후 실제 export가 규칙을 가진 4행을 만들었다. 다른 원천의 필터를 완화하지 않았다. 결과는 `reading_analysis.preservation_checks`에 규칙 ID/verdict/passage_quote/reason을 모두 기록하며 변조·누락·중복·changed/held·없는 인용은 거절한다. import 초기와 각 insert 직전에 규칙/회차를 다시 읽는다. 과거 회차가 정정되면 최신 판정과 새 export를 사용한다. 구조 통과는 의미 인증이 아니며 `awaiting_content_review`를 유지한다.

[로컬 pilot](../scripts/textbook/frym-precision/adaptation-pilot-1.json) 8편은 같은 middle/V3 언어 목표에서 중1의 중심내용 질문과 고1의 추론/한계 질문을 비교한다. 분량은 195~209단어이며 관찰 검토에서 기록된 관계를 보존했다. 출처/저작권자·CC BY 링크·변경 설명과 대표 질문 근거를 기록했다. 전체 목표 skill 문항 세트·기사별 권리 계약을 갖춘 완성 생성 청크가 아니므로 직접 DB import하지 않는다. 이 결과를 8/8 생성 정확도나 실제 연령별 난이도로 해석하지 않는다. 부정 사례 4종은 분모·비교 방향·빈도·측정 나이 왜곡을 보여 준다. `frym-preservation-verify.mjs`는 해시·인용·목표/규칙 커버리지·단어 창을 검사하지만 거짓 preserved self-report를 의미적으로 판별하지 않는다. [결과·한계·재현](./reports/frym-preservation-20261004.md). DB 적재·발행·마이그레이션은 수행하지 않았다.
