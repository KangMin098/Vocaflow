# 31 — P6 SQL v3(적용 후보) · 실제 PostgreSQL 동시성 · 판단 장면 (b) · 독립 판정 단계

> 상태: **적용 후보 · 개발 DB 미적용.** 사용자 결정: 아키텍처 채택 · 판단 장면 (b) 지연 서버 조회 · 독립 판정 단계 제한 적용 · SQL 적용 미승인. T-0140 BLOCKED_AUTH · main 통합 보류 유지.
> SQL 전문: `p6-sql/20261024100000_learning_exposures.v3.sql` — **sha256 `741e0585ac4dd606c997a2b8b8fd47456e10853957ecc0b3867579b3f3d6be8e`** (157줄).

## 1. 추가 · 변경 객체 전체

| 종류 | 객체 | 비고 |
|---|---|---|
| 표(신규) | `public.learning_exposures` | append-only 노출 원장 · UNIQUE(user_id, client_exposure_id) · kind·source 제약 · `received_at default clock_timestamp()` |
| 인덱스 | `learning_exposures_user_item` (user_id, item_ref, received_at) | |
| 표(신규) | `public.learning_exposure_tracking` | 1행 · 추적 시작 시각 |
| **열(기존 표)** | `public.learning_task_attempts.exposure_order_at timestamptz` | nullable · 기본값 없음 → 기존 행 재작성 없음 |
| **트리거(기존 표)** | `learning_task_attempts_exposure_order` BEFORE INSERT | (사용자 · 문항) advisory xact 잠금 뒤 `clock_timestamp()` 기록 |
| 함수 | `learning_task_attempts_exposure_order()` | security invoker · search_path 고정 · PUBLIC/anon/authenticated 실행 회수 |
| 함수 | `learning_exposures_append_only()` + 트리거 | **security definer** · `search_path = public, pg_temp` · UPDATE 거부 · DELETE 는 합성 행 · 계정 삭제 cascade 만 |
| 함수 | `learning_exposure_record(…)` | security invoker · search_path 고정 · service_role 만 실행 · advisory 잠금 · 같은 id 다른 내용 거부 |
| 함수 | `learning_attempt_independence(bigint)` | security invoker · `learning_first_attempts`(기존 뷰, security_invoker) 위 · authenticated · service_role 실행 |
| RLS | `learning_exposures_own_select` · `learning_exposure_tracking_read` | 본인 행 · 표식 읽기 |
| GRANT/REVOKE | 두 신규 표 anon·authenticated 전부 회수 → authenticated SELECT · service_role SELECT/INSERT/DELETE(노출) · UPDATE/TRUNCATE 회수 | |

## 2. 기존 DB 영향

- `learning_task_attempts`: 열 1 추가(nullable, 재작성 없음) · BEFORE INSERT 트리거 1 추가. 기존 트리거 3개(delete_guard · update_guard · learning_trial_sample_frozen_attempt[BEFORE INSERT/UPDATE]) 와 함께 돈다 — 새 트리거는 값을 하나 채우고 잠금만 잡는다(거부 없음). 기존 RPC(`learning_attempt_record` · `learning_attempt_submit`) 서명 · 본문 무변경.
- 기존 뷰 `learning_first_attempts` 는 열을 명시해 select 하므로 영향 없음. 저장소의 `select a.*` 소비자는 PGlite 테스트 3곳(열이 하나 늘어도 동작) — 제품 코드에서 `*` 로 읽는 곳은 찾지 못함(main grep).
- 잠금 비용: 시도 INSERT 마다 (사용자 · 문항) 키 advisory xact 잠금 1회 — 같은 학습자 · 문항 동시 쓰기만 직렬화(K4: 다른 학습자 · 문항 대기 2~3ms).
- 기존 데이터 · 정책 · 함수 · 권한: 변경 없음.

## 3. 실제 PostgreSQL 다중 연결 동시성(`p6-sql/pg-concurrency-test.mjs`)

환경: embedded-postgres 17 격리 클러스터(저장소 밖 작업 폴더, `pg_ctl` 기동) · 두 연결 · 공유 개발 DB 무관. 기존 시도 저장은 `learning_attempt_record` 의 INSERT 와 같은 단순 INSERT(서버 `now()` 기본값)로 재현.

