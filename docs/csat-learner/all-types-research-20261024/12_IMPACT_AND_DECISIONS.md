# 12 — P0/P1 실제 영향도 재분류 · 데이터 계약 정정 · 미확정 교수설계 결정

> 상태: **연구 산출물(작성자 자체 검증)**. S0/S1 공식 수용이 아니다. 공식 독립 수용 판정은 아직 없다.
> 작성 2026-10-24 · 기준 커밋: `main`=e3e0a6a0e · s0 worktree=9e73d7660 · 현재 worktree(design/replica-first)=8cd15b7b6.
> 00~11 의 심각도는 **원문 기록으로 보존**한다(고치지 않음). 이 문서는 실제 제품 영향도를 따로 판정한다.
> 학습자 이해·전이·성적 향상은 어디에서도 검증하지 않았다.

## 0. 00_INTEGRATED_DESIGN 정오(errata)

| # | 00 의 기술 | 실측 | 근거 |
|---|---|---|---|
| E1 | 「main 8cd15b7b6 에는 강의 진행 자동 selectScene 이 없다(s0 에만)」 | **틀림.** 8cd15b7b6 은 main 이 아니라 design/replica-first. 실제 `main`(e3e0a6a0e)에 `AnalysisTheater.tsx:851` `if (target !== scene) selectScene(target, 'replace')` 와 `LectureStage.tsx:303` 의 cue 단위 `scrollIntoView` 가 있다 | `git grep -n selectScene main -- apps/web/src` · `git grep -n scrollIntoView main -- apps/web/src/components/csat` |
| E2 | 정답 직접 낭독은 34:c4·22:c5·38:c4 | **범위 과소.** main 의 커밋된 강의 대본 회차 파일 29개 전부(`apps/web/src/lib/csat/lecture-data/*.json`, index.json 제외)에 「정답은」 이 회차당 23~30회(15 독립 검증 지적으로 정정) | `git show main:<file> \| grep -o 정답은 \| wc -l` |

## 1. P0/P1 실제 영향 경로 재분류

분류 키: **MAIN**=현재 main 제품 경로 직접 영향 · **ISO**=별도 worktree/격리 구현에만 · **CONTRACT**=명확한 제품 계약(v6) 위반 · **CONTENT**=콘텐츠 정확성 감수 필요 · **UNVERIFIED**=실제 검증을 안 해 위험 미확정 · **GAP**=신규 구현 필요한 설계 공백. (복수 가능)

