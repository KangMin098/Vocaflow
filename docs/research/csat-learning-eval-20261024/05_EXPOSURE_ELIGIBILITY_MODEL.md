# 05 · P6 노출 수준과 독립 수행 적격성 모델 (E5)

> 읽기 전용 조사. 새 표·RPC·마이그레이션·DB 쓰기 없음. 결정 규칙 정본: [rubric/p6-exposure-map.json](./rubric/p6-exposure-map.json).
> 근거: `20261023194123_learning_exposures.sql`(sha256 `741e0585…f6be8e`) · `20261024012226_learning_exposures_fix_v3_1.sql`(`3f8b9e99…c7f5b8`, 전체 해시는 JSON) · 기반 뷰 `learning_first_attempts`(20261008160000/180000).

## 1. P6 실제 구조

### 1-1. `public.learning_exposures` (append-only 사건 원장)
| 열 | 기록 내용 |
|---|---|
| `user_id` | 노출된 학습자(auth.users FK, cascade) |
| `client_exposure_id` | 클라이언트 요청 id — `(user_id, client_exposure_id)` unique, 재전송 멱등 |
| `item_ref` | 노출된 문항(1–120자) |
| `kind` | `answer_direct`(정답 직접) · `decisive_hint`(결정적 단서) — **두 값뿐** |
| `source` | `lecture_until` · `lecture_full` · `lecture_continue` · `judgment_scene` · `reveal_api` · `item_page_render`. 제약: `decisive_hint` 는 lecture_* 에서만 |
| `analysis_version` · `lecture_version` · `lecture_digest`(sha256 hex) · `cue_id` | 어떤 판본·강의·단서였는지 |
| `occurred_at` | 클라이언트 주장 시각 |
| `received_at` | 서버 `clock_timestamp()` — **순서 판정 기준** |
| `clock_suspect` | `|received − occurred| > 600초` |
| `synthetic` | 합성 행(삭제 허용) |

- 쓰기: `learning_exposure_record(...)` RPC, service_role 만. 학습자는 본인 행 SELECT 만. UPDATE 전면 거부, DELETE 는 합성·계정 삭제 cascade 만.
- v3.1: RPC 의 auth.users 확인 제거(FK 로 대체) · tracking 표 service_role INSERT/DELETE 회수.

### 1-2. `learning_task_attempts.exposure_order_at` + 트리거
- 시도 INSERT 시 (user, item_ref) advisory 잠금 뒤 `clock_timestamp()` 기록 → 같은 학습자·문항의 시도와 노출이 커밋 순서로 직렬화.
- nullable·기본값 없음: 트리거 이전 시도는 NULL.

### 1-3. `learning_exposure_tracking` (1행) — `started_at` = 추적 시작(개발 DB: 2026-10-23 19:41:23Z).

### 1-4. `learning_attempt_independence(attempt_id)` — 조회 시 계산(저장 안 함)
판정 순서: `legacy_unknown` → `not_check_phase`(activity≠theater 또는 phase≠practice) → `repeat` → `helped`(after_viewed_first · after_explanation · help_level≠independent) → `after_exposure`(원장 received_at ≤ exposure_order_at, 동률 포함) → `timing_held` → `unbound` → `ungraded` → `independent_candidate`. 숙달을 자동으로 올리는 값은 없다.

### 1-5. 개발 DB 실측(2026-10-24 SELECT)
- `learning_exposures` **0행**, `exposure_order_at` 가 채워진 시도 **0건**.
- `Vocaflow-main-serving/apps/web/src` 에 `learning_exposure_record` · `learning_attempt_independence` 호출 **없음**. 스키마는 있으나 기록 경로가 제품에 연결되지 않았다 → 현재 모든 시도는 원장 측면에서 X_UNKNOWN.

## 2. 서버 관측 가능 / 불가능

| 관측 가능(P6·기존 기록) | 관측 불가(항상 UNKNOWN) |
|---|---|
| 제품이 RPC 로 보고한 강의 재생 구간·판단 장면·reveal API·문항 페이지 렌더 노출 | 다른 탭·캐시·이전 다운로드에서 본 정답 |
| 시도의 help_level, 해설/정답 먼저 보기 뒤 여부(기존 뷰) | 외부 답지·EBS·검색·AI 도구 |
| 서버 시각 기준 시도·노출 순서 | 종이 기출집·교재·학원 해설 |
| 판본(analysis/lecture version·digest) | 튜터·친구·교사의 구두 도움 |
| | 클라이언트가 RPC 를 보내지 못한 노출(오프라인·실패·미구현 화면) |

외부 노출은 사실로 추론하지 않는다. X0 은 언제나 **「서버 관측 범위 안의 X0」** 이고 `external_exposure=UNKNOWN` 을 함께 표기한다.

## 3. P6 → X0..X3 / X_UNKNOWN 결정 규칙

창: 같은 user·item_ref 에서 `received_at ≤ exposure_order_at`(동률 포함). 창 안 최대 노출이 이긴다(X3 > X2 > X_UNKNOWN > X1 > X0).

