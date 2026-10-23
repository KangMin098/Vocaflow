# S0 → S1 최소 연결 계획 및 CORE/AT 매핑

측정: 2026-10-23T12:08:29.06415+00:00 / 기준 소스: `3f437e9b65e06c00a96f64890402500417377c92` / AI-Control: T-0131의 보완 실사.

원문·선지 전문·개인 학습기록은 저장하지 않았다. DB 관리자 SELECT의 관측이며 계정별 접근 가능성은 별도다. 분류의 내용 타당성·전체 기출의 완전성·학생 효과를 입증하지 않는다.

## CORE-01~12

| CORE | 현재 코드 근거 | 판정 | 최소 변경/확인 |
| --- | --- | --- | --- |
| 01 | inquiry/labels.ts; InquiryV3Panels.tsx; meaning-support/data.ts | 이미 가능(부분) + 자료 부족 | official/source_observation/design_hypothesis 및 bridging_inference가 있다. 공식 PDF·정답 출처 전수 대조는 미실시. |
| 02 | SystemLearningSummary.tsx; UnderstandingChecks.tsx | 이미 가능(부분) | 근거 선택/조건 전환과 설명 후 확인이 존재. 클릭을 독립 성취로 변환하지 않는지 지도 기록 흐름을 추가 검증. |
| 03 | AnalysisTheater.tsx:652,846; inquiry/scenes.ts | 신규 구현 + 충돌 | 자유 장면 이동은 있으나 재생 중 liveScene이 selectScene을 호출해 자동 전환한다. 3진입 경로·공개 선택 유지가 필요. |
| 04 | AnalysisTheater.tsx:1237; MeaningSupportPanel.tsx | 신규 구현 | 현재 v3 판정과 기존 정답·오답 블록이 중복될 수 있다. 첫 화면 질문/한정·깊이 조합을 재구성. |
| 05 | teaching-contract.ts#TEACHING_MODELS; SceneDiagrams.tsx | 이미 가능(교수 모델) + 신규 구현 | 26개 기존 교수 모델의 근거 단위/관계/시각 자료 조건을 재사용. 듣기 모델·유형별 scene 조합은 추가. |
| 06 | reveal-gate.ts; embargo-gate.ts; lecture/route.ts | 신규 구현 + 검증 미실시 | 수집 보류 gate와 학생 선택 reveal/depth 매트릭스는 다른 책임. 정답 직접/간접/TTS/ARIA 위험 어댑터 필요. |
| 07 | inquiry/data.ts; meaning-support/data.ts; inquiry/compare-v3.ts | 이미 가능(부분) | 기존 ready/stale, schema/hash/review, 상대 공개/결속을 합치지 않고 독립 상태로 노출. 로컬 PDF/계정 검증은 미실시. |
| 08 | session/store.ts; learning-session.ts; map-return.ts; map/v4 | 검증 미실시 + 신규 어댑터 | 활동/도움/확인/독립 증거 분리 가능 경로를 연결. 현재 학습지도 성공·재계획 부작용 0은 이번 S0가 입증하지 않음. |
| 09 | lecture/{store,player,tts,types}.ts; LectureStage.tsx | 이미 가능(부분) + 신규 구현 | 읽기/TTS/무음과 cue/target/focus 존재. cue revision/공개 위험·독립 결속/실패 시 상태 유지 실증 추가. |
| 10 | app/(app)/csat/item/[slug]/page.tsx; ItemPaper.tsx | 이미 가능(Shell) + 검증 미실시 | 단일 라우트 재사용. 정상 로그인 1280/1440, 키보드·실제 포커스·한 상세 검증 필요. |
| 11 | reflow/types.ts; read-paper.ts; skeleton.ts; DB RLS/ACL | 이미 가능(정적 근거) + 검증 미실시 | 브라우저 로컬 PDF·private source 경계·학평 골격 cache 분리 보존. 정상 계정 RLS 검증 실패를 PASS로 바꾸지 않음. |
| 12 | 기준서 G0~G4; 본 GAP_REGISTER | 검증 미실시 | 콘텐츠/제품/사용성/전이·성적 각각 분리. G3/G4 NOT_EVALUATED. |

## AT01~20

