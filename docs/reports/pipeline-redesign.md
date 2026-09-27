# 교재 공장 파이프라인 — 재설계안 (Gate 2 · 사람 결정 대기)

> 2026-09-23 · **읽기 전용에서 멈춘다.** 이 문서까지가 Gate 0~2 이고, 여기서 정지한다.
> 근거: [pipeline-inventory.md](./pipeline-inventory.md) · [pipeline-scorecard.md](./pipeline-scorecard.md).
> 현재 총점 **7 / 22** · 0점 항목 3 · 0점 칸 22/99.
> **아무것도 적용하지 않았다** — 마이그레이션 0 · 화면 코드 0 · DB 쓰기 0.

## 0. 진단 한 문장

> 교재 공장에는 **여덟 칸짜리 라인이 그려져 있지만, 그 라인이 실제로 막는 것은 아무것도 없다.**
> 재료 두 단계(기출 원천 20/22 · 원문 적격 19/22)는 이미 상태·사유·실패 목록·작업 큐를 갖췄고,
> 나머지 일곱은 **개수만 세고 기록을 안 남긴다.** 그래서 ⑦ 검수가 1% 통과인데 ⑧ 조판이 「통과」로 서고,
> 3인 검수 1/60 인 권이 카탈로그에 「냈음」으로 서고, 학습자에게는 **다른 시리즈의 목차**가 인쇄된다.

발명할 것이 없다. **원문 적격 화면의 모양(STATUS → ACTION · 사유별 대상 · 대상 열람 버튼)을 나머지 일곱에 옮기는 일**이다.

---

## 1. 채점 규칙 정정 1건 (Gate 4 재측정에 쓰인다)

**A5 학습자 도달**에서 `lane='lab'` 이면서 **산출물이 설계상 학습자에게 가지 않는 단계**는 `N/A` 로 두고 평균 계산에서 뺀다. 해당 단계는 **② 기획 하나**다(① 기출 원천은 lab 이지만 분석이 `/csat` 으로 가고, ③ 설계도 사다리가 매대 계단이 된다).

- 정정 전 A5 평균 = 13/9 = 1.44 → 1
- 정정 후 A5 평균 = 12/8 = 1.50 → 1
- **Gate 1 총점 7/22 는 변하지 않는다.** 정정은 Gate 4 에서 만점이 불가능해지는 것을 막기 위한 것이고, 현재 점수를 올리지 않는다.

---

## 2. 0~1점 항목별 — 원인 · 재설계 층 · 비용 · 기대 점수

층: **DB** / **드레인** / **화면** / **IA**. 비용은 사람 시간 기준 추정이다.

