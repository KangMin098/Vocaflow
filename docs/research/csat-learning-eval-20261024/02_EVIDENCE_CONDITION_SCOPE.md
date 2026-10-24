# 02 유형별 근거·조건·범위 해석 평가 기준 (E2)

작성 2026-10-24 · 기계 판독본: [rubric/type-evidence.json](./rubric/type-evidence.json).
출처: G1 `810a463ac` `01_TYPE_MATRIX.md` §3 판단 기능 코드(F-*, 작업 라벨, 정본 아님). 점수·학습 효과 수치 없음 — 실제 학습자 결과는 **NOT_EVALUATED**.

## 0. 공통 규칙
- 코드 체계: `EV-U<n>-<FAM>-<k>`. E1 의 일반 코드(`EV-U2-*` 등, rubric/levels.json)의 **하위 코드**이고 JSON `parent` 로 결속한다. E1 코드명이 다르면 parent 만 고친다.
- U2 이상은 노출 X0~X1 + INDEPENDENT_ELIGIBLE 일 때만 독립 수준. X2/X3 뒤 응답은 ASSISTED_ONLY.
- 정답 선지만 맞고 근거(span·연결·태그)가 없거나 틀리면 U2 를 주지 않는다.
- 클릭·탐색·강의 청취는 어떤 코드도 주지 않는다. 자유서술은 연구용 보조 증거(사람/AI 평정)일 뿐 숙달 산입 금지 — 과제는 span 선택·연결·선지+사유코드·조건/극성 토글로 설계한다.
- gold(근거 범위·사유코드)는 문항별 사전 확정 + 사람 검수 표시가 있어야 쓴다. AI 평정자 합의는 진실이 아니다. gold 없는 문항 = NOT_EVALUATED.

## 1. 유형군 요약

| 유형군 | 유형 | 근거 단위 | 대표 과제 형식 | 대표 범위 오류 |
|---|---|---|---|---|
| FAM-CENTRAL | GIST·TOPIC·TITLE·X-TITLE·CLAIM | 중심명제 span + 예시와의 일반-구체 관계 | 중심 span 지목 · 문장 역할 태그 · 오답 사유코드(넓음/좁음/본문 없음) | 예시 확대, 세부를 요지로, 양보절 착각 |
| FAM-ACT | PURPOSE·CLAIM | 화행 표지 span | 요청 문장 지목 · 배경 vs 요청 구분 | 사정 설명을 목적으로 |
| FAM-MOOD | MOOD | 전·후 감정 span + 전환점 + 극성 | span 3개 + 극성 토글 | 한쪽 감정만 근거 |
| FAM-IMPLY | IMPLY | 밑줄 ↔ 원관념 span 대응 | 연결 · 사유코드(문자적/부분) | 문자적 해석 |
| FAM-COMPARE | FACT·X-FACT·NOTICE·CHART | 선지별 대응 span/셀 + 성분 대조 | 선지별 연결 · 일치/불일치/본문 없음 토글 · 불일치 성분 태그 · 도표 연산 선택 | 성분 하나만 대조, 예외 조건을 전체로, 배수/차 혼동 |
| FAM-POLAR | VOCAB·X-VOCAB | 극성 결정 연결 span | 극성 토글 + span | 낱말 뜻만 보고 방향 무시 |
| FAM-FORM | GRAMMAR | 대상 형태 ↔ 지배 성분 쌍 | 연결 + 구조 사유코드 | 가까운 명사에 수일치 |
| FAM-SLOT | BLANK·SUMMARY(·INSERT 일부) | 자리 조건 + 재진술 span (일부 문항은 조건명제) | 재진술 span · 자리 관계 태그 · (34형만) 조건 토글 | 앞 문장만 봄, 극성 반대, (34형) 필요/충분 뒤바꿈 |
| FAM-CHAIN | ORDER·X-ORDER·INSERT·IRRELEVANT | 연결 표지(지시어·연결사·관사) + 문장 쌍 관계 | 자리 + 표지 2개 지목 · 선행사 연결 · 단절점 지목 | 표지 하나만 봄, 같은 소재 어휘를 관련으로 |
| FAM-REFER | X-REFER | 지칭 ↔ 인물 대응 | 지칭별 인물 연결 | 시점 전환 후 인물 혼동 |
| FAM-LISTENING | L-* 18 | **DATA_GAP**(선지 전문·원음 없음) | — | — |

## 2. 수준 대응 원칙
- **U2 EVIDENCE_LINK**: 유형군별 근거 단위를 gold 범위 안에서 지목(예 `EV-U2-CENTRAL-1`, `EV-U2-CHAIN-1`, `EV-U2-COMPARE-1`).
- **U3 DISTRACTOR_FAILURE**: 매력 오답의 실패 사유를 닫힌 사유코드로 맞힘(`EV-U3-*-1`).
- **U4 PRINCIPLE_CONDITIONS**: 유형군 고유 조건을 조작·적용 — 도표 연산(`EV-U4-CHART-1`), 안내문 예외 범위(`EV-U4-NOTICE-1`), 34형 조건명제(`EV-U4-SLOT-COND-1`), 중심명제 일반화 조건(`EV-U4-CENTRAL-1`).
- **U5 TRANSFER**: 같은 유형군의 다른 주제·장르 문항에서 U2~U4 코드가 다시 관찰될 때만. 기준은 E1 정의를 따른다.

## 3. 세 기준 사례 — 서로 다른 사고 구조
- **2026#22 (FAM-CENTRAL)**: 예시들이 공통으로 지지하는 일반화를 찾는 구조. 근거 = 중심 span + 예시 태그. 조건 토글을 쓰지 않는다.
- **2026#34 (FAM-SLOT, 조건명제)**: 조건→귀결 구조의 자리 조건 충족. `EV-U4-SLOT-COND-1`·`SE-NEC-SUFF` 는 **FAM-SLOT 중 `has_conditional_proposition=true` 문항 전용**이다. 다른 유형군은 물론 조건명제가 아닌 빈칸에도 적용하지 않는다.
- **2026#38 (FAM-CHAIN)**: 연결 표지의 앞뒤 결속·단절. 근거 = 표지 쌍과 단절점.

## 4. 범위 오류 코드(공통 접두 SE-)
SE-OVERGEN(과일반화) · SE-NARROW(과축소) · SE-SHIFT(범위·관점 이동) · SE-PARTIAL(부분 근거) · SE-EXTERNAL(본문 밖 상식) · SE-LITERAL · SE-LOCAL · SE-REFER · SE-SCOPE(예외 조건) · SE-QUANT · SE-POLAR · SE-NEAREST · SE-TOPIC · SE-NEC-SUFF(34형 한정). 오답 사유코드 과제의 닫힌 선택지로 쓰고, 학습자 응답에서 관찰된 오류로만 기록한다.

## 5. 자료 공백
- 문항별 gold span·사유코드: 전 유형 미구축 → 현재 모든 코드 NOT_EVALUATED.
- R-CHART 도표 셀 결속 DATA_GAP · R-SUMMARY bodyOK 22% · R-BLANK bodyOK 67% · R-MOOD 의미 자료 0 (G1 매트릭스 수치 인용).
- 34형 판정용 `has_conditional_proposition` 메타데이터 없음 — 사람 검수로 만들어야 함.
- 듣기 18유형 전체 DATA_GAP. retired 4유형(R-BLANK2·R-REFER·X-BLANK·X-BLANK2)은 대상 외.
