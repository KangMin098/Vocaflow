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

현행 출제는 아니지만 문항·강의가 있으므로(합계 강의 17 / cue 223) 다른 유형과 같은 열을 채운다. 근거 단위·판단 정의는 교수 모델 `teaching-contract.ts`(S0 TYPE_REGISTRY, DL-0201 수용분이 인용한 정의)를 따르고, G1에 **상세 연구가 없는 부분은 DATA_GAP**으로 둔다. 흡수(현행 유형 편입) 여부는 정하지 않는다(03 Q6) — 분류·DB 변경 없음.

| type | 근거 단위 | 판단 행동 | 피드백 | 강의 준비도(강의/cue/누적UNK/지역D·A/조기) | 데이터·공백 |
|---|---|---|---|---|---|
| R-BLANK2 | 빈칸 2곳 + 문장 + 선지 쌍 | T-PROP 2칸 변형: 각 빈칸의 독립 제약을 따로 대조 → 선지 쌍이 교집합에서만 성립하는지 | D1 3값을 **칸별**로 + 쌍 성립 | 4 / 53 / 1 / 5 / 0 | 수능 4문항. G1 상세 연구 없음 → 판단 행동·피드백 세부 **DATA_GAP**(교수 모델 정의만) |
| R-REFER | 밑줄 대명사 + 문장 | T-TRACK: 대명사 → 등장 대상·행위자·소유자 연결 | 지칭 대상 일치/불일치(D1 아님) | 6 / 80 / 2 / 6 / 0 | 18문항. 상세 연구 없음 → 세부 **DATA_GAP** |
| X-BLANK | 빈칸 + 공유 장문 단락 + 문장 | T-PROP(장문): 단락 흐름이 요구하는 결론·원리를 완성 명제로 대조 | D1 3값 + D5 | 6 / 77 / 4 / 9 / 0 | 17문항. 상세 연구 없음 → 세부 **DATA_GAP** |
| X-BLANK2 | 빈칸 2곳 + 공유 장문 | T-PROP 2칸(장문) | D1 3값 칸별 + 쌍 성립 | 1 / 13 / 0 / 1 / 0 | 1문항(2017#42 계열). 표본 1 → 판단·피드백 검증 **DATA_GAP** |

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

- 44유형 모두 근거 단위·판단 도구·피드백 축이 지정됨. retired 4는 교수 모델 정의 기반이며 상세 연구가 없는 세부는 DATA_GAP으로 명시(§1.2). 공통 축 밖 고유 기능(R-MOOD 전환점, R-IMPLY 비유 대응, R-CHART 계산, X-REFER 인물 추적, R-SUMMARY 극성 결합, R-IRRELEVANT 축 유지, 듣기 F3·F4·F6)은 02 §3 도구로 각각 대응.
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

결론: 공개 게이트와 학습자 제어는 **"게이트는 player·노출 채널만, 제어는 viewer만 소유"** 로 분리하면 충돌하지 않는다. 단 `0e36138e3` 기준의 click→jump와 following 중 details 재열림은 게이트를 우회하거나 제어를 깨므로 먼저 고쳐야 한다(이후 T-0140 커밋에서 처리 여부는 T-0140 독립 검증 기록을 따른다 — 이 문서는 판정하지 않음).

### 2.3 기존 구현 작업(T-0140)과의 교차 점검 — 충돌 1건

T-0140(owner `csat-lecture-disclosure`, `feat/lecture-learner-control`@`6eb6f3451`, **BLOCKED_AUTH**, 공식 수용 전)은 "정답 직접 안내 전까지" 경로를 자체 경계 데이터 `apps/web/src/lib/csat/lecture/disclosure-data.json`(cue 수·digest·`stopBefore`·`preStopRisk`)로 구현했다. 읽기 전용 대조 결과:

| 문항 | T-0140 경계 | sidecar@810a463ac | 수용 계약(T-0138 05 §3) 대비 |
|---|---|---|---|
| 2026-34 | `stopBefore: 3`(0기준 → c1~c3 재생), `preStopRisk: "hint"` | c3 = 지역 UNKNOWN(검토자 불일치) | **충돌**: UNKNOWN은 안전 구간 아님(fail-closed). c3을 HINT 동의 구간에 포함하면 안 됨 |
| 2014A#30 · 2015#36 · 2025#35 · M2306#35 | 경계 전 포함, `preStopRisk: "decisive_confirmed"` | 조기 DECISIVE(05 §2) | 위험 등급은 표시됨. **DECISIVE는 OFFICIAL_ANSWER 동급 동의**가 필요 — 해당 동의 UX인지는 T-0140 검증 범위 |
| M2109#19 | `stopBefore: 5`, `preStopRisk: "hint"` | 조기 ANSWER c6(index 5) | 정합(경계 이전에서 정지) |

처리: T-0140 파일·데이터는 수정하지 않는다. 이 충돌은 T-0140 owner와 그 독립 검증자에게 전달할 근거로 기록한다(전달 여부는 증거가 생길 때까지 주장하지 않음). S2-c 제품 적용 전 **경계 데이터를 수용 계약(05 §3: UNKNOWN fail-closed, DECISIVE=OFFICIAL_ANSWER 동의)과 맞추는 것**을 착수 조건으로 둔다.

## 3. S2-a~d 소유·파일 영향·착수 조건·수용 테스트

AT 번호는 v6.0 §10(AT01~AT26). 모든 후보는 사용자 범위 승인 전 착수하지 않는다.

| 후보 | owner | 파일 영향(`apps/web/` 기준) | 착수 조건 | 수용 테스트 | 하지 않는 것 |
|---|---|---|---|---|---|
| **S2-a** 강의 학습자 제어 보완·main 반영 | **`csat-lecture-disclosure`**(기존 등록 owner, 2026-10-23T18:39 바인딩, `feat/lecture-learner-control`). 현재 **T-0140**(BLOCKED_AUTH)이 이 범위를 포함 — 새 owner·새 TASK 만들지 않음 | T-0140 허용 경로: `src/components/csat/lecture/` · `src/components/csat/theater/AnalysisTheater.tsx` · `theater.module.css` · `src/components/csat/__tests__/theater-delivery-guard.test.ts` · `src/app/api/csat/lecture/` · `src/app/(app)/csat/item/[slug]/page.tsx` · `src/lib/csat/lecture/` · `src/lib/csat/theater.ts` · e2e 스펙 2 | ① T-0140 실계정 E2E(계정 비밀번호 필요, 현재 BLOCKED_AUTH) ② T-0140 독립 검증 수용 ③ 사용자 main 통합 확인. 보완 4건(start 암묵 따라가기·본문 click→jump·following 중 details 재열림·pickScene 일시정지)의 처리 여부는 T-0140 검증 기록으로 확인 | AT08 · AT12 · AT16 · AT17 · AT18 · AT24 | 이 문서가 T-0140 결과를 판정·수정하지 않음 |
| **S2-b** 2026-34 공개 후 F01·F03·F04·F05 | **`csat-v4-s0`**(34 이관 설계 owner) — 단 **`csat-lecture-disclosure`가 소유한 파일은 T-0140 종료 전 수정하지 않음** | G3 DELTA §8 기준. 단계 0: `src/lib/csat/inquiry/data.ts` · `src/lib/csat/meaning-support/data.ts` · **`src/lib/csat/lecture/types.ts` · `src/lib/csat/lecture/store.ts`** · `src/lib/csat/learner.ts` · 단계 3·4: `src/components/csat/theater/InquiryV3Panels.tsx` · `AnalysisTheater.tsx` · `src/lib/csat/meaning-support/model.ts` · `src/lib/csat/meaning-support/align.ts` · (공개 진입 필요 시) `src/app/(app)/csat/item/[slug]/page.tsx` | 겹치는 파일(`lecture/types.ts` · `lecture/store.ts` · `AnalysisTheater.tsx` · `page.tsx`)은 **T-0140 수용·main 통합 후** 그 위에서, 또는 사용자가 owner 재배치를 승인한 경우만. 겹치지 않는 파일(`inquiry/data.ts` · `meaning-support/*` · `InquiryV3Panels.tsx` · `learner.ts`)은 범위 승인 후 선행 가능. 화면 상태 6종(01 F4) 동시 · 강의 결합 없음 | AT01 · AT02 · AT03 · AT04 · AT05(22 회귀) · AT06(38 보류 유지) · AT07 · AT09 · AT13 · AT14 · AT15 · AT21 · AT22 · AT24 | F08 배치 확정 · 공개 게이트 · 38번 학습자 노출 |
| **S2-c** 기존 cue sidecar 품질 보완·독립 검수·승인·제한 적용 | 데이터: **`csat-all-types-research`**(sidecar 작성 owner) + 작성 미참여 리뷰어. 제품 적용: **`csat-lecture-disclosure`**(강의 공개 경로 구현 owner, 파일 소유자) | 데이터 단계: 연구 폴더만. 제품 단계: T-0140과 같은 강의 파일 + `disclosure-data.json`의 경계 근거를 승인된 sidecar로 대체·대조 | 데이터: `810a463ac` 이후 연구 커밋(sidecar v2 등) 원격 보존·공식 독립 검증 후에만 사용 · 우선 감사 R-IRRELEVANT·R-NOTICE·R-ORDER · 일치율 원비율 판정. 제품: T-0140 종료 후 · **§2.3 충돌(34 c3 UNKNOWN 포함, DECISIVE 동의 등급) 해소** · 05 §3 + §2.2 규칙 | AT10 · AT11 · AT12 · AT21 · AT22 · AT24 · AT25 | 원본 대본 JSON 키 추가(필수 아님) · 대본 문구 수정 |
| **S2-d** 유형 준비도 SELECT 정례화 | **`csat-s1-integration`**(읽기 전용 보고) | 제품 파일 없음. AI-Control 또는 이 문서 폴더의 보고 산출물 | 없음(DB SELECT만) | AT13 · AT23 · AT24 | DB 쓰기 |

파일 소유·순서: 강의 영역(`lecture/` · `AnalysisTheater.tsx` · `page.tsx` · `api/csat/lecture/`)은 **`csat-lecture-disclosure` 단일 소유**(T-0140). 순서는 **T-0140(S2-a 포함) 수용·통합 → S2-b의 겹치는 파일 → S2-c 제품 단계**. S2-b의 겹치지 않는 파일과 S2-c 데이터 단계, S2-d는 서로 독립. 어느 owner도 다른 owner의 진행 중 TASK 파일을 동시에 수정하지 않는다.

## 4. T-0138 리뷰 비차단 지적 처리

| 지적 | 처리 |
|---|---|
| 01의 "R00~R19 해시는 README" 약칭이 README의 커밋 결속과 어긋남 | 01 근거 표기를 커밋 결속으로 정정 |
| 02 G4의 R-IRRELEVANT 사례 `M2706#35류` 추적성 | 02 §4를 R07이 분석한 `2026#35`로 정정 |

## 5. 보존 상태와 검증

- 보존: F08 미선정 · C1 콘텐츠 미승인 · F02/F06/F09/F10 BLOCKED_EVIDENCE · T-0136/T-0137/T-0138/T-0139 수용 범위.
- 이번 수치: 강의 수는 main `lecture-data/index.json`, cue 상태는 `810a463ac` 커밋 객체에서 작성자가 집계(누적 UNKNOWN 합계 739로 공식 리뷰 재현값과 일치). 조기 공개 34의 유형 분포는 05 §2 표에서 계수.
- NOT_RUN: 제품 구현·격리 하네스·실계정 HTTP/RLS·실제 TTS·접근성 실기·학습 효과. S1 전체 수용·S2 착수·main 통합 승인 아님.

## 6. run 2 정정 (반려 `T-0141-codex-review-7d31fde74.md`)

| 지적 | run 1(`7d31fde74`) | run 2 |
|---|---|---|
| T141-01 P1 | retired 4는 수치 튜플과 보관 메모만 | §1.2에 근거 단위·판단 행동·피드백·강의 준비도를 채우고, 상세 연구가 없는 세부는 DATA_GAP으로 명시. 흡수·분류·DB 변경 없음 |
| T141-02 P1 | S2-a owner "미등록", S2-c 제품 owner 미정, S2-b 파일 목록에 `lecture/types.ts`·`store.ts` 누락 | S2-a·S2-c 제품 = 기존 `csat-lecture-disclosure`(T-0140), S2-b = `csat-v4-s0` + G3 §8 단계 0 파일 전부, 겹치는 파일은 T-0140 종료 후 또는 owner 재배치 승인 시만. T-0140·작업자 보존 |
| 추가 발견 | — | §2.3 T-0140 경계 데이터와 수용 계약 충돌(34 c3 UNKNOWN 포함) 기록 — 수정하지 않고 전달 근거로 |