| 항목 | 지금 | 원인 (한 줄) | 재설계 층 | 무엇을 | 마이그레이션 | 위험 | 비용 | 기대 |
|---|:--:|---|---|---|:--:|---|---|:--:|
| **B4 실패 목록** | **0** | `csat_item_reviews` 를 읽는 웹 코드가 0곳 — 판정은 조판기 안에서만 쓰이고 화면에 안 나온다 | 화면 | 단계마다 「막힌 항목 N개」 목록 + 항목 열람. ⑦ 은 `csat_item_reviews` 직조회로 revise 501 · fail 159 를 연다 | 없음 | 낮음 — 읽기만 | 2~3일 | **2** |
| **B5 승인 지점** | **0** | 승인 컬럼이 파이프라인 전체에 0개. 승인은 사람 머릿속에만 있다 | DB + 화면 | `csat_pipeline_approvals` 한 표로 9단계 승인을 받는다(§5 M1) + 화면에 「승인 대기 N」 배지 | **M1 신설** | 중간 — RLS·권한 | 2일 | **2** |
| **B6 상태·사유 필드** | **0** | 880,337행 문항 표에 status 도 reason 도 없다. 조판 기록에도 없다 | DB | `csat_item_state` 곁 표(§5 M4) + `textbook_volume_renders` 에 발행 상태(§5 M3) | **M3 · M4** | M3 낮음(19행) · M4 중간(FK 880k) | 3일 | **2** |
| **A1 흐름 정합** | 1 | ⑥ 해설이 갈 곳 없는 메뉴 칸 · 원문 적격에 번호 없음 · ② 기획이 lab 인데 라인 병목으로 계산된다 | IA + 화면 | ⑥ 전용 화면 · 레인(lab/line)대로 그룹 재배열 · `findBottleneck` 에 레인 인자 | 없음 | 낮음 | 2일 | **2** |
| **A2 계약 명시** | 1 | `StageDef.question/output/gate` 가 **모델에 이미 있는데** 단계 화면이 안 쓴다 | 화면 | 공통 `StageFrame` 머리에 「입력 → 출력 → 완료 조건」 한 줄(§4) | 없음 | 낮음 — 값은 기존 모델 | 1일 | **2** |
| **A3 상태 가시성** | 1 | 매트릭스가 있어도 셀 값이 **개수뿐**이고 status 축이 없다 | DB + 화면 | M4 의 status 를 축으로 삼아 항목 × status 매트릭스 | M4 재사용 | 낮음 | 2일 | **2** |
| **A4 실측 정합** | 1 | 원문 적격·기획이 **커밋된 파일**을 읽는다 · ⑦ 이 조판 시각에 얼린 값을 읽는다 · ④ 가 `[object Object]` 를 인쇄한다 | DB + 화면 | 집계 RPC `csat_source_eligibility_tally()`(§5 M5) · ⑦ 은 `csat_item_reviews` 직조회 · `SourceClient.tsx:296-303` 수정 | **M5 함수** | 중간 — 87,720행 집계 시간 | 2일 | **2** |
| **A5 학습자 도달** | 1 | ⑦ 검수가 학습자 경로를 안 막고, ⑧ 출고물이 학습자 경로에 없다. 목차 스냅샷이 **V-Level 키 하나**라 시리즈가 섞인다 | DB + 화면 | ① `volume-contents.json` 키를 `series:step` 으로(스냅샷 재생성) ② 매대가 `textbook_volume_renders.status='published'` 를 본다 ③ 검수 미통과 문항이 재고 집계에서 빠진다 | M3 사용 | **높음 — 공개 표면이 바뀐다** | 4~5일 | **2** |
| **B1 드레인 계약** | 1 | ③ 설계·⑧ 조판에 드레인이 없고 ② 기획은 export 가 스스로 commit 한다 | 드레인 | ⑧ 은 `press-drain`(§6-2) · ② 는 export/import 분리 · ③ 은 **면제 선언 또는 `blueprint-drain`**(§6-3 · 사람 결정) | 없음 | 낮음 | 3일 | **2** |
| **B2 재실행 안전** | 1 | ② 는 검증기·건너뛴 수 없음 · ⑧ `render-volume` 은 `--out` 을 덮어쓴다 | 드레인 | `--commit` 기본 off · 건너뛴 수 출력 · `csat_drain_runs` 기록(§5 M2) | **M2 신설** | 낮음 | 2일 | **2** |
| **B3 막힌 항목 지목** | 1 | 명령은 있는데 「몇 개가 왜 막혔는지」가 없다 | 화면 | `StageFrame` 의 「막힌 것」 줄 = 수 + 사유 + 다음 명령(복사 버튼) | 없음 | 낮음 | 1일 | **2** |

합계 추정: **19~24일**. 단계별 PR 로 쪼개면 §7 의 5개 PR.

---

## 3. IA 안 2개 — 최소 변경 vs 흐름 정합

### 안 A · 최소 변경 — 메뉴는 그대로, 기록만 만든다

메뉴 12칸을 **건드리지 않는다.** 고치는 것 넷:

1. ⑥ 해설 메뉴 항목을 **⑦ 검수 화면 안의 탭**으로 흡수(메뉴에서 제거) — 갈 곳 없는 칸을 없앤다.
2. `csat_pipeline_approvals`(M1) · `csat_drain_runs`(M2) · `textbook_volume_renders.status`(M3) 신설.
3. ⑦ 검수·⑤ 집필 두 화면에 「막힌 항목」 목록 패널을 붙인다.
4. `SourceClient.tsx` 의 `[object Object]` 수정.

| | 값 |
|---|---|
| 메뉴 변경 | 1칸 제거 (12 → 11) |
| 마이그레이션 | M1 · M2 · M3 |
| 화면 변경 | 3화면 |
| 비용 | **7~8일** |
| 기대 총점 | **15 / 22** · 0점 항목 **0개** |
| 안 되는 것 | A5 는 1 에 머문다(학습자 경로는 손대지 않는다) · A2·A3 도 1 유지 |

### 안 B · 흐름 정합 — 모델이 이미 선언한 레인을 메뉴가 따라간다

`factory-model.ts` 는 **`lane: 'lab' | 'line'` 을 이미 선언하고 현황판도 그렇게 그린다**(캡처 `00-dashboard` 의 「전략 연구소 / 생산 라인」 두 띠). 메뉴만 그 구분을 무시하고 「재료 / 공정 / 출고」로 묶여 있다. 안 B 는 메뉴를 모델에 맞춘다.

| 지금 | 안 B |
|---|---|
| **만들기** — 새 교재 만들기 · 카탈로그 | **한 권 내기** — 새 교재 만들기 · 카탈로그 *(그대로)* |
| **재료** — 기출 원천 ① · 원문 적격 | **전략 연구소** — 기출 원천 ① · 기획 ② · 설계 ③ |
| **공정** — 기획 ② · 설계 ③ · 소재 ④ · 집필 ⑤ · 해설 ⑥ · 검수 ⑦ | **생산 라인** — 소재 적격 ③ʙ *(옛 「원문 적격」)* · 소재 ④ · 집필 ⑤ · 해설 ⑥ *(전용 화면 신설)* · 검수 ⑦ |
| **출고** — 조판·발행 ⑧ | **출고** — 조판·발행 ⑧ *(발행 상태 · 승인 · 학습자 링크 추가)* |

함께 바뀌는 것 넷:

1. **`findBottleneck` 이 레인을 받는다.** 지금은 `ord` 가 가장 앞선 미통과 공정을 고르느라 lab 의 ② 기획이 라인 병목으로 표시된다(현황판이 「막힌 곳 · 2. 기획」이라 적는 동안 ④⑤⑧ 은 통과). 라인 병목과 연구소 병목을 **따로** 고른다.
2. **⑥ 해설 전용 화면.** 유형 × 수준 해설 보유 매트릭스 + 빈 칸 목록 + `explain-drain` 패널.
3. **「원문 적격」 → 「소재 적격」** 으로 이름과 자리를 바꿔 ④ 소재 바로 앞에 둔다 — 그 단계의 출력은 ④ 의 입력이지 ①②③ 의 입력이 아니다.
4. 9화면 전부 `StageFrame` 공통 골격(§4).

| | 값 |
|---|---|
| 메뉴 변경 | 그룹 4개 재정의 · 1칸 신설(⑥) · 1칸 개명·이동 |
| 마이그레이션 | M1 · M2 · M3 · M4 · M5 |
| 화면 변경 | 9화면 + 신설 1 + 학습자 2화면(매대·상세) |
| 비용 | **19~24일** |
| 기대 총점 | **20~22 / 22** · 0점 항목 **0개** |
| 위험 | **학습자 공개 표면이 바뀐다** — 발행 상태가 매대를 막으면 지금 보이는 권이 사라질 수 있다. 되돌릴 수 있게 `status` 기본값을 `published` 로 두고 내리는 쪽만 수동으로 한다 |

