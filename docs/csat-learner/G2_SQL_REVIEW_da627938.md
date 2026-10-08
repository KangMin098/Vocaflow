<!-- docs/csat-learner/G2_SQL_REVIEW_da627938.md -->
# G2 통합 SQL 적용 전 독립 심사 — `da627938…` (2026-10-08)

| 항목 | 내용 |
|---|---|
| 대상 | `feat/methodology-vnext` **`e294b4642`** · `supabase/migrations/_pending_20261008160000_learning_sessions_integrated.sql` · 승인 요청서 `docs/methodology/G2_INTEGRATED_SQL.md` |
| 방법 | git 에서 원문 직접 추출 · 원본 초안(`779eb9bb…`)과 diff · 개발 DB **읽기만**(SELECT) · 메모리 Postgres(PGlite 0.2.17) 회귀 44 + 표적 프로브 4 |
| 하지 않은 것 | 개발 DB 적용 · 쓰기 0 · methodology / practice 브랜치 수정 0 |

## 최종 판정 — **CONDITIONAL** (P1 1건을 SQL 에서 고친 뒤 적용 승인 가능)

## 1. 해시
- 직접 계산 sha256 **`da627938c469f71db0c839c8bca670862b46786b9e0469f8aae1eddb088cc057`** — 보고 값과 **일치** · 370줄.
- 원본 초안 `779eb9bb…` 와의 차이는 머리말 · M1 · M2 · M3 · M5a · M5b · M5c · M5d · 권한 시그니처 · 되돌리기뿐 — 나머지 바이트 동일(diff 로 확인).

## 2. 변경 객체 · 영향 범위
요청서 §2 표와 SQL 원문이 일치한다.
- 새 표 `learning_sessions`(+`explanation_viewed_at`) · `learning_mutations`
- `learning_task_attempts` 열 4 · 인덱스 2 · phase CHECK
- RPC 3(`learning_session_apply` 는 18인자 — 마지막 `p_explanation_viewed_at` 기본값)
- 뷰 `learning_first_attempts`(+`help_level` · `after_explanation`)
- **함수 교체 `knowledge_trials_analyzed_guard`**(M3 · M5c) · 새 트리거 2(M5d) · `funnel_events` CHECK 83
- 개발 DB 실측(읽기): `learning_task_attempts` 0행 · `knowledge_trials` 2행(analyzed 0) · `authenticated` 의 knowledge_trials UPDATE 권한 없음 · 현 게이트 함수 본문 = 120000 본문(되돌리기가 복원하는 본문과 **문자 단위 동일** · 140000 · 150000 은 이 함수를 건드리지 않음 · 별건 170000 은 별도 트리거 `knowledge_trials_synthetic_immutable` 추가라 순서 무관 확인)

## 3. 결함
| 등급 | 결함 | 재현(메모리 DB) | 권고 |
|---|---|---|---|
| **P1** | **M5a 「가장 이른 공개가 이긴다」가 독립 판정을 소급해 뒤집는다.** 같은 세션 id 를 두 기기가 공유할 때(G1 은 세션 id 를 기기 간 동기화한다) B 가 t2 에 「해설 먼저」 공개 → t3 판단, A 가 t1(<t2) 「독립」 공개를 늦게 올리면 세션이 independent 로 바뀌고 **해설을 먼저 본 뒤의 t3 판단이 `after_viewed_first=false` 독립 첫 시도**가 된다 — 효과 게이트(M3)가 세는 바로 그 값. 시도 행의 `help_level` 열은 `viewed_first` 로 남아 저장 데이터끼리도 모순 | `probe.json` (a): 전 `{viewed_first, true}` → 후 `{independent, false}` · 행 열 `viewed_first` | 도움 수준은 **더 많이 도움받은 쪽이 이기게**(viewed_first > hint > independent — 한 번 도움을 받으면 독립으로 돌아가지 않음), `revealed_at` 만 가장 이른 값. 또는 시도가 하나라도 기록된 세션의 `help_level` 은 고정 |
| **P1 (연결 — SQL 아님)** | B8 연결 함정: practice g2 의 공개 mutation id(`stableUuid(session,'reveal')`)를 재사용해 해설 시각을 보내면 payload 가 달라 **conflict → 아무것도 저장 안 됨**. practice g2 는 공개 conflict 를 허용하므로 조용히 유실 | `probe.json` (b): 같은 id → `conflict` · 저장 `null` / 새 id → `applied` · 저장됨 · help 불변 | 해설 열람은 **별도 mutation id**(예: `stableUuid(session,'explain')`) · `p_at` = 열람 시각 — vocaflow-dd B8 연결 작업에 전달 |
| P2 | 분석 완료 표본 세션에 늦은 해설 시각이 오면 고정 트리거가 예외 → 원장 claim 도 롤백 → **재시도마다 같은 예외**(영구 실패 · 클라이언트 무한 재시도 위험) | `probe.json` (c): 1 · 2회차 모두 예외 · 원장 0 | RPC 가 `outcome='frozen'` 을 돌려주거나 클라이언트가 이 예외를 종결로 처리 · 지금은 analyzed 0 이라 영향 없음 |
| P2 | 시도 행 `help_level` 열은 「기록 시점 값」이고 세션 값과 달라질 수 있다(M5a) — 뷰는 세션을 정본으로 보지만 열을 직접 읽는 소비자는 틀린다 | (a) | 열 주석에 「기록 시점 값 · 정본은 세션」 명시 또는 P1 수정으로 불일치 자체 제거 |
| P2 | 현재 direct 경로 행(세션 없음 · `help_level` 열 NULL)은 효과 게이트에서 독립으로 세지 않는다 — 보수적이라 옳지만, ③ 코드 전환 전에는 어떤 실제 검증도 analyzed 가 될 수 없다 | `probe.json` (d): 실효 help `null` | 요청서 §6 에 명시 |
| P2 | M5d 는 표본 시도의 **삭제**를 막지 않는다(사용자 삭제 cascade 를 막지 않으려는 의도) — 분석 뒤 표본이 줄 수 있다 | 원문 | 의도라면 요청서에 「삭제 시 분석 결과 재검토」 절차 |