| 시험 | v3 | v2 |
|---|---|---|
| K1 시도 트랜잭션이 먼저 시작(now()=T0) → 노출이 먼저 커밋 → 시도 INSERT | **PASS** after_exposure | **FAIL** independent(오판 — `now()` 순서 결함) |
| K2 시도 INSERT 미커밋 중 같은 학습자·문항 노출 → 커밋까지 대기 · 시도는 독립 후보 | **PASS** 대기 414ms | **FAIL** 대기 2ms(직렬화 없음) |
| K3 시도 롤백 → 노출 진행 · 유령 시도 0 | PASS | PASS |
| K4 다른 학습자 · 문항 → 대기 없음 | PASS 2ms | PASS |
| K5 같은 요청 id 동시 2연결 → 1행 · 같은 id | PASS | PASS |
| K6 기록 실패 → 롤백 · 같은 id 재시도 1행 | PASS | PASS |
| K7 커밋 전 노출은 다른 연결에 안 보임 · 커밋 뒤 보임 | PASS | PASS |

**v3 7/7 · v2 5/7** — 시험이 순서 결함을 실제로 구별한다. 결과 `pg-concurrency-v3.json` · `pg-concurrency-v2.json`.
「clock_timestamp 만으로는 순서를 보장하지 않는다」 — v3 는 **양쪽 경로(시도 INSERT 트리거 · 노출 RPC)가 같은 advisory 잠금**을 잡고, 잠금 뒤의 시각을 순서 기준으로 쓴다. 잠금은 커밋까지 유지되어 순서 시각 = 커밋 순서.
남는 경합: 기존 `learning_sessions` 의 해설 · 도움 시각(레거시 공개 경로)은 이 잠금을 잡지 않는다 — 기존 뷰의 timing_uncertain(2분 창) 판정이 보수적으로 보류한다. 새 공개 경로는 노출 원장으로 옮긴다(§4).

PGlite: v2 33/33 보존(`pglite-test.mjs`) · v3 37/37(`pglite-test-v3.mjs` → `pglite-results-v3.json`, 독립 판정을 단계 · 지도 뷰 기준으로 교체).

## 4. 판단 장면 (b) — 최소 변경안(설계, 제품 코드 미변경)

상세 `29_JUDGMENT_ANSWER_DEFERRAL.md`. 현재 첫 HTML/RSC 에 실리는 정답 데이터: **직접 정답 4**(gate.answer · head 칩 「정답 ①」 · answer 블록 why_correct · 지도 앵커 answer) · **정답 확정 4**(reject 블록 4개 · 앵커 reject:n · 이해 확인 lure 문항 · 비교 쌍 choice) · 힌트 5 · 미확인 2. `force-dynamic` 이라 캐시 누출은 없고, 문항 간 `<Link>` 기본 prefetch 가 다른 문항 RSC 를 미리 받는 경로가 있다(확인 필요).

1. 서버: page.tsx 가 위 직접 · 확정 데이터를 props 에서 뺀다(`theaterBlocks(item, { withAnswer: false })`). 문항 간 링크 `prefetch={false}`.
2. 새 `POST /api/csat/item/[slug]/judgment`: 인증 → embargo 관문 → `analysis_version` 결속 확인 → service-role `learning_exposure_record(kind answer_direct, source judgment_scene)` **커밋 성공 뒤에만** 정답 데이터 반환 · 실패 503(데이터 없음) · `no-store`. 같은 원장을 강의 `scope=full` · 경계 「계속」 도 쓴다.
3. 클라이언트: 판단 장면에 「정답 확인」 단추 — 누를 때만 요청(마운트 · prefetch 0) · 결과는 컴포넌트 상태에만 · 공개 뒤 정답 영역 포커스(학습자 조작이므로 허용) · aria-live.
4. 테스트: 서버 HTML/RSC 에 정답 칩 · why_correct · reject 본문 없음 · 라우트 기록 실패 시 데이터 없음 · 마운트 fetch 0.