### 결정이 필요한 것 (사람)

| 질문 | 선택지 |
|---|---|
| **Q1. 범위** | (a) 안 A 최소 변경 · (b) 안 B 흐름 정합 · (c) 안 A 먼저 적용 후 재측정하고 안 B 판단 |
| **Q2. 「새 교재 만들기」와 「기획」 통합** | (a) 그대로 둔다 — 「새 교재」는 **한 권**을, 「기획」은 **시장 전체**를 본다(대상이 다르다) · (b) 통합한다. **권고: (a)**. 다만 「새 교재 만들기」는 지금 아무것도 기록하지 않는 명령 조립기라(§6-4) **작업 지시(work order)를 남기게** 고치는 것을 함께 본다 |
| **Q3. 「해설 준비 중」 처리** | (a) 전용 화면 신설(안 B) · (b) ⑦ 검수 탭으로 흡수(안 A) · (c) 메뉴에서 제거하고 현황판 눈금만 남긴다. **권고: (a)** — ⑥ 은 880,337문항 중 4,719문항이 아직 빈 칸이고 그 분포를 볼 화면이 어디에도 없다 |
| **Q4. 재료 2항목의 관계** | (a) 「기출 원천 ①」은 연구소로, 「원문 적격」은 라인 입구로 갈라 둔다(안 B) · (b) 지금처럼 「재료」 한 묶음. **권고: (a)** — 둘은 입력도 출력도 겹치지 않는다(전자는 평가원 기출, 후자는 `library_articles`) |
| **Q5. ③ 설계에 드레인을 붙일까** | (a) **면제 선언** — 설계는 사람 결정이므로 드레인이 없는 것이 옳다고 적고 B1·B2 채점에서 N/A · (b) `blueprint-drain` 신설(§6-3). **권고: (a)** |
| **Q6. 학습자 매대 게이트** | (a) 발행 상태가 매대를 막는다(공개 표면 변화 있음) · (b) 막지 않고 **경고만** 표시 · (c) 지금 그대로. **권고: (a)** — 지금은 3인 검수 1/60 인 권이 공개 URL 로 열린다 |

---

## 4. 화면 규격 안 — 단계 화면 공통 골격 `StageFrame`

9화면이 같은 골격을 쓴다. 값은 **전부 기존 모델·DB 에서 온다 — 새로 짓는 값이 없다.**

```
┌──────────────────────────────────────────────────────────────────────┐
│ ⑦ 검수 — 다층·다각도                          [승인 대기 3]  [화면 도움말]│
│ 시중: 초교 · 재교 · 삼교 + 감수                                        │
│                                                                      │
│ ① 계약   입력 조판 후보 문항 → 출력 페르소나 3인 판정 → 완료 층마다 100%   │
│          └ StageDef.question / .output / .gate  (factory-model.ts)    │
│                                                                      │
│ ② 막힌 것  ● 292문항이 미해소 revise/fail 을 달고 재고에 남아 있다        │
│           다음:  item-review-drain-export --band 5 --volume 20  [복사] │
│                                                                      │
│ ③ 상태 매트릭스   항목 × status — 셀 색은 현황판과 같은 STATUS_KO 4색      │
│    ┌──────────┬──────┬────────┬──────┬────────┐                       │
│    │ 밴드      │ pass │ revise │ fail │ 미검수  │   ← 칸 값은 자리 표시다  │
│    │ V5       │    · │      · │    · │      · │     (아직 안 잰 값)     │
│    └──────────┴──────┴────────┴──────┴────────┘                       │
│                                                                      │
│ ④ 드레인   마지막 실행 <csat_drain_runs 최신 행> · 청크 n/N · 건너뜀 k   │
│           [export 내보내기]  [import 적재 — 승인 필요 ⚠]                │
│                                                                      │
│ ⑤ 실패 목록   fail 159 · revise 501 (실측)              [전체 보기 →]    │
│    · <item_id> <밴드> <유형>  <페르소나>  «findings 의 첫 줄»            │
│    · … 한 줄이 한 판정. 링크는 그 문항의 검수 이력으로 간다.              │
└──────────────────────────────────────────────────────────────────────┘
```