| 원 ID | 원 심각도 | 내용 | 영향 분류 | 제품 영향 판정 | 근거 |
|---|---|---|---|---|---|
| P0-1 | P0 | 강의 진행이 장면을 바꾸며 학습자 선택(msPick 등)을 지움 | MAIN · CONTRACT | **유지 P0** — main 의 문항 해설 화면(`/csat/item/[slug]` → `LectureStage` 가 본문을 감쌈)에서 재생 시 발생 | E1 · `page.tsx`(main) 372행 |
| P0-2 | P0 | 강의가 정답을 직접·간접 공개 | MAIN · CONTRACT | **유지 P0, 범위 확대** — 강의 재생은 학습자 응답과 무관(`LectureStage`·`LecturePlayerBar` 에 응답/공개 상태 조건 없음, `/api/csat/lecture` 는 Pilot embargo 만 검사). 다만 현 해설 화면이 이미 공식 답을 싣는 구조(`gate.answer`)이므로 「회귀」 가 아니라 **v6 공개 통제 계약 미구현** | E2 · `route.ts:32` · `embargo-gate.ts` 주석 |
| P0-3 | P0 | 공개 분석 없는 302문항 · 신판 검토 중 3문항 노출 위험 | MAIN · UNVERIFIED | **P1 로 하향(제품 영향)** — 학습자 SELECT 정책이 `status='published' and not embargoed` 로 정적 차단(`20261005170000_csat_ec_reveal_gate.sql:378`). 남는 위험은 실세션 미검증과 302문항의 「자료 없음」 화면 상태 정의 | SQL 재실측(§2) |
| P0-4 | P0 | RLS 실세션 검증 0건 | UNVERIFIED | **유지(검증 공백)** — 정책은 존재, 정상 로그인 세션 실행 증거 없음 | 03 §2 |
| P0-5 | P0 | 26 교수 모델을 유형별 도구로 오인 | GAP · CONTRACT | **설계 위험(제품 결함 아님)** — 현재 화면은 문장 표시·노트 저장만 하며, 위험은 S2 에서 「REUSE 로 v6 §5 충족」 이라고 판정할 때 생김 | 04 |
| P1 34② | P1 | 분석 unknown vs 강의 「거짓」 | MAIN · CONTENT | 강의 대본은 main 에 커밋됨 → 학습자에게 들림. 판정은 §4-C | 02 CC-02 |
| P1 C1 | P1 | 38⑤ these 범위 | MAIN · CONTENT · (Codex 소유) | 원본 v3 는 그대로, 수정 후보 미승인. Codex T-0136 D1 과 같은 대상 | 02 · 07 |
| P1 과잉일반화 | P1 | 강의 마무리 원리의 조건 누락 | MAIN · CONTENT | 34·38 확인, 전 회차 일괄 감수 필요(미측정) | 10 |
| P1 스크롤 | P1 | cue 단위 자동 스크롤 | MAIN · CONTRACT | main `LectureStage.tsx:303` | E1 |
| P1 단축키 | P1 | 전역 ←/→ | ISO? · UNVERIFIED | main `LectureStage` 는 `keys={false}` 로 렌더(page.tsx 372) — main 문항 화면에서는 꺼져 있을 가능성. 런타임 미확인 | page.tsx(main) |
| P1 source_hash | P1 | 비교 결속에 원문 해시 없음 | ISO · GAP | `projectV3Pairs` 는 s0 에만 | 03 |
| P1 answer 컬럼 | P1 | authenticated 가 `csat_items_public.answer` 읽음 | MAIN · UNVERIFIED | 마이그레이션 `20260927161216` 이 authenticated 에 table SELECT 복원. 의도 여부는 제품 결정 필요(권한 변경은 하지 않음) | migrations(main) |
| P1 자료 결함 | P1 | CHART 수치 0 · GRAMMAR 밑줄 경계 · NOTICE 표 평탄화 · 38 choices 조각 | MAIN(DB) · GAP | 학습 화면 근거 검증 불가 유형 | 08 · 02 CC-07 |
| P1 듣기 | P1 | 선지·정답·원음·권리 0 | GAP | DB 미적재라 제품 영향 없음, 설계 차단 | 09 |
| P1 verified | P1 | 의미지원 verified = 해시·형식 | MAIN · CONTENT | 라벨을 내용 감수로 쓰는 문서·화면 문구 점검 필요 | 02 |
| P1 강의 행동 0 | P1 | 37/37 cue 에 학생 행동 없음 | MAIN · CONTRACT | 전 회차 동일 골격으로 추정(34·22·38 만 실측) | 10 |
| P1 숙달 유입 | P1 | 들은 cue 계수가 숙달에 들어가는지 | UNVERIFIED | 미측정 | 04 |
| P1 R-MOOD | P1 | 미연구 | GAP | §4-D · 13 | — |
| P1 units_hash | P1 | NULL 3,806행 | UNVERIFIED | published 중 비율 미측정 | 03 |

**요약:** main 제품 경로 직접 영향 = P0-1 · P0-2 · 34② · C1 · 과잉일반화 · 스크롤 · answer 컬럼 · 자료 결함 · verified 라벨 · 강의 행동 0. 격리 전용 = source_hash 결속. 검증 공백 = RLS 실세션 · 단축키 · 숙달 유입 · units_hash. 설계 공백 = 26모델 · 듣기 · R-MOOD.
**코드·DB 는 이 작업에서 고치지 않았다.** main 수정이 필요한 항목(P0-1·P0-2·스크롤)은 별도 구현 작업 대상이며, 34번 제품 경로는 Codex T-0136 범위와 겹치므로 착수 전 owner 조정이 필요하다.

## 2. 데이터 계약 정정 목록

2026-10-24 직접 실행한 SQL(읽기 전용):
`csat_items` 전체 / `csat_item_analyses` distinct item / published 분석이 없는 문항 / 최신 version 의 in_review / 그중 이전 published 보유 / 2026#34 choices 길이·answer.

