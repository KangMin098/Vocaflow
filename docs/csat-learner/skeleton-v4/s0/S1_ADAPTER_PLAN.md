# S0 → S1 입력: 기존 코드 사실 대장과 CORE/AT 대응

측정 2026-10-23 · 기준 소스 `3f437e9b6` · AI-Control T-0131.

**이 문서는 결정 문서가 아니다.** v6.0 기준서 §3.2에 따라 S0는 기존 코드의 **관측 사실**만 적고, REUSE/IMPROVE/REPLACE/NEW 결정은 S1에서 기능별(F01~F10) 4대안 비교로 내린다. 아래 "기존 동작"은 재사용 승인이 아니라 S1 심사의 **REUSE 후보 설명**이다. 코드가 있다·테스트가 통과했다는 사실은 채택 근거가 아니다.

## 1. CORE-01~12 ↔ 관측된 기존 동작

| CORE | 관련 코드(사실) | 관측된 동작 | 관측된 결손·충돌 | 미검증 |
|---|---|---|---|---|
| 01 증거 엄정성 | `inquiry/labels.ts:66` InquiryV3; `InquiryV3Panels.tsx`; `meaning-support/data.ts` | v3 `design.claims[].basis`에 official / source_observation / design_hypothesis, bridging_inference 구분 존재(v3 786 문항 한정) | v3 없는 2,928 문항엔 구분 없음 | 공식 PDF·정답 출처 전수 대조 |
| 02 판단 의미 | `reveal-gate.ts`; `SystemLearningSummary.tsx`; `UnderstandingChecks.tsx` | 근거·선지·확신 선택 후 정답 공개 경로, 설명 후 확인 경로 존재 | — | 클릭→성취 변환 여부(지도 기록 흐름) |
| 03 학습자 주도 | `AnalysisTheater.tsx:652,846-852`; `inquiry/scenes.ts` | 장면 직접 이동 가능 | **재생 중 `liveScene` 변화 시 `selectScene(target,'replace')` 자동 호출** — 학습자 장면 소유와 충돌 후보 | 3진입 경로 실동작 |
| 04 정보 밀도 | `AnalysisTheater.tsx:1237-1266`; `MeaningSupportPanel.tsx`; `depth` 파라미터 | depth 파라미터 존재 | v3 판정 블록과 기존 정답·오답 블록 중복 가능 | 첫 화면 블록 수 실측 |
| 05 사고 구조 | `teaching-contract.ts:51` `TEACHING_MODELS`(DB 26유형 키, 근거 단위·관계·visual guard); `SceneDiagrams.tsx`; `reflow.ts` INLINE/VISUAL 집합 | 유형별 교수 모델 26개 존재 | 듣기 모델 없음; 26 교수 모델 ≠ DB 26 유형 목록 ≠ 듣기 18 (서로 다른 분류) | 모델별 목표 적합성 |
| 06 공개 안전 | `reveal-gate.ts`; `embargo-gate.ts`(fail-closed, 423); `api/csat/lecture/route.ts`(재생 후 대본 전송); `check=1` | 엠바고·학생 공개 게이트가 별도 책임으로 존재 | cue·관계선·ARIA·TTS 단위 공개 위험 등급 없음; 34 c4 대본에 직접 정답 | 공개 매트릭스 실측 |
| 07 콘텐츠 가용성 | `inquiry/data.ts`; `meaning-support/data.ts`(schema/criteria/contentHash/basePublicHash/analysisVersion 검사); `inquiry/compare-v3.ts`(양쪽 units_hash·analysis_version 결속) ; `page.tsx:181-202` | 비교는 **서버에서** 상대 문항 공개 집합과 held/missing을 판정해 `projectV3Pairs` 결과만 전달 | 자원별 상태가 하나의 독립 4축 표현으로 노출되지는 않음 | 정상 계정 응답에서 비공개 본문 미전송 |
| 08 학습 기록 | `learning-session.ts:15-17`(HelpLevel·Completion); `session/store.ts`; `map-return.ts`; `20261002120000_csat_map.sql` independent_check 승인 게이트 | 도움 수준·완료 종류 구분 존재 | v4 `LearningEvidenceClass` 5분류와의 대응 미정 | 활동이 TASK 성공·숙달을 바꾸지 않는지 |
| 09 강의 | `lecture/{store,player,tts,types}.ts`; `LectureStage.tsx`; `lecture-data/*.json`(schema1, cue `est_sec`, `total_sec_est`) | 읽기/TTS 재생, cue target/focus | schema3 데이터 0, 분석 v5와 미결속, cue revision 필드 없음, 자동 장면 전환(CORE-03) | TTS 실패 시 상태 유지 |
| 10 화면 | `app/(app)/csat/item/[slug]/page.tsx`; `ItemPaper.tsx` | 단일 라우트 | — | 정상 로그인 1280/1440·키보드·포커스 |
| 11 보존 | `reflow/read-paper.ts`(브라우저 로컬, 해시만 전송); `csat_items_public` 컬럼 ACL·answer 엠바고 마스킹; base RLS | 로컬 PDF·서버 비공개 경계 존재 | — | 실계정 RLS(테스트 로그인 실패 AUTH_BLOCKED) |
| 12 효능 주장 | 기준서 G0~G4; GAP_REGISTER | — | — | G3/G4 NOT_EVALUATED |