| 자리 | 값의 출처 | 지금 있는가 |
|---|---|---|
| ① 계약 3줄 | `StageDef.question` · `.output` · `.gate` (`factory-model.ts:106-137`) | **모델에 있고 화면이 안 쓴다** |
| ② 막힌 것 | `StageState.blocker` + `nextCommands[0]` (`factory-model.ts:191-199`) | 현황판에만 있다 |
| ③ 상태 매트릭스 | M4 `csat_item_state.status` × 밴드/유형 | **status 가 없다 → M4 필요** |
| ④ 드레인 패널 | M2 `csat_drain_runs` 최신 행 + 서버 액션 | **없다 → M2 필요** |
| ⑤ 실패 목록 | 단계별 판정 표(⑦ 은 `csat_item_reviews`) | **읽는 코드가 0곳** |

**대시보드와 같은 언어**: 셀 색은 `STATUS_KO` 4색(`pass #2E7D5A` · `short #B5803A` · `blocked #9C3A30` · `unmeasured #8A8278`)을 그대로 쓴다 — 새 색을 만들지 않는다. **「못 잼」과 「0」을 절대 섞지 않는다**(`factory-model.ts:16-19` 의 기존 규칙).

**접근성**: 매트릭스 셀은 색만으로 상태를 말하지 않는다(글자 병기) · 모든 버튼 44px 이상 · 실패 목록 링크에 보이는 focus 표시.

---

## 5. 마이그레이션 초안 (⚠ 적용 금지 — 승인 후)

> AGENTS.md 「마이그레이션 자동 적용 금지」. 아래 SQL 은 **읽히기 위한 초안**이고 실행하지 않았다.
> 적용 전 `pg_get_functiondef` 대조 · `/db-checkpoint` 앞뒤 스냅샷.

### M1 · `csat_pipeline_approvals` — 승인 기록 한 표 (B5 0 → 2)

```sql
-- 9단계의 승인을 한 표에 모은다. 단계마다 표를 만들면 아홉 개가 갈라진다.
create table public.csat_pipeline_approvals (
  id           uuid primary key default gen_random_uuid(),
  stage        text not null check (stage in
                 ('evidence','source','market','blueprint','material',
                  'author','explain','review','press')),
  subject_kind text not null check (subject_kind in ('volume','item','article','type','gate','run')),
  subject_id   text not null,
  decision     text not null check (decision in ('approved','rejected','withdrawn')),
  reason       text,                       -- rejected·withdrawn 이면 NOT NULL 이어야 한다(아래 CHECK)
  decided_by   text not null,
  decided_at   timestamptz not null default now(),
  evidence     jsonb,                      -- 무엇을 보고 결정했나
  constraint reason_required_on_no
    check (decision = 'approved' or (reason is not null and length(reason) >= 10))
);
create index csat_pipeline_approvals_subject_idx
  on public.csat_pipeline_approvals (stage, subject_kind, subject_id, decided_at desc);
alter table public.csat_pipeline_approvals enable row level security;
-- RLS: 관리자만 읽고 쓴다(기존 admin 판정 헬퍼 재사용).
```

### M2 · `csat_drain_runs` — 드레인 실행 기록 (B2 0 → 2 · B3 근거)

