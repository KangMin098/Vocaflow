# G3 — 2026-34 제품 이관 차이분석

T-0137 · 작성 owner `csat-v4-s0` · **차이분석/상세 계약, 제품 미구현, 독립 검증 대기**.

T-0136 COMPLETED와 `81d6732b2e89566f8198bf9c5f9cbd0ccbe88ecd`의 [수용 명세](../skeleton-v4/s1-v6/correction/r2/PRODUCT_TRANSFER_2026_34.md)를 보존한다. 이 문서는 기존 명세를 대체하는 전면 설계서가 아니라, 현 제품 및 전체 유형 연구 대조에서 필요한 수정 사항만 기록한 부록이다. D1 표시 계약 A·D2 절차·34 이관 **설계** 수용을 제품 구현/콘텐츠 승인으로 확대하지 않는다.

## 1. 실제 기준과 기존 명세의 변경점

| 관측 대상 | 고정 HEAD | 관측 범위 |
|---|---|---|
| 수용 명세/작성 브랜치 착수점 | `81d6732b2e89566f8198bf9c5f9cbd0ccbe88ecd` | T-0136 COMPLETED, 원 명세 불변 |
| 실제 main (`Vocaflow-main-serving`) | `e3e0a6a0e4327e0eabfaca83f47568a75be080b6` | 착수 시 clean. 수용 명세의 코드 범위와 관련 제품 파일 변경 0 |
| 전체 유형 연구 | `810a463acf8e9221fca3484d66f31d843f4a543d` | `research/csat-all-types-20261024`. 착수 관측 a518bef7 이후 추가된 R4·공개 sidecar 연구까지 반영. 연구 결론은 제품 수용이 아님 |
| 강의 개선 | `0e36138e3385aad47b4b02d542b4461cf338365b` | `feat/lecture-learner-control`, 착수 시2bd99a0f clean. 작업 중 안내 줄 started 상태 보정 추가, 제품·테스트 5파일 범위 유지. main에 미반영 |

파일별 Git blob SHA-256·관측 근거는 [SOURCE_INDEX.json](./SOURCE_INDEX.json), 데이터는 [DATA_STATUS.json](./DATA_STATUS.json) 참조. 브랜치 이름을 main으로 오인하지 않는다. 다른 세션이 이후 HEAD를 바꾸면 이 결론은 위 고정 SHA 범위에서만 유효하며 구현 전 다시 비교한다.

기존 명세에서 보완할 부분은 다음과 같다.

| 기존 수용 범위 | 현재 추가로 필요한 정정/상세화 |
|---|---|
| OFFICIAL_ANSWER 공개 후 분석만 이관 | 근거 우선·해설 우선·강의 우선의 자유 진입과 공개 동의를 추가. 공개 전 선지 선택 강제를 도입하지 않는다. 보안 권한과 교수적 표시 상태를 분리한다(§4). |
| F07 자동 selectScene/scrollIntoView를 제거/분리 | 개선 브랜치가 일부 구현. 최신0e36138e까지 동일 수정 재작성 대신 해당 diff를 평가하고 남은 사용자 의도/닫힘/클릭/재생 재개 문제만 보완(§3·5). |
| ①/③ 저장 한국어 명제는 공식 영어 선지 전문 아님 | 문구 자체는 맞다. 그러나 **DB에 공식 영어 선지 5개가 없다는 뜻으로 사용하면 틀림**. DB 저장과 이번 원지 대조를 별도 기록(§6). |
| analysisRevision/sourceSha/lectureRef 제안 | 실제 DB 필드는 `analyses.version`; DB units_hash NULL·units/skeleton 부재와 커밋 파일 결속을 구분. lecture v2는 자체 버전이며 분석 v5 결속이 구현된 것은 아님. |
| 내용 승인 없는 설명 보류 | 34②의 unknown/fails와 강의 c7/c10 충돌, c1/c12의 과잉 일반화 위험을 매체 전체에 적용. 공개 동의가 콘텐츠 승인 대신이 아님. |
| F08 미선정/기존 평가 절차 | 그대로 유지. 연구 04의 별도 수치·화면 높이를 수용된 F08 v1.0 기준에 몰래 섞지 않음(§7). |

## 2. 기능별 코드·수용 설계·대안 대응

아래 경로는 `apps/web/src/` 기준이다. REUSE는 **현재 제품 그대로**를 뜻하며, 개선 브랜치의 일부 코드 채택을 제품 전체 REUSE로 포장하지 않는다. 비용은 학습 목표 필수 조건을 충족한 대안끼리만 비교한다.