## 4. 기존 데이터 · 이벤트
- CHECK 83 = 현재 68 ∪ knowledge 2 ∪ 기출 13 — 개발 DB 의 68종 전부 포함 · 기존 행은 모두 68종 안(이번 단위 앞서 SELECT 확인 · 요청서 실측 21,000행과 일치).
- 새 15종 송신처: `main` · `feat/csat-practice-port` · `feat/methodology-vnext` · `feat/csat-learning-loop-g1` 모두 **0** — 배포 순서 ④(적용 · 사후 검사 뒤 한 커밋 활성화)와 일치.
- 합성 판정: SQL 은 `synthetic` 을 받기만 한다. B5(서버 관리 목록) 는 코드 전환 ③ 의 조건으로 남는다.

## 5. 세션 상태 전이 · B8
- 정상: 0시도 세션 · 공개 전 시도 거부 · 상속 · 모순 거부 · 재전송 duplicate · 같은 키 다른 내용 conflict(빈 세션 없음) · 첫 시도 = 판단 시각 순 · 해설 시각 = 가장 이른 값(`least`) · 해설 뒤 판단 `after_explanation` — **회귀 44/44**(원본 초안용 하네스를 이 SQL 에 그대로 적용 · 되돌리기 실제 실행 포함).
- M5a 는 `revealed_at` · `explanation_viewed_at` 에는 맞다(가장 이른 사실이 정본). **`help_level` 에 같은 규칙을 쓰는 것이 P1.**

## 6. RLS · 멱등 · 동시성
- RLS · 권한: 회귀 44 의 권한 묶음 통과(본인만 읽기 · 직접 쓰기 · 원장 · RPC 거부).
- 동시성: PGlite 는 단일 연결이라 **두 연결 동시성은 이 심사에서 재현하지 못했다** — 요청서의 실제 PostgreSQL 두 연결 검증(inserted 1 · duplicate 1 · 행 1)을 근거로 두고, 적용 뒤 실 DB 재검증(B6′)을 조건으로 유지.
- M3 게이트는 invoker 권한으로 뷰를 읽는다 — knowledge_trials 쓰기가 service_role 전용(개발 DB 확인)이라 RLS 에 가려 적게 세는 경로는 없다.

## 7. 롤백
- 실행 가능한 완성본 — 메모리 DB 에서 실제 실행 · 새 표 제거 · 시도 표 13열 · 게이트 원래 본문 · 68종 복원.
- 위험: 적용 뒤 새 이벤트 · `review` · 세션 연결 시도 · 표본 세션이 생기면 CHECK · FK 복원 전에 처리 필요(요청서 §7 전제와 같음). 별건 170000 이 먼저 적용돼 있어도 이 되돌리기는 그 트리거를 건드리지 않는다.

## 8. 배포 순서 · 호환
- ① 적용 → ② 사후 검사 → ③ 코드 전환 → ④ 이벤트 — 요청서와 동의. 새 열이 모두 NULL 허용이라 ③ 전 기존 direct INSERT(practice 현재 기본) · G1(기기 기록 · 서버 쓰기 없음)은 그대로 동작.
- practice g2 어댑터의 `learning_session_apply` 호출은 이름 인자라 18번째 인자 추가와 호환. **B8 연결은 별도 mutation id 필수**(위 P1 연결).

## 9. 승인 전 수정 필요
1. **[SQL · methodology]** M5a 의 `help_level` 규칙 — 「더 많이 도움받은 쪽이 이긴다」(또는 시도 기록 뒤 고정). `revealed_at` · `explanation_viewed_at` 은 지금 규칙 유지. 수정 뒤 해시 재계산 · 위 (a) 시나리오를 격리 테스트에 추가.
2. **[요청서]** §6 에 B8 연결 규칙(해설 열람 = 별도 mutation id) · direct 행이 게이트에 안 세지는 점 · 고정 예외의 클라이언트 처리 명시.
3. (권고) 고정 트리거 예외를 RPC outcome 으로.

## 10. 판정
**CONDITIONAL** — 9-1(P1) 수정과 해시 갱신 뒤 적용 승인 가능. 그 밖의 계약(무결성 · 기존 데이터 · 이벤트 · RLS · 멱등 · 롤백 · 배포 순서)은 심사 범위에서 결함 없음. 두 연결 동시성은 요청서 근거 + 적용 뒤 실 DB 재검증 조건.

증거: `docs/csat-learner/g2-draft/review-da627938/`(프로브 스크립트 · 결과 · 하네스 결과).