| AT | 현재 근거 | S0 상태 | 후속 테스트 |
| --- | --- | --- | --- |
| 01 | inquiry labels / meaning-support/data.ts | 부분 가능 | 공식/관찰/추론/가설·부재 원문 조각을 구분하는 출력 회귀 |
| 02 | teaching-contract.test.ts; meaning-support/model.test.ts | 25개 범위 관련 통과 / 추가 필요 | 0↔1 번호 변환·삽입 슬롯 별도 타입, 분석/강의 version 독립 |
| 03 | AnalysisTheater.tsx:1237~1266 | 신규 구현 | 첫 화면 질문 하나·필수 한정·연결 근거, 중복 10블록 기본 노출 방지 |
| 04 | AnalysisTheater.tsx:846 | 충돌 / 신규 구현 | 3경로 즉시 진입·강제 순서/자동 scene 전환 없음 |
| 05 | lecture-data/2026.json; reveal-gate.ts | 신규 구현 / 미검증 | H0×심화/TTS/ARIA/관계선 직접·간접 위험, H3 즉시 허용 |
| 06 | inquiry-data.json#/items/2026#34 | 자료 있음 / 원문 미검증 | Ideally+If+cannot be 전체 명제 |
| 07 | 동일 v3 choices[1] | 자료 있음 | ② unknown/not_established와 requirement_fit fails 분리 |
| 08 | inquiry-data.json#/items/2026#22 | 자료 있음 | ③ 부분 사실, Often/may/might 보존 |
| 09 | inquiry-data.json#/items/2026#38; teaching-contract.ts | 부분 자료 / 내용 대조 필요 | these 넓은 맥락·앞뒤 접합·기존6→7·위치 타입 |
| 10 | REPRESENTATIVE_EDGE_CASES 37행 | S0 메타 확인 / 실제 동작 미검증 | 원본 hash 불변·37 cue ID/target·추정 시간·수정 후보 분리 |
| 11 | LectureStage.tsx; lecture/player.ts | 미검증 | TTS 실패/모드 변경/직접 탐색 후 선택·스크롤·포커스 유지 |
| 12 | meaning-support/data.ts; compare-v3.test.ts | 부분 통과 / 통합 추가 | PDF·hash·의미·anchor·permission 각 결손만 제한 |
| 13 | page.tsx:181~202; compare-v3.test.ts(6) | 부분 통과 / 실계정 미검증 | 34 pairs0·held/missing/changed 제외·비공개 본문 미전송 |
| 14 | map-return.ts; session/store.ts; map/v4 | 미검증 | 클릭/종료/강의/설명 후 확인이 TASK 성공·숙달·재계획을 바꾸지 않음 |
| 15 | 단일 item route; 이전 54 격리 캡처 | 미검증 | 정상 로그인1280/1440·키보드·포커스·비색상 상태·44px 목표 |
| 16 | TYPE_REGISTRY 듣기 248 메타 | 자료 부족 | 평가 원음≠TTS, 출처·전사·화자·구간 없을 때 생성하지 않음 |
| 17 | TYPE_REGISTRY; ITEM_METADATA.json | S0 메타 확인 | 3714=3698+16, 로컬630 별도/듣기248·18유형, 공인 완전 분류 단정 없음 |
| 18 | GAP_AND_ASSUMPTION_REGISTER | S0 보고 범위 확인 | G3/G4 NOT_EVALUATED와 콘텐츠/UI/학생 효과 분리 |
| 19 | READINESS_MATRIX; measuredAt | S0 메타 확인 | 과거 묶음 수치와 새 SQL 관측 시각·분모 구분 |
| 20 | 아래 역할 반증 시나리오 | 시나리오 작성 / 실제 역할 실험 미실시 | L1/L2/T/E/A/C/U/D/P/G 각각 반례1개 이상 |

## 최소 구현 순서(이 S0에서 구현하지 않음)

1. 기존 교수 모델·ID/인덱스 타입·returnContext를 읽는 순수 어댑터. 저장 schema/원본은 변경하지 않는다.
2. 자원별 readiness/review/permission/pdfMatch·분석 version·강의 version을 분리. 최신 미발행 판 때문에 유효 published를 무조건 stale로 만들지 않는다.
3. 학생 선택 depth/reveal/lectureMode를 모델링하고 cue·ARIA·관계선의 실제 위험을 별도 검수한다. 기존 embargo gate와 서버 projection을 재사용한다.
4. 자유 장면 선택과 기존 강의 재생 중 자동 scene 전환의 충돌을 제거하는 최소 상태 제어를 구현한다.
5. 34 한 문항에서 조건/완성 명제/대표 오답 대조/도움 피드백을 연결하고 지정 6 cue 후보를 별도 revision으로 수동 감수한다. 강의 원본은 보존한다.
6. 22/38에서 중심성·부분 사실 / 앞뒤 접합·기존 연결의 고유 모델로 반증. 도표 셀·읽기 장문·듣기를 같은 문장 막대로 강제하지 않는다.
7. 학습지도/Workspace 진입·복귀 및 activity-only 이벤트 어댑터를 연결하고 숙달 부작용 회귀를 수행한다.
8. 정상 로그인/RLS·PDF·TTS·1280/1440/키보드 실증 후에만 G2 결과를 보고한다. 학생 사용성·전이는 별도 G3/G4.

비교는 이미 서버에서 상대 공개 집합·현재 결속을 필터링한다. 정적 JSON import만 보고 신규 비교 공개 DB 필드를 필수 선행으로 제안하지 않는다. 듣기/네모 어법 신규 시드가 필요한지도 실제 자료와 기존 분류 변형을 더 확인한 뒤 SQL 승인 대상으로 제안한다.

## 역할별 반증 시나리오(실제 역할 시험 아님)

| 역할 | 거부 반례/검증 질문 |
| --- | --- |
| L1 초보 | 첫 화면을 열었을 때 질문/한정 대신 해설 10블록이 먼저 보이는가? |
| L2 숙련 | 원하는 장면·강의로 즉시 건너갈 수 있고 강제 퀴즈가 없는가? |
| T 교사 | If/Ideally/may를 빼면 뜻이 바뀌는 오해가 피드백에 남는가? |
| E 강사 | 표지어 개수·위치만으로 정답을 단정하는 요령을 가르치는가? |
| A 평가 | 추론/가설을 공식 출제 의도로 확정 표기하는가? |
| C 학습과학 | 설명 후 확인을 실패로 취급하거나 클릭을 숙달로 올리는가? |
| U 접근성 | 키보드로 선택/복귀 가능한가, TTS 실패가 포커스를 빼앗는가? |
| D 데이터 | 원문/PDF/선지 없는 곳에 가짜 근거를 채우는가? |
| P 보안/개발 | held 비교 본문이 응답에 포함되거나 활동으로 TASK 성공이 변하는가? |
| G 보호자 | 강의 완주를 성적/전이 효과 입증으로 홍보하는가? |
