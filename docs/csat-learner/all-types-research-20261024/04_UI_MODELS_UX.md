# 04 — 교수 모델 · 분석 화면 · 설계 중복/충돌 + UX 연구 (범위 D0-D + H)

- 작성 2026-10-24 · 읽기 전용 조사. 코드 기준: `D:/workspace/Vocaflow-csat-v4-s0` HEAD `9e73d7660`(이하 `s0:`), 메인 저장소 `D:/workspace/Vocaflow` 브랜치 `design/replica-first` HEAD `8cd15b7b6`(이하 `main:`).
- v6.0 = `C:/Users/Administrator/Downloads/Vocaflow_CSAT_5인_최종교차심사_목표우선_통합설계_v6.0_20261023.md`(이하 `v6:`). S1 문서 = `s0:docs/csat-learner/skeleton-v4/s1-v6/`(이하 `S1/`).
- 설계 대상 PC 1280/1440만. 화면은 실행하지 않았다(dev 서버 미기동) — 런타임 관찰은 모두 S1 증거 인용이며 직접 재현은 NOT_VERIFIED.

## 1. EXISTING_SYSTEM_CAPABILITY

### 1.1 26 교수 모델이 코드에서 실제로 하는 일

정의: `s0:apps/web/src/lib/csat/teaching-contract.ts:51` `TEACHING_MODELS`(키 = `csat_items.type_id`, 26개). 각 모델은 **데이터 레코드**(label · units · relation · answerDesign · lureDesign · choiceTruth · visual · passageDesign · pitfalls, `:27-37`)이며 상호작용 컴포넌트가 아니다.

화면 소비처는 `AnalysisTheater.tsx` 한 곳뿐(grep, 테스트 제외):
| 소비 | 위치 | 효과 |
|---|---|---|
| `goal = teachingModelOf(typeId)` | `s0:…/theater/AnalysisTheater.tsx:322` | |
| `task` 장면 「이 문항에서 탐구할 질문」 = `goal.relation` 문장 표시, `visual`이면 경고 | `:1196-1205` | **텍스트 1문장 표시** |
| `principle` 장면 = `goal.relation` 재표시 | `:1300-1316` | 텍스트 |
| 원리 노트 저장(tag=hash(relation), conditions=answerDesign, limit=pitfalls[0]) | `:439-449` | 학습자 노트 데이터 |
| `distractorsAreTrue` → 오답 선지 「내용은 맞음」 표시 분기 | `:1200`, `teaching-contract.ts:307-313` | 선지 진위 라벨 |

**결론:** `units`(근거 단위 9종, `:24`)와 `lureDesign`·`passageDesign`은 화면 상호작용을 바꾸지 않는다(소비 grep 0건 — DATA_GAP: 드레인 프롬프트·검수 측 소비는 범위 밖, 미확인). 즉 26 모델은 "유형별 판단 도구"가 아니라 **문구 + 2개 불리언 분기**다. v6 D06(유형별 도구 조합, `v6:65`)·§5 표(`v6:162-173`)의 "전용 상호작용"은 현재 코드에 대응물이 없다. S1의 "근거 단위 후보로만 쓴다"(`S1/FEATURE_DECISIONS.md:76`)와 정합.

모델 구조 요약(행 번호 `teaching-contract.ts`):
- 공통 GIST 공유 4개: R-GIST·R-TOPIC·R-TITLE·X-TITLE(`:39-49`, 73-77행대) — 실질 동일 모델, 사고 차이 표현 없음.
- choiceTruth=true 7개: R-GRAMMAR·R-VOCAB·X-VOCAB·R-NOTICE·R-FACT·X-FACT·R-CHART(`:150,161,172,260,271,282,293`).
- visual=true 1개: R-CHART(`:294`) — v6 "chart_series/table_cell 별도 준비도 게이트"(S1 FEATURE_DECISIONS:76)의 유일 코드 근거.
- 듣기 유형 모델 **0개**(26개 전부 R-/X-). v6 §5 "듣기 전 유형" 계열(`v6:173`) · AT23 분류 혼동 금지(`v6:288`)와 연결: 교수모델 26 ≠ DB 26유형 ≠ 듣기 18. DATA_GAP: DB type_id 전수와 1:1 대응 여부 미질의.

### 1.2 AnalysisTheater 자동 장면·자동 스크롤 (정확한 코드)