```sql
-- CCP 의 드레인 콘솔이 쓰는 기록과 같은 모양. 화면이 "마지막에 무엇이 돌았나" 를 말할 수 있게 된다.
create table public.csat_drain_runs (
  id            uuid primary key default gen_random_uuid(),
  stage         text not null,
  script        text not null,             -- scripts/... 실제 경로
  args          text,
  mode          text not null check (mode in ('export','agent','validate','import','render')),
  status        text not null default 'running' check (status in ('running','ok','failed')),
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  items_total   integer,
  items_done    integer,
  items_skipped integer,                   -- 건너뛴 수 — 재실행 안전의 증거
  error         text,
  run_by        text
);
create index csat_drain_runs_stage_idx on public.csat_drain_runs (stage, started_at desc);
alter table public.csat_drain_runs enable row level security;
```

### M3 · `textbook_volume_renders` 발행 상태 (A5 · B6 · 19행이라 싸다)

```sql
alter table public.textbook_volume_renders
  add column status        text not null default 'published'
       check (status in ('rendered','review','approved','published','withdrawn')),
  add column status_reason text,
  add column published_at  timestamptz;

-- ⚠ 기본값을 'published' 로 둔다 — 지금 매대에 서 있는 권을 조용히 내리지 않기 위해서다.
--    내리는 것은 사람이 한 행씩 한다(§3 Q6).
comment on column public.textbook_volume_renders.status is
  '발행 상태. rendered=찍혔다 · review=검수 대기 · approved=승인됨 · published=매대에 있다 · withdrawn=내렸다';
```

### M4 · `csat_item_state` — 문항 상태·사유 곁 표 (B6 · A3)

```sql
-- ⚠ csat_dcp_items(880,337행 · 1,579 MB)에 컬럼을 더하지 않는다.
--   기본값에서 벗어난 문항만 여기 한 행을 갖는다 — 큰 표를 안 건드리고 상태 축을 얻는다.
create table public.csat_item_state (
  item_id     uuid primary key references public.csat_dcp_items(id) on delete cascade,
  status      text not null check (status in ('usable','blocked','retired')),
  reason_code text not null,               -- 닫힌 열거형: review_fail · review_revise · no_explanation · off_ladder · spec_stale
  reason      text,
  updated_at  timestamptz not null default now()
);
create index csat_item_state_status_idx on public.csat_item_state (status, reason_code);
alter table public.csat_item_state enable row level security;

-- 읽는 쪽 규칙: 행이 없으면 'usable' 이다. **행이 없는 것을 0 으로 세지 않는다.**
```

**비용 주의**: FK 를 붙이는 순간 Postgres 가 `csat_dcp_items(id)` 에 대한 참조 검사를 위해 인덱스를 쓴다(PK 라 이미 있다). `ON DELETE CASCADE` 는 880k 부모 행 삭제 시 비용이 생기지만 그 표는 삭제가 드물다. 초기 적재는 ⑦ 검수 결과 292행뿐이라 **가볍다**.

### M5 · `csat_source_eligibility_tally()` — 커밋 JSON 을 대체할 집계 함수 (A4)

```sql
-- 화면이 커밋된 스냅샷(3일 전) 대신 DB 를 직접 읽게 한다. 87,720행 집계라 함수로 서버에서 접는다.
create or replace function public.csat_source_eligibility_tally()
returns table (grade text, v_level smallint, n bigint, measured_at timestamptz)
language sql stable as $$
  select e.result->>'grade',
         (e.result->'axes'->>'vLevel')::smallint,
         count(*),
         max(e.measured_at)
  from public.csat_source_eligibility e
  group by 1, 2
$$;
```
⚠ **적용 전에 실행 시간을 잰다.** 8초를 넘으면 `withDeadline` 이 잘라 화면이 「못 잼」이 된다 — 그때는 mv 로 바꾼다(30분 갱신 · `textbook_shelf_inventory_mv` 와 같은 방식).

---

## 6. 에이전트 운영 안

### 6-1. 승인 지점 표 — 되돌릴 수 없는 동작과 그 승인 주체

