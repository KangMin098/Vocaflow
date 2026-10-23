# D3 — 교수 모델 26개 목표 적합성 감사

> 연구 산출물(읽기 전용). 작성 Claude 서브에이전트 D3, 2026-10-24. 제품 구현·학습 효과 입증 아님. 판정(REUSE/IMPROVE/REPLACE/NEW)은 확정하지 않고 필요한 증거만 적는다.
> 기준: main `e3e0a6a0e`(이하 `m:`), 연구 `37f8b7219`(04·00·01·03·12·14). 화면 실행 없음 — 모두 정적 판독.
> 평가 기준(사용자 지시 2026-10-23): 학습자의 관찰·선택·근거 추적·비교·조건 조작이 있어야 하며 텍스트 표시·펼치기·다음 클릭은 충족이 아니다.

## 1. 모델 목록 정합성

| 출처 | 개수 | 비고 |
|---|---|---|
| `m:apps/web/src/lib/csat/teaching-contract.ts:51` `TEACHING_MODELS` | **26** (키 grep 26) | R- 19 · X- 7. 04 는 s0 `9e73d7660` 기준이었으나 **main 에도 같은 파일 존재** |
| 01 §3 DB `csat_types` | 26 (active 22 · retired 4: R-BLANK2 · R-REFER · X-BLANK · X-BLANK2) | 키 1:1 — KNOWN(00 §1 f, 01 §1) |
| 00 §2.2 듣기 | 18 유형, 교수 모델 0 | KNOWN(04 P1-5) |

- **D3-01(신규, P3, 문서 정정)**: 01 §1.1 은 「현재 워크트리(design/replica-first)에 teaching-contract.ts 없음」이라 했으나 main `e3e0a6a0e` 에는 있다(`m:…/teaching-contract.ts`, 테스트 `__tests__/teaching-contract.test.ts`). 04 의 코드 판독은 main 에도 적용 가능.
- 차이 없음: 이름·개수 26 = DB 26 = 04 26.

## 2. 모델이 main 화면에서 실제로 하는 일 (공통)

`teachingModelOf`/`distractorsAreTrue` 소비처(테스트 제외 grep):

| 소비 | 위치 | 상호작용 종류 |
|---|---|---|
| task 장면 「탐구할 질문」 = `relation` 1문장, `visual` 경고 1문장 | `m:…/theater/AnalysisTheater.tsx:1196-1208` | **텍스트 표시** |
| principle 장면 `relation` 재표시 | `AnalysisTheater.tsx:1300-1316` | 텍스트 |
| 원리 노트 저장(relation·answerDesign·pitfalls[0]) | `AnalysisTheater.tsx:439-449` | 저장 버튼(판단 아님) |
| 오답 「내용은 맞음」 분기 | `AnalysisTheater.tsx:1200` · `lib/csat/theater.ts:228` | 라벨 |
| 이해 확인 「오답 함정」 과제 생성 차단(choiceTruth+부정 발문) | `lib/csat/understanding-check.ts:80` | 과제 유무 분기 |
| 학습 정리에 `units` 라벨 표시 | `lib/csat/system-learning.ts:70,95` | 텍스트 |

`lureDesign` · `passageDesign` 화면 소비 0, `units` 는 정리 라벨로만 소비(04 의 「units 소비 0」은 main 에선 system-learning 라벨 1곳이 있음 → **D3-02 신규 P3**: 그래도 상호작용 변화 없음).

모델과 **무관하게** 유형을 가리지 않고(또는 데이터 유무로) 켜지는 실제 판단 상호작용:

| 상호작용 | 위치 | 판단 종류 | 게이트 |
|---|---|---|---|
| 근거 문장 고르기(evidence check) | `understanding-check.ts:77-79`, UI `theater/UnderstandingChecks.tsx:77-85` | 근거 추적(선택) | 지도(`map.answerSentences`) 있을 때, **전 유형 동일 문장 단위** |
| 오답 함정 라벨 고르기(lure check) | `understanding-check.ts:80-96` | 분류 선택 | 표 2종만: POSITION_TYPES 4개(`:19` R-INSERT·R-ORDER·R-IRRELEVANT·X-ORDER) vs 나머지 PROPOSITION |
| 구조 예측(StructurePredict) | `AnalysisTheater.tsx:930`, `theater/StructurePredict.tsx:94-100` | 패턴 선택 후 대조 | meaning 장면 + gate.design 있을 때(유형 무관) |
| 의미 지원(MeaningSupportPanel) | `AnalysisTheater.tsx:1211-1225` | 단위·관계 추적 | 의미 자료 있을 때 — 유형별 1~4문항, R-MOOD 0(KNOWN 01 §3) |
| 선지 쌍 비교(V3CompareExplorer) | `AnalysisTheater.tsx:1268-1285` | 비교 | v3 검수 자료 있을 때 |
| 원리 패널 4종(Evidence/ContextSense/Cohesion/Principle) | `m:app/(app)/csat/item/[slug]/page.tsx:297-306` | 선택(밑줄·문장 번호, aria-pressed) | **taskKey**(채택 원리) 기준, 유형 키 아님 |

→ **D3-03 (KNOWN 04 P0-2 / 12 P0-5 재확인)**: 26 모델 중 어떤 키도 전용 판단 도구를 고르지 않는다. 판단 상호작용은 데이터 존재(지도·v3·의미·채택 원리)로 켜지며, 유형 차이는 「POSITION vs PROPOSITION 함정표」 1분기와 choiceTruth 분기뿐.

- **D3-04(신규, P2, 문서 정합)**: 04 §1.2-1 의 재생 중 자동 `selectScene`(P0-1)은 s0 판이다. main `AnalysisTheater.tsx` 에서 `liveScene`·`selectScene(target` grep 0건. main 은 레일 live 칩 자동 스크롤(`:941`)·`judgment-options` 스크롤(`:738`)·전역 ←/→(`:960-969`)만 남는다. P0-1 의 main 영향은 **UNKNOWN**(s0 미병합 여부 확인 필요).

## 3. 모델별 감사

열: 목적=`relation` 요지 · 데이터=모델 필드+기존 소스 · 구현=유형 특유 상호작용(없으면 공통만) · 부족=관찰(O)·선택(S)·근거 추적(T)·비교(C)·조건 조작(M) 중 **유형 고유 형태로** 없는 것 · 위험=과잉 일반화 · 증거=판정에 필요한 것.
공통 구현(문장 근거 선택·함정 라벨·구조 예측·v3 비교)은 모든 행에 해당하므로 「공통」으로만 표기.