| 기능 | 실제 기존 구현 | 수용 설계/연구 요구 | 대안별 목표 충족·실패 및 필요한 변경 |
|---|---|---|---|
| F01 발문·한정 | `InquiryV3Panels.tsx::V3Task`에 task/조건 텍스트, `V3Meaning`에 scope와 근거 버튼이 있다. page는 ready inquiry를 전달한다. | 발문과 Ideally·If·cannot be의 서로 다른 범위를 직접 선택하고 실제 근거로 확인. 모든 빈칸을 조건문형으로 일반화 금지. | **REUSE:** 조건 열거만으로 범위 대조 부족. **IMPROVE 권고 유지:** 기존 패널에 검수된 qualifier→unit/span 연결과 선택 상태 추가. **REPLACE:** 전용 조건판은 가능하나 기존 근거 왕복을 대체 검증해야 함, 현 우위 근거 없음. **NEW:** 전 유형 조건문 강제 도구는 31/32/33의 인과·대조·일반화 차이를 수용 못함. 새 프레임워크보다 필요한 anchor 데이터부터 확보. |
| F03 근거·관계 | `AnalysisTheater` meaning 선택·bridge·history, `meaning-support/model.ts`의 검수 관계 연결, `align.ts` 원문 정렬, 서버 `projectV3Pairs`가 존재한다. | 등록 관계만 양방향 탐색하고 이전 문맥·근거로 복귀. 관찰/연결 해석 구별, hash 불일치/미등록/보류 분리. | **REUSE:** 현재 bridge와 장면 변경에서 msPick/msPhrase 등을 비우므로 완전 복원 미충족. **IMPROVE 권고 유지:** 기존 관계 인덱스와 상태 stash/recall을 보완; 역방향·focus·PDF 문맥을 결속. **REPLACE:** 독립 관계 엔진은 기존 URL/지도 계약 대체 비용과 확장 이득 증거 부족. **NEW:** 근거/비교 짝 추정 생성은 탈락. 34의 비교 짝 0 유지. |
| F04 정답·오답 | `V3Judgment`가 한 선택지의 내용 truth와 requirement fit을 이미 분리 표시한다. 기본 pick은 정답이며 `selected_as_answer` 표시·해설도 즉시 보인다. DB loader는 공식 선지 전문을 현재 DTO로 조회하지 않는다. | ①/③ **완성 명제**를 같은 조건에서 동시 비교, truth/fit 분리, ② unknown/fails 보존. 공개 전에는 정답 기본 선택·소거·정답 role로 암시하지 않음. | **REUSE:** 단일 정답 기본 패널은 비교·자유 공개 미충족. **IMPROVE:** 기존 단일판에 탭 추가는 가능하지만 왕복 중 두 명제 보존 증거 부족. **REPLACE 권고 유지:** 판단 표시 영역을 동시 비교판으로 교체하고 기존 truth/fit·등록 근거·접근성 계약은 유지. **NEW:** 새 자유서술 자동 판정/정답 생성은 근거 없으므로 탈락. 한국어 대입 명제와 공식 영어 선택지를 명시적으로 구별. |
| F05 원리·한계 | `V3Design`이 basis 라벨·근거·limitation을 이미 제공한다. 기존 `SystemLearningSummary`와 확인 활동은 준비된 자료 중심이다. | 실제 관찰→해석, 적용 조건·한계를 직접 대조. 빈칸=항상 조건문/부정어라는 일반화 금지. 22는 중심성,38은 접합·기존 연결이라는 전용 판단 유지. | **REUSE:** 긴 설계 설명만 읽어서는 조건 대조 목표 부족. **IMPROVE 권고 유지:** basis와 한계를 유지하고 검수된 조건 선택→근거/한계 연결을 추가. **REPLACE:** 새 원리판은 기존 basis 신뢰 구조를 대체 검증해야 하며 우위 미확인. **NEW:** 반례 생성/없는 비교 쌍 생성은 탈락. 실제 자료가 없으면 준비 중으로 표시. |
| F07 강의 제어 | main은 cue→자동 장면 변경/scrollIntoView. 개선 브랜치는 자동 장면 제거, following/follow/unfollow, 장면 안내 단추, 입력별 해제를 구현했다. | 재생과 학습자의 장면·근거·scroll·focus·닫은 상세 상태를 독립 소유. 명시적 따라가기만 위치를 이동. 정답 공개와 내용 승인은 별도 관문. | **main REUSE ELIMINATED:** 직접 탐색을 덮어씀. **IMPROVE 권고 유지:** 개선 diff를 출발 후보로 검증하고 §3·5의 잔여 계약만 보완. **REPLACE:** player 엔진 교체만으로 viewer·공개 상태 문제를 해결하지 못하며 회귀 비용 추가, 우위 증거 없음. **NEW:** 새 오케스트레이터도 동일 상태/공개 계약을 증명해야 하므로 선결정하지 않음. 승인 전 원본 대본 수정/신규 대본 제작은 범위 밖. |

전체 유형 연구를 반영할 공통 경계: 34의 조건-완성명제 도구를 모든 빈칸/유형의 도구로 만들지 않는다. 22는 부분 사실과 중심성,38은 truth=`n_a`와 앞뒤 접합/기존 연결 보존을 유지한다. 근거 ID는 문장 번호만이 아니라 paragraph/choice/table/chart/notice/summary/audio 등 실제 자산 종류를 구분할 수 있어야 하며, 해당 자료가 없으면 unavailable로 둔다. 듣기 원음·권리,도표 수치·이미지,어법 밑줄 경계 등 연구의 DATA_GAP을 이번34 구현 준비로 해소했다고 주장하지 않는다. 26 교수 모델 키가 존재한다는 사실도 유형별 판단 도구 구현 완료를 뜻하지 않는다.

