# CSAT v4.0 S0 — REPRESENTATIVE_EDGE_CASES (정상·경계 표본)

- 2026-10-23 · T-0131 · 근거는 DB(`csat_items`·`csat_item_analyses`)와 저장소 파일 경로. 원문 인용은 판단 근거에 필요한 구절만.
- 선정 원칙: **정상** = 그 유형의 판단 구조가 전형적으로 드러나고 v3·강의가 있는 문항. **경계** = 데이터 결손·형식 변형·결속 불일치처럼 화면/계약이 깨질 수 있는 실제 문항. 내용 감수(정답 타당성)는 하지 않았다.

## 1. 기준 회귀 사례(보존)

| item | 유형 | 보존할 판단 | 원문 근거(문장 번호는 화면 1기반) | 피해야 할 단정 |
|---|---|---|---|---|
| 2026#34 | R-BLANK | 6번 `Ideally, the law is the embodiment of …`의 이상 조건 + 7번 `If such laws forbid … then the law cannot be ____`의 조건적 결론 → ③ 완성 명제 | DB 정답 3. 0기반 저장 인덱스 5 = 화면 6번 | 현실의 모든 법 일반화, 부정어=반대말 공식, ②를 사실 거짓으로 단정 |
| 2026#22 | R-GIST | 2번 정의, 7번 `Often … more competitive`·8번 `may need` 진단, 6·9·10번(`may be required`, `might be better`) 신중한 처방 | DB 정답 1(한글 선지) | `Often/may/might` 제거, "결론 표지 뒤 = 정답" |
| 2026#38 | R-INSERT | 주어진 문장 `these internal narratives … identity` ↔ ⑤ 뒤 `For example, … who you are as an individual` 접합, ④ 위치는 ③→④(대학 예시→일반화) 연결 절단 | DB 정답 5. **선지 배열은 삽입 위치 사이 본문 조각**(위치 ①~⑤와 문장 번호는 다른 타입) | `these` 선행 = 6~7번 단정, 예시 표지 개수로 위치 확정 |

## 2. 유형별 정상·경계 표본

정상 표본은 "v3 verified + 강의 + 비교 ≥1"을 만족하는 수능 문항 중 강의 색인 첫 항목으로 기계적으로 고른다(S1에서 `inquiry-data.json`·`lecture-data/index.json` 조인으로 재현). 아래 표는 S0에서 **유형 수준 경계 조건**을 실제 결손 근거로 지정한 것이다.

| 유형 | 정상 표본 | 경계 표본(실제) | 경계 근거 |
|---|---|---|---|
| R-BLANK | 2026#34 | R-BLANK 학평 in_review 106건 | 최신 판이 검수 중 → 학습자에겐 옛 판(stale) |
| R-GIST | 2026#22 | — | |
| R-INSERT | 2026#38 | 학평 R-INSERT units 불일치 21건 | 근거 위치 강조 중지 대상(mismatch) |
| R-ORDER / X-ORDER | v3·비교 보유 수능 문항 | 위치 선지 타입(M-SLOT) | 위치와 문장 번호 혼동 위험 |
| R-CHART | v3 보유 수능·모평 29 | **학평 103건 분석 없음**, 비교 0, 셀 모델 없음 | DATA_GAP + 원본 이미지 크롭 의존 |
| R-FACT / X-FACT / R-NOTICE | v3 보유 | 비교 0(FACT), 실용문 필드 모델 없음 | 직접 비교 UNAVAILABLE |
| R-GRAMMAR | v3 보유 | **H1803G1#29 등 네모 (A)(B)(C) 어법 4건 미분류** | 형식 변형 UNMAPPED |
| R-VOCAB / X-VOCAB | v3 보유 | 비교 0~2 | |
| R-SUMMARY | v3·비교 보유 | body_ok 29/130 · H2503G1#40·H2603G1#40 미분류 | 파서/분류기 결손 |
| R-CLAIM | v3 보유 | 학평 75건 최신 in_review | stale |
| R-MOOD / R-PURPOSE / R-TOPIC / R-TITLE / R-IMPLY / R-IRRELEVANT | v3 보유 | 학평 전부 v3·강의 0 | 학평 계열 탐구 미구축 |
| X-REFER | v3 보유 | 비교 0, 다중 지칭 표지 | 지시 추적 모델 없음 |
| retired(R-REFER·R-BLANK2·X-BLANK·X-BLANK2) | 2014~2016 수능 | 현행 출제에 없음 | 과거 형식 — 전이 비교에서 "현행 아님" 표기 필요 |
| 미분류 | — | H1906G1#36~39 발문 빈 문자열 | 파싱 실패 DATA_GAP |
| 듣기 L-* | **없음(결손)** | **없음(결손)** | 문항·원음·전사 0 |

