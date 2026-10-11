# CSAT_REASONING_DATA_V3 — 근거·콘텐츠·검수·저장 계약

2026-10-12 · 목표 schema v3. **아래 새 타입/필드는 구현 계획이며 DB 컬럼이 아니다.** 기존 테이블·API·정적 파일의 실제 상태는 CURRENT_STATE_AUDIT에 있다.

## 1. 저장 결정과 기존 자산

기본안은 PR #222로 main에 통합된 inquiry v1의 **분석 버전에 묶인 정적 콘텐츠 정본**을 확장하는 것이다. 기존 `answer_locus` JSONB에 억지로 모든 의미/비교/노트를 넣거나 모든 분석 버전을 올리지 않는다. 공용 콘텐츠는 서버만 데이터 파일을 import하고, 공개가 허용된 현재 문항 projection만 client에 준다. `inquiry/labels.ts`처럼 타입/라벨과 JSON load를 분리한다.

| 기존 | 재사용·변경 |
|---|---|
| DB measured_ability/design_intent | task/가설의 입력. ‘공식 확인’ 자동 라벨 금지 |
| answer_locus.quote/reasoning/passage_design | evidence/정답 설명/역할·변환. 원문 분할/버전 확인 없이 문장 index 그대로 복제 금지 |
| choice_analysis | 선정/비선정 판정·설명. inquiry preserved/altered와 합치되 서로 다른 근거 수준 유지 |
| teaching-contract / choice-polarity | 26유형 단위·관계·발문 극성. 단일 타입명만으로 truth를 확정하지 않음 |
| inquiry v1 labels/data/build | v3의 작성/검수/빌드 경로로 확장. 옛 결과/원장 보존·adapter 명시 |
| compare-data / ComparePairs | 방향 링크와 note 보존. v3 양쪽 binding·mapping·조건·독립 검수 추가 |
| lecture-data / lecture API | 대본 비SSR·검증된 cue/target/focus/언어 분리·권한 가드 유지 |
| DissectionRecord + `/api/csat/state` | 개인 노트도 기존 record JSON 모델의 optional collection. 새 영속 저장소/DB 테이블 기본안 아님 |

JSONB 구조를 바꿀 수 있다는 이유로 승인 없이 기존 분석/개인 기록을 대량 갱신하지 않는다. 실제 DB를 수정해야 하는 교정은 별도 scoped 승인/체크포인트와 기존 새 분석 버전·독립 검수 공정을 사용한다.

## 2. 식별자와 source binding

`ContentBinding` 목표 필드:

```typescript
type ContentBinding = {
  itemId: string; examId: string;
  analysisId: string; analysisVersion: number;
  sourceHash: string; answerHash: string; unitsHash: string; unitRevision: string;
  visualHash?: string; contentHash: string;
} & ({ organizer: 'edu_office'; grade: 1 | 2 | 3 }
   | { organizer: 'kice'; grade?: 3 });
```

analysisId/version는 실제 DB 최신 published 행에서 얻는다. source/answer/units hash는 현재 원본·정답·정본 단위의 기존 hash helper/프로토콜을 재사용해 **export 시 생성/확인**한다. 없는 source_revision 컬럼을 질의하지 않는다. KICE 정적 원문/골격의 hash도 내부 build manifest에서 계산하고 기존 버전의 입력 파일에서 결속한다. 학평은 실제 csat_item_units의 input_hash/units_hash/units_version와 연결한다. 해시 정규화 규약/분할 버전을 manifest에 기록하고 JSON key 순서 변화만으로 다른 내용으로 판정하지 않는다.

grade는 학평이면 필수다. 평가원/모평에는 새 학년 값을 생성하지 않으며 기존 DB grade3을 보존하는 adapter만 optional grade3을 전달할 수 있다. 기관 필터를 우선하고 ‘학평 고3’과 평가원을 학년 값만으로 같은 공개/검수 집합으로 합치지 않는다.

전체 원문/선지/시각 자료를 새 public API에 넣지 않는다. 내부 해시용 소스와 학습자 projection을 분리하며 learner-facing source_hash 증명을 위해 원문을 service role로 내려보내지 않는다. 현재 loader에 metadata binding만 추가하되 RLS/public state는 계속 먼저 확인한다. source binding을 아직 얻지 못한 기존 콘텐츠는 `legacy_unbound`로 표시하고 새 검수 완료/일반화로 승격하지 않는다.

공통 evidence ID는 문항·unitRevision에 묶인 stable opaque ID다. 새 분할로 offset/번호가 달라지면 새 revision과 adapter를 사용한다. 단순히 `sentence:5`를 전 문항 공통 식별자로 쓰지 않는다. 기존 sentence:k/focus는 evidence→기기 원문 span/골격 index mapping으로 변환하는 adapter에만 남긴다.