## 3. 강의 개선의 구현 사실과 실제 검증 범위

| 항목 | main | 개선 HEAD의 실제 코드 | 판정/남은 확인 |
|---|---|---|---|
| 자동 장면 | liveScene effect가 selectScene(replace) 실행 | 해당 effect 제거, 장면 안내 단추를 누를 때 이동 | **구현 있음**. R3의 코드 판독·정적 가드 근거. 최신 안내 줄의 제품 브라우저 검증은 없음. |
| 자동 스크롤 | cue마다 블록·레일 scrollIntoView | 블록은 following 중, 레일은 playing && !following이면 억제 | **부분 개선**. paused/수동 장면 변경에서도 문맥을 보존하는지 추가 필요. |
| 따라가기 재개 | 개념 분리 없음 | start()가 true로 설정, follow()는 상세를 펴고 현재 cue 위치로 이동 | **구현 있음/계약 차이**. 재생과 따라가기를 분리해야 함. 선택했던 위치를 재생 시작이 덮어쓰면 안 됨. |
| 휠·Tab·스크롤 키 | 보존 제어 없음 | wheel/touchmove, ArrowUp/Down·PageUp/Down·Home/End·Tab으로 해제 | LectureStage 단독 하네스 32/32의 일부. Tab 과잉 해제 불편, RTL·중클릭 자동 스크롤 미검증. |
| Space·스크롤바 | 제어 없음 | 본문 Space는 다른 handler가 defaultPrevented하지 않을 때 해제. 버튼 등은 제외. scrollbar pointer hit-test | 하네스 일부 검증. 실제 item은 `keys={false}`이므로 전역 Space 재생 토글을 켜져 있다고 가정하지 않음. OS/RTL·overlay scrollbar 별도. |
| 닫은 상세 | cue가 상세를 자동 펼침 | following=false에서는 펼치지 않음 | **조건부 구현**. following=true에서 학습자가 summary로 닫을 때 해제/닫힘 기억 처리가 없으므로 이후 cue가 다시 펼 수 있음. 기존 성공은 이 경우를 증명하지 않음. |
| 원문·근거 클릭 | 재생 중 블록 클릭이 player.jump로 이어짐 | 해당 onClick→jump 경로 그대로 남음 | **미해결 차이**. 일반 읽기/근거 탐색은 cue를 바꾸지 않고, 명시적 cue 재생 명령만 이동하도록 분리 필요. |
| 수동 장면 | pickScene은 재생 중 toggle로 멈추고 loading 중 holdLecture를 설정. selectScene은 일부 의미 선택을 초기화 | 이 수동 pause/초기화 경로가 남고 lec.unfollow 호출 없음 | 자동 scene effect 제거만으로 재생/탐색 독립이 완성되지 않음. 수동 장면 탐색과 명시적 pause를 분리하고 장면별 근거·문맥 복원을 검증해야 함. |
| 안내 줄·접근성 | 없음 | 고정 라벨+aria-pressed, 상주 polite region, 장면 버튼 후 offer focus. 최신0e36138e는 실제 playing을 한 번 본 lectureStarted 뒤에만 줄 유지 | **코드 보정 있음**. R4는2bd99a0f의 loading/error 렌더 문제를 지적했고0e36138e가 보정. 최신 커밋 독립/제품 브라우저 재검증은 아직 없음. |

증거 재사용 한계: 연구17·19의 LectureStage 단독 하네스 **32/32**는 `6f7fbe1ce` 범위, 연구20(R4)은 `2bd99a0f1`에서도32/32·tsc/lint/가드9/9 재실행을 기록한다. AnalysisTheater/장면 안내 줄은 하네스에 장착되지 않았고 focus 비교도 요소 식별력이 약하다는 지적이 있다. R4 판정은 PARTIAL이며 loading/error 문제는 코드 추론으로 발견, 실화면 재현은 하지 않았다. 최신0e36138e를 과거 하네스 32건으로 전체 수용하지 않는다. 실계정 E2E는 연구상 계정 부재로 BLOCKED이며 이번에는 재실행하지 않았다. 제품 실계정·실제 음성·전체 접근성 PASS가 아니다.

## 4. 정답 공개와 노출 이력 계약의 차이

**접근 권한(access)과 교수적 공개(exposure)는 두 축이다.** 기존 명세의 공개 전 payload 보류를 모든 공식 정답의 DB 비밀 정책으로 해석하지 않는다. 연구 14의 사용자 결정에 따라 공개 기출 정답은 접근 권한자에게 제공 가능하며 UI가 학습자 선택 전 표시를 미룰 수 있다. UI 숨김은 보안 경계가 아니다. embargo/로그인/미공개 분석/비공개 비교 상대는 서버·RLS 관문으로 계속 차단한다. `canRevealItem`은 Pilot 보류 접근 관문이며 학습자 공개 동의 상태가 아니다. `check=1`도 일반 경로의 선행 조건이 아니다.

