# S1 잔여 보완 — 44유형 대응표 · 34 cue 공개 × 강의 제어 · S2-a~d 소유·착수·AT

AI-Control **T-0141**(T-0138 후속) · owner `csat-s1-integration` · DRAFT — 독립 검증 전.
T-0138(@`102245ee9`, ACCEPT·COMPLETED, 설계 범위)의 01~05는 다시 쓰지 않는다. 이 문서는 수용 범위 밖으로 남은 누락·충돌만 보완한다.
확정 근거: T-0136 · T-0137(G3 @`fb6bf663e`) · T-0138 · T-0139(G1 @`810a463ac`) 공식 수용분. G1 연구 브랜치의 `810a463ac` 이후 로컬 커밋(`fbd804e5c`·`37f8b7219`·`613215067`, 원격 미보존)은 **미수용 참고**로만 언급한다.

## 1. 44유형 근거·판단 행동·피드백·강의 준비도 대응표

열 정의
- **근거 단위**: 01 F2의 `EvidenceRef.kind` 기준(문장·삽입 위치·밑줄·표 셀·실용문 항목·발화 턴·시간 구간).
- **판단 행동**: 02 §3 도구(닫힌 선택만, 자유서술 채점 없음).
- **피드백**: 01 D 축. 진위 3값은 대의·빈칸·함축에만.
- **강의 준비도**: 대본 강의 수(`lecture-data/index.json`@main) · cue 수 · 누적 UNKNOWN cue 수 · 지역 DECISIVE/ANSWER cue 수(sidecar-reviewed@`810a463ac`, 지역 UNKNOWN은 정답 확정 이후 미검수 cue를 포함하므로 여기 싣지 않음) · 자동 경계 이전 조기 공개 후보(05 §2). 모든 강의는 제품 공개 게이트 미구현 → **강의 결합은 05 §3 계약 구현 전까지 불가**.
- **데이터**: 02 §1 · R08 · R12 §2 인용.

### 1.1 독해 active 22