파일 소유 충돌: page.tsx · AnalysisTheater · theater.ts 는 T-0140(csat-lecture-disclosure, BLOCKED_AUTH) 범위이고 T-0091 · T-0043 의 `theater/**` · `csat/item/**` 허용 범위와 겹친다 — 구현 착수 전 해당 TASK 상태 · 활성 수정 여부 확인과 단일 owner 지정 필요. P6 SQL 적용 전에는 (b) 구현이 기록 경로를 가질 수 없다(순서: SQL 승인 · 적용 → (b) 구현).

## 5. 독립 판정 단계 제한(`30_P6_PHASE_CONTRACT.md`)

학습지도에 단계 전용 열은 없다 — 소비자 코드가 phase · activity · task_key · 시각으로 정한다. **FIND · CHECK = activity theater + phase practice 의 첫 시도**만 독립 후보. REPAIR(도움 뒤 재수행 · guided practice) · TRANSFER(phase transfer) · practice 화면 · pre/post/delayed/review 는 독립 근거가 아니다.

v3 `learning_attempt_independence` 상태(우선순위 순): `legacy_unknown`(추적 이전 · item 없음) → `not_check_phase` → `repeat`(지도 뷰의 첫 시도가 아님) → `helped`(뷰의 after_viewed_first · after_explanation · help_level≠independent) → `after_exposure`(노출 원장 · 순서 시각 기준, 동률 포함) → `timing_held`(뷰의 timing_uncertain) → `unbound`(세션 없음) → `ungraded` → **`independent_candidate`**.
- 함수는 「후보」 까지만 낸다. **판본 결속(content_hash = 현재 판본 해시)** 과 과제 묶음 · 숙달/해소는 소비자 `skillDiagnosis` 가 정한다(현재 판본 기대 해시가 DB 에 없음 — 30 NOT_VERIFIED). 어떤 상태도 숙달을 자동으로 올리지 않는다.
- 합성 학습자는 본인 지도에선 포함 · 집단 통계에서만 제외(기존 계약) — 함수는 별도 상태를 두지 않는다.
- REPAIR 의 도움 받은 재수행은 `not_check_phase` 또는 `helped` 로만 나온다(PGlite 「REPAIR 류」 검사).

## 6. 마이그레이션 · 비파괴 복구

적용(승인 뒤): 번호 충돌 확인 → sha256 `741e0585…` 승인 기록 → `apply_migration` → 읽기 확인(객체 · 정책 · 권한 · 트리거 목록 · `learning_task_attempts` 행 수 불변 · 기존 행 `exposure_order_at` 전부 null) → 합성 사용자로 시도 · 노출 · 판정 1회씩 → 저장소 `supabase/migrations/` 커밋 · `DB_SCHEMA.md` · CHANGELOG.

복구(데이터 보존 순):
1. 노출 기록 중단: `revoke execute on function public.learning_exposure_record(…) from service_role;` (되돌리기: 재부여)
2. 시도 쪽 잠금 · 순서 기록 중단: `drop trigger learning_task_attempts_exposure_order on public.learning_task_attempts;` — 데이터 삭제 없음(이후 새 시도는 `exposure_order_at` null → `legacy_unknown` 으로 보수 판정). 되돌리기: 트리거 재생성.
3. 판정 함수 교체: `create or replace function public.learning_attempt_independence` (저장 데이터 무변경).
4. 철거(`drop table` · `drop column exposure_order_at`)는 데이터 삭제 — **이번 승인 범위 밖**, 별도 명시 승인 · 사전 스냅샷 필수.

## 7. 미검증

- 실제 Supabase 의 기본 권한 · `auth.uid()` · `learning_attempt_record` 전체 본문과 함께 돈 동시성(격리 시험은 INSERT 재현).
- `learning_trial_sample_frozen_attempt` 와 새 트리거의 실행 순서 상호작용(이름순 — frozen 이 먼저, 거부 시 잠금 없이 끝남; 실제 함수 본문으로는 미시험).
- (b) 구현 · 문항 간 prefetch 실측 · 실계정 E2E(BLOCKED_AUTH).
- 학습 효과: 미검증.