학습자는 `근거부터 탐색 / 해설과 함께 분석 / 강의로 이해`를 바로 선택하고 바꾼다. 선지 선택·답 제출을 정답 공개의 조건으로 요구하지 않는다. 해설 우선은 명시적 공개 선택으로 기록하고 바로 진입한다. 강의 우선은 첫 위험 cue **직전** 안내→계속/건너뛰기/멈춤 선택을 제공한다. 건너뛸 안전 구간이 확인되지 않으면 없다고 표시하고 정답 없이 들을 수 있다고 약속하지 않는다. 학습자 응답을 기다리는 동안 화면 target·역할·소거 순서·대본·음성·ARIA 모두 위험 내용을 실행하지 않는다.

상태 소유 제안(새 DB 구조를 만들었다는 뜻 아님):

- `accessState`: 서버가 인증·권한·published 분석·embargo·원문 접근 상태를 판단. 권한 상실 시 재생/대기 TTS를 취소하고 제한 콘텐츠를 제거한다.
- `disclosurePermission`: `NONE / HINT / ANSWER`, item+콘텐츠 결속 단위. 학습자의 명시 동의만 바꾼다. cue/타이머/정답 기본 pick이 허용 범위를 자동 확대하지 않는다.
- `exposureHistory`: 실제로 보여주거나 들려준 최고 수준·채널·시점·동의 원인. 동의만 했으나 아직 출력되지 않은 정답을 열람 완료로 기록하지 않는다. 허용 범위 안에서 cue가 실행되면 실제 노출을 기록하되 이것이 다음 위험 구간의 동의를 대신하지 않는다. 화면에서 다시 숨겨도 이력을 되돌리지 않는다.
- `pendingDisclosure`: 진입하려는 cue/판단/상세의 위험 수준·채널·누적 영향. 계속은 해당 위험 범위를 동의한 뒤 실행, 건너뛰기는 안전하다고 검수된 다음 구간만 선택, 멈춤은 현재 viewer를 그대로 둔다. 개별 cue 재생/prev/next/jump/재시도도 같은 관문을 통과한다.
- `activityEvidence`: answer_viewed, checked_after_explanation, independent_attempt를 구분. 최초 hint/해설/정답 노출 뒤 같은 문항에서 수행한 답 선택·확인은 독립 수행으로 기록하지 않는다. 탐색·강의 청취·확인 활동으로 mastery를 자동 부여하지 않는다. 기존 수행과 섞는 저장 경로를 조사하기 전 새 컬럼/이벤트를 임의 생성하지 않는다.

초기 UI/outline의 기본 정답 선택, selected_as_answer, reject 번호·개수/순서, 정답 아이콘/색·role 라벨, 의미·근거 강조, 숨긴 상세/ARIA, 음성 큐까지 동일 정책을 적용한다. 대본 segments를 SSR에서 빼더라도 `lectureOutline`이 role/target/focus를 미리 내보내므로 암시가 남을 수 있다. 일반 학습 DTO는 검수된 안전 projection만 렌더하고, 승인 보류 콘텐츠는 D1과 같은 검토 전용 경계로 분리한다. 정답 표시 동의는 부정확한 콘텐츠를 읽어도 된다는 승인이 아니다.

### cue별 공개 계약에 추가할 데이터

[CUE_DISCLOSURE_34.json](./CUE_DISCLOSURE_34.json)은 **기존 연구 sidecar와의 차이표를 포함한 작성자 위험 분류 후보**이며 별도의 런타임 태그 정본이 아니다. 원본 lecture v2와 cue SHA에 묶인12개 항목, 직접 공개·간접 암시·소거 누적·내용 감수 상태를 구별한다. 첫 c1부터 암시 위험이 있다. c4/c5는 정답을 직접 말하고, 별도 진입 경로 c6~c9의 오답4개 소거만으로도③이 남는다. c11 어휘도 정답 선택지의 핵심어를 다뤄 안전한 무암시 cue로 단정할 수 없다.

작업 중 추가된 연구21의 `csat-lecture-disclosure-sidecar/v1`은 이미 원본과 분리되어 있다. 2026 회차 파일 SHA와34의12cue 원문 JSON SHA를 직접 대조하여 모두 일치했다. 기존 sidecar를 다시 만들 필요는 없다. 다만34의 c3는 두 판정자 의견 불일치로 local UNKNOWN, c5/c10/c11/c12는 직접 정답 공개 **이후**라 local 미검수 UNKNOWN인 반면 순서대로 재생할 때 cumulative ANSWER이다. 이 값을 임의 cue 진입에도 적용해 안전하다고 판단하면 안 된다. G3의 c5 직접 공개 위험 등은 보수적 대조 제안으로만 기록하고 기존 UNKNOWN을 승인 라벨로 덮어쓰지 않는다. 공개 위험 태그의 합의는②/원리 설명 내용 정확성 승인과 다르다.

