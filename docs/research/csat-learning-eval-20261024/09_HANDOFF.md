# 09 · 대량작업 E 종료 · 실증 준비 인계 (2026-10-24)

> E 의 연구·평가 도구 구축은 **완료 범위로 인정**(사용자 결정 2026-10-24)되었으나 공식 제품·연구 수용은 아니다. 실제 학습 효과: **NOT_EVALUATED**.
> 기존 01–08 · 루브릭(U0–U5, 증거 코드 19) · P6 규칙 12 · 도구·테스트는 그대로 보존한다. 이 문서는 남은 공백과 인계만 다룬다.
> 상태 확인: 브랜치 `research/csat-learning-eval-20261024` = origin 동일(`8a69010f3`, 이 문서 커밋 전). main 미병합(의도).

## 1. 실제 적용을 막는 조건 — 우선순위

| 순위 | 차단 | 영향 | 해소 주체 | 비고 |
|---|---|---|---|---|
| 1 | **P6 미연결** — `learning_exposures` 0행, 제품 코드가 기록 함수 미호출 | 모든 시도가 X_UNKNOWN → 독립 수행 판정 0건. 전후·전이 비교 전부 불가 | 제품 owner(§5) | E 는 제품·DB 를 고치지 않는다 |
| 2 | **분석 정본 revision 미고정** — 후보 17건 published 4–6개 공존, 34·38 은 v5 에서 오답 라벨 변경 | 정답 근거·오답 코드 기준이 버전마다 다름 | 사용자 결정 | 공식 정답(정답표)과 분석 revision 은 다른 축이다(§4) |
| 3 | **권리·사용 범위 미결정** | 전이 문항 적격 0 | 사용자 결정 | DB 필드 신설은 선결정하지 않는다. 후보 경로: 제품 경계(원문 미게재 · 학습자 보유 PDF)를 연구에도 적용 |
| 4 | **동일 원리 판정 미실시** — type_id 일치만 | 전이(U5) 정의 불충족 | 연구(사람 승인) | 34 조건 명제 구조는 빈칸 유형 전체로 일반화 금지 |
| 5 | **문항별 gold 미작성** — 근거 span · 오답 사유 · 허용 대체 설명 | U2–U4 채점 불가 | 연구(작성) + 사람 승인 | §4 의 감수 항목 |
| 6 | 원문 대조 **사람 확인 서명** · 로컬 PDF 출처 확인 | original 게이트가 MACHINE_MATCH 에서 멈춤 | 연구 | 2026 만 평가원 내려받기 해시 일치 기록 있음 |
| 7 | 동의·보호·기관 검토, 사전 등록 | 실제 모집 불가 | 사용자·기관 | 08 §5 P6–P9 |

## 2. 전이 후보 17건 — 문항별 부적격 사유

근거표: [`transfer/source-evidence.json`](transfer/source-evidence.json). 방법: DB `csat_items`(읽기) ↔ 로컬 평가원 문제지·정답표 PDF 기계 대조(영문 30자·국문 8자 조각 포함률). 원문 텍스트는 저장하지 않았다.

이번 확인으로 바뀐 것:
- **original**: 17/17 지문·선지가 로컬 문제지 PDF 에 있다(지문 조각 포함률 0.83–1.00, 1 미만은 빈칸·삽입 표지 자리). → `MACHINE_MATCH`. 사람 확인 서명 전에는 PASS 로 올리지 않는다. 문제지 PDF 출처(평가원 원본 여부)는 2026 외에는 해시 대조 기록이 없어 UNVERIFIED.
- **answer**: 모평 12건은 로컬 정답표 PDF 와 DB 정답 일치 → PASS. 2025 수능 5건은 정답표 PDF 가 자동 해독되지 않고(`ToUnicode` 없음) 저장소 정답이 화면 캡처 **수기 전사 한 출처**(`answers-manual.json`, 짝수형)뿐 → E4 의 PASS 를 **PARTIAL 로 낮췄다**.
- 함정 기록: 2025 · M2509 · M2706 문제지는 영문 글리프가 ASCII+2 로 밀려 추출된다(`Itgcv` = `Great`). 그대로 대조하면 「원문 불일치」로 오판한다. 대조용 해독만 했고 원본·추출기는 고치지 않았다.

