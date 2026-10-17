# LM-G1.5a — V2 문맥 의미 선택 수용 자료(Codex 독립 검증 전)

> 기준 main `5e2aff89d`(T4 수용). 코드 `ff3d2b6e3`. 증거는 같은 SHA 에서 `dirtyTree: false`(결과 파일에 기록한 실행 기준).
> 증거 층위: ① instrument 계약 · 순수 채점 ② 개발 DB · 기존 API ③ Chromium 1280×900 · 1440×900. ④ 전문가 루브릭 검수 = NOT_TESTED, ⑤ 학생 학습 효과 = NOT_CLAIMED.
> **판정 요약: V2 실제 수직 경로는 완료가 아니다.** 측정 계약 · 채점 · 기존 원장 연결은 끝났다. 합의 주석 0개 · 출시 0행이므로 학습자 경로는 BLOCKED_CONTENT/APPROVAL 이고, 화면은 허위 지원 없이 그 상태를 보인다.
> 계약: [INSTRUMENT](./LM-G1_5a_V2_INSTRUMENT.md) · 대기: [PENDING_DELTA](./LM-G1_5a_V2_PENDING_DELTA.md).

## 1. 자료 적격성 실측(2026-10-17 · 읽기 전용 SQL · 저장소)

| # | 단계 | 평가원(kice) | 교육청(edu_office) |
|---|---|---|---|
| 1 | 전체 후보(R-VOCAB + X-VOCAB) | 51(29 + 22) | 196(103 + 93) |
| 2 | 원문 · 문맥 사용 가능(`body_ok`) | 51 | 182 |
| 3 | 구운 골격(문장 서명) 있음 | 51 | 측정 안 함 — 학평 계산 미지원(T3) |
| 4 | 공식 정답 번호(B 판별 근거) | 51 | 196 |
| 5 | 검증된 문맥 뜻 · 배제 이유(D) | **0** | 0 |
| 6 | 검수된 근거 문장(C) | **0** | 0 |
| 7 | 합의 주석(노출 자격) | **0** | 0 |
| 8 | 출시(`knowledge_applications` active) | **0** | 0 |
| 9 | 독립 확인용 미노출 · 연습 · 서로 다른 지문 전이 | 0 · 0 · 0 | 0 |
| 10 | 공백 | D 뜻 · 배제 이유 · C 근거 주석, 맹검 검수, V2 판정 정책, 템플릿 연결, 출시 | 그 위에 학평 적격 판단 |

단계 2–4 의 수는 「쓸 수 있는 문항」이 아니다. 5–8 이 0이므로 지금 V2 확인에 쓸 수 있는 문항은 **0개**다.
참고로 교재 `vocab_choice` 49,353개(P-F8d 실측)는 문항 검수 전이고 DCP 경로라 확인 도구 자격이 없다.

## 2. 반례 V01–V22

| ID | 반례 | 층위 | 결과 |
|---|---|---|---|
| V01 | 낱말 자리 판별 ≠ 문맥 뜻 판단(둘 다 맞혀야 성공) | ① | PASS |
| V02 | 엉뚱한 자리 + 우연히 같은 뜻 번호 → 실패 | ① | PASS(같은 표현의 다른 문맥 실제 사례는 BLOCKED_CONTENT) |
| V03 | 뜻은 맞고 근거는 틀림 → 정오 성공 · 근거 따로 실패. 검수 전 근거는 미채점(null) | ① | PASS |
| V04 | 오답 뜻마다 배제 이유가 없으면 주석 무효 | ① | PASS(실제 「부분적으로 그럴듯한」 사례는 BLOCKED_CONTENT) |
| V05 | 원문 · 주석 revision 불일치 → 채점 안 함 | ① | PASS — 기존 `currentItemTask` 골격 서명 + 주석 해시 변화 |
| V06 | 주석 해시 UNKNOWN/STALE | ① | PASS — T4 evidenceView 계약 그대로(새 키에도 같은 경로) |
| V07 | 정답 키 제출 전 노출 없음 | ① · 정적 렌더 | PASS(panel · 첫 화면 마크업) |
| V08 | 첫 독립 오답 뒤 재시도 정답 | — | BLOCKED_CONTENT(T4 단위 · 브라우저로 R5 에서 검증된 같은 writer · adapter) |
| V09 | 도움 · 해설 뒤 수행 | — | BLOCKED_CONTENT(같은 이유) |
| V10 | 같은 원문 다른 문항 | — | BLOCKED_CONTENT |
| V11 | 다른 TASK 에서 같은 원문 노출 | — | BLOCKED_CONTENT |
| V12 | 서로 다른 원문 전이 집계 | — | BLOCKED_CONTENT |
| V13 | 잘못된 입력(범위 · 중복 · 형식) | ① | PASS · 중복 제출 · 요청키 충돌은 기존 writer(콘텐츠 없음으로 V2 실측은 BLOCKED_CONTENT) |
| V14 | 저장 실패 시 결과 미표시 | 코드 | NOT_TESTED(실행 화면은 콘텐츠 필요). 패널은 `!res.ok` 면 결과 대신 오류만 둔다 |
| V15 | 권리 · 검수 · 공개 부적격 | ① ② | PASS — draft/비맹검/검수자 없음/거절은 노출 자격 없음 · API 는 `no_task` 400 · 원장 0행 |
| V16 · V17 | 목표 변경 · PLAN 복원 | ②③ | PASS(T3 회귀 20/0 ×2). V2 수행 기록 자체는 BLOCKED_CONTENT |
| V18 | 미지원 상태에서 허위 실행 링크 없음 | ① ② ③ | PASS — content_needed · 확인 키 없음 · 팝업/서랍/상단 링크 0 · 과제 칸 없음 |
| V19 | 합성 계정은 효과 표본 제외 | ① | PASS(T4 계약 그대로 · 이번 계정도 합성) |
| V20 | 지연 유지 자동 승격 없음 | ① | PASS(T4 NOT_ESTABLISHED 고정) |
| V21 | V2 근거가 R5 · S5 등으로 전파되지 않음 | ① | PASS — 확인 키 분리 · R5 증거에 contextual-sense 기록 섞이지 않음 |
| V22 | 1280/1440 선택 · 키보드 · 가로 넘침 | ③ | PASS(지도 V2 노드 Enter → 팝업 포커스 · 넘침 0). 과제 칸의 선택 · 제출 · 복귀는 BLOCKED_CONTENT |