연구21은 검토자의 why·quote가 정형 문구/자동 절단이어서 근거로 쓸 수 없다는 품질 한계와 충돌을 명시한다. 따라서 sidecar의 promoted 또는0.85 합의율만으로 제품 수용을 부여하지 않는다. 재사용 가능한 것은 결속 확인된 직접 정답/소거 규칙과 명시된 검수 범위이며, 간접 암시·임의 진입·누적 상태는 보강 검증이 필요하다.

연구21의 U2 시작 전 일괄 안내는 기존 대본 변경 없이 구현할 수 있는 후보이다. 「정답 부분 전까지만」은 **단서·답을 좁히는 설명은 포함될 수 있음**을 먼저 알리고 HINT 범위 동의를 받아야 한다. 알려진 R1/R2/R7 경계에서 멈춘다는 것이 정답을 유추할 수 없는 안전 구간의 보장은 아니다. UNKNOWN/충돌 또는 임의 진입으로 안전성 미확정이면 해당 cue 전에 더 높은 위험을 안내하고 응답을 기다린다. 대본 탭을 열거나 outline만 렌더하는 경로도 같은 관문 대상이다.

필요한 결속은 `{itemId, analysisVersion, unitsHash, sourceTextSha256, sourcePdfSha256, inquiryHash, meaningHash, lectureVersion, lectureHash, cueId, cueHash, disclosureRevision, reviewer, reviewedHash}`이다. 위험은 `none/hint/decisive/answer`와 `speech/transcript/target/role/elimination/aria` 채널, 근거, 내용 승인 상태를 가진다. 누적 상태는 실제로 방문·동의한 cue들의 고유 소거 집합/근거 조합을 기준으로 계산하고 단순 cue 번호 임계값을 사용하지 않는다. 순서 변경·재방문·건너뛰기에도 같은 정책이다.

태그 없음·분류 불일치·태그 해시 불일치·누적 암시 미판정은 **안전(none)으로 통과시키지 않고 answer 수준의 사전 안내 대상으로 보류**한다. 대본 내용 자체가 감수 보류이면 공개 동의만으로 해제하지 않는다. 기존 sidecar를 우선 대조하고 부족한 범위만 별도 승인 아래 export→독립 내용 판정→해시 검증→import로 보강한다. 이번 JSON도 기존 연구 sidecar도 현재 제품 loader가 읽지 않는다. 원본 키 추가는 현재 필요 조건이 아니며, 승인 전 대본 수정·새 무암시 대본 제작은 하지 않는다.

## 5. 강의·장면 상태의 목표 계약

기존 viewer/player 분리 수용을 구체화한다. viewer는 `scene, chosenMeaning, chosenEvidence, choice/peer, sourcePage/zoom/scroll, paneScroll, focus, closedDetails, returnContext`를 소유하고 player는 `cue, status, mediaMode, rate, pendingSpeech`를 소유한다. 공개/콘텐츠 관문은 두 상태 위에서 독립 적용한다.

| 사용자/시스템 사건 | 필요한 동작 |
|---|---|
| 처음 재생·일시정지/계속·오류 재시도 | viewer 위치·선택·닫힘·focus 유지. `following`을 암묵적으로 다시 켜지 않음. 기본은 수동 탐색이며 사용자가 따라가기를 명시 선택할 수 있음. |
| cue 자연 진행·prev/next·직접 cue 재생 | 공개 관문을 먼저 확인. 명시적 따라가기 외 viewer 변경 0. cue 이동 자체를 장면 이동 동의로 간주하지 않음. |
| 직접 장면·근거·원문 선택/스크롤/상세 닫기 | 자동 따라가기를 해제하고 선택 상태를 저장. 일반 콘텐츠 클릭은 player.jump를 호출하지 않음. 닫은 details는 이후 cue가 다시 열지 않음. |
| 「설명 위치 따라가기」 명시 선택 | 위험/내용 관문 통과 후 현재 설명 위치로 한 번 이동. 해당 장면으로 이동할 필요가 있으면 별도 명시 장면 버튼을 사용. 현재 목표에 필요한 상세만 열며 다른 닫힘 상태를 일괄 지우지 않음. |
| 따라가기 끄기 | cue는 진행 가능하되 위치·선택·focus 고정. 상태 변경으로 버튼/안내 공간이 사라져 focus를 잃지 않음. |
| 휠·키보드·scrollbar·Space | 원문/판단 pane별 사용자 의도를 반영. Space는 버튼/입력 동작과 본문 읽기 구분, 기본 스크롤이 사용된 때 해제. 실제 item의 keys=false 유지. 키보드로 의도한 탐색을 player 단축키가 빼앗지 않음. |
| 장면/지도/Workspace 왕복 | 같은 item·동일 결속이면 문맥·유효 focus 복원. item/분석/원문 변경 시 오래된 선택을 적용하지 않고 이유 표시. 복귀 query는 기존 allowlist만 사용하며 인증 키로 쓰지 않음. |
| 종료/OFF·item 변경 | 종료/OFF는 매체만 취소하고 viewer 문맥 보존. 새 item은 player와 이전 결속을 초기화하되 새 문항을 이미 독립 수행했다고 기록하지 않음. |