| 문항 | 유형 | original | answer | 분석 revision | rights | 동일 원리 | 남은 차단 |
|---|---|---|---|---|---|---|---|
| 2025#22 | R-GIST | MACHINE_MATCH | PARTIAL(수기) | 4개 공존 | UNKNOWN | UNKNOWN | answer·version·rights·원리·서명 |
| M2509#22 | R-GIST | MACHINE_MATCH | PASS | 4 | UNKNOWN | UNKNOWN | version·rights·원리·서명 |
| M2606#22 | R-GIST | MACHINE_MATCH | PASS | 4 | UNKNOWN | UNKNOWN | version·rights·원리·서명 |
| M2609#22 | R-GIST | MACHINE_MATCH | PASS | 4 | UNKNOWN | UNKNOWN | version·rights·원리·서명 |
| M2706#22 | R-GIST | MACHINE_MATCH | PASS | 4 | UNKNOWN | UNKNOWN | version·rights·원리·서명 |
| 2025#34 | R-BLANK | MACHINE_MATCH | PARTIAL | 4 | UNKNOWN | UNKNOWN(조건 명제 별도) | answer·version·rights·원리·서명 |
| 2025#33 | R-BLANK | MACHINE_MATCH | PARTIAL | 5 | UNKNOWN | UNKNOWN(조건 명제 별도) | answer·version·rights·원리·서명 |
| M2509#34 | R-BLANK | MACHINE_MATCH | PASS | 4 | UNKNOWN | UNKNOWN(조건 명제 별도) | version·rights·원리·서명 |
| M2606#34 | R-BLANK | MACHINE_MATCH | PASS | 4 | UNKNOWN | UNKNOWN(조건 명제 별도) | version·rights·원리·서명 |
| M2609#34 | R-BLANK | MACHINE_MATCH | PASS | 4 | UNKNOWN | UNKNOWN(조건 명제 별도) | version·rights·원리·서명 |
| M2706#34 | R-BLANK | MACHINE_MATCH | PASS | 5 | UNKNOWN | UNKNOWN(조건 명제 별도) | version·rights·원리·서명 |
| 2025#38 | R-INSERT | MACHINE_MATCH | PARTIAL | 5 | UNKNOWN | UNKNOWN | answer·version·rights·원리·서명 |
| 2025#39 | R-INSERT | MACHINE_MATCH | PARTIAL | 5 | UNKNOWN | UNKNOWN | answer·version·rights·원리·서명 |
| M2509#38 | R-INSERT | MACHINE_MATCH | PASS | 6 | UNKNOWN | UNKNOWN | version·rights·원리·서명 |
| M2606#38 | R-INSERT | MACHINE_MATCH | PASS | 5 | UNKNOWN | UNKNOWN | version·rights·원리·서명 |
| M2609#38 | R-INSERT | MACHINE_MATCH | PASS | 4 | UNKNOWN | UNKNOWN | version·rights·원리·서명 |
| M2706#38 | R-INSERT | MACHINE_MATCH | PASS | 5 | UNKNOWN | UNKNOWN | version·rights·원리·서명 |

`unseen_by_learner` 는 문항 속성이 아니라 학습자별 게이트라 **PILOT_TIME** 으로 분리했다(파일럿 때 P6 기록·자기보고로 판정). 적격 0/17 은 유지한다 — 평가 문항으로 승격하지 않는다.

## 3. 기준 문항 2026-22/34/38 — 이번에 확인된 것

- 2026 문제지 PDF sha256 `788830081bb2a3ad…` = `kice-source.ts` 의 평가원 내려받기 대조값. 세 문항 지문·선지 기계 대조 일치(38 지문 0.967).
- 공식 정답표(2026, 홀수형) 자동 해독: 22=①, 34=③, 38=⑤ — DB 정답과 일치. → 01 §5 「원지 PDF 대조 NOT_VERIFIED」 중 **정답·원문 존재는 기계 확인됨**. 사람 서명은 남는다.
- 주의: 기계 대조는 「DB 선지가 PDF 에 있다」만 본다. **2026#38 선지에 본문 조각·각주가 섞인 결함(CC-07)은 이 방법으로 잡히지 않는다** — 그 선지 데이터는 계속 채점에 쓰지 않는다.

## 4. 34·22·38 채점 근거 — 사람 감수 필요 항목

원칙: **공식 정답**(정답표, 위 §3 확인)과 **분석 revision**(오답 라벨·근거 해석, v1–v5)은 따로 확정한다. AI 평가자끼리의 합의는 감수를 대신하지 않는다 — 각 항목은 `사람 승인(누가·언제·어느 revision)` 이 붙을 때만 루브릭 award 에 쓴다. 아래는 확정이 아니라 **감수 요청 목록**이다.