## 3. 콘텐츠 객체와 불변식

| 객체 | 필수 의미·참조 | 공개/검수 불변식 |
|---|---|---|
| `EvidenceRef` | id, binding, kind(sentence/paragraph/span/underline/blank/choice/notice/summary/table_cell/chart_region), unitId, localLocator, quoteRef? | 실제 단위에 resolve. index/구절 일치 검증. 없는 그림 셀/원문을 생성하지 않음 |
| `MeaningAnnotation` | id, evidenceIds, contextualMeaningKo, syntaxRelations?, scope(negation/condition/agent/time/quantity), paraphraseKo, uncertainty | 실제 영어 뜻/범위와 검수 일치. 원문 전체의 번역 대체 재구성물을 새 배포 경로로 만들지 않음 |
| `TaskRequirement` | id, stemEvidence, requestedJudgment, necessaryConditions, readingScope | 연구자 해석 vs 공식 문항 설명 provenance. 발문 긍정/부정 분리 |
| `Claim` | id, statementKo, basis, evidenceIds, requirementIds, status, reviewerRef | basis=`official`/`source_observation`/`design_hypothesis`/`learning_principle`. 공식 문항 근거 없는 의도는 hypothesis |
| `ChoiceJudgment` | choiceId, selectedAsAnswer, contentTruth(true/false/n_a/unknown), requirementFit(satisfies/fails/unknown), preserved[], altered[], decisiveReasons[], evidenceIds | 정답 번호/내용 참거짓/발문 충족을 분리. truth true 비선정/위치 n_a/altered=[] 허용; reasoned n/a 가능 |
| `DesignInterpretation` | constructClaimIds→requirementIds→observedClaimIds→hypothesisIds, alternatives?, limitation | 관찰에서 가설로 가는 edge를 사실 인과/제작 연대기로 표시하지 않음 |
| `ComparisonPair` | pairId, kind(same_structure/contrast/boundary), left/right binding, mappings, sharedConditions, decisiveDifferences, review | 같은 타입·함정 이름만으로 mapping 생성 금지. 양쪽 공개/최신 binding 통과 |
| `Principle` | principleId, level(candidate/bounded/generalized), statement, applicability, nonApplicability, supportPairIds, scope, reviews | generalized는 검수된 다사례 지지/경계 논증 필요. 후보는 단일 문항과 범위 명시. 보류가 반례로 둔갑하지 않음 |
| `SceneContract` | sceneId, question, orderedClaimIds, primaryVisual, evidenceIds, helpRefs, cueIds, availability | 7페이지/필수 응답 뜻 아님. 데이터 결여를 명시하고 fallback 연결 |
| `ReasoningGraph` | nodes는 위 객체 refs, edges는 supported_by/means/requires/contradicts/transforms/compares/applies_when | 설명 객체를 그래프에 다시 복제하지 않음. edge에도 근거/basis·불확실성. 텍스트 목록 대안 |

네 근거 수준은 **주장의 provenance**다. 서로 숫자로 높은 등급처럼 서열화하지 않는다. 검수 pass는 official이 된다는 뜻이 아니다. 특정 오답이 실제 학생에게 매력적이었다는 주장은 해당 문항의 반응 통계와 출처가 없으면 제공하지 않는다.

## 4. 26유형 adapter 계약

기존 `TEACHING_MODELS` 키를 유지하고 의미/판단/도식 adapter를 같은 registry에 연결한다. 아래 엔진은 **예정된 재사용 view model**이지 현재 모든 엔진 컴포넌트가 구현돼 있다는 뜻이 아니다.