| 단계 | 되돌릴 수 없는 동작 | 지금 | 안 | 기록 |
|---|---|---|---|---|
| ① 기출 원천 | `analysis-drain-import --commit` | 버전을 올려 새 행(되돌릴 수 있다) | 그대로 | `csat_drain_runs` |
| 소재 적격 | `gate-mixed-import --commit` | 예행 → 소량 검증 → commit (도움말에만) | **사람 승인 1회** | M1 `stage='source'` |
| ② 기획 | 벤치마크 리포트 덮어쓰기 | 없음 | `--commit` 분리 | `csat_drain_runs` |
| ③ 설계 | `csat_stage_gates` 임계 변경 | 없음 (`is_locked` 9행 전부 false) | **`is_locked=true` 인 행은 승인 없이 못 바꾼다** | M1 `subject_kind='gate'` |
| ④ 소재 | `write-drain-import --commit` (원글 적재) | 없음 | 시중 자리 하한 25 미달이면 승인 필요 | M1 + runs |
| ⑤ 집필 | `item-drain-import --commit` (문항 적재) | 없음 | 밴드당 1,000문항 초과 적재 시 승인 | M1 + runs |
| ⑥ 해설 | `explain-drain-import --commit` | `answer_key` 덮기 금지 경고만 | 그대로 + runs 기록 | `csat_drain_runs` |
| ⑦ 검수 | `delete from csat_item_reviews` (재검수 위해) | 도움말 경고만 | **삭제는 승인 필수** | M1 `decision='withdrawn'` |
| ⑧ 조판·발행 | `render-volume --out` 덮어쓰기 · **매대 노출** | 없음 | `status: rendered → review → approved → published` 4단 · `published` 전환만 승인 | M1 + M3 |

### 6-2. `press-drain` — ⑧ 에 없는 계약을 만든다 (B1·B2 0 → 2)

조판은 결정적이라 「에이전트가 채우는 중간 단계」가 없다. 그래서 3단이 아니라 **2단 + 승인**으로 계약한다.

```
scripts/textbook/press-drain-export.mjs   (읽기만 · 재실행 안전)
  → 찍을 후보 권 목록 + 권마다 차단 사유를 낸다
    · 검수 미통과 문항 N개      (csat_item_reviews)
    · 해설 없는 문항 N개        (answer_key.explanation_ko)
    · 규격 밖 원글 N편          (csat_source_eligibility)
  → scripts/textbook/press-drain/<series>-<band>.json
  → csat_drain_runs 에 mode='export' 한 행

  [사람 승인]  — 차단 사유 0 인 권만 승인 대상. M1 에 한 행.

scripts/textbook/press-drain-import.mjs --commit   (재실행 안전)
  → build-volume + render-volume 을 부르고
  → textbook_volume_renders 를 upsert (status='approved')
  → --out 을 덮어쓰지 않는다: <out>-<rendered_at>.html 로 쌓고 심볼릭 최신만 교체
  → csat_drain_runs 에 mode='render' 한 행 (items_skipped = 이미 최신인 권)
```

### 6-3. ③ 설계 — 드레인을 붙일까 (Q5 · 사람 결정)

- **(a) 면제 선언 (권고)** — 설계 산출물은 사다리 규격이고 그것은 사람이 정한다. 드레인을 억지로 만들면 「에이전트가 규격을 바꾸는」 경로가 생기고, 그것은 이 저장소가 **일부러 막아 둔 것**이다(`csat_stage_gates.is_locked`). 대신 **`is_locked` 를 실제로 쓴다**(지금 9행 전부 false). B1·B2 를 N/A 로 두고 채점 규칙에 적는다.
- **(b) `blueprint-drain` 신설** — 빈 칸 + 근거를 export 하고 에이전트가 「그 칸에 쓸 유형과 임계」를 제안, import 는 `csat_blueprint_proposals` 에만 넣고 **적용은 승인 후**. 비용 +3일.

### 6-4. 「새 교재 만들기」를 작업 지시로 (Q2 부수 안건)