| 문항 | 연결할 루브릭 칸 | 현재 근거(출처) | 감수할 것 | 그 전까지 채점 |
|---|---|---|---|---|
| 22 | U2 근거 구간 | 처방 문장 6·9·10번(01 §2, 03 §3) | 근거 span gold 확정, 허용 대체 근거(6번만/9번만) 인정 범위 | 미채점 |
| 22 | U3 가까운 오답 ③ | PARTIAL_TRUE, 7번 진단(03 §3) | ③ 과 7번 동일성(CC-09) · truth 축 키 | fit 축만 |
| 22 | U4 조건 | 「역할 전체 포괄」, 반례 2025#22 · 2026#23(01 §2) | 반례 문항의 원리 판정 승인 | 미채점 |
| 34 | U2 근거 구간 | 마지막 두 문장 + If · Ideally(01 §2) | span gold, 짧은 구간의 우연 일치 대비 미끼 구간 설계 | 미채점 |
| 34 | U3 ②④⑤ | v1–4 와 v5 라벨 상충(03 §3) · ② 진위 unknown 대 강의 거짓 단정(CC-02) | **정본 revision 결정** · ② 키 확정 | ① full, ②④⑤ span 만 |
| 34 | U4 조건 조작 | `cannot`·`Ideally` 제거 변형, 반례 2026#31·32·33(01 §2) | 「부정어 뒤 빈칸」 과잉일반화(CC-03) 제거 확인 · 34 구조를 다른 문항에 적용 안 함 | 미채점 |
| 38 | U2 these 범위 | 6–7(원 키) 대 4–7(C1 후보, 미승인)(CC-01) | 범위 키 결정 — 미정이면 4–7 선택을 오답 처리 금지 | 범위 칸 award 금지 |
| 38 | U3 ②③ | v5 라벨 변경 · ③ 실패 강도 미확정(03 §3) | 정본 revision · ③ 「보류」 허용 여부 | ①④ full, ②③ span 만 |
| 38 | 선지 데이터 | CC-07 혼입 | 선지 표시 데이터 정정 여부(제품 owner) | 이 선지 데이터로 채점 안 함 |
| 공통 | 강의 cue 누설 | c4·c5 정답 직접 언급(CC-05) | 해당 강의 시청 뒤 응답 = X3 처리 확인 | ASSISTED_ONLY |

허용 가능한 대체 설명: 구조화 응답(사유 코드·span)에서 「다른 근거 문장이지만 같은 관계」를 인정할지는 문항별 gold 에 `accepted_alternatives` 로 명시해야 한다. 지금은 어느 문항에도 없다 → 대체 설명을 감점하지도, 가점하지도 않는다(그 칸은 미채점).

## 5. P6 인계 (제품 owner)

- 사실: `learning_exposures` 0행 · `exposure_order_at` 채워진 시도 0 · main 제품 코드에서 `learning_exposure_record` / `learning_attempt_independence` 호출 0(05 §1-5, 2026-10-24 SELECT·grep).
- 요청: 정답·결정적 단서 노출 경로(판단 장면 정답 지연 조회 · 강의 cue · 해설 열람)에서 원장 선기록 연결. 범위·구현은 제품 owner 판단 — E 는 테이블·RPC·코드 변경을 제안 구현하지 않는다.
- 평가 쪽 계약(유지): 기록 없는 시도는 독립 수행으로 확정하지 않는다(X_UNKNOWN → eligibility UNKNOWN). 원장 0행만으로 X0 이 되지 않는다(규칙 R12: 원장 0행 **그리고** 순서 시각 있음 **그리고** help_level=independent). 서버가 볼 수 없는 외부 노출은 판정하지 않는다.
- 회귀 유지: 도구 결함 2건(노출 지도 12규칙 무시 · 최소 근거 `all_of` 무시) 테스트는 `tool/__tests__/modules.test.mjs` 에 있다.

## 6. 평가 도구 입력 계약

판정 기록 1건(`tool/schema.mjs` 가 검사):