| # | 키 | 목적 | 유형 고유 데이터 | 유형 고유 구현 | 부족(유형 고유) | 일반화 위험 | 판정 증거(필요 / 현재) |
|---|---|---|---|---|---|---|---|
| 1 | R-PURPOSE | 요청·행동 문장 → 화행 동사 | relation `:55` · seed A1/A3-5 | 없음(공통) | S(화행 동사 선택) · T(배경→요청 전환점) | 「마지막 문장=목적」 굳힘 | 필요: 요청 문장 위치 실측·전환 표지 결속 / 현재: 문장 근거 선택만 |
| 2 | R-MOOD | 전환점 기준 감정 변화 | `:81` · 의미 자료 0(01) | 없음 | T(전환점 지정) · C(전/후 감정어 대조) | 감정어 하나로 결정 | 필요: 전환점 cue 데이터 / 현재: 없음 — NEW 후보 근거 |
| 3 | R-CLAIM | 당위·평가어 → 주장 | `:66` | 없음 | O(당위 표지 표시) · S | should=주장 단정 | 필요: 표지 위치 데이터 / 현재: 없음 |
| 4 | R-IMPLY | 밑줄 비유 → 원관념 | `:92` units underline · `reflow/paper-marks.ts:82`(마크 none) | 없음 | T(비유↔원관념 연결) · C | 비유=반대 의미 굳힘 | 필요: 밑줄 위치·원관념 문장 결속 / 현재: 문제지 마크조차 none |
| 5 | R-GIST | 중심 명제 범위·관점 → 선지 압축 | GIST 공유 `:39-49,74` | 없음 | M(범위 과대/과소 조작) | 4유형 동일 모델(KNOWN 04 P1-5) | 필요: 범위 차이 데이터 / 현재: 함정 라벨(범위 과대·과소) 선택만 |
| 6 | R-TOPIC | 〃 | `:75` | 없음 | 〃 + 주제 명사구 형식 | 〃 | 〃 |
| 7 | R-TITLE | 〃 + 제목 형식 함의 | `:76` | 없음 | 〃 + 비유·의문형 해석 | 〃 | 〃 |
| 8 | X-TITLE | 장문 중심 명제 | `:77` units paragraph | 없음 | T(단락→중심) | 단문 GIST 절차를 장문에 적용 | 필요: 단락 단위 근거 / 현재: 문장 단위만 |
| 9 | R-BLANK | 빈칸 논리 조건 · 앞뒤 근거 | `:103` · reflow 빈칸 `reflow.ts:54` | 없음(빈칸 문제지 표시만) | M(조건 명제 구성) · T(재진술 연결) | 「앞뒤 문장에 답」 굳힘 · bodyOK 67%(KNOWN 01) | 필요: 빈칸-재진술 문장 결속, 34②(KNOWN) 감수 / 현재: 문장 근거 선택 |
| 10 | R-BLANK2 (retired) | 두 독립 제약 교집합 | `:114` | 없음 | M(제약별 후보 소거) | — | retired 4문항 — 증거 수집 우선순위 낮음 |
| 11 | X-BLANK (retired) | 장문 빈칸 결론 | `:125` | 없음 | 〃 | — | 〃 |
| 12 | X-BLANK2 (retired) | 장문 두 빈칸 | `:136` | 없음 | 〃 | — | 〃 |
| 13 | R-GRAMMAR | 절 구조가 요구하는 형태 | `:147` choiceTruth | lure check 차단(부정 발문)·라벨 분기 | O(절 구조 표시) · S(요구 형태 선택) | 「문장 역할」 그릇 강제(contract 주석 `:5`) · 네모형 미분류(KNOWN 01) | 필요: 밑줄 위치 결속(D4b 범위) / 현재: 진위 라벨뿐 |
| 14 | R-VOCAB | 낱말 극성 ↔ 문맥 방향 | `:158` choiceTruth | ContextSensePanel(밑줄 misfit + 단서 문장, `ContextSensePanel.tsx:99-118`) — **단 taskKey 'contextual-sense' 채택 문항만** | 유형 전체 커버 아님 | 반의어 치환=정답 굳힘 | 필요: 채택 문항 수/132 / 현재: 패널 존재·채택 범위 UNKNOWN |
| 15 | X-VOCAB | 장문 방향 ↔ 극성 | `:169` | 위와 같은 패널 가능성(taskKey 의존) | 〃 · 단락 방향 | 〃 | 〃 |
| 16 | R-REFER (retired) | 대명사 → 대상 연결 | `:180` | 없음 | T(대명사↔인물 연결) | — | retired |
| 17 | X-REFER | 단락 넘는 인물 연결 | `:191` | 없음 | T · C(인물별 묶기) | 첫 등장 인물=주어 굳힘 | 필요: 밑줄 5개 ↔ 인물 결속 / 현재: 없음 |
| 18 | R-ORDER | 단락 선행 조건 사슬 | `:202` · POSITION 함정표 | lure check POSITION 표(`:17,19`) | M(단락 배열 조작) · T(지시어→선행사) | 연결어 하나로 결정 | 필요: 단락 경계·선행 조건 데이터 / 현재: 함정 라벨 선택 |
| 19 | X-ORDER | 사건·시점 사슬 | `:213` · POSITION | 〃 | M(사건 배열) | 〃 | 〃 |
| 20 | R-INSERT | 삽입문 앞뒤 요구 조건 | `:224` · POSITION | 〃 (CohesionPanel 은 taskKey 'cohesion-link' 채택 시) | M(삽입 위치 시험 배치) · C(양쪽 연결 확인) | 「대명사 있으면 바로 뒤」 굳힘 · 38 C1(KNOWN) | 필요: 자리별 앞뒤 조건 / 현재: 함정 라벨 |
| 21 | R-IRRELEVANT | 사슬을 바꾸는 한 문장 | `:235` · POSITION | 〃 | C(문장별 사슬 기여 비교) | 「소재 다르면 무관」 굳힘 | 〃 |
| 22 | R-SUMMARY | 명제 성분 → 요약 칸 압축 | `:246` summary_slot · `reflow.ts:58,461` | 문제지 빈칸 표시만 | M(칸별 의미·극성) · T | bodyOK 22%(KNOWN 01) | 필요: 요약문 칸 데이터 정합 / 현재: 대부분 원문 결함 |
| 23 | R-NOTICE | 항목별 주체·수치·허용 대조 | `:257` notice_item choiceTruth · `learner-text.ts:22`(「줄」) | 진위 라벨 · 「줄」 단위 표기 | C(선지↔표 항목 대조) · T(항목 단위) | 표를 문장으로 취급 | 필요: 안내문 표 구조(D4b) / 현재: 문장 근거 선택(줄로 호칭) |
| 24 | R-FACT | 선지↔지문 성분 대조 | `:268` choiceTruth | 진위 라벨 · EvidencePanel(taskKey 의존) | C(성분별 대조 조작) | 순서대로 대응 굳힘 | 필요: 선지-문장 대응 데이터 / 현재: 문장 근거 선택 |
| 25 | X-FACT | 이야기 사실 대조 | `:279` choiceTruth | 진위 라벨 | 〃 · 단락 | 〃 | 〃 |
| 26 | R-CHART | 범주·단위·값 계산 대조 | `:290` chart_series/table_cell visual | `visual` 경고 1문장(`AnalysisTheater.tsx:1205`) · 학평 검수 게이트(`hakpyeong-review.ts:129,143`) | O(값 읽기) · M(계산) · C — 전부 없음 | 배수·%p 혼동(pitfalls) | 필요: 도표 셀 결속(KNOWN 01 DATA_GAP) / 현재: 경고문뿐 — NEW 후보 근거 |