이는 개선 브랜치 전체를 미리 승인하는 계약이 아니다. `pickScene`의 자동 pause/loading hold와 `selectScene`의 초기화·root click→jump·following 중 details 재열림·start의 follow 재설정 경로를 분리해야 한다. 기존 toggle 방식의 일시정지/계속은 start와 다르므로 이미 같은 동작이라고 단정하지 않는다. paused rail은 회귀 확인 대상으로 둔다. 새 상태 라이브러리 도입은 필요 조건이 아니며 먼저 기존 상태 소유권을 정리한다.

## 6. 데이터·콘텐츠·권한 — 관측과 미검증 분리

34는 DB SELECT로 영어 선지 **5개**, 공식 정답 ③, published 분석 v1~v5를 확인했다. 이번 작성자는 기존 공식 홀수형 문제지의 **6쪽 캡처를 직접 열어 DB ①~⑤와 모두 대조**했다. 결과는 문자열/순서 일치라는 수동 원지 대조이며 독립 내용 승인·실제 제품 PDF 렌더링/크롭 정렬 성공이 아니다. 공식 문제지·정답표 SHA와 캡처 SHA는 DATA_STATUS에 고정한다. 원문/선지 전문을 새로 생성하거나 한국어 대입 명제로 대체하지 않았다.

| 계층 | 실제 확보 상태 | 이번에 하지 않는 판단 |
|---|---|---|
| DB 분석 | 최신 published `version=5`; v1~v5의 units_version/units_hash는 NULL | NULL을 로컬 v3 hash로 채워 DB 결속 완료라 주장하지 않음. schema/행 존재≠내용 정확성 |
| DB units/skeleton | 34 행 없음(SELECT의 null 집계) | 원문 없음/제품 기능 없음으로 단정하지 않음. 제품은 커밋된 skeleton을 읽음 |
| inquiry 파일 | analysis_version=5, v3 units_hash=`7fb095d3cac4821e`, ② unknown/fails | ready는 버전 일치 검사이며 내용 승인이나 DB units 결속 증명이 아님 |
| meaning-support 파일 | schema meaning-support/1, analysisVersion5·unitsHash 동일, basePublicHash와 review contentHash 존재,7문장 alignment | loader는 schema/검수 해시와 배포 inquiry 결속을 검사한다. sourceSnapshotHash가 있어도 원지 PDF SHA와 같은 값이 아니며 이 필드의 현재 원문과의 직접 일치 검사는 loader에 없음 |
| lecture 파일 | 자체 version=2,12cue, 커밋 파일 SHA 및 문항/cue SHA 확보 | 분석 v5·units/source/meaning binding 필드 없음. lecture v2를 분석 v2로 해석하지 않음. stale 강의 자동 차단은 신규 계약 |
| 공식 PDF | 공식 파일과 캡처 해시,34⑤까지 수동 대조 확보 | 로컬 PDF worker/권한/정렬/키보드 접근성은 미검증. 개발 기본 PDF 제공은 production에서 꺼지는 기존 경계 유지 |
| 비교 | 34의 등록된 비교 짝 0 | 연구의 다른 빈칸 문항이 존재한다는 이유로 정식 비교 쌍을 생성하지 않음 |

34②의 **발문 불충족(fails)은 유지**, 내용 자체 truth는 **unknown/독립 감수 대기**로 둔다. DB 분석의 주체 역전 설명과 강의 c7/c10은 같은 검수 대기 대상으로 다룬다. 원본을 고치지 않은 채 제품 이관 시 해당 설명·음성·target/ARIA를 검토용으로 분리/보류해야 한다. c1/c12의 일반화도 별도 내용 감수 전 공식 원리로 승격하지 않는다. C1(38) 콘텐츠는 계속 NOT_APPROVED이며 교차 검증용 검토 모드만 허용한다.

정상 학습자 세션에서 published/in_review/embargo/비공개 상대 응답이 올바른지는 서버 코드·DB privileged SELECT로 증명할 수 없다. 실계정 HTTP/RLS 검증을 별도 필수 조건으로 유지한다. 현재 DTO가 choices 전문을 조회하지 않으므로 5선지 표시를 구현하려면 공개 권한·payload·원지 결속을 확인한 읽기 경로를 먼저 정한다. raw csat_items를 클라이언트에 넓게 개방하지 않으며 DB view/ACL 변경은 별도 승인이다.

## 7. F08 및 1280/1440 UI·접근성 검증 계획

**IMPROVE/REPLACE 유지, selected=null/UNDETERMINED.** [수용된 F08 v1.0](../skeleton-v4/s1-v6/correction/r2/F08_EVALUATION.md)의12과업·7영역·사전 분류·필수 관문·사용성/비용 비교 순서를 그대로 사용한다. 두 후보 모두 같은34·22·38자료/승인상태/공개상태/cue/초기장면과 과업을 사용한다. 38 보류 설명을 일반 학습자 성공에 합산하지 않는다.