1. **자동 장면 전환** `s0:…/AnalysisTheater.tsx:846-852`
   ```ts
   const liveScene = liveKey ? blocks.find((b) => b.key === liveKey)?.kind : undefined
   useEffect(() => {
     if (lec?.status !== 'playing' || !liveScene || holdLecture.current) return
     const target = sceneOfBlock(liveScene)
     if (target !== scene) selectScene(target, 'replace')
   }, [liveScene, lec?.status])
   ```
   `selectScene`(`:653-670`)은 `stashScene()` 후 장면 교체, `msPick/msChip/msPhrase/msBridge`를 **null로 초기화**, URL `replaceState`. → 재생 중 학습자가 고른 의미 선택·구절이 강의 진행만으로 지워진다(정적 판독; 런타임 NOT_VERIFIED, S1 F07 관측 "정적 반례" `S1/FEATURE_DECISIONS.md:151`).
2. **보호 장치**: `pickScene`(`:940-945`)은 학습자 직접 선택 시 재생을 일시정지, 로딩 중이면 `holdLecture=true`. 즉 "직접 선택 > 자동"은 *장면 클릭*에만 적용되고, 스크롤·근거·선지 탐색은 보호하지 않는다.
3. **자동 스크롤 4곳**
   - 레일 live 칩: `:873` `[cursor]`마다 `scrollIntoView({inline:'center', smooth})`.
   - 강의 대상: `s0:…/lecture/LectureStage.tsx:303` cue마다 `active.scrollIntoView({block:'center'})` — 학습자가 다른 문장을 읽고 있어도 끌어감. reduced-motion이면 smooth만 끔(이동 자체는 유지).
   - 문제지 마크: `s0:…/theater/ItemPaper.tsx:99,102` 마크/하이라이트 바뀔 때 `nearest`.
   - 공개 확정 후 차이 카드: main 판 `main:…/AnalysisTheater.tsx:168`, s0 `:467`(session-done).
4. **키보드**: 전역 `window` keydown ←/→ = 강의 cue 이동(`s0:…:878-` / `main:…:247-258`). INPUT/TEXTAREA/SELECT만 제외 → `role="option"` 목록(V3CompareExplorer `:116`)·라디오에서 화살표가 cue 이동과 충돌할 가능성(정적 추론, NOT_VERIFIED).
5. **포커스**: 강의 진행은 focus()를 호출하지 않음(grep). 포커스 이동은 학습자 동작에서만(InquiryDock `:49`, V3CompareExplorer `:108`, ItemScreen `main:…/session/ItemScreen.tsx:46`). S1 관측 "cue 포커스 불변"(`S1/FEATURE_DECISIONS.md:174`)과 일치.

### 1.3 충돌 판정 (자동 강의 진행 vs 학습자 탐색)

| 소유권 | 현재 | 사용자 규칙/v6 요구 | 판정 |
|---|---|---|---|
| 장면 | 재생 중 자동 교체(1) | 학생이 직접 열고 나감(`v6:136`), 사용자 포커스/스크롤 소유(`v6:156`) | **충돌 P0** |
| 선택 상태 | 자동 교체 시 ms 선택 초기화 | 선택 보존 | **충돌 P0**(판단 행동이 강의에 지워짐) |
| 스크롤 | cue마다 center 이동 | 학습자 소유 | 충돌 P1 |
| 포커스 | 불변 | 불변 | 정합 |
| 진행 계수 | "들은 큐만 센다"(`LectureStage.tsx:306` 주석) | 탐색/클릭 숙달 산입 금지 | DATA_GAP: 들은 큐가 숙달·진단으로 흐르는지 미추적 → P1 확인 필요 |

## 2. DESIGN_COVERAGE — v4/v5/v6 중복·모순