| type | 근거 단위 | 판단 행동 | 피드백 | 강의 준비도(강의/cue/누적UNK/지역D·A/조기) | 데이터 |
|---|---|---|---|---|---|
| R-PURPOSE | 문장(화행) | T-ROLE: 요청·행동 요구 문장 지목 → 선지 동사 대조 | D1 진위×발문 | 27 / 351 / 24 / 31 / 0 | 있음 |
| R-MOOD | 문장 구역(전환점 앞/뒤)·단서 구절 | T-TURN: 전환점 지목 → 전·후 단서 → 선지 두 칸 대조 | 칸별 일치/불일치(D1 아님) · 하위형 3종 분리 | 28 / 370 / 19 / 28 / 1 | 원문·선지·정답 있음, 전환점·단서 span 0(DATA_GAP), 의미층 0 |
| R-CLAIM | 문장(당위·판단) | T-ROLE | D1 | 23 / 316 / 33 / 26 / 1 | 학평 75 공개 분석 없음 |
| R-GIST | 문장 역할(정의·진단·처방) | T-ROLE | D1(부분 사실 ↔ 요지) | 29 / 377 / 24 / 36 / 2 | 있음 |
| R-TOPIC | 문장 역할 | T-ROLE | D1 | 29 / 377 / 44 / 46 / 1 | 있음 |
| R-TITLE | 문장 역할 + 은유 칸 | T-ROLE | D1 + 압축·은유 | 31 / 405 / 45 / 46 / 2 | 있음 |
| R-IMPLY | 밑줄 + 문장 | T-PROP(비유→원관념) | D1 | 22 / 291 / 7 / 24 / 0 | 표본 얕음 |
| R-BLANK | 빈칸 문장 + 조건 문장 | T-PROP: 두 선지 완성 명제 동시 대조 | D1 3값(34② unknown) + D5 | 115 / 1,459 / 95 / 184 / 1 | bodyOK 354/527 |
| R-IRRELEVANT | 문장(①~⑤ 표지) | T-AXIS: 축 유지/이탈 | 축 유지 판정(D1·D2 아님) | 28 / 358 / 20 / 50 / **9** | 표본 1(R07 §4: 2026#35) |
| R-ORDER | 단락 블록 (A)(B)(C) | T-SEAM: 모든 이음매 변수 | D2 | 55 / 732 / 90 / 80 / **7** | 있음 |
| R-INSERT | 문장 + 삽입 위치(별도 타입) | T-SEAM: 위치별 이음매 3칸 | D2(진위 n_a) | 56 / 675 / 54 / 64 / 0 | 2026#38 choices 혼입·⑤ 해설 C1 보류 |
| R-CHART | 표 셀·계열 | T-CELL | D3 + 계산 | 29 / 341 / 8 / 40 / 0 | **도표 수치·이미지 0 → BLOCKED_EVIDENCE** |
| R-FACT | 문장 성분 | T-SLOT | D3 | 28 / 334 / 33 / 34 / 0 | 선지↔근거 정렬 0 |
| R-NOTICE | 실용문 항목 | T-SLOT(허용/금지) | D3 | 57 / 699 / 28 / 80 / **8** | 표 평탄화 |
| R-GRAMMAR | 밑줄(구조 자리) | T-FORM | D4 구조 요구 | 28 / 338 / 14 / 31 / 2 | 밑줄 경계 미보존(PARTIAL) · 네모 어법 미분류 4 |
| R-VOCAB | 밑줄 낱말 | T-FORM(극성) | D4 문맥 극성 | 29 / 370 / 29 / 32 / 0 | 밑줄 낱말 추출 보강 |
| R-SUMMARY | (A)(B) 요약 칸 + 문장 | T-PROP 변형: 칸별 원문 성분 | D1 + 극성 결합 | 28 / 350 / 22 / 31 / 0 | **bodyOK 29/130** |
| X-TITLE | 공유 장문 + 문장 역할 | T-ROLE | D1 | 28 / 369 / 23 / 38 / 0 | 세트 묶음 키 NOT_VERIFIED |
| X-VOCAB | 공유 장문 + 밑줄 | T-FORM | D4 | 22 / 286 / 27 / 25 / 0 | 밑줄 추출 |
| X-ORDER | 공유 장문 블록 | T-SEAM(사건) | D2 | 29 / 381 / 50 / 32 / 0 | 공통화 근거 없음(UNDETERMINED) |
| X-REFER | 공유 장문 + 지칭 밑줄 | T-TRACK | 인물 일치/불일치 | 29 / 375 / 19 / 43 / 0 | 표본 얕음 |
| X-FACT | 공유 장문 성분 | T-SLOT | D3 | 29 / 354 / 24 / 31 / 0 | 정렬 0 |

### 1.2 retired 4

R-BLANK2(4/53/1/5/0) · R-REFER(6/80/2/6/0) · X-BLANK(6/77/4/9/0) · X-BLANK2(1/13/0/1/0): 매트릭스 행만 보관. 현행 출제 아님. 흡수 여부 UNDETERMINED(03 Q6).

### 1.3 듣기 18 (DB 미적재 · 교수 모델 0 · 강의 0)

| 묶음 | 유형 | 근거 단위 | 판단 행동(설계, R09) | 피드백 | 강의 준비도 | 데이터 |
|---|---|---|---|---|---|---|
| F1 담화 핵심 | L-PURPOSE · L-OPINION · L-MAIN · L-TOPIC | 발화 턴 + 시간 구간 | T-LISTEN: 1차 청취(전사 숨김) → 결정 턴 지목 → 표적 재청취 → 전사 대조 | 지각 실패 / 판단 실패 분리 | 강의 0 | 원음·권리·선지·정답 0 → BLOCKED_EVIDENCE |
| F2 사실 대조 | L-NOTMENTION · L-MENTIONED · L-ANNOUNCE | 턴 + 시간 | T-LISTEN + 성분 대조 | D3(청취판) | 0 | 동일 |
| F3 세트 | L-SET-TOPIC · L-SET-NOT | 공유 오디오 구간 | 공유 담화 이중 과제 | F1/F2 | 0 | 동일 |
| F4 대화 상태 | L-RELATION · L-TODO · L-FAVOR · L-REASON | 화자 + 턴 | 상태 추적(듣기 고유) | 화자·시점 일치 | 0 | 동일 |
| F5 매체 교차 | L-PICTURE · L-TABLE · L-MONEY | 턴 + 이미지/표 셀 | 발화↔그림/표, 계산 | D3 + 계산 | 0 | 이미지 0 |
| F6 화행 응답 | L-RESPONSE · L-SITUATION | 직전 턴 | 응답 적합 | 화행 적합 | 0 | 동일 |

판단 행동·피드백은 R09 설계 인용이며 실제 문항·원음이 없어 검증되지 않았다. 전사 272는 있으나 검수·권리 미확인. 이 공백을 추정 콘텐츠로 채우지 않는다.

### 1.4 누락 판단 기능 점검 결과

- 44유형 모두 근거 단위·판단 도구·피드백 축이 지정됨. 공통 축 밖 고유 기능(R-MOOD 전환점, R-IMPLY 비유 대응, R-CHART 계산, X-REFER 인물 추적, R-SUMMARY 극성 결합, R-IRRELEVANT 축 유지, 듣기 F3·F4·F6)은 02 §3 도구로 각각 대응.
- **새로 확인한 누락:** 조기 공개 후보 34개가 R-IRRELEVANT(9) · R-NOTICE(8) · R-ORDER(7)에 몰려 있다. 이 세 유형은 "한 cue 소거 완결"·"역할 순서 낭독"·"정답 속성 진술"이 대본 관행으로 반복되므로, 강의 결합 시 유형 단위 사전 감사가 필요하다(S2-c ② 우선순위).

## 2. 34번 cue 공개 게이트 × 강의 학습자 제어 충돌 점검

### 2.1 2026-34 cue 값 (sidecar-reviewed@`810a463ac`)

| cue | 지역 | 누적 | 검토 | 게이트 처리(05 §3) |
|---|---|---|---|---|
| c1 | HINT | HINT | 2인 합의 | HINT 동의 필요. 단 G3는 "부정어 뒤 빈칸 = 거부 견해" 답 성질 선언으로 암시 위험을 지적 → HINT 동의로 제공하되 내용 감수 대기 |
| c2 | HINT | HINT | 2인 합의 | HINT |
| c3 | UNKNOWN | HINT | **불일치** | **UNKNOWN fail-closed** — 정답 확정 가능 안내 + 해당 동의 전 미제공 |
| c4 | ANSWER | ANSWER | 자동 확정 | OFFICIAL_ANSWER |
| c5 | UNKNOWN | ANSWER | 미검수 | OFFICIAL_ANSWER(누적) |
| c6~c9 | HINT | ANSWER | 자동 확정 | 순서 재생 시 누적 ANSWER. **c4를 건너뛰고 c6~c9만 들어도 4개 소거로 정답 확정** → 런타임 소거 집합으로 DECISIVE 이상 |
| c10~c12 | UNKNOWN | ANSWER | 미검수 | OFFICIAL_ANSWER(누적) · c11 어휘도 정답 핵심어를 다뤄 안전 단정 불가(G3) |

결론: 2026-34 강의에서 OFFICIAL_ANSWER 동의 없이 제공할 수 있는 범위는 **c1·c2(HINT 동의 시)**뿐이다. c3부터는 미검수·불일치·확정 공개 구간이다. 이는 "B 정답 직접 안내 전까지 듣기"(05 §4)가 34번에서는 두 cue로 끝난다는 뜻이다.

### 2.2 사건별 충돌과 해결 규칙

| 사건 | 공개 게이트 요구 | 강의 제어 요구(01 C2, G3 §5) | 충돌 | 해결 규칙 |
|---|---|---|---|---|
| 재생 중 다음 cue가 게이트 대상 | 동의 전 재생 금지 | viewer(장면·선택·스크롤·focus·닫힌 details) 불변 | 게이트 안내가 화면 이동·포커스를 가져가면 충돌 | 게이트는 **player만 정지**하고 안내는 강의 바(고정 위치)에 표시. viewer 상태 변경 0, 포커스는 학습자가 안내로 이동할 때만 |
| 따라가기 켜짐 + 게이트 대상 cue | target 위치·강조·역할 라벨도 노출 채널 | 따라가기는 현재 설명 위치로 이동 | 이동 자체가 target(예: `analysis:answer`)을 드러냄 | 동의 전에는 **따라가기 이동 보류**(현재 위치 유지), 동의 후에만 이동. 따라가기 상태는 유지 |
| 장면 안내 단추("그 장면 보기") | 게이트 cue의 장면 이름·역할도 채널 | 단추를 눌러야만 이동 | 단추 라벨이 "정답 근거" 장면을 암시 | 게이트 미통과 cue의 장면 안내 라벨은 중립 문구(예: "다음 설명 위치")로 투영 |
| 학습자가 cue 목록에서 직접 선택 / prev·next·jump | 모든 진입이 같은 게이트 통과, 런타임 누적 기준 | 명시적 cue 재생 명령만 cue 이동 | 직접 선택으로 게이트 우회 가능 | jump 경로도 게이트 함수 통과. 거절 시 cue 이동 없음 |
| 본문 블록 클릭 | — | 본문 클릭은 cue를 이동시키지 않음(G3) | 현 개선 브랜치는 click→jump(게이트 우회 경로) | **click→jump 제거**가 게이트의 전제 조건(S2-a 보완 항목) |
| 건너뛰기 선택 | 다음 cue도 런타임 누적으로 재판정 | 건너뛰기는 viewer 불변 | 건너뛴 뒤 남은 소거 cue 조합이 정답 확정 | 건너뛴 cue는 노출 이력에 넣지 않되, 이후 cue의 소거 집합은 실제 노출분으로 계산 |
| 학습자가 following 중 details를 닫음 | — | 이후 cue가 다시 열지 않음 | 개선 브랜치는 following 중 재열림 | 닫힘 기억(S2-a 보완). 게이트와 무관하게 선행 |
| READ / SILENT / OFF 전환 | READ 텍스트·강조·ARIA도 같은 상한 | 매체 전환은 viewer 불변 | SILENT에서도 강조·대본 탭으로 노출 가능 | 매체와 무관하게 게이트 동일 적용, OFF는 매체만 취소 |
| TTS 실패 → READ 대체 | 같은 공개 수준만 | 위치 불변 | 대체 텍스트가 상한 초과 가능 | 대체도 게이트 통과분만 |
| 동의 후 화면 공개 단계를 낮춤 | 노출 이력 단조 | — | — | 이력 유지, 이후 응답은 independent_attempt 아님 |

결론: 공개 게이트와 학습자 제어는 **"게이트는 player·노출 채널만, 제어는 viewer만 소유"** 로 분리하면 충돌하지 않는다. 단 현 개선 브랜치의 click→jump와 following 중 details 재열림은 게이트를 우회하거나 제어를 깨므로 S2-a에서 먼저 고쳐야 한다.

## 3. S2-a~d 소유·파일 영향·착수 조건·수용 테스트

AT 번호는 v6.0 §10(AT01~AT26). 모든 후보는 사용자 범위 승인 전 착수하지 않는다.

| 후보 | owner | 파일 영향(`apps/web/` 기준) | 착수 조건 | 수용 테스트 | 하지 않는 것 |
|---|---|---|---|---|---|
| **S2-a** 강의 학습자 제어 보완·main 반영 | **미등록 — 지정 필요.** 강의 worktree(`feat/lecture-learner-control`)에 등록 owner 없음(G3 §9). 작성 세션 확인 후 AI-Control owner 등록 | `src/components/csat/lecture/LectureStage.tsx` · `src/components/csat/theater/AnalysisTheater.tsx` · `theater.module.css` · `src/components/csat/__tests__/theater-delivery-guard.test.ts` · `tests/e2e/csat-lecture-learner-control.spec.ts` | ① 보완 4건: start() 암묵 따라가기 제거 · 본문 click→jump 제거 · following 중 닫은 details 재열림 금지 · pickScene 자동 일시정지 분리 ② AnalysisTheater 장착 하네스 ③ 실계정 E2E(계정 비밀번호 필요, 현재 BLOCKED) ④ 독립 재검증 ⑤ 사용자 main 통합 확인 | AT08 · AT12 · AT16 · AT17 · AT18 · AT24 | 공개 게이트 · 대본 수정 |
| **S2-b** 2026-34 공개 후 F01·F03·F04·F05 | **`csat-v4-s0`**(34 이관 설계 owner) 또는 사용자가 지정한 구현 owner. S2-a owner와 같은 파일을 동시 소유하지 않음 | 단계 0: `src/lib/csat/inquiry/data.ts` · `src/lib/csat/meaning-support/data.ts` · `src/lib/csat/learner.ts` · 단계 3·4: `src/components/csat/theater/InquiryV3Panels.tsx` · `AnalysisTheater.tsx` · `src/lib/csat/meaning-support/model.ts` · `src/lib/csat/meaning-support/align.ts` · `src/app/(app)/csat/item/[slug]/page.tsx` | S2-a의 `AnalysisTheater.tsx` 변경이 확정·통합된 뒤 그 위에서 시작 · 화면 상태 6종(01 F4) 동시 · 강의 결합 없음 | AT01 · AT02 · AT03 · AT04 · AT05(22 회귀) · AT06(38 보류 유지) · AT07 · AT09 · AT13 · AT14 · AT15 · AT21 · AT22 · AT24 | F08 배치 확정 · 공개 게이트 · 38번 학습자 노출 |
| **S2-c** 기존 cue sidecar 품질 보완·독립 검수·승인·제한 적용 | 데이터: **`csat-all-types-research`**(sidecar 작성) + 별도 리뷰어. 제품 적용: S2-a owner와 협의해 한 owner | 데이터 단계: 연구 폴더만. 제품 단계: `src/lib/csat/lecture/types.ts` · `src/lib/csat/lecture/store.ts` · `src/app/api/csat/lecture/route.ts` · `src/components/csat/lecture/LectureStage.tsx` · `src/components/csat/lecture/LecturePlayerBar.tsx` | 데이터: `810a463ac` 이후 연구 커밋(sidecar v2 등) 원격 보존·공식 독립 검증 후에만 사용 · 우선 감사 R-IRRELEVANT·R-NOTICE·R-ORDER · 일치율 원비율 판정. 제품: S2-a 통합 후 · S2-b 단계 0(`lecture/types.ts`)과 순서 조정 · 05 §3 계약 + 이 문서 §2.2 규칙 | AT10 · AT11 · AT12 · AT21 · AT22 · AT24 · AT25 | 원본 대본 JSON 키 추가(필수 아님) · 대본 문구 수정 |
| **S2-d** 유형 준비도 SELECT 정례화 | **`csat-s1-integration`**(읽기 전용 보고) | 제품 파일 없음. AI-Control 또는 이 문서 폴더의 보고 산출물 | 없음(DB SELECT만) | AT13 · AT23 · AT24 | DB 쓰기 |

파일 겹침 순서: **S2-a → S2-b(AnalysisTheater) → S2-c 제품 단계(LectureStage·lecture/types)**. S2-b 단계 0과 S2-c 제품 단계는 `lecture/types.ts`가 겹치므로 같은 owner가 순서대로 하거나 S2-c를 S2-b 단계 0 뒤로 둔다. S2-d는 독립.

## 4. T-0138 리뷰 비차단 지적 처리

| 지적 | 처리 |
|---|---|
| 01의 "R00~R19 해시는 README" 약칭이 README의 커밋 결속과 어긋남 | 01 근거 표기를 커밋 결속으로 정정 |
| 02 G4의 R-IRRELEVANT 사례 `M2706#35류` 추적성 | 02 §4를 R07이 분석한 `2026#35`로 정정 |

## 5. 보존 상태와 검증

- 보존: F08 미선정 · C1 콘텐츠 미승인 · F02/F06/F09/F10 BLOCKED_EVIDENCE · T-0136/T-0137/T-0138/T-0139 수용 범위.
- 이번 수치: 강의 수는 main `lecture-data/index.json`, cue 상태는 `810a463ac` 커밋 객체에서 작성자가 집계(누적 UNKNOWN 합계 739로 공식 리뷰 재현값과 일치). 조기 공개 34의 유형 분포는 05 §2 표에서 계수.
- NOT_RUN: 제품 구현·격리 하네스·실계정 HTTP/RLS·실제 TTS·접근성 실기·학습 효과. S1 전체 수용·S2 착수·main 통합 승인 아님.