단위: `contextual-sense.test.ts` 11 · `ContextSensePanel.test.tsx` 2 · `v2-support-boundary.test.ts` 3.

## 3. 브라우저 · DB — `e2e-lm-g1-5a.mjs`

| ID | 내용 | 1440 | 1280 |
|---|---|---|---|
| G01 | V2 팝업 — 실행 링크 없음 · 막힘 사유 `content_gap` · 증거 칩 없음 · 키보드로 열고 포커스 이동 | PASS | PASS |
| G02 | V2 서랍 — 실행 링크 · 증거 블록 · 「통과/숙달」 없음 | PASS | PASS |
| G03 | 상단 다음 행동 · V2 실행 링크 0 | PASS | PASS |
| G04 | 가로 넘침 0 | PASS | PASS |
| G05 | 기록 API: V2 어휘 문항 `M2609#30` 제출 → 400 `no_task` · 원장 0행 | PASS | PASS |
| G06 | 문항 화면(확인 모드)에 V2 과제 칸 없음 | PASS | PASS |

계정은 각 1개를 만들고 삭제한 뒤 부재를 확인했다. [1440](./evidence/lm-g1-5a-20261017/v2-1440/results.json) · [1280](./evidence/lm-g1-5a-20261017/v2-1280/results.json).

## 4. 회귀(같은 코드 `ff3d2b6e3`)

| 묶음 | 결과 |
|---|---|
| T4 증거 1440 · 1280 | 8/0 · 8/0 |
| T3 목표 1440 · 1280 | 20/0 · 20/0 |
| T2 R5 수직 1440 · 1280 | 20/0 · 20/0 |
| T1 단계 | 9/0 |
| LM-W1 통합 화면 | 36/0 |
| 단위(`lib/csat` · `components/csat` · `lib/learner` · `lib/knowledge` · 문항 화면) | 223 파일 · 2,599/0 |

복귀 · 해부 · 공급 e2e 와 Codex T4 판 14항 실행기는 이번에 다시 돌리지 않았다(NOT_TESTED).

## 5. 상태

| 범위 | 상태 |
|---|---|
| V2 instrument 계약 · 채점 · 입력 검증 · 정답 미노출 | PASS(①) |
| 기존 레지스트리 · 기록 API · 문항 화면 연결 | PASS(코드 · 타입), 실행은 콘텐츠 0이라 비활성 확인만(②③) |
| 실제 V2 수행 → 원장 → 증거 → 지도/Workspace/PLAN | BLOCKED_CONTENT(D1 · D2) · BLOCKED_APPROVAL(D3–D5) |
| 근거(C) 루브릭 · 버전 | BLOCKED_APPROVAL(D7 = T4 P2 · P3) |
| 전문가 검수 · 학습 효과 | NOT_TESTED · NOT_CLAIMED |

## 6. Codex 독립 검증 요청

1. B+D 정오 · C 분리 · 「B 실패면 D 실패」 규칙이 V2 정의(「문맥 의미 선택 정답 + 근거 낱말 지목」)와 맞는가. 정의는 근거를 「낱말 지목」으로 말하는데, 이번 도구는 문장 번호다(원문 비저장 원칙).
2. `releasable` 조건(합의 · 맹검 · 검수자 · 날짜)이 기존 claim-support 채택 조건과 같은 강도인가.
3. 레지스트리 순서(손 주석 과제 → contextual-sense → 파생 E축)가 어휘 문항의 기존 E축 과제를 가리지 않는가. 지금은 주석 0개라 영향이 없다.
4. 패널의 저장 실패 · 재시도 경로(V14)를 콘텐츠 없이 검증할 방법이 있는가.