| 유형 ID | 의미·판단 단위 / 중심 표현 / 예외 |
|---|---|
| R-PURPOSE | 화자·수신자·요청 화행→선지 동사 대응 / 명제 대응 / 소재를 요청으로 격상하지 않음 |
| R-CLAIM | 당위/평가 주장의 범위와 주체 / 명제 대응 / 반박 대상의 should 구별 |
| R-GIST | 핵심 명제·범위·관점 / 압축 대응 / 첫·끝문장 규칙 금지 |
| R-TOPIC | 글 전체 주제 범위 / 추상화 대응 / 반복어만으로 결론 금지 |
| R-TITLE | 핵심+제목 형식·비유 / 추상화 대응 / 제목 소재 일치≠적절한 범위 |
| R-MOOD | 사건/시점별 감정 표현 / 시간·상태 대응 / 두 감정 변화와 단일 분위기 구별 |
| R-IMPLY | 밑줄 문자 의미↔문맥 명제 / 의미 변환 / 밑줄 없는 입력 보류 |
| R-FACT | 사실·주체·범위·시점 / 항목 대조 / 맞지 않는 것 발문과 contentTruth 분리 |
| R-NOTICE | 실제 공지 항목·조건 / 항목 대조 / 본문 주변 형식/시간 단위 보존 |
| R-CHART | 자료 범주·단위·값·비교식 / visual 조건 대조 / visualHash 없으면 수치 판정 보류 |
| R-GRAMMAR | 밑줄 형태·정동사/절/수식 조건 / 구문 성립 도식 / 정상 비선정 선지 altered 없음 |
| R-VOCAB | 문맥 의미·대상·극성/방향 / 의미 변환 / 밑줄 범위와 정상 표현 구별 |
| R-BLANK | 빈칸 포함 명제·부정/조건 scope / 조건→표현 변환 / 앞뒤/전체 근거 가능 |
| R-BLANK2 | 두 빈칸의 독립 조건+조합 / 조건→표현 변환 / 폐지 유형임을 표시하고 원리 학습용 유지 |
| R-ORDER | 원본 문단 identity·선행 조건·응집 / 경계 연결망 / 접속어/반복어만으로 순서 확정 금지 |
| R-INSERT | 앞↔삽입문↔뒤의 필요 조건 / 삼중 경계 / 양쪽 연결 검수·위치 선지 truth n_a |
| R-IRRELEVANT | 글 전체 주제/전개와 단위의 이탈 / 제거 전후 관계 / 내용 참인 문장도 무관 가능 |
| R-SUMMARY | 요약 slot별 원문 명제·변환·조합 / slot 대응 / 각 빈칸과 전체 요약 모두 검증 |
| R-REFER | 밑줄 지시 대상·구문 범위 / 지시 그래프 / 폐지·정본 선행사 범위 검증 |
| X-TITLE | 장문 공통 핵심·단락 통합 / 추상화 대응 / 세트 공유 원문 binding |
| X-VOCAB | 장문 맥락·밑줄 단위 의미 / 의미 변환 / 앞뒤 단락 scope·표현 truth |
| X-ORDER | 장문 원본 블록·사건/인물·선행 조건 / 경계 연결망 / 세트 identity 보존 |
| X-REFER | 인물 재도입·인칭/지칭 / 지시 그래프 / 지칭의 근거와 순서 정답을 혼동하지 않음 |
| X-FACT | 장문 사건/인물/시간 진술 / 항목 대조 / 다른 번호 공유 원문·발문 극성 |
| X-BLANK | 장문 단일 빈칸 의미 조건 / 조건→표현 변환 / 폐지·장문 scope 유지 |
| X-BLANK2 | 장문 두 빈칸·조합 / slot 조건 변환 / 폐지·둘을 모두 대조 |

공통 엔진은 명제/표현 대응, 경계 연결, 구문·지시, 사실·자료 대조의 기본 primitives를 재사용한다. 여섯 장면용 엔진 수를 맞추려고 모든 타입을 하나의 주장→반론 도식으로 만들지 않는다. 26유형 registry coverage와 unknown type fallback을 테스트한다. 기관/학년은 type ID와 별도 축이며 학평에 평가원이라는 라벨을 붙이지 않는다.

## 5. 비교·일반화의 채택 조건

기존 pair는 한국어 note+trap 중심이고 분석/source binding이 없다. v3로 자동 승격하지 않고 내부 manifest에 `legacy_unbound`로 유지한 뒤 재검수한다. 매 pair는 양쪽 source/answer/analysis/units/visual(필요할 때) 해시와 reviewed content hash, 작성/검수 run ID를 가진다. cross-type partner는 siblings에서만 찾지 않고 **RLS로 공개 가능한 상대 ID를 batch 조회**해 identity/binding을 확인한다. 공개가 실패한 상대의 설명·근거·대본도 projection에서 제거한다.

동일 구조 pair의 mapping은 ‘각 요구 조건/의미 변환이 어떤 근거로 대응하는가’를 명시한다. contrast/boundary는 비슷한 표현에서도 판정을 가르는 조건을 기록한다. generalized 원리에는 서로 다른 문항의 검수된 지지와 실제 경계/반례 검토가 필요하다. 몇 쌍이면 보편 법칙이라고 선언할 수 있다는 수치 기준은 만들지 않는다. 범위가 불충분하면 bounded/candidate이고, 공식 ‘항상’ 규칙은 공식 근거 또는 전량 검증의 명확한 범위 없이는 쓰지 않는다.