| 항목 | 기존 S0/S1 기재 | 실측 | 정정 |
|---|---|---|---|
| 전체 문항 | (일부 문서 3,595) | **3,714** | 3,595 는 「분석 행 보유 문항」 — 분모 명시 |
| 분석 행 보유 | — | **3,595** | 분석 전무 119 |
| 공개 분석 부재 | 183 | **302** (=119+183) | 183 은 「최신판 in_review 이면서 published 이력 없음」 만 셈 |
| 검토 중 | 186 = 3 + 183 | 186 = 3 + 183 | 일치 |
| 듣기 전사 | S0: UNKNOWN | 로컬 272문항(16회) 전사 존재 · 분류 248 과 겹침 119 | 검수·권리 NOT_VERIFIED. 선지·정답·원음 0 |
| 2026-34 선지 | LECTURE_CONTRACT: 전문 미확보 | DB choices 5개 · answer 3 | 원지(PDF) 대조 NOT_VERIFIED |
| 유형 | 26 + 18 | 독해 26(active 22/retired 4) · 듣기 분류 18 | 듣기 분류 체계 3종(14·18·17) 불일치 — 통합하지 않음 |

숫자 일치는 내용 정확성 승인이 아니다. 문항 ID·version·원천 hash·권한 결속은 위 표의 어느 행에서도 내용 감수를 대신하지 않는다.
S0/S1 문서의 정정은 Codex owner 파일이라 **직접 고치지 않고** 이 목록을 전달 근거로 둔다.

## 3. 44개 유형 상세설계 상태

| 계열 | 유형 | 상태 | 문서 |
|---|---|---|---|
| 대의 | R-PURPOSE · R-CLAIM · R-GIST · R-TOPIC · R-TITLE · X-TITLE | 상세설계(17항목) · 반례 5 | 05 |
| 대의 | R-SUMMARY | 상세설계 · 본문 29/130 → PARTIAL | 05 |
| 심경 | R-MOOD | 상세설계(17항목) · 132문항(변화 109·단일 18·분위기 5) · 의미층 0 → PARTIAL | 13 |
| 빈칸·함축 | R-BLANK · R-IMPLY (+조건·인과·대조 구조 5) | 상세설계 · R-BLANK body_ok 67% → PARTIAL | 06 |
| 담화 | R-INSERT · R-ORDER · R-IRRELEVANT · X-ORDER | 상세설계 · 무관 표본 1 · X-ORDER 공통화 근거 없음 | 07 · §4-B |
| 정보·형식 | R-FACT · R-NOTICE · R-CHART · R-GRAMMAR · R-VOCAB · X-FACT · X-REFER · X-VOCAB | 상세설계 · CHART **BLOCKED**(수치 0) · GRAMMAR PARTIAL | 08 |
| 보관 | R-BLANK2 · R-REFER · X-BLANK · X-BLANK2 (retired) | 매트릭스 행만 | 01 |
| 듣기 | L-* 18 | 6묶음 상세설계 · 전부 **BLOCKED**(선지·정답·원음·권리 0) | 09 |

(유형 이름 목록의 정확한 26 구성은 01 §ASSET_INVENTORY 가 정본.)

## 4. 미확정 교수설계 결정

### A. 정답 공개 시점 — 제품 계약 제안

> **[2026-10-24 대체됨]** 아래 「잠김 → 답 선택 → 공개」 강제 순서는 사용자 결정 1에서 채택되지 않았다. 현행 계약은 `14_PRODUCT_DECISIONS.md` §결정 1. 이 절은 원문 기록으로만 둔다.

현 main: 해설 화면이 공식 답을 화면 데이터로 싣고(`gate.answer`), 강의는 응답과 무관하게 재생된다. v6 의 학습자 판단 우선 원칙과 맞지 않는다.

**문항×학습자 단위 공개 상태 하나**를 모든 출력(본문 표시·강의 음성·역할 라벨·`reject:N` 대상·강조 순서·ARIA·선지 색)이 공유한다.