| 주제 | 이전 설계 | v6 / S1 | 관계 |
|---|---|---|---|
| 강의-장면 동기 | `main:docs/csat-learner/analysis-theater.md`(theater 기획, 강의가 블록을 따라감) · 코드 주석 `:845` | v6 §4.4 자동 selectScene=충돌 후보(`v6:156`), S1 F07/F08 REUSE ELIMINATED(`S1/FEATURE_DECISIONS.md:7,153,178`) | **모순** — 기존 문서 갱신 필요(정본 교체 시) |
| 3열 Shell | 기존 theater 3열(레일·문제지·해설) | v6 5요소 Shell(`v6:128-134`), S1 F08 다음 후보 REPLACE(2면)(`:182`) | v6 문구는 "증거면/판단면 자체 스크롤" → 2면 쪽에 기울어 있으나 결정은 selected=null |
| 유형 도구 | teaching-contract 공통 그릇 거부(주석 `:4-8`) — 그러나 화면은 같은 그릇 | v6 D06 공통 Shell+기능별 도구 | 의도 일치, **구현 공백** |
| 단계형 세션 | `main:…/session/SessionRunner.tsx:84,117` 고정 순서(쌍 비교 → 다음, `window.scrollTo(0,0)`) | v6 "장면은 필수 통과 절차 아님"(`v6:136`) | 경로 성격 모순 — 세션 러너가 별도 경로인지 범위 확인 필요(DATA_GAP) |
| 공개 정책 | PredictGate·committed 게이트(`main:…:152-170`) | v6 reveal 4단(`v6:142`) | 중복 — 게이트=reveal 1단계로 흡수 가능, 이름 통일 필요 |
| 44px | DESIGN/AGENTS "44px 미만 금지" | v6 D13·AT17, WCAG 2.5.8 24px(`v6:72,282,318`) | 정합(44는 강화 목표) |
| 접근성 감사 | `main:docs/csat-learner/dissection-accessibility.json` | AT17 | 중복 — 재사용 여부 미확인 |

## 3. UX 연구 (PC 1280/1440)

### 3.1 근거면 + 판단면 동시 탐색
- 1280 기준 가용 폭 ≈1216(좌우 32): 증거면 ≥ 600(영문 지문 60–75자/줄 유지) + 판단면 ≥ 480 + 간격 ≥ 24. 레일/교수 영역을 상시 3열로 두면 증거면이 줄어 줄 길이가 깨짐 → 교수 영역은 판단면 내부 확장 또는 하단 도크로. 1440은 증거면 640–720.
- 두 면 독립 스크롤 + **연결 동작은 스크롤이 아닌 "표시 + 위치 칩"**: 판단면에서 근거를 고르면 증거면은 하이라이트만 하고, 화면 밖이면 "③번 문장 · 아래" 칩을 띄워 학습자가 눌러 이동(자동 스크롤 금지와 근거 추적 양립).
- 선지 비교는 동시에 2개 고정 비교(S1 F04 C안 근거 `S1/FEATURE_DECISIONS.md:90`). 5개 전부 동시 표시는 작업기억 ~4 초과.

### 3.2 초보 vs 숙련
- 초보: 질문 1문장 + 필수 한정을 판단면 상단 고정(F08 IMPROVE/REPLACE 공통), 다음 행동 하나만 강조.
- 숙련: 어디서든 원문/선지/해설 직행(레일 단축키, 단 ←/→ 전역 바인딩은 판단 목록 내부에서 해제).
- 경로 선택(`path=EXPLORE|GUIDED|LECTURE`)은 진입 시 1회 선택 + 상단에서 전환, 기록은 저장하되 숙달 산입 금지.

### 3.3 층 구조 (핵심/근거/심화)
- 핵심 = 질문 + 판단 조작(선택·연결·비교). 근거 = 원문 위치 + 관계 라벨(관찰/추론 출처). 심화 = 원리·한계·강의 대본. 심화는 판단면 안 인라인 확장(팝업 금지), 중첩 깊이 ≤1.
- 텍스트 덤프 회피 검사: 각 장면에 "학습자가 무엇을 고르거나 잇는가"가 데이터 계약 `action`(`v6:148`)으로 존재해야 하고, 없으면 그 장면은 설명 장면으로 분류해 기본 접힘.

### 3.4 접근성
- 키보드: 증거면·판단면·교수 영역을 랜드마크(`region` + aria-label)로, F6/Skip 링크로 면 간 이동. 근거 연결은 클릭 외 Enter/Space 동등, 드래그 대안 필수(AT17).
- 상태는 색 + 텍스트/형태(실선·점선·아이콘+라벨). 정답/오답·관찰/추론 라벨은 ARIA 문구까지 공개정책 감수(`v6:142`).
- 대상 ≥44px(현재 S1 B/C/D 네이티브 버튼 44 관측 `S1/FEATURE_DECISIONS.md:174`; 문장 단위 클릭 대상(인라인 텍스트)은 44 미만 → 문장 번호 버튼 병설 필요).
- reduced-motion: LectureStage는 smooth만 끄고 이동은 유지 — 원칙(낮추기)에는 맞지만 소유권 문제는 별개.

