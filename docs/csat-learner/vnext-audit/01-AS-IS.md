<!-- docs/csat-learner/vnext-audit/01-AS-IS.md -->
# 01. AS-IS: 지금 무엇이 어떻게 돌아가는가

표기 규칙은 [README](./README.md#근거-표기)를 따릅니다. 경로는 별도 표시가 없으면 `apps/web/src/` 기준입니다.

## 1. 전체 아키텍처

```
[공급]  PDF·정답표 ─ ingest-*.mjs ─▶ corpus JSON ─ corpus-sync ─▶ csat_types / csat_exams / csat_items
                                                              └─ units-build (학평만) ─▶ csat_item_units
        analysis-drain export ─▶ 에이전트(csat-item-analyst) ─▶ validate ─▶ import ─▶ csat_item_analyses (버전 행)
        평가원: 자기 3인 검수(csat_analysis_reviews) ─┐
        학평: review-drain 블라인드 3인(csat_independent_reviews, 해시 결속) ─┴▶ csat_guard_published ─▶ status=published
        파생: skeleton(평가원 JSON · 학평 DB) · lecture-data JSON · trap-atlas JSON · type reports · anchor-data

[학습자]  서버: 분석·골격·강의 차례(대본은 /api/csat/lecture) ─▶ 화면
         기기: PDF ─ reflow ─▶ IndexedDB papers ─▶ 왼쪽 원문
         기록: IndexedDB record(DissectionRecord) ⇄ PUT/GET /api/csat/state ⇄ csat_learner_state.record(jsonb)
         진단: /api/csat/diagnosis/* ─▶ csat_dx_* (점수·등급)
         이벤트: POST /api/analytics/event ─▶ funnel_events
```

### 브랜치 상태 차이

| 항목 | origin/main `6870e00d4` | :3000 화면(map-vnext `981e75083`) |
|---|---|---|
| 홈 탭 | 유형 · 함정 (기본은 유형) | Workspace · 유형 · 함정 (기본은 Workspace) |
| `/csat/workspace/[id]` | 없음 | 있음 (`lib/csat/workspace.ts` 418행 등) |
| 학평 로컬 원문 (개발용) | 없음 | 있음 (`981e75083`) |

출처: [사실·코드] `git diff --stat origin/main feat/map-vnext`(80개 파일, +2670/−723), [사실·화면] A2.

## 2. 학습자 화면 (실측)

| 라우트 | 컴포넌트 | 주 행동 (실측) | 저장 | 이벤트 | 캡처 |
|---|---|---|---|---|---|
| `/csat` | `space/SpaceScreen` | 「3문항으로 시작 · 약 12분」(→해부) | 읽기 + 복습 압축 저장 | `csat_home_viewed`, `csat_space_scoped`×2 | A2 |
| `/csat` (로그아웃) | — | `/login?next=/csat`로 이동 | — | — | A1 |
| `/csat/browse` | `browse/CsatWorkspace` | 회차별 번호 칩 → 문항 | 없음 (필터는 useState) | `screen_viewed`만 | B |
| `/csat/item/[slug]` | `theater/AnalysisTheater` | 예측 게이트 확정 | IndexedDB predictions·views → PUT state | 확정 이벤트 **없음** | C1–C4 |
| `/csat/dissect` | `session/SessionRunner` | PDF 놓기 → 훑기 → 예측 3수 → 결정 | predictions·formulas·queue·completed·drafts·active | `csat_session_started` | D |
| `/csat/formulas` | `ProgressView` | (빈 상태) 「아직 남긴 공식이 없어요」 | — | — | E1 |
| `/csat/record` | `home/RecordScreen` | 「덮은 넓이」. 「이 기기에만 저장 중」 표시 | — | — | E2 |
| `/csat/diagnosis` | `DiagnosisShell` | 「첫 시험 기록」 | `csat_dx_*` (서버 채점) | `csat_dx_viewed`×2 (중복) | E3 |
| `/csat?view=continue` | `ContinuePanel` | 멈춘 세트 · 복습 오늘/내일/이번 주 · 최근 연 문항 | — | `csat_home_viewed` | E5 |
| `/csat/workspace/[id]` | map-vnext 전용 | — | — | — | (계정에 Workspace가 없어 미확인) |

### 화면에서 직접 본 결함
1. **홈 머리의 문항 수**: 「기출 802문항 · 2014–2027」. 학평 2,606문항이 빠져 있습니다 [사실·화면] A2.
2. **홈 진단 카드**: 「내 진단을 지금 불러오지 못했어요」. 콘솔에 503이 2건 찍혔습니다 [사실·화면] A2.
3. **극장에서 확정할 때 저장되는 것**: `PUT /api/csat/state` 1건이고 본문은 `predictions:[{item:"2026#34", step:1, hit:false, source:"theater"…}]`입니다. 학습 이벤트는 0건입니다 [사실·화면] C2.
4. **모르겠어요 경로**: 똑같이 `PUT /api/csat/state`로 `hit:false` 예측이 저장됩니다. 이 기록은 적중 통계에 들어갑니다 [사실·화면] C3 + [사실·코드] `dissect.ts:131`.
5. **극장의 「다음 단계」 버튼은 정상입니다(정정).** 처음 기록한 「활성화되지 않음」은 프로브 결함이었습니다. 이름이 같은 버튼이 두 개 있어(글자 버튼과 둥근 화살표, `AnalysisTheater.tsx:351,370`) 프로브의 선택자가 둘 다 잡았고, 활성 여부 검사가 오류를 내 「비활성」으로 읽혔습니다. 코드는 마지막 단계에서만 비활성화합니다. 남는 사실은 **마지막 단계에 완료·복습 상태나 문구가 없다는 것**입니다 [사실·코드].
6. **다시 열기**: 확정한 문항은 다시 열면 게이트 없이 대조 상태로 바로 열립니다. 다만 로컬 기록만 읽으므로 다른 기기에서 한 확정은 반영되지 않습니다 [사실·화면] C2 + [사실·코드] `reveal-gate.ts:58-61`.
7. **원문 미준비 (배포 조건)**: 왼쪽에 안내문 2줄과 [여기 놓기]가 나옵니다. 평가원 회차라면 해부 화면에는 [평가원에서 받기]가 있지만 극장 왼쪽에는 없습니다 [사실·화면] C1·D.
8. **해부 화면**
   - 스킨: 옛 보라색 세리프입니다. 같은 영역의 다른 화면은 3B입니다.
   - 라벨: 「학습 허브」 링크가 `/csat`로 갑니다.
   - 원문: 개발용 로컬 PDF를 자동으로 읽지 않습니다.
   - 근거: [사실·화면] D.
9. **서가**: 무작위 문항 링크의 href가 서버와 클라이언트에서 다릅니다(hydration 경고) [사실·화면] B.
10. **없는 문항 `/csat/item/9999-99`**: 일반 404 화면이 나오지만 HTTP 상태는 200입니다 [사실·화면] F1.
11. **강의 API가 500을 낼 때**: 화면에 아무 안내가 없습니다(status·alert 0건) [사실·화면] F2.

## 3. 콘텐츠 의존 체인

```
원문(PDF) ─ hash? ─▶ csat_items.passage ─ csat_item_input_hash ─▶ csat_item_units(학평만, n 1기반)
   └▶ csat_item_analyses(version, units_hash 학평만) ─▶ 검수 ─▶ published (문항당 여러 버전 공존)
        ├▶ 평가원 skeleton-data JSON (빌드 시점 최신 published에서 인용 매칭, 0기반 문장 번호)
        ├▶ 학평 csat_item_skeletons (source_hash 저장 · 비교 코드 없음)
        ├▶ lecture-data JSON (분석 버전·해시 결속 없음)
        ├▶ trap-atlas JSON (학평은 최신 버전이 published가 아니면 문항 제외)
        └▶ csat_type_reports (updated_at만)
```

### 전파되지 않는 변경 [사실·코드]
| # | 끊긴 곳 | 결과 |
|---|---|---|
| 1 | 평가원 원문·단위가 바뀌어도 보류 트리거가 없음 (`csat_hold_on_units_change`는 `H%` 전용) | 낡은 분석이 계속 발행된 상태로 남음 |
| 2 | 평가원 골격 JSON은 빌드 시점에 굳고, 화면은 런타임 최신 분석을 읽음. 둘은 앵커 id로만 짝지어짐 | 재발행 뒤 강조 위치와 설명이 어긋날 수 있음 |
| 3 | 강의 데이터 ↔ 분석: 결속 없음 | 강의가 옛 분석을 읽어 줄 수 있음 |
| 4 | 아틀라스(학평)와 학습자 로더의 버전 선택 규칙이 다름 | published v2 위에 draft v3이 있으면 아틀라스에서 빠짐 |
| 5 | `csat_item_skeletons.source_hash`를 비교하는 코드 없음 | 낡음을 감지하지 못함 |
| 6 | `.github` CI에 `csat:atlas --check`, `build-skeleton` 낡음 검사 0건 | 사람이 돌려야만 잡힘 |
| 7 | `order-view.ts:104`, `client.ts:147`이 버전을 접지 않고 셈 | 유형별 분석 수가 부풀 수 있음 [미확인: 화면 영향] |

### 문장 번호 기준
- 분석 프롬프트와 학평 단위는 1기반입니다.
- 평가원 화면은 `sentence_index`를 쓰지 않고 인용 매칭으로 번호를 새로 매기며, 이 번호는 0기반입니다(`passage-skeleton.ts:21`).
- 강의 cue와 reveal도 0기반입니다. 1기반에서 0기반으로 바꾸는 코드는 없습니다.
- 근거: 실측 일치율 1기반 65%, 0기반 15.8%(`anchor-inventory.mjs:9`).

## 4. 구현 사실 / 문서 주장 / 설계 가설

| 주제 | 구현 사실 | 문서 주장 | 설계 가설 (1차 검토 포함) |
|---|---|---|---|
| 예측 게이트 | 닫힌 분석 블록이 `hidden`으로 DOM에 있음. 정답 키가 props에 있음 | 브리프 A3 「DOM에 없음」 | 보안 경계로 두지 않는다는 것이 09-25 결정 |
| 모르겠어요 | hit=false 예측으로 저장되어 적중 통계에 포함 | 「바로 보기」 | `viewed`로 따로 기록해야 함 |
| 해부 범위 | 공개 문항 전체. 메타는 보충용 | `browse.ts:7` 주석 「손검토 문항만」 | — |
| 복습 | 고정 3일 1회. FSRS 아님 | 브리프 「간격 반복」 | 기출 복습 대상과 성공 기준을 따로 정의해야 함 |
| 옛 시도 표 | 학습자 경로 0곳 | `lib/admin/help/kice.ts:43` 「세션 풀이가 csat_session_attempts에 쌓인다」 | 은퇴 표기 필요 |
| 평가원 검수 | 자기 3인, 해시 결속 없음 | — | 공통 독립 기준 (1차 검토 P0) |
| 함정 분류 | 1,726종, 1회 사용이 1,325종 | 「513종」(평가원만) | 7–9계열 후보는 미검증 |
| 진단 | 점수·등급·게이지 | 브리프 A2 「채점 없음」 | 진단과 학습을 분리해 공존 |
| 이벤트 | 24종 모두 송신처 있음. 학습 핵심 행동 7개는 이벤트 없음 | — | 이벤트 사양 v1 (02 §6) |
| 개발 계정 분리 | 플래그 없음 | — | 측정 오염. 분리 필요 |
| 원문 | 서버가 보내지 않음. 기기에서 reflow | D17 법률 자문 미결 | 경계 유지 |

## 5. 관리자 (AS-IS)
- `/admin/csat/evidence`
  - 탭: 운영 현황(PIPELINE 5단계의 첫 차단 수), 작업 큐(WORK_ISSUES), 문항 탐색(축 교차), 검수 진행(학평 전용).
  - 최신 published 버전 기준으로 계산합니다(`evidence.ts:221-258`).
  - **실행 버튼이 없습니다.** 모든 조치는 CLI입니다.
- `/admin/csat/*` 셸은 「교재 공장」입니다(`AdminSidebar.tsx:157-195`).
  - `/admin/csat/review`(교재 원고 검수 ⑦)와 evidence의 「검수 진행」(기출 분석 검수)이 같은 이름을 씁니다.
  - 기출 분석 뷰는 `/admin/kice/*`로 따로 떨어져 있습니다.
- 학습자 컴포넌트 6개가 관리자에서만 쓰입니다: Heatmap, LocusBar, TrapAtlas, ReportText, PlanTimeline, LecturePlayerBar.