| 상태 | 진입 | 허용 공개 상한 |
|---|---|---|
| `LOCKED` | 기본 | 발문 해석 · 관찰 지점 · 관계 질문. 정답 번호·오답 번호·소거 순서·「거부되는 견해」 같은 답 성질 암시 **금지** |
| `COMMITTED` | 학습자가 선지를 고름 | + 학습자가 고른 선지와 가장 끌리는 오답 1개의 근거 대조. 공식 답은 아직 아님 |
| `REVEALED` | 학습자가 「공식 답 보기」 를 명시 선택 | 공식 답 · 전체 오답 근거 · 원리와 적용 한계 |

세 학습 경로:
- **탐색 우선**: LOCKED 로 시작, 강의는 LOCKED 상한 cue 만 재생하고 판단 정지점에서 멈춘다(건너뛰기 가능, 강제 아님).
- **해설 우선**: 학습자가 처음부터 「공식 답 보기」 를 고르면 바로 REVEALED. 기록에 `revealed_before_attempt` 를 남기고 그 시도는 숙달 증거에서 제외한다(활동 기록은 유지).
- **강의 우선**: 강의는 LOCKED 상한으로 시작해 판단 정지점에서 「직접 고르기 / 답과 함께 계속」 을 묻는다. 후자는 해설 우선과 같은 처리.

필요 데이터: cue 마다 `disclosure_level`(LOCKED/COMMITTED/REVEALED) 태그 — 현재 없음(GAP). 태그가 없는 cue 는 REVEALED 로 간주(fail-closed).
결정권: 이 계약 채택은 사용자 결정. 34번 제품 경로 반영은 Codex T-0136 범위와 조정 필요.

### B. 문장 연결 판단 — 공통 vs 전용

| 구분 | 내용 | 적용 |
|---|---|---|
| 공통(의미·교육적 동일성 확인) | 이음매 판정: 앞이 요구하는 것 · 뒤가 받는 것 · 지시 대상은 **범위**로 표시 | R-INSERT · R-ORDER |
| 삽입 전용 | 기존 문장 연결은 고정, **후보 위치 5곳 각각에서 끼우면 끊기는 기존 연결**을 함께 판정(38: 6→7 보존). 필요조건만 채우는 위치(38 ③·④)와 결정 위치 구분 | R-INSERT |
| 순서 전용 | 주어진 첫 단락 고정, (A)(B)(C) 세 블록의 **모든 이음매가 변수** — 각 블록의 시작부가 요구하는 선행 특성 대조(36: another … like this) | R-ORDER |
| 무관 전용 | 이음매가 아니라 **비교 축·판단 기준의 유지**(35: 낱말 반복에도 단기↔장기 축 이탈) | R-IRRELEVANT — 공통화 제외 |
| 미적용 | X-ORDER(장문 순서) — 공통화 근거 문항 분석 없음 | UNDETERMINED |

### C. 2026-34 ②

- 분석(v3): `content_truth=unknown`(지문이 다루지 않음), `requirement_fit=fails`.
- 강의 c7·c10: 「법은 방어받는 쪽」 「주체 역전」 → 사실상 거짓 단정.
- 판정: **어느 쪽도 정답 기준으로 바꾸지 않는다.** 화면·강의 공개는 독립 콘텐츠 감수 전까지 「요구 불충족」 만 확정 근거로 쓰고, 진위는 「미확정」 으로 표시한다. 강의 c7·c10 은 감수 대기 cue 로 표시(원본 대본 수정 안 함).
- 필요한 것: 작성에 참여하지 않은 감수자의 원문 대조 판정(해시 결속).

### D. R-MOOD