## 2. AT 대응(v4.0 AT01~20 → v6.0 AT01~26으로 재번호 예정)

v6.0 기준서가 AT를 26개로 다시 정의했다. S0는 v4.0 번호 기준 관련 코드만 기록하고, v6.0 AT의 실행 가능성·결과는 S1 문서에서 다룬다.

| v4.0 AT | 관련 코드/자료(사실) | S0 상태 |
|---|---|---|
| 01 출처 정직성 | inquiry labels, meaning-support/data.ts | 관련 코드 있음 · 테스트 NOT_RUN |
| 02 버전/인덱스 | `teaching-contract.test.ts`, `meaning-support/model.test.ts`(독립 검토자가 순수 3파일 25개 통과 보고) | 부분 · 삽입 위치 전용 타입 없음 |
| 03 첫 화면 | AnalysisTheater.tsx:1237-1266 | NOT_RUN |
| 04 경로 자유 | AnalysisTheater.tsx:846 | 충돌 후보 관측 |
| 05 공개 매트릭스 | lecture-data/2026.json, reveal-gate.ts | 34 c4 direct_answer 관측 · NOT_RUN |
| 06~09 34·22·38 | `inquiry-data.json#/items/2026#{34,22,38}` | 자료 있음 · 원문 PDF 대조 NOT_RUN |
| 10 강의 37 | REPRESENTATIVE_EDGE_CASES 37행 | 메타 확인 |
| 11 재생 장애 | LectureStage.tsx, lecture/player.ts | NOT_RUN |
| 12 자료 결손 | meaning-support/data.ts, compare-v3.test.ts | 부분 |
| 13 비교 | page.tsx:181-202, compare-v3.test.ts | 서버 필터 관측 · 실계정 NOT_VERIFIED |
| 14 학습지도 | map-return.ts, session/store.ts | NOT_RUN |
| 15 PC·접근성 | 단일 라우트, 과거 격리 캡처 54 | NOT_VERIFIED |
| 16 듣기 | 로컬 248 메타 | DATA_GAP(원음·전사) |
| 17 전체 유형 | TYPE_REGISTRY | S0 메타 확인 |
| 18 효과 주장 | GAP_REGISTER | 보고 범위 확인 |
| 19 자료 규모 | READINESS_MATRIX | S0 메타 확인 |
| 20 역할별 반증 | 아래 §3 | 시나리오만, 실행 NOT_RUN |

## 3. S1 심사에 넘길 열린 질문(결정 아님)

- 26 교수 모델을 판단 도구의 기반으로 쓸지(REUSE/IMPROVE), 판단 기능별 도구로 교체할지(REPLACE), 듣기처럼 없는 곳에 새로 만들지(NEW)는 F01~F05·F10 심사에서 정한다.
- 재생 중 자동 `selectScene`은 유지·수정·제거 중 무엇이 학습자 장면 소유(CORE-03, v6.0 D07)를 만족하는지 F07·F08에서 정한다.
- 비교 서버 projection이 v6.0 D08·D12를 충족하는지, 학습 가치 기준이 더 필요한지 F06에서 정한다.
- 강의 schema1 대본을 cue 계약(원본/수정 분리, 공개 위험)으로 감쌀지 다시 저작할지 F07에서 정한다.
- DB 쓰기가 필요해 보이는 항목(듣기 L-* 원장, 네모 어법 유형, 미분류 16 재분류)은 실제 필요가 확인될 때만 SQL을 제안하고 승인을 받는다.

## 4. 역할별 반증 시나리오(실행 안 함)

| 역할 | 거부 반례/검증 질문 |
|---|---|
| L1 초보 | 첫 화면에 질문·한정 대신 해설 블록이 먼저 펼쳐지는가? |
| L2 숙련 | 원하는 장면·강의로 즉시 이동할 수 있고, 재생 중 장면이 저절로 바뀌지 않는가? |
| T 교사 | If/Ideally/may를 빼면 뜻이 바뀌는 피드백이 남는가? |
| E 강사 | 표지어 개수·위치만으로 정답을 정하는 요령을 가르치는가? |
| A 평가 | 추론·가설을 공식 출제 의도로 표기하는가? |
| C 학습과학 | 설명 후 확인을 실패로 취급하거나 클릭을 숙달로 올리는가? |
| U 접근성 | 키보드로 선택·복귀 가능한가, TTS 실패가 포커스를 빼앗는가? |
| D 데이터 | PDF·선지가 없는 곳에 가짜 근거를 채우는가? |
| P 보안/개발 | held 비교 본문이 응답에 섞이거나 활동으로 TASK 성공이 바뀌는가? |
| G 보호자 | 강의 완주를 성적·전이 효과로 표시하는가? |