| 계획 | 실행·기록값 | 수용 조건/현재 상태 |
|---|---|---|
| 실제 PDF | 두 폭1280×1000/1440×1000, 브라우저100%/200%, 실제 동일 PDF SHA/worker/페이지/zoom, 가림·잘림·한정어 식별 | 기존 protocol의 원문+판단/원문+근거+판단 사전 분류 과업을 모두 수행. 정적 PNG로 대체 금지. **NOT_RUN** |
| 왕복·문맥 | 기존34-A~D,22-A~D,38-A~D, 원문↔근거↔선지 및 지도/Workspace, scene/selection/scroll/focus exact identity 로그 | 잘못된 문항/해시/추정 관계0, 명시 복귀 상태 일치. 요소 id 문자열만이 아니라 DOM 요소 동일성·복원 대상 검증. **NOT_RUN** |
| 키보드/조작 | Tab/Shift+Tab,Enter,Space,화살표,Page/Home/End,Escape,실제 scrollbar,details 닫기,따라가기 | 키보드 trap/누락0·보이는focus·44px target·학습자 닫힘 보존. RTL/overlay scrollbar·중클릭은 지원 정책을 명시하고 미지원은 PASS 처리 금지. **NOT_RUN** |
| 강의/노출 | 직접 재생·cue jump·읽기 클릭·수동 장면·scroll·pause·종료·OFF·오류, 각 공개 상태에서 전 채널 관찰 | 무동의 노출/자동 scene·scroll·focus·details 변경0. 실제 TTS 취소·대기 음성 누출 별도. **NOT_RUN** |
| 접근성 | 색 대비 실측, 확대/문자 잘림, 스크린리더 읽기 순서·상태·중복/live region·정답 암시, 읽기 전용 PDF 대체 접근 | DOM ARIA snapshot/소스 검사로 실제 스크린리더 PASS 대체 불가. **NOT_RUN** |
| 비교/회귀 | ①/③ 두축,② unknown/fails,22 부분참/요지,38 앞뒤접합·기존연결,준비자료 없음,check=1 | 문항별 필수 실패를 총점으로 상쇄하지 않음. 기존동일 SHA 격리 근거는 해당 범위만 재사용. **계획**, 제품 실기 아님 |

연구04의 C1~C12는 참고 후보 기준이다. 그 문서의 1280×800/1440×900,90%/55~80자/≤3조작 같은 값을 기존 protocol에 사후 결합하지 않는다. 추가 환경을 시험하려면 별도 사전 버전·기준을 고정하고 두 후보를 같은 조건으로 재비교한다. 학습 효과 우위·최종 승자는 실제 근거 없이 주장하지 않는다. F02/F06/F09/F10의 부족 증거를 이 계획으로 해소했다고 기록하지 않는다.

## 8. 변경 파일·영향 범위와 구현 순서

**아래는 향후 승인된 구현에서의 후보 변경 범위**이며 이번에는 파일을 수정하지 않는다. 기존 명세의 순서 앞에 자유 공개와 데이터 검수 선행 조건을 보완한다.

| 단계 | 필요한 파일/책임 | 직접 수용 테스트 |
|---|---|---|
| 0 결속·내용 | `lib/csat/inquiry/data.ts`, `meaning-support/data.ts`, `lecture/types.ts`, `lecture/store.ts`, `learner.ts`; 필요 시 승인 sidecar 생성 도구 | 버전/hash/태그 누락·위조·source 변경에서 stale/held, DB null과 파일 fallback 구분.② unknown/fails·보류 cue 전 채널 차단. 콘텐츠/DB 수정은 별도 승인. |
| 1 공개/진입 | `app/(app)/csat/item/[slug]/page.tsx`, `app/api/csat/lecture/route.ts`, `components/csat/lecture/LectureStage.tsx`, `LecturePlayerBar.tsx`, 분석 DTO/표시 정책(새 작은 순수 모듈 후보) | 세 진입 자유·선지선택0회로 정답보기 가능. no disclosure/hint/answer와 access 조합·outline·대본·음성·소거·ARIA 누출,건너뛰기/재방문/누적소거/동의취소. 정상 인증/RLS 실기 별도. |
| 2 F07 상태 | 개선 브랜치의 `AnalysisTheater.tsx`, `LectureStage.tsx`, `theater.module.css` diff 채택 여부 평가 | 자동scene0,수동scene/근거/본문click/player독립,시작/재개 follow암묵재설정0,닫힌details 유지,Space/Tab/scrollbar,pause/end/offer focus/낭독. 최신 SHA를 AnalysisTheater 장착 하네스와 실계정E2E로 검증. |
| 3 F01·F03 | `InquiryV3Panels.tsx`, `AnalysisTheater.tsx`, `meaning-support/model.ts`, `align.ts` 및 필요한 원문 패널 연결 | Ideally/If/cannot be 등록범위 대조,UNREGISTERED·HELD·MISMATCH 구별,왕복exact상태·focus복원,hash없는문장번호단독highlight금지. |
| 4 F04·F05 | `InquiryV3Panels.tsx` 판단 영역 대체/원리 조작,필요 데이터 DTO | ①/③ 완성명제/공식선지 구별·동시비교,② unknown/fails,조건/한계basis·실제근거,없는반례생성0,22/38회귀. |
| 5 회귀·노출 후 활동 | `map-return.ts`, `system-learning.ts`, 기존 기록/reveal/task 경로(구조 조사 후 변경 여부 결정), 관련 기존 테스트 | 지도/Workspace 유효복귀·stale문맥 폐기,check=1 유지,explanation 후 수행≠independent/mastery. 저장 스키마 변경 필요 시 별도 SQL 승인. |
| 6 F08 실비교 | 기존 두 격리 작업면 또는 승인된 최소 제품 스파이크 | 기존 v1.0 사전 절차 그대로 실제PDF/키보드/동시대조/왕복/강의 조건을 동일하게 비교. 단독승자 근거없으면 미선정. |