→ `13_TYPE_R_MOOD.md`. 실데이터로 상세설계 완료: 132문항 · 선지·정답 132/132 · body_ok 131(H2407G3#19 잘림) · 대표 `2024#19`·`M2706#19`, 경계 `H2109G1#19`(분위기형).
판단 구조: 전환점으로 앞/뒤 구역 분할 → 선지 「A → B」 를 칸별로 대조 → 직접 감정어와 행동 추론 상태 구분(같은 「시계 보기」 가 2024#19 불안 / M2706#19 지루함 — 과독 경계).
하위형 셋(변화·단일·분위기)은 판단 구조가 달라 한 활동으로 묶지 않는다. 공백: 공식 오답률 0 · 전환점·단서 구절 표시 없음 · 감정어 극성 표 없음 · 분석 v3 내용 미검토.

## 5. 신규 발견과 기존 S1 계약의 차이

| S1 기재 | 이번 연구 | 처리 |
|---|---|---|
| F07/F08 REUSE 탈락(제어 위반) | main 실코드에서 재생→장면 교체·선택 소거 확인 — 탈락 근거 보강 | 일치 |
| F08 IMPROVE/REPLACE 후보 유지 | S1 B안은 기존 화면 개선 구현이 아니라 IMPROVE 증거 불가 · C1–C12 판정표 제안(04) | Codex T-0136 D2 와 같은 쟁점 — 전달 근거 |
| C1 후보(38⑤ 근거 [1,4,5,6,7,8]) | 두 작업군 독립 판독 동의 · 단 결정 근거는 For example 접합과 6→7 보존 | Codex D1 에 전달 근거 |
| 34 선지 전문 미확보 | DB 5개 존재 | 문구 정정 필요(Codex 파일) |
| 듣기 전사 UNKNOWN | 272문항 존재 | 문구 정정 필요(Codex 파일) |
| 공개 분석 부재 183 | 302 | 정정 필요 |
| 강의 정답 cue 6개 후보 | 전 회차 대본에 「정답은」 23~29회/회차 | 공개 계약(§4-A) 필요 |
| F02·F06·F09·F10 BLOCKED_EVIDENCE | 유지 · 해제 증거 목록(03 §4) | 일치 |

## 6. 해결된 이견 / 남은 공백

해결: 3,714 vs 3,595(분모) · 줄 번호 271 vs 303(브랜치별, E1 로 main=303 확정) · 듣기 전사 존재 · 34 선지 존재 · 34② 처리 원칙 · 삽입/순서 공통·전용 경계.
남은 공백: 공개 계약 채택(사용자 결정) · 34② 독립 감수 · C1 승인(Codex/사용자) · RLS 실세션 · cue `disclosure_level` 데이터 · CHART 수치 · GRAMMAR 밑줄 범위 · 듣기 선지·원음·권리 · 합성 학습자 증거 사용 범위 · 학습 효과(미검증).

## 7. 다음 구현 범위별 착수 가능 여부

| 범위 | 판정 | 조건 |
|---|---|---|
| 강의 진행이 학습자 선택·스크롤을 빼앗지 않게(P0-1·스크롤) | **착수 가능** | main 제품 코드. 34번 화면과 겹치므로 Codex T-0136 owner 와 파일 범위 조정 후 |
| 공개 상태 계약(§4-A) 구현 | **결정 대기** | 사용자 채택 + cue `disclosure_level` 태깅(드레인) |
| 대의 계열 판단 활동 | 설계 착수 가능 · 구현은 S2 승인 필요 | 05 |
| 담화 계열 | 설계 착수 가능 · C1 승인 전 38 은 후보 표시 | 07 · §4-B |
| 빈칸·함축 | 설계 가능 · 34 는 Codex 경로 | 06 |
| 정보·어휘 | 가능 · CHART 제외 | 08 |
| 어법·요약·도표 | 데이터 보정 선행 | 08 |
| 듣기 | **차단** | 선지·정답·원음·권리 확보 |
| F02·F06·F09·F10 | **차단** | 03 §4 증거 |
| S2 전체 착수 | **미승인** | 공식 독립 수용 없음 |

## 8. Codex 담당 작업과의 충돌

- 이 작업은 Codex 소유 파일(s0 worktree `docs/csat-learner/skeleton-v4/**`, T-0136 allowed_paths)을 **수정하지 않았다**. 쓰기는 이 디렉터리뿐.
- 겹치는 쟁점(쓰기 충돌 아님, 전달 근거): T-0136 D1(C1 표시) ↔ §5 C1 · D2(F08 기준) ↔ 04 C1–C12 · 「34번 5기능 제품 경로 이관」 ↔ §7 P0-1 수정 범위(같은 `AnalysisTheater`/`LectureStage` 파일 — 동시 수정 금지, 순서 조정 필요).
- 다른 세션에 이 내용이 전달되었다는 증거는 없다.