### 집계
- 유형 고유 판단 상호작용 **있음 0/26** (모델 키가 상호작용을 고르는 경우 0).
- 유형 범주 수준 분기 있음 **11/26**: POSITION 함정표 4(R-ORDER·X-ORDER·R-INSERT·R-IRRELEVANT) · choiceTruth 7(R-GRAMMAR·R-VOCAB·X-VOCAB·R-NOTICE·R-FACT·X-FACT·R-CHART). 이 둘은 선택 과제의 **보기표/유무**만 바꾼다.
- 원리 패널(taskKey) 경유 유형 특유 조작 가능: R-VOCAB/X-VOCAB(contextual-sense) · R-INSERT 계열(cohesion-link) · 선지 대응 계열(option-restate/evidence-locate) — 채택 문항 범위 **UNKNOWN**(DB 미질의).
- 텍스트만(모델 relation 표시 외 공통 기능뿐): 나머지 15/26.

### 판단 기능 부족 상위
1. **조건 조작(M)** — 순서·삽입·빈칸·요약·도표 9개 이상에서 배치·계산·조건 구성 조작 없음. 문장 번호 선택으로 대체.
2. **근거 추적의 단위 불일치(T)** — evidence check 는 전 유형 「문장」 단위(`understanding-check.ts:77`). 모델 `units`(underline·paragraph·table_cell·chart_series·notice_item·summary_slot)가 상호작용에 반영 안 됨 — 13개 모델이 문장 외 단위를 선언.
3. **비교(C)** — 성분 대조형(FACT·NOTICE·CHART·REFER)에 선지↔근거 성분 대조 도구 없음; v3 비교는 선지 쌍 비교로 성격이 다름.
4. **관찰(O)** — 표지 표시(당위어·절 구조·전환점) 없음: CLAIM·GRAMMAR·MOOD.

