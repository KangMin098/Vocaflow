# 학습자 관리 모델 — Vocaflow Learner Management (SSoT)

> 5개 비교군(LingQ/Readlang · Busuu · 리틀팍스 · 클래스카드 · 듀오링고) 분석 + 라이브 데이터 진단(2026-06-28)을 종합한 학습자 관리 설계의 단일 출처.
> **타겟 결정**: 한국 **수능생 단일 집중** · **L3(교사/학원 B2B) 로드맵 명시 + 데이터 모델 선반영**.
> 모든 "현황" 사실은 코드 grep + DB direct query 로 검증. 스키마 DDL 은 적용 전 제안 — 마이그레이션은 §10 승인 게이트 준수.

---

## 0. 포지셔닝 — 비교군에서 무엇을 취하나

Vocaflow 의 직접 동족은 **LingQ/Readlang**(내 텍스트 import + known-word 추적 + 비게이미피케이션) 단 하나. 나머지는 콘텐츠 제공형(리틀팍스), 게임화(듀오링고), 교사배포(클래스카드), CEFR구조(Busuu)로 정체성이 다름.

| 축 | 채택 모델 | 출처 |
|---|---|---|
| 차별 정체성 | 내 텍스트 import + known-word 성장 | LingQ |
| 진척 시각화 | **known-word count(Implicit Progress)** — 막대 게이지 X | LingQ |
| 목표 관리 | **자료×활동 학습 계획 (자료별 활동 선택)** | 리틀팍스 코스 |
| 동기 톤 | **Calm/비게임화** (진지 학습자 포지션, 트렌드 역행 아님) | LingQ·Busuu |
| 주간 회고 | Report Card(Empathetic 코멘트) | 리틀팍스 월리포트 |
| L3 위탁관리 | 클래스→초대코드→세트배포→리포트 | 클래스카드 |
| 복습/학습흐름 | FSRS + 9모듈 인지계층 | Vocaflow 고유 |

**§10 게임화 금지는 약점이 아니라 시장 포지션** — LingQ·Busuu 둘 다 비게임화로 성인/진지 학습자를 흡수. 수능생(목표지향·진지)에 정합.

---

## 1. 라이브 데이터 진단 (2026-06-28 검증) — P0 범위의 근거

모든 리포트·known-word·Study Plan 은 두 스트림(`learning_records` 원천 + `daily_activity` 집계)에서 파생. 진단 결과:

| 테이블 | writer | 트리거/함수 | row | 판정 |
|---|---|---|---|---|
| `learning_records` | `lib/srs/flush-actions.ts`(flush) + `recordWordBlitzResult` | 없음(client write) | 4 | ✅ **연결+검증됨** (게임 5종 #51~#59 가 전부 flush 경유) |
| `scores` | 게임 완료 핸들러(#56~#58) | 없음 | 0 | ✅ **연결됨, 실플레이 대기** |
| `daily_activity` | **없음** (FlowStripe·WordVaultHub 는 READ) | **없음** | 0 | ❌ **연결 안 됨 = P0** |
| `user_stats` / `known_word_count` | **없음** (컬럼 미존재) | 없음 | 0 | ❌ **미연동 + 신규 컬럼** |

**핵심 결론**: synthesis 의 "P0 = 모듈 종료 INSERT 파이프라인"은 `learning_records` 한정 **이미 완료**(SRS flush + 게임 5종). 진짜 남은 P0 는 **집계층 신설**(`daily_activity` 자동 충전 + `known_word_count`). 원천 스트림은 이미 흐른다.

---

## 2. 데이터 모델 (DDL 제안)

### 2-1. 기존 테이블 보강

```sql
-- user_profiles — 온보딩/페르소나 (수능생 단일 집중)
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS persona text,           -- 'csat' (현 단일) · 향후 'adult_self'/'general'
  ADD COLUMN IF NOT EXISTS onboarded_at timestamptz;

-- user_stats — known-word 캐시 (LingQ형 Implicit Progress)
ALTER TABLE public.user_stats
  ADD COLUMN IF NOT EXISTS known_word_count integer NOT NULL DEFAULT 0;  -- derived 캐시 (§3 정의)
```

### 2-2. 신규 — 학습 계획 (자료×활동 · 리틀팍스형) ⚠️ 재설계 2026-06-28

> 초기 설계의 수능 D-day 역산(`learning_goals`)은 **폐기**(0 rows DROP). 학습 계획 = 플랫폼 자료(도서/스크립트/공용단어장)별로 **할 활동을 고르는** 구성(리틀팍스 코스형). "수능 단일 집중"은 타겟 페르소나로만 유지하고 계획의 substance 는 자료×활동.

**리치 구성 (2026-06-28 v06.102):** 자료 4종(material_type += `'article'`) + 도서 `chapters int[]`.
**요일 결합 (v06.105):** 학습 **요일을 항목별로** (`weekdays int[]`) — 자료 선택과 결합. 전역 `study_plan_schedule`/시간(분) **폐기**(따로 선택 = 이질감·계획성 약함, 사용자 피드백).

```sql
CREATE TABLE public.study_plan_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  material_type text NOT NULL CHECK (material_type IN ('book','article','word_set','script')),
  material_id   uuid NOT NULL,                 -- library_books|library_articles|shared_word_sets|texts (다형)
  modules       text[] NOT NULL DEFAULT '{}',  -- 선택 활동(아래)
  chapters      int[]  NOT NULL DEFAULT '{}',  -- 도서 선택 챕터 idx (빈=전체)
  weekdays      int[]  NOT NULL DEFAULT '{}',  -- 학습 요일 1=월..7=일 (빈=미정) — 자료와 결합
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, material_type, material_id)  -- 자료 1개당 1행
);
ALTER TABLE public.study_plan_items ENABLE ROW LEVEL SECURITY; -- 본인 4정책
-- study_plan_schedule(전역 주당 리듬 + 하루 분) 폐기 — 요일은 위 weekdays 로 항목별 결합
```

**자료 4종** = 도서(library_books·표지·챕터) / 스크립트(library_articles·소스 배지) / 공용단어장(shared_word_sets·이모지) / 내 스크립트(texts).
**활동(modules)** + 자료유형별 가용:

| 자료 | 가용 활동 |
|---|---|
| 도서 · 내 스크립트 | 10종 전부 (listen/read/echo/vocab/flashcard/wordblitz/pairflip/spellforge/scriptquiz/dictation) |
| 스크립트(article) | echo 제외 9종 (전용 echo 라우트 없음) |
| 공용단어장 | vocab·flashcard·wordblitz·pairflip·spellforge (어휘 5종) |

코드: `plan-activities.ts`(활동·매트릭스·라우트·WEEKDAYS·소스라벨) + `plan-actions.ts`(4종 fetch + chapters + fetchSchedule/saveSchedule) + `/plan` + `PlanClient.tsx`(일정 스트립 + 비주얼 카드 + 4탭 picker + 챕터 선택 + launch).

### 2-3. 신규 — 주간 리포트 (리틀팍스 월리포트 이식)

```sql
CREATE TABLE public.weekly_reports (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start    date NOT NULL,                         -- 주 시작(월요일)
  total_minutes integer NOT NULL DEFAULT 0,
  total_words   integer NOT NULL DEFAULT 0,            -- 그 주 학습 단어
  known_delta   integer NOT NULL DEFAULT 0,            -- known_word_count 주간 증가
  by_module     jsonb NOT NULL DEFAULT '{}'::jsonb,    -- 모듈별 세션/시간
  empathetic_note text,                                -- Lora italic "사람의 말투" 코멘트(§철학3)
  generated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_start)
);
ALTER TABLE public.weekly_reports ENABLE ROW LEVEL SECURITY;
```

### 2-4. P0 — `daily_activity` 자동 충전 트리거

`daily_activity`(user_id, date PK · total_minutes · total_words · by_module · avg_accuracy)는 이미 존재하나 writer 0. `learning_records` 가 이제 흐르므로 **AFTER INSERT 트리거**로 자동 집계:

```sql
CREATE OR REPLACE FUNCTION public.agg_daily_activity_from_learning_record()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO daily_activity (user_id, date, total_words, by_module)
  VALUES (NEW.user_id, (NEW.attempted_at AT TIME ZONE 'Asia/Seoul')::date, 1,
          jsonb_build_object(NEW.module::text, 1))
  ON CONFLICT (user_id, date) DO UPDATE SET
    total_words = daily_activity.total_words + 1,
    by_module = daily_activity.by_module ||
      jsonb_build_object(NEW.module::text,
        COALESCE((daily_activity.by_module->>NEW.module::text)::int, 0) + 1);
  RETURN NEW;
END $$;

CREATE TRIGGER trg_daily_activity_from_lr
  AFTER INSERT ON learning_records
  FOR EACH ROW EXECUTE FUNCTION agg_daily_activity_from_learning_record();
```

- `total_minutes`/`avg_accuracy` 는 `scores`(세션 시간/정확도) 기반 별도 트리거 또는 세션 종료 시 보강(2차).
- daily_activity 는 §10 금지 대상(memory_state 등)이 **아님** — 정당한 집계 materialized 테이블.

### 2-5. 신규 — L3 위탁관리 (클래스카드 모델 · **데이터 모델만 선반영**, 화면 Phase 2)

```sql
CREATE TABLE public.classes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text NOT NULL,
  invite_code text NOT NULL UNIQUE,                  -- 초대코드 기반 등록(클래스카드 정석)
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.class_members (
  class_id   uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       text NOT NULL DEFAULT 'student',        -- student | assistant
  joined_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (class_id, user_id)
);
CREATE TABLE public.assignments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id   uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  kind       text NOT NULL,                          -- 'text' | 'word_set'
  ref_id     uuid NOT NULL,                          -- texts.id | shared_word_sets.id
  due_at     timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

- **`user_profiles.role`** (기존재 — Phase 2K /admin RBAC 에서 사용) 에 `teacher` 값 추가로 L3 진입.
- 리포트→학부모: `weekly_reports` 읽기전용 공유 링크(토큰) — Phase 2.
- 테스트/차수: 기존 `scores`/`learning_records` 재사용(신규 테이블 불요).
- **선반영 범위(지금)**: 위 3 테이블 + role 값 + RLS 정책 골격만. 화면(`/teacher/*`)은 Phase 2.

---

## 3. known-word 계산 정의 (§10 derived 원칙)

`known_word_count` 는 **저장 상태가 아니라 집계 캐시**. `memory_state`/`mastery_progress`/`last_days`/`next_days` 컬럼화 금지 원칙 유지.

```
known_word_count(user) := count(vocabularies v
                                WHERE v.user_id = user
                                  AND v.stability >= KNOWN_STABILITY_THRESHOLD)
KNOWN_STABILITY_THRESHOLD = 21  (일) — 기존 P6.2 stable dedup 임계와 정합
```

- **캐시 갱신**: flush(`flush-actions.ts`) 가 vocabularies 업데이트 후 `user_stats.known_word_count` 재계산 upsert (또는 daily 트리거/cron). 실시간 정확도 < 캐시 단순성 트레이드오프 — 캐시 채택.
- **R(t) 4색**(stable/shaky/risk/new)은 여전히 동적 계산(저장 X). known_word_count 는 "안정 단어 누적 수"라는 별개 Implicit 지표.
- **시각화(§철학4 Implicit Progress)**: 막대 게이지 대신 "서재가 차오름 / V-Level 풍경이 깊어짐" — 누적 단어가 환경을 바꾼다. 듀오 XP(외적 보상) 반대편의 "내 자산이 쌓인다"(내적 동기, SDT 자율성).

---

## 4. 학습 계획 구성 모델 (일정 + 자료×활동 · 리틀팍스 코스형) ⚠️ 리치 구성 2026-06-28

> 초기 "수능 D-day 역산"은 폐기. **언제(일정) · 무엇을(자료) · 어떻게(활동)** 3요소를 비주얼로 고른다. 텍스트 위주 → 표지/배지/이모지 + 선택 중심(학습 의욕).

```
요일 결합(v06.105): 학습 요일을 자료에 부착(study_plan_items.weekdays) — 따로 선택 X. 시간(분) 폐기.
자료(4종): 도서(표지·챕터 다중선택) / 스크립트=article(소스 필터) / 공용단어장(이모지) / 내 스크립트
         → 활동(자료유형별 가용) + 요일 다중 선택 → study_plan_items 1행 (+chapters +weekdays)
화면 /plan (v06.106 컴포저 + 주간 보드 — 나열식 폐기, 한눈에 클릭클릭):
  · 주간 보드 = 담은 자료를 요일(월~일) 칼럼에 배치 — 날짜 한눈에. 칩 클릭 → 우측 구성 편집. 요일 미정은 하단 행.
  · 컴포저 2-pane = 좌:자료 고르기(4탭 → V밴드 섹션 + 서브필터 → 표지 그리드/목록) · 우:선택 자료의 **챕터·활동·요일 칩 한 화면**
    - 신규(좌 클릭) → 우 구성 → ‘계획에 담기’ / 담은 항목(보드 클릭) → 우 토글 즉시 저장 + ‘바로 시작’(launch) + 빼기
    (단어장 V는 slug auto-vlevel→cefr 폴백 · 챕터 종속 세트 library_book/article 제외)
자료 라우트: book→/library/books/[id] · article→/library/scripts/[id] · word_set→/library/vocab#set-{slug} · script→/text/[id]
컴포넌트: WeekBoard · BoardChip · DraftConfig(신규) · ItemConfig(편집) · BookGridItem/MaterialRow(고르기) · WeekdayChips/ActivityChip/ChapterChip
```

- 계획 = "언제(요일)·무엇을·어떻게" 한 흐름에 결합. 수능 D-day·완료일 역산·시간 압박 지표 없음(§철학1 Calm·§철학4 Implicit). 요일은 deadline 이 아니라 **리듬**.
- /manage 학습 계획 카드 = 담은 자료 N개 · 활동 N개 + 상위 자료명 요약.
- **활동 실행(launch)** — /plan 카드 기본 = 선택 활동을 **그 자료 단어로 바로 시작**하는 링크. scoped 진입(아이콘 ▶): **flashcard·spellforge·wordblitz** = 스크립트 `?text=`·단어장 `?set=` (scoped-words `fetchScopedWords` 정합: set→shared_words, text→vocabularies) · **scriptquiz** = 스크립트 `?text=` · listen·read·echo·vocab→본문. 미스코핑(모듈 hub ↗): **pairflip(sessionStorage config)·dictation(multi-step)·도서 게임**. (`activityLaunchHref`/`isActivityScoped` · v06.111)
- (후속) pairflip·dictation 자료 스코핑(flow 기반 진입 개조) · 자료별 진행도.

---

## 5. 학습자 여정 + 화면 (3 모드)

```
[진단]→[학습 계획]→[일일 루프]⇄[주간 리포트]
 V-Level  자료×활동    LingQ+9모듈   리틀팍스
```

### L1 학습자

| 화면 | 신규/보강 | 핵심 | 영감 |
|---|---|---|---|
| `/plan` | 🆕 | 자료(도서/스크립트/단어장)별 활동 선택 → study_plan_items (수능 D-day 폐기) | 리틀팍스 코스 |
| `/diagnostic` | 有 | V-Level + CSAT track 측정(수능 집중) | Busuu placement |
| `/hub` | 보강 | 오늘 할 일(due+i+1) · 이어하기 · 완료일 예측 | LingQ+Busuu |
| `/dashboard` | 보강(실데이터) | known-word 성장 · 기억 4색 · streak(약하게) | LingQ+리틀팍스 |
| `/reports` | 🆕 | 주간 Report Card(Lora italic 코멘트) | 리틀팍스 |
| `/wordvault` | 有 | 단어 자산 · 복습 due | LingQ vocab |

### L2 운영자 (admin)

| 화면 | 기능 | 데이터원 |
|---|---|---|
| `/admin/users` | 학습자 목록·진도·V-Level·이탈위험 | user_profiles·user_stats·daily_activity |
| `/admin/users/[id]` | 개별 타임라인·known-word 추세·기억분포 | daily_activity·vocabularies·learning_records |
| `/admin/analytics` | 리텐션·진단완료율·루프완주율 | daily_activity 롤업 |

### L3 위탁관리 (teacher · 클래스카드형 · **Phase 2 화면**, 데이터 선반영)

| 요소 | 클래스카드 대응 | 테이블 |
|---|---|---|
| 클래스 개설 → 초대코드 등록 | 초대코드 | classes · class_members |
| 세트/텍스트 배포 | 과제 | assignments |
| 차수/테스트 결과 | 세션 결과 | scores · learning_records(재사용) |
| 리포트 → 학부모 | 카톡/링크 | weekly_reports 공유 토큰 |

---

## 6. 핵심 결정 (5개 비교군 검증 + 본 진단)

| # | 결정 | 채택 |
|---|---|---|
| 1 | 게임화(XP/league) | **전면 기각** (LingQ·Busuu 비게임화 = 진지 학습자/수능생 정합) |
| 2 | 진척 시각화 | **known-word 성장(Implicit)** |
| 3 | 목표관리 | **자료×활동 학습 계획(리틀팍스 코스형)** |
| 4 | streak | 약하게(warm) — 듀오 압박 회피 |
| 5 | 타겟 | **수능생 단일 집중** (persona='csat', target_v_level default V8, CSAT track 진단) |
| 6 | L3 B2B | **로드맵 명시 + 데이터 모델 선반영**(classes/초대코드/role), 화면 Phase 2 |
| 7 | **P0** | **`daily_activity` 자동 충전 트리거 + `known_word_count` 캐시** (원천 스트림은 이미 흐름) |

---

## 7. 구현 시퀀싱 (진단이 결정한 범위)

| Phase | 작업 | 비고 |
|---|---|---|
| **P0** | `daily_activity` 트리거(§2-4) + `known_word_count` 컬럼·캐시(§2-1·§3) | learning_records 이미 흐름 → 트리거 1개로 집계 충전 |
| P1 | `study_plan_items` + `/plan` + 자료×활동 구성(§2-2·§4) | 리틀팍스 코스 (재설계 2026-06-28, 수능 D-day 폐기) |
| P2 | `weekly_reports` + `/reports` + Empathetic 코멘트(§2-3) | daily_activity 집계 전제 |
| P3 | `/dashboard` 실데이터화(known-word 성장·기억 4색) | P0 산출물 소비 |
| P4 (B2B) | L3 화면(`/teacher/*`) — classes/assignments/리포트 공유 | 데이터 모델은 P0~ 선반영 |

**불변의 한 줄**: known-word·Study Plan·리포트 전부 `daily_activity`/`learning_records` 파생. learning_records 는 이번 세션(#38·#51~#59)에 가동됨 → **P0 는 집계 트리거 하나로 시작**.

---

*관련: 메모리 [[project-srs-persistence-a1]] · [[project-a3-game-real-data-sweep]] · `docs/LEARNING_MODEL.md`(9모듈 인지계층) · `docs/VOCAB_LAYERS.md`(Cold/Warm/Hot). 본 문서는 설계 SSoT — DDL 적용은 §10 마이그레이션 승인 게이트 준수.*