## 4. F08 작업면 IMPROVE vs REPLACE 판정 기준 (사전 결정 없음)

동일 조건: 같은 3문항(2026-22·34·38), 같은 데이터(실제 원문·검수된 v3 근거·같은 선지 집합), 같은 과제 스크립트, 1280×800 / 1440×900, 정상 인증 + 로컬 원문.

| # | 검사 | 측정 방법 | 통과 기준 |
|---|---|---|---|
| C1 | 근거-판단 동시 가시 | 판단 대상 선택 직후 뷰포트 안에 해당 근거 문장과 판단 요소가 함께 보이는 비율 (스크롤 0회) | 3문항 × 모든 근거 연결 중 ≥90% |
| C2 | 소유권 | 재생 중 학습자 스크롤/선택/포커스 후 cue 3개 진행 → scrollTop·선택·activeElement 불변 | 100% 불변 (현행 REUSE는 실패 확정) |
| C3 | 줄 길이 | 증거면 영문 평균 글자/줄 | 55–80 |
| C4 | 가로 넘침 | `scrollWidth - clientWidth` | 0 (S1 관측 ≤1 허용치 재검) |
| C5 | 비교 조작 수 | 선지 2개 비교까지 조작 횟수 | ≤3 |
| C6 | 키보드 완주 | 마우스 없이 질문→근거 연결→선지 비교→원리 열기→복귀 | 완주 + 모든 포커스 가시 |
| C7 | 대상 크기 | 조작 요소 bounding box | 100% ≥44×44 (텍스트 인라인 예외는 대체 버튼 있을 때만) |
| C8 | 중첩 | 열린 오버레이/팝업 최대 깊이 | ≤1 |
| C9 | returnContext | 지도·Workspace·기출 탐색 3진입 왕복 후 장면·선택·스크롤 복원 | 3/3 |
| C10 | 공개 누출 | reveal=SOURCE_ONLY에서 DOM 텍스트·aria·색·아이콘에 정답 신호 | 0 |
| C11 | 유형 확장성 | 22(중심성)·34(완성명제)·38(접합) 각각 전용 판단 도구가 같은 Shell에 들어가는가 | 3/3, Shell 코드 수정 없이 |
| C12 | 회귀 비용 | 기존 AnalysisTheater 테스트·라우트·기록(dissection record) 유지 | IMPROVE는 기존 테스트 PASS 유지, REPLACE는 대체 테스트로 동일 계약 커버 |

판정 규칙: C1·C2·C6·C10 중 하나라도 실패한 안은 탈락. 둘 다 통과하면 C11 → C12(비용) 순. IMPROVE는 **기존 AnalysisTheater를 실제 수정한 구현**으로 측정해야 한다(S1 B는 문서용 새 Shell이라 IMPROVE 증거가 아님, `S1/FEATURE_DECISIONS.md:179`). 학습 효과 우위는 위 측정으로 주장하지 않는다.

## 5. P0 / P1

- **P0-1** 재생 중 자동 `selectScene`(`AnalysisTheater.tsx:846-852`)이 장면과 학습자 선택(ms*)을 교체·초기화 — 판단 행동 소실.
- **P0-2** 26 교수 모델이 화면에선 문구 1문장 + 불리언 2개로만 쓰임 → "유형별 판단 도구"는 미구현. v6 §5를 "기존 모델 재사용"으로 착각하면 텍스트 덤프 화면이 된다.
- **P1-1** LectureStage `:303` cue마다 center 스크롤 · 레일 `:873` 자동 스크롤.
- **P1-2** 전역 ←/→ 바인딩이 listbox/라디오 탐색과 충돌 가능.
- **P1-3** "들은 큐" 계수의 숙달·진단 유입 여부 미확인(DATA_GAP).
- **P1-4** F08 IMPROVE 측 증거가 기존 Shell 수정이 아님 — 비교 불성립.
- **P1-5** 듣기 유형 교수 모델 0, GIST 4유형 동일 모델.

## NOT_VERIFIED / DATA_GAP
- 런타임 동작 직접 재현 없음(S1 증거 인용). DB type_id ↔ 26 모델 대응 미질의. 드레인/검수 측 `units` 소비 미조사. SessionRunner 경로와 v6 Shell의 관계 미확정.
