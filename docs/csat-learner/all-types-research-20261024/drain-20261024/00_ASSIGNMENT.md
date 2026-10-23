# Drain 2026-10-24 — 배정표 · 공통 규칙

> 연구 산출물. 제품 구현·학습 효과 입증 아님. 작성자는 모두 Claude 서브에이전트(내부 검토만, 공식 독립 수용 아님).

## 고정 기준(시작 시 실측)

| 대상 | 커밋 / 수치 |
|---|---|
| research/csat-all-types-20261024 | `37f8b7219` (문서 00~24, cue-audit/sidecar-v2) — 읽기는 `git show 37f8b7219:<path>` (워크트리에 다른 세션의 staged 삭제가 있음 — 건드리지 말 것) |
| feat/lecture-learner-control | `6eb6f3451` (워크트리 D:/workspace/Vocaflow-lecture-learner-control) |
| main | `e3e0a6a0e` |
| 강의 원본 | main `e3e0a6a0e:apps/web/src/lib/csat/lecture-data/*.json` 29개 — 강의 **796** · cue **10,131**(보고값과 일치). **정정:** 처음 배정에서 적은 792 · 10,432 와 경로 `D:/workspace/Vocaflow/...` 는 작업 트리(design/replica-first 8cd15b7b6, 2026-09-28 판)였다. D1a~e 는 그 옛 판을 감사했으므로 main 재대조(D1ab · D1cd · D1e_MAIN_RECHECK)가 정본 판정이다. D1f 는 main 기준. |
| TASK | T-0136·0137·0138 COMPLETED · T-0139 READY(독립 검증 대기, 침범 금지) · T-0140 BLOCKED(제품 코드 수정 금지) |

## 공통 규칙

1. **읽기 전용.** 제품 코드·DB·강의 JSON·sidecar·공식 정답·기존 분석·TASK·잠금·브랜치를 바꾸지 않는다. git 은 `show`/`log`/`ls-tree`/`grep` 만. DB 는 `mcp__supabase__execute_sql` 의 **SELECT 만**(project `jajenrevcbmrpaliomxv`).
2. 자기 산출물 파일 **하나**(배정 경로)만 쓴다. 다른 파일 쓰기 금지. 중간 작업은 자기 스크래치(OS temp)에서.
3. 저작권: 지문·선지 원문을 길게 옮기지 않는다 — 인용은 **40자 이하**, 위치(문항 ID·문단/선지 번호·cue ID)로 가리킨다.
4. 증거 없는 결론 금지. 확인 못 한 것은 `NOT_VERIFIED` / `BLOCKED_AUTH` / `UNKNOWN` 으로 남긴다. skip 을 PASS 로 쓰지 않는다.
5. 기존 연구(문서 00~24)에 이미 있는 결함은 `KNOWN(문서번호 §)` 로 표시하고 신규로 세지 않는다(예: 34② · 38 C1 · 위험 cue 916 판정). 작업 시작 전 자기 영역 관련 기존 문서를 먼저 읽는다.
6. 각 발견에 ID(`<작업군>-NN`), 근거 위치, 재현 조건, 심각도(P0~P3, 실제품 영향 vs 격리 환경 구분), 신규/KNOWN, 원본 감수 필요 여부를 단다.
7. 산출물 끝에 「조사 범위(실제로 본 개수)」 · 「완료/부분/미완료」 · 「미검증」 절을 둔다.

## 배정(겹치지 않음)

| ID | 범위 | 산출물 |
|---|---|---|
| D1a | 강의 2014A·2014B·2015·2016·2017 | D1a_LECTURE_AUDIT.md |
| D1b | 강의 2018·2019·2020·2021·2022 | D1b_LECTURE_AUDIT.md |
| D1c | 강의 2023·2024·2025·2026·M1809 | D1c_LECTURE_AUDIT.md |
| D1d | 강의 M2006·M2106·M2109·M2206·M2209 | D1d_LECTURE_AUDIT.md |
| D1e | 강의 M2306·M2309·M2406·M2409·M2506 | D1e_LECTURE_AUDIT.md |
| D1f | 강의 M2509·M2606·M2609·M2706 | D1f_LECTURE_AUDIT.md |
| D2a | 반례: 중심 주장·요지·제목·요약·목적 | D2a_COUNTEREX_GIST.md |
| D2b | 반례: 빈칸·함축·의미 추론 | D2b_COUNTEREX_BLANK.md |
| D2c | 반례: 삽입·순서·무관 문장·담화 | D2c_COUNTEREX_DISCOURSE.md |
| D2d | 반례: 정보 대조·도표·안내문·어법·어휘·심경/분위기·장문 | D2d_COUNTEREX_INFO_FORM.md |
| D3 | 교수 모델 26개 목표 적합성 | D3_TEACHING_MODELS.md |
| D4a | 공개 분석 부재 302 · 의미 지원 구조/내용 감수 · 공식 원문↔저장 선지 결속 | D4a_DATA_GAP_ANALYSIS.md |
| D4b | 도표 수치·이미지 · 어법 밑줄 위치 · 안내문 표 · 요약·장문 | D4b_DATA_GAP_STRUCTURE.md |
| D5 | 듣기 분류 248 × 전사 272 결속 | D5_LISTENING_BINDING.md |
| D6 | 정답 공개·학습자 제어 반례(T-0140 코드 읽기 전용) | D6_DISCLOSURE_COUNTEREX.md |
| D7 | 제품 수용 테스트 공백 설계 | D7_ACCEPTANCE_TESTS.md |
| D8 | 기출분석 × 학습지도·Workspace 계약 | D8_MAP_WORKSPACE_CONTRACT.md |