쌍 없음, 미검수, 원문 없음, 보류, stale은 서로 다른 absence reason이다. 사용자 compare 클릭은 채택 조건과 무관하다. 후보가 없어도 설명과 자기 설명을 열어 둔다. pair 변경 때 연결된 principle와 note의 현재성도 검사한다.

## 6. 강의 schema와 장면 동기화

기존 Lecture.version은 콘텐츠 버전이다. 새 v3 강의는 별도 `schemaVersion: 3`을 추가하고 missing은 legacy schema1로 읽는다. `LecturePlayer`/tts는 엔진으로 재사용한다. 목표 metadata `CueBinding`은 `cueId/sceneId/claimIds/evidenceIds/primaryTarget/relatedTargets/readingSegmentRefs/contentBinding`을 가진다.

legacy validator는 기존 ROLE_ORDER·8~14큐 등 현재 규칙을 그대로 유지한다. **새 schema3 validator**는 장면별 의미 역할/근거 일치·logicalOrder·각 큐의 실제 target·언어/인용/낭독/취소 계약을 검사한다. 새 대본은 의미/어휘→선지 성립/비선정 이유→설계 해석→비교 대응→원리 조건을 설명한다. 역할/장면 허용 표는 아래 계약으로 고정하며 비용/길이 상수만 대표 파일럿 결과로 별도 개정할 수 있다. 기존 품질 제한을 임의 제거하지 않는다. unknown schema는 거부한다.

새 schema 식별자는 실제 새 승인 콘텐츠에만 붙인다. 옛 큐에 label만 바꾸거나 compare 큐를 생성했다고 가정하지 않는다. 기존 대본은 legacy 차례임을 표시하고 장면 선택과 별개로 들을 수 있다. 새로운 target kind가 필요하면 types/targets/focus/theater adapter/검증기/UI를 같은 단계에서 수정한다. 대본 segments는 여전히 SSR·전체 corpus client 번들에 넣지 않고 권한 적용 lecture API에서 가져온다.

첫 구현의 schema3 역할 계약은 아래 표로 고정한다. `LectureV3`는 schemaVersion으로 구별되는 타입이며 공통 재생 segment/순서/시간은 기존 player adapter를 통한다. 기존 `LectureRole`/ROLE_ORDER를 전역 교체하지 않는다.

| sceneId | schema3 허용 role | 주대상과 검증 |
|---|---|---|
| task | task | 실제 TaskRequirement/발문 조건 |
| meaning | meaning, vocab | MeaningAnnotation 또는 해당 의미에 필요한 어휘·evidence |
| judgment | judgment | ChoiceJudgment/결정 조건. 선택·내용 truth·요구 적합성 분리 |
| design | design | 관찰/가설 Claim; hypothesis 라벨과 대본 표현 일치 |
| compare | compare | 공개 검수 Pair의 실제 mapping과 양쪽 evidence |
| principle | principle | 현재 Principle의 level/조건/한계 |
| explain | explain | 작성 방법/자기 대조 안내. 개인 입력을 읽거나 판정하지 않음 |

전체 대본의 scene 순서는 위 순서를 단조 증가하되 데이터 없는 장면은 생략 가능하다. meaning 안 vocab의 위치는 자유이며 역할별 전역 순서는 없다. 전체 강의 첫 rollout은 기존 8~14큐·150~270초·큐20초 이하·pause300~900ms 상한/하한을 유지한다. 이를 맞추려 내용 없는 큐를 채우지 않는다. 대표 대본에 적합하지 않으면 별도 schema3 상수/적용 범위를 파일럿 결과와 함께 개정한다. 장면 일부를 듣기는 검수된 전체 대본의 subset 재생이며 subset에 전체 강의 최소 길이를 재적용하지 않는다. 원문 인용/낭독/복사/지시어 제한은 기존 유효 규칙을 재사용하고 새 target에 대한 의미 정합 검사를 추가한다. task/meaning/judgment의 검수된 요구·의미·선지 설명 coverage가 없으면 해당 전체 강의는 ready가 아니다. 비교/설계/원리 데이터 결손은 coverage manifest에 명시하며 그 설명을 가짜로 생성하지 않는다.

## 7. 개인 자기 설명·원리 노트

기존 `SelfExplanation(kind='lure')`·Formula의 conditions/limit/source와 기록은 보존한다. 새 원리 설명은 `DissectionRecord.version=1`에 optional `reasoningNotes`로 추가하는 기본안이다. 모델/정규화/merge/held 필터/API/화면을 한 작업에서 수정한다. 새 DB 컬럼은 기본안에 없다.