## 4. 접근성·데이터 의존성

- 존재하는 선택 UI 는 `<button aria-pressed>` + `role="group" aria-label`(`UnderstandingChecks.tsx:77-85`, `ContextSensePanel.tsx:99-118`), StructurePredict 44px 명시(`StructurePredict.tsx:94-100`). 키보드 기본 동작은 버튼이라 가능.
- 전역 ←/→ 바인딩(`AnalysisTheater.tsx:960-969`)이 향후 유형 전용 listbox·배열 조작(M)과 충돌 — KNOWN(04 P1-2). 새 조작 도구 설계의 선행 조건.
- 문장 인라인 클릭은 44px 미만 → 번호 버튼 병설 필요 — KNOWN(04 §3.4).
- 데이터 의존: 모든 판단 기능이 지도·v3·의미·채택 원리 자료 존재에 묶임. 자료 없으면 task 장면은 relation **텍스트 1문장만** 남음(`AnalysisTheater.tsx:1352` 빈 상태 조건). 자료 부재 302문항(KNOWN 12 P0-3)에선 26 모델 전부 텍스트 덤프로 수렴.

## 5. 발견 요약

| ID | 내용 | 심각도 | 신규/KNOWN | 원본 감수 |
|---|---|---|---|---|
| D3-01 | 01 §1.1 「파일 없음」은 main 과 불일치 | P3 문서 | 신규 | 불필요 |
| D3-02 | `units` 는 학습 정리 라벨로만 소비(상호작용 0) | P3 | 신규(04 보정) | 불필요 |
| D3-03 | 26 모델 중 전용 판단 도구 0 | P1 설계(실제품: 텍스트 1문장) | KNOWN(04 P0-2, 12 P0-5) | 불필요 |
| D3-04 | 자동 selectScene P0-1 은 main 에서 grep 0 — main 영향 UNKNOWN | P2 문서 정합 | 신규 | 불필요 |
| D3-05 | evidence check 문장 단위 고정 → 13 모델의 비문장 units 무시 | P1 실제품 | 신규(04 는 units 미소비만 지적) | 불필요 |
| D3-06 | R-IMPLY 문제지 마크 none(`paper-marks.ts:82`) — 밑줄 관찰조차 불가 | P2 실제품 | 신규 · NOT_VERIFIED(런타임) | 필요(밑줄 위치) |
| D3-07 | 원리 패널 taskKey 채택 문항 범위 미측정 | 검증 공백 | 신규 | — |

## 조사 범위(실제로 본 개수)
- 문서: 04 전체, 00·01·12·14 grep(26/교수 모델), 01 §3 표, 00_ASSIGNMENT. 03 은 grep 결과 해당 없음.
- 코드(main `e3e0a6a0e`): teaching-contract.ts 전체 키 26, AnalysisTheater.tsx 해당 구간 약 10곳, understanding-check.ts, system-learning.ts, ContextSensePanel 일부, UnderstandingChecks·StructurePredict 버튼부, item page 패널 분기, 유형 키 grep(약 80행: seed-rules·reflow·order-model·hakpyeong-review·learner-text·map/v62).

## 완료/부분/미완료
- 완료: 목록 정합, 모델별 소비·부족·위험·증거 표 26행.
- 부분: 원리 패널(taskKey) 경유 유형 커버리지 — 코드 분기만, DB 채택 수 미질의.
- 미완료: 런타임 화면 확인, 키보드 실조작.

## 미검증
- 전 항목 런타임 NOT_VERIFIED(dev 서버 미기동). taskKey 채택 문항 수 UNKNOWN. s0 자동 장면 전환의 main 병합 여부 UNKNOWN. D3-06 은 다른 마크 경로 존재 여부 미확인.