제품 구현 때 변경 대상 하위 지시·문서 동반 갱신(LEARNING_MODEL/MODULES/공개·강의 계약)도 영향 범위에 포함한다. 새 API/새 프레임워크/DB 컬럼을 필요한 증거 없이 선결정하지 않는다. 보존된 R2 명세를 전체 덮어쓰지 않고 수용된 차이만 후속 버전으로 반영한다.

## 9. 다른 작업자와의 충돌

현재 문서 작업은 `docs/csat-learner/g3-transfer-20261024/`와 CHANGELOG만 소유한다. T-0136 원 명세·연구 디렉터리·다른 worktree·제품 파일·잠금은 수정하지 않는다. 향후 이관은 강의 개선 브랜치의 **AnalysisTheater/LectureStage/CSS 및 테스트**와 겹친다. 해당 SHA와 작업자의 후속 변경을 먼저 확인하고 동일 파일의 동시 쓰기를 피해야 한다. main으로 이미 들어왔는지 재확인한 뒤 남은 diff만 적용한다. 이번에 merge/cherry-pick/다른 브랜치 잠금 해제는 하지 않는다.

로컬 브랜치의 제품 대상 경로 delta와 등록 소유권은 SOURCE_INDEX의 충돌 관측을 참조한다. 오래된 브랜치 diff·clean worktree·프로세스 존재만으로 편집 중/종료를 단정하지 않는다. 공통 Git 이력이 없는 AI-Control 브랜치는 제품 merge-base 비교 대상이 아니며 `NO_COMMON_HISTORY`로 기록한다. 공유 문서 CHANGELOG는 자기 줄만 커밋하고 커밋 직전 다른 세션 변경을 재확인한다.

착수 관측에서는 로컬294브랜치 중 공통 이력 없는5개를 분리했고, 지정 제품8경로의 분기 후 delta가 있는 후보21개를 찾았다. 이는 활성 작업21건이라는 뜻이 아니다. 직접 강의 파일과 겹치는 최신 후보는 `feat/lecture-learner-control`, 오래된 `integrate/csat-on-replica`도 AnalysisTheater 변경을 가진다. CSS·대본/API 변경을 가진 이전 브랜치의 delta도 충돌 후보로 보존한다. 등록 owner 목록에서 이관 worktree의 `csat-v4-s0`만 확인되었지만, 강의 worktree에 등록 owner가 없다는 사실을 쓰기 허가로 해석하지 않는다.

연구16의 간접 암시 설명에는 첫1~2cue라는 본문과 표의 합계가 맞지 않는다(45+61=106,116은 세 번째10개까지 포함). 전수/표본을 재판정하지 않았으며 이 잘못된 요약 수치를 공개 계약 근거로 재사용하지 않는다. 이번34는 실제12cue를 별도로 위험 후보 분류했다.

## 10. 제한적 착수 범위와 남은 판정

이번에 확정하는 것은 **구현 전 수정 사항과 검증 계약**이다. 독립 검증 후 별도 승인된 좁은 제품 구현은 (a) 데이터/노출 결속과 안전한 상태 분리, (b) 검증된 강의 diff의 남은 수동제어 보완, (c) 정답 공개 후34의5기능 상호작용 이관 순으로 검토할 수 있다. 안전한 근거 우선/강의 우선은 공개 위험 태깅·전 채널 관문 없이는 완료할 수 없다. 콘텐츠 감수·실계정·PDF 검증이 필요한 부분은 기능 완성 판정에서 분리한다.

**현재 제품 구현 착수 승인 아님.** 이번 변경은 차이분석만이며 main 통합/S2 전체 착수/S1 전체 제품 수용을 승인하지 않는다. D1 A ACCEPT, C1 콘텐츠 B NOT_APPROVED, D2 ACCEPT, F08 UNDETERMINED,34 이관 설계 ACCEPT·제품 미완료를 유지한다. 이번 추가 계약 자체도 고정 커밋의 별도 Claude 검증 전까지 작성자 제안이다. 실제 학습 효과는 미검증이다.