지금 `/admin/csat/new` 는 4단(무엇을 → 무엇으로 → 규격 → 발주)을 걷고 **아무것도 기록하지 않는다** — 명령 문자열을 조립해 보여 주고 끝난다(`order-model.ts` 는 DB 도 파일도 안 읽는다고 스스로 적는다). 그래서 같은 권을 다음 세션이 다시 고른다.

제안: 마지막 「발주」가 **M1 에 `subject_kind='volume'`, `decision='approved'` 한 행**을 남기고, 그 행이 ⑧ 의 승인 대기 목록에 뜬다. 마이그레이션 추가 없음(M1 재사용). 비용 1일.

---

## 7. 적용 순서 (Gate 3 — 결정 후에만)

A2 「단계(공정)별 PR 하나 · 메뉴 IA 는 별도 PR · 한 PR 에 두 층 금지」를 지킨다.

| PR | 층 | 내용 | 전 → 후 (총점) |
|---|---|---|---|
| **PR-1** | DB | M1 · M2 · M3 (+ 안 B 면 M4 · M5). 화면 변경 0 | 7 → 7 *(기록 자리만 생긴다)* |
| **PR-2** | 드레인 | `press-drain` 신설 · ② export/import 분리 · 전 드레인이 `csat_drain_runs` 에 쓴다 · **재실행 안전 테스트** | 7 → 10 |
| **PR-3** | 화면 | `StageFrame` + 최저점 단계부터: ⑥ 해설(9) → ⑧ 조판(10) → ③ 설계(11) → ④ 소재(14) · ⑦ 검수(14) → ⑤ 집필(15) | 10 → 17 |
| **PR-4** | IA | 메뉴 그룹 재배열 · ⑥ 신설 · 「소재 적격」 개명 · `findBottleneck` 레인 인자 | 17 → 19 |
| **PR-5** | 학습자 | `volume-contents` 를 `series:step` 키로 재생성 · 매대가 `status='published'` 를 본다 | 19 → **21** |
| — | 도움말 | 각 PR 안에서 `help/csat.ts` · `help/textbook.ts` 동기화(AGENTS.md 자동화 정책 ②) | — |

**Gate 4 목표**: 총점 ≥ 18 · 0점 항목 0개 · 운영 측정 3개(막힌 단계 확인 클릭 수 · 재실행 안전 테스트 통과율 · 승인 대기 노출).

---

## 8. 결정 요청 (여기서 정지)

| | 물음 | 권고 |
|---|---|---|
| **Q1** | 적용 범위 — 안 A(최소 변경 · 7~8일 · 15점) / 안 B(흐름 정합 · 19~24일 · 20~22점) / A 먼저 후 재판단 | **안 B**. 안 A 는 0점 셋을 지우지만 **⑦⑧ 의 학습자 도달 0점을 못 고친다** — 그 두 칸이 이 진단에서 가장 아픈 곳이다 |
| **Q2** | 「새 교재 만들기」와 「기획」 통합 | 통합하지 않는다. 대신 §6-4 로 **발주를 기록**하게 한다 |
| **Q3** | 「해설 준비 중」 처리 | 전용 화면 신설 |
| **Q4** | 재료 2항목 관계 | 갈라서 ① 은 연구소, 원문 적격은 라인 입구(「소재 적격」) |
| **Q5** | ③ 설계 드레인 | 면제 선언 + `is_locked` 를 실제로 쓴다 |
| **Q6** | 학습자 매대 게이트 | 막는다. 단 M3 기본값 `published` 로 두어 **지금 보이는 권은 그대로** 두고, 내리는 것은 한 행씩 사람이 |
| **Q7** | 마이그레이션 승인 | M1 · M2 · M3 (안 B 면 + M4 · M5). §5 의 SQL 그대로 적용해도 되는가 |

**결정 전에는 Gate 3 을 시작하지 않는다.** DB 쓰기 0 · 화면 코드 0 인 상태로 멈춰 있다.