| 규칙 | 조건 | 노출 |
|---|---|---|
| R1·R2 | `exposure_order_at` NULL 또는 `item_ref` NULL | X_UNKNOWN |
| R3 | 창 안 `kind=answer_direct`(어떤 source든) | X3 |
| R4–R6 | after_explanation · after_viewed_first · help_level=viewed_first | X3 |
| R7 | 창 안 `kind=decisive_hint` | X2 |
| R8 | 창 안 행이 `clock_suspect` (상위 규칙 미해당 시) | X_UNKNOWN |
| R9·R10 | timing_uncertain · help_level NULL | X_UNKNOWN |
| R11 | help_level=hint | X1 |
| R12 | help_level=independent · 창 안 원장 0행 · order 시각 있음 | X0(서버 관측 한정) |
| 기본 | 그 밖 | X_UNKNOWN |

주의: X1 은 「서버가 결정적이라고 표시하지 않은 힌트」일 뿐이다. 힌트 내용의 결정성은 P6 가 구분하지 않는다(gap G3).

## 4. 적격성 모델

관계(강한 노출이 약한 판정을 덮는다):
- **정답 열람(X3)** ⊃ **결정적 단서 노출(X2)** → 그 문항에 대한 이후 수행은 모두 **ASSISTED_ONLY**.
- **도움 받은 확인**: 해설·정답 뒤의 재확인(post-explanation check, REPAIR)은 정오와 무관하게 **ASSISTED_ONLY** — 독립 근거가 아니다.
- **독립 수행(INDEPENDENT_ELIGIBLE)**: 해당 문항(과 그 정답)에 대한 시도 이전·중 노출이 **완전한 기록으로 X0/X1 임이 증명**되고, `learning_attempt_independence = independent_candidate`, 판본 일치, 그 화면의 기록 경로가 실제 동작함이 확인된 경우만.
- **UNKNOWN**: 기록 누락·추적 이전·시각 보류·결속 없음·미채점·기록 경로 미연결. 기본값을 X0 으로 두지 않는다.
- `not_check_phase` · `repeat` → NOT_EVALUATED(독립 근거로 쓰지 않음).
- **숙달**: 같은 원리·유형의 **다른 문항**에서의 INDEPENDENT_ELIGIBLE 수행이 필요하다. 노출된 문항 자체의 재수행·같은 문항 반복은 숙달 근거가 아니다. 서버 독립 판정이 있어도 외부 노출은 UNKNOWN 이므로 숙달은 「관측 범위 내 독립」 주장으로만 기술한다.

| 시도 상황 | 노출 | 적격성 |
|---|---|---|
| 첫 시도, 원장 0행, independent, order 시각 있음 | X0 | INDEPENDENT_ELIGIBLE(관측 한정) |
| 비결정 힌트 뒤 첫 시도 | X1 | INDEPENDENT_ELIGIBLE 후보(힌트 결정성 미검증 시 보수적으로 UNKNOWN 권장) |
| 강의 결정 단서 뒤 | X2 | ASSISTED_ONLY |
| 해설·정답 뒤 재확인 | X3 | ASSISTED_ONLY |
| 추적 이전 / 기록 경로 없음 | X_UNKNOWN | UNKNOWN |

## 5. P6 로 지원 못 하는 부분 — 추가 승인 필요

- **G1 기록 경로 미연결**: 제품 코드가 `learning_exposure_record` 를 부르지 않는다(원장 0행). 현재 상태로는 어떤 시도도 R12(X0)에 도달하지 못한다.
- **G2 완전성 증명 불가**: 원장은 「보고된 노출」만 담는다. 화면별로 기록이 빠짐없이 동작했는지(heartbeat·화면 커버리지) 표식이 없어 「0행 = 노출 없음」을 증명할 수 없다.
- **G3 X1/X2 경계**: `kind` 가 두 값뿐 — 비결정 힌트·단서 공개(21_CUE_DISCLOSURE_SIDECAR 수준)를 원장에 남기지 않는다. help_level=hint 는 내용 결정성을 모른다.
- **G4 정답 열람 vs 정답 노출 구분 없음**: `item_page_render` 처럼 화면에 렌더된 것과 학습자가 실제 본 것을 구분하지 않는다(보수적으로 X3).
- **G5 문항 간 연결 없음**: 같은 지문·세트 문항, 같은 원리의 다른 문항에서의 노출 전이(다른 문항 해설이 이 문항 정답을 드러냄)를 item_ref 단위로는 못 잡는다.
- **G6 판단 유예(29_JUDGMENT_ANSWER_DEFERRAL)**: 판단 장면의 정답 공개 지연 여부를 시도 쪽 열로 결속하지 않는다.
- **G7 외부 노출**: 원리상 관측 불가 — 자기 보고 등 별도 수집은 설계·승인 대상이며 그래도 사실로 승격하지 않는다.
- **G8 숙달 산정**: 「다른 문항 독립 수행」을 묶는 원리/유형 키·판본 결속은 소비자(skillDiagnosis) 몫으로 P6 밖이다.