`ReasoningNote`: UUID id, itemId, principleId?, bindingSnapshot, statement/grounds/applicability/limit(짧은 사용자 글), evidenceIds, pairIds, **afterExplanation:true**, originSessionId?, originCheckAttemptId?, helpAtReveal?(기존 HelpLevel snapshot), savedAt/updatedAt, comparedWithModel:boolean. note는 언제나 설명 후 기록이다. helpAtReveal은 실제 원세션 이력을 알고 있을 때만 `independent|hint|viewed_first`를 복사하며 그 값이 independent여도 note는 독립 수행이 아니다. 확인 중 해설 진입은 원시도 도움/노출 기록과 새 탐구 세션을 연결해 구별하고 원시도의 최초 reveal help를 임의 덮어쓰지 않는다. 필드 길이는 기존 EXPLAIN_MAX와 전체 state 900KB 제한 안에서 명세한다. source 원문 전체/도표 데이터를 자동 첨부하지 않는다. 개인정보/자유 텍스트/문항 ID는 funnel 이벤트 속성에 넣지 않는다.

병합은 기존 id 단위 원칙. 다른 탭/기기의 기록을 root JSON 덮어쓰기로 잃지 않게 한다. 수정 충돌은 기존 merge 정책을 확인해 과거 내용 보존 방식으로 처리한다. 권한은 서버 세션 userId이고 요청 body의 userId는 신뢰하지 않는다. held 연계 노트/정답 근거는 기존 `correctnessItemIds/withoutHeldCorrectness`와 state 가드에 포함해 조회 비노출을 검증한다. 저장 원자료를 임의 삭제하지 않는다. note의 binding이 낡으면 자기 기록은 남기고 ‘이전 분석에 대한 설명’으로 보이게 하며 현재 검수 콘텐츠와 섞지 않는다.

이 노트·기존 compared/checks/완료 기록을 독립 진단 evidence로 변환하지 않는다. 독립 확인 데이터는 기존 채택·노출·도움·처음 보는 과제 기준을 따른다.

첫 계약은 네 자유 입력 필드 각각 EXPLAIN_MAX=600자 이하, statement는 공백 제거 후 비어 있지 않음, 나머지는 optional이다. 기존 state byte guard는 전체 직렬화 결과에 그대로 적용한다. 길이 초과는 잘라 저장하지 않고 입력을 보존하며 오류를 반환한다. timestamp는 현재 state 규약의 검증/merge 형식을 따르고 tests는 고정 now를 주입한다. comparedWithModel은 자기 대조 동작 기록이며 채점 결과가 아니다.

## 8. 전량 배치와 신뢰 게이트

기존 `inquiry-drain-export/validate/build`, `compare-drain-export/import`, analysis drain을 검색·재사용한다. export의 버전 동일 skip에 **새 schema/필수 필드/해시의 완료 조건**을 추가한다. 옛 v1 출력에 값이 있다는 이유로 v3 의미 주석 대상에서 영구 skip하지 않음. 실제 선택 manifest 밖 파일을 처리하지 않는다.

v3 작성 결과에 status=`ok|needs_source|needs_review|not_applicable`, coverage-by-scene, 바꾼 필드와 보존 이유를 기록한다. 필요한 값이 없으면 없는 이유를 적고 빈 문자열/임의 설명을 ready로 올리지 않는다. 검수 객체는 item/pair/principle ID·binding·contentHash·writerRun/reviewerRun·criteriaVersion·verdict와 이유를 가진다. **explicit pass이며 writer≠reviewer이고 실제 현재 입력과 일치할 때만 공개 빌드한다.** 누락 판정/마지막 revise 아님/3페르소나 자기 점검만으로 독립 통과라 하지 않는다. 파일 이름 정렬 대신 검수 revision/hash로 결과를 선택한다.

단계별 의미 검수: 원문 뜻/구문→문항 요구·각 선지→가설 provenance→pair mapping→조건/반례→화면/대본 동일 의미. 기계적으로 hash/타입/인용 일치가 맞아도 의미 정확성을 통과했다고 하지 않는다. 오류·제외·n/a 수와 분모를 기관/학년/유형/장면별 출력한다.

최신 source/analysis/answer/units/visual 또는 pair 지지가 바뀌면 해당 확장만 stale/보류한다. 최신 기존 검수 분석과 자유 탐구는 권한 범위 안에서 유지한다. public projection의 한국어 의미 주석도 원문·선지·그림의 실질적 전체 재구성/배포가 되지 않는지 기존 권리 정책에 따라 검수한다. 정책 변경이 필요하면 별도 구체 승인안으로 분리한다.