| 필드 | 필수 | 값 | 없으면 |
|---|---|---|---|
| `record_id` | 예 | 문자열, 데이터셋 안 유일 | 거부 |
| `learner_pseudo_id` | 예 | 가명 `[A-Za-z0-9_-]{3,64}` · 이메일·전화번호 형태 어디에도 금지 | 거부 |
| `data_origin` | 예(권장) | `SYNTHETIC` \| `REAL` | UNKNOWN → 비교 결과 NOT_EVALUATED |
| `item_id` · `item_version` · `analysis_version` | 예 | 문자열 — `analysis_version` 은 §1-2 의 정본 revision | UNKNOWN · `check` 가 버전 불일치 보고 |
| `phase` | 예 | `PRE` · `POST_ASSISTED_CHECK` · `POST_INDEPENDENT` · `TRANSFER` | UNKNOWN |
| `path` | 예 | `FREE` · `EXPLANATION_FIRST` · `LECTURE_FIRST` | UNKNOWN |
| `task_format` · `attempt_started_at` | 예 | 문자열 · ISO 시각(시도 전/후 노출 판정) | 노출 시점 UNKNOWN |
| `response` | 예 | `{selected_option, evidence_span_ids[], failure_codes[], condition_toggles{}}` — 자유서술은 숙달 근거 아님 | UNKNOWN |
| `exposure_events[]` | 예 | P6 행(점 경로 `attempt.*` `exposure.*` `first_attempt.*`) — 실데이터는 `--map rubric/p6-exposure-map.json` 필수 | 배열 없음 → X_UNKNOWN |
| `studied_item_ids[]` · `transfer_eligibility_verified` | TRANSFER 때 | 학습한 문항 · §2 게이트 전부 PASS 여부 | U5 → U4 상한 |
| `rater_judgments[]` | 예 | `{rater_id, rater_kind: human\|ai, level: U0–U5\|NOT_EVALUATED\|UNKNOWN, evidence_codes[{code, ref}], note}` | 일치율 계산에서 제외(수 보고) |

수준 값은 문자열만(숫자 거부). 결측은 대체하지 않는다.

## 7. 평가 타당성 — 외부 측정 도구

| 도구 | 원 출처 | 한국어판 사용·타당화 근거 | 표현 |
|---|---|---|---|
| Paas 정신적 노력 9점 | Paas (1992) *J. Educ. Psychol.* 84, 429–434 — 2차 출처로 서지 확인([uni-due 도구 DB](https://learninglab.uni-due.de/research-instrument/13339)), 원문 미열람 | 미확인 | 「연구용 번역 문항(미타당화)」 |
| SUS | Brooke (1996) — 원문 미대조 | 검색에서 SUS 한국어판 타당화 연구를 찾지 못함(「K-SUS」 는 강점 사용 척도 — 다른 도구) | 「연구용 번역 문항(미타당화)」 |
| NASA-TLX Raw | Hart & Staveland (1988) — 원문 미대조 | 1996 대한인간공학회 RNASA-TLX(운전 과제, 심리측정 결과 미확인)뿐([koreascience](https://koreascience.kr/article/CFKO199611919574285.pub?orgId=esk)) | 「연구용 번역 문항(미타당화)」 |
| SEQ | Sauro & Dumas (2009) — 원문 미대조 | 미확인 | 「연구용 번역 문항(미타당화)」 |

미검증 설문을 공인 심리측정 도구로 표기하지 않는다. 쓰려면 번역·역번역·전문가 검토·소규모 예비 검사(신뢰도) 기록을 먼저 남긴다. KCI·RISS 원문 검색은 하지 않았다.

평가 타당성 점검(도구가 이미 하는 것): 최소 증거 조건(`all_of`/`any_of`) · 평가자 불일치(`disagree` → 사람 adjudication) · 결측·노출 미상·버전 불일치(`check`). 여러 AI 평가자의 합의는 신뢰도일 뿐 정답성이 아니다(07 §한계).

## 8. owner 별 전달

| 항목 | 받는 쪽 | 전달 상태 |
|---|---|---|
| P6 제품 연동 차단(§5) | csat-lecture-disclosure(판단 장면 정답 지연 · 원장 선기록 작업 owner) | 세션 메시지 송신 — 수신 확인은 그쪽 응답으로만 |
| 17개 후보 부적격 사유(§2) · 정본 revision · 권리 결정 | 사용자 | 이 문서 |
| 34·22·38 감수 항목(§4) | G1 연구 owner(csat-all-types-research) · 사용자(콘텐츠 승인) | 이 문서(세션 미확인 — 전달 주장하지 않음) |
| 도구 입력 계약(§6) | 파일럿 실행자 | 이 문서 |
| 파일럿 선행 조건 | 사용자 | 08 §5 + 이 문서 §1 |

후속 작업 범위: 자료 공백과 평가 적격성 해결만. 기존 연구 재작성 · 신규 대규모 도구 · TASK 생성 · DB 변경 · main 병합은 하지 않는다.