## 3. 강의 37 cue 버전 확인과 수정 후보(원본 미수정)

사실: 강의는 `apps/web/src/lib/csat/lecture-data/2026.json`(schema1, binding 없음). 34 v2/12 cue, 22 v2/13 cue, 38 v3/12 cue = 37. 분석은 v5(별개 체계). `est_sec`가 아니라 cue별 `sec`/총 `sec`가 추정 길이. cue별 revision 필드 없음 → `cueRevision`은 신규 개념(S1 어댑터).

| cue | 원본(요지) | 문제 | 원문 근거 | 수정 후보(새 revision, 수동 감수 후) | 공개 위험 |
|---|---|---|---|---|---|
| 34 c1 | "빈칸은 부정어 바로 뒤 … 지문이 거부하는 견해" | `cannot be`를 '거부 견해=반대말'로 축소, `If`·`Ideally` 조건 누락 | 6번 Ideally(이상적 법) · 7번 If … then cannot be | "빈칸은 `If`가 건 조건 아래에서 법이 '될 수 없는' 것을 묻습니다. 6번의 '이상적으로'가 어떤 법을 말하는지 먼저 보세요." | strategic_hint |
| 34 c4 | "정답은 삼 번 … 여섯 번째 문장 … 법이 막는 건 어차피 고르지 않을 행동" | 직접 정답 발화, `Ideally`의 이상 조건을 현실 법 일반으로 확장 | 6번 Ideally · 7번 If such laws | "6번은 '이상적인' 법을 정의합니다. 7번의 조건이 성립하면 그런 법은 자유를 막는 것으로 볼 수 없습니다." 정답 번호는 `reveal=OFFICIAL_ANSWER`에서만 | **direct_answer**(현행) |
| 34 c12 | "부정어 뒤 빈칸은 거부 견해 … 선지에 부정을 붙여 읽고" | 부정어 공식 일반화 | 같은 | "이 문항에서는 조건(If)과 이상(Ideally)을 함께 지켜야 했습니다. 부정어 위치만으로 고르는 규칙은 아닙니다." | none |
| 22 c13 | "요지는 정의가 아니라 결론 표지 뒤 처방" | '결론 표지 뒤 = 요지' 일반화, `may/might` 한정 탈락 | 6번 `may be required`, 9번 `might be better`, 7번 `Often` | "이 글에서는 정의(2) → 경향 진단(7·8) → 조건부 권고(6·9·10) 구조가 요지를 정했습니다. 권고가 '~일 수 있다'로 한정된 점도 요지에 남겨야 합니다." | strategic_hint |
| 38 c1 | "예시 표지가 두 번 … 두 번째 예시가 받칠 진술이 빈 자리가 답" | 정답 위치 간접 암시, 표지 개수 공식 | ③ 뒤 For example / ⑤ 뒤 For example, 주어진 문장 `these … identity` | "주어진 문장의 `these`와 `identity`가 앞뒤 어디와 이어지는지 확인해 봅시다." | **answer_implying**(현행) |
| 38 c12 | "같은 예시 표지가 두 번이면 짝이 없는 예시 바로 앞이 자리" | 표지 개수 → 위치 확정 공식 | ⑤ 뒤 예시는 identity(정치 성향)를 받침 | "이 문항에선 ⑤ 뒤 예시가 '정체성'을 받치는데, 그 진술이 비어 있었습니다. 위치는 앞 연결과 뒤 연결을 모두 확인해 정합니다." | answer_implying(정답 공개 후 허용) |

원본 덮어쓰기 금지 — 위 후보는 이 문서에만 있다.
