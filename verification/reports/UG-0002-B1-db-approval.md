# UG-c8315ad8-0002 Scope B-1 — DB 변경 승인 요청안 (2026-10-10 · 미적용)

목표: FIND → REPAIR → TRANSFER → CHECK 학생 경로를 「추측 없이」 판정한다(Work REQ-…-007·009·010 needs_info 의 요구).
상태: **제안만** — 개발 DB 에 적용하지 않았다. 사용자 대화형 승인(`vfc approve --kind db_write`) 뒤에만 적용한다.

## 1. 왜 기존 기록만으로는 안 되나(조사 결과)
| 단계 | 기존 기록 | 판정 가능? |
|---|---|---|
| FIND 확정 | `learning_task_attempts` 확인 문항 독립 첫 시도 → `skillDiagnosis`(D-1) | 가능(구현됨) |
| **REPAIR 성공** | 지도 처방 과제(`TASK_STAGE` REPAIR 72개)는 **체크 표시(자기 보고)** 로만 완료된다 — 서버 채점 응답이 없다 | **불가** — 「서버 검증 REPAIR 성공」 근거가 없다 |
| TRANSFER 성공 | `learning_task_attempts.phase='transfer'`(Practice 다른 지문) · `is_correct`(서버 채점) · `answered_at` · `learning_first_attempts` 자격(독립·해설 전·시각 확실·비합성) | **가능** — 다른 `item_ref` 이고 확정 시각 뒤의 독립 첫 정답이면 성공. DB 변경 불필요 |
| CHECK | 확정에 쓰지 않은 미노출 확인 문항의 독립 첫 시도(D-8) | 가능(구현됨) |
| 순서(REPAIR→TRANSFER→CHECK) | REPAIR 시각이 없어 순서를 증명할 수 없다 | REPAIR 기록이 생기면 `answered_at` 로 가능 |

→ 빠진 것은 **REPAIR 의 서버 채점 기록 하나**다. 새 표를 만들 필요가 없다.

## 2. 최소 DB 변경(B-1)
REPAIR 를 기존 원자 RPC `learning_attempt_submit`(G2·M8)으로 서버 채점 시도로 남길 수 있게 **phase 값 `repair` 하나**를 두 CHECK 제약에 더한다. 표·열·RPC·뷰는 그대로(뷰 `learning_first_attempts` 는 phase 별로 첫 시도를 이미 가른다).

```sql
-- supabase/migrations/<새 번호>_learning_phase_repair.sql  (적용 전 ls supabase/migrations 로 번호 확인)
begin;
alter table public.learning_task_attempts drop constraint learning_task_attempts_phase_check;
alter table public.learning_task_attempts add constraint learning_task_attempts_phase_check
  check (phase in ('pre', 'practice', 'post', 'delayed', 'transfer', 'review', 'repair'));
alter table public.learning_sessions drop constraint learning_sessions_phase_check;
alter table public.learning_sessions add constraint learning_sessions_phase_check
  check (phase in ('pre', 'practice', 'post', 'delayed', 'transfer', 'review', 'repair'));
commit;
```

- **호환성**: 값 집합을 넓히기만 한다 — 기존 행은 모두 그대로 유효. 기존 코드는 `repair` 를 만들지 않으므로 동작 변화 없음.
- **재실행 안전**: `drop constraint … ; add constraint …` 가 한 트랜잭션 — 다시 돌려도 같은 결과(이미 `repair` 가 들어간 행이 있어도 통과).
- **잠금**: CHECK 재검증은 표 전체 스캔(ACCESS EXCLUSIVE 짧게). `learning_task_attempts` 행 수를 적용 직전에 확인 — 크면 `not valid` + `validate constraint` 2단계로 나눈다.
- **롤백**(repair 행이 없을 때만):
```sql
begin;
do $$ begin
  if exists (select 1 from public.learning_task_attempts where phase = 'repair')
     or exists (select 1 from public.learning_sessions where phase = 'repair') then
    raise exception 'repair 기록이 있다 — 롤백하지 않는다(데이터 보존)';
  end if;
end $$;
alter table public.learning_task_attempts drop constraint learning_task_attempts_phase_check;
alter table public.learning_task_attempts add constraint learning_task_attempts_phase_check
  check (phase in ('pre', 'practice', 'post', 'delayed', 'transfer', 'review'));
alter table public.learning_sessions drop constraint learning_sessions_phase_check;
alter table public.learning_sessions add constraint learning_sessions_phase_check
  check (phase in ('pre', 'practice', 'post', 'delayed', 'transfer', 'review'));
commit;
```

## 3. 판정 계약(승인 뒤 순수 함수로 구현 — 정책 범위 MEDIUM)
- **REPAIR 성공** = 그 원리(skill = task_key)의 `phase='repair'` 서버 채점 시도 중, verified(D-1) 시각 **뒤**의 독립 첫 시도(`learning_first_attempts`: independent · 해설 전 · 시각 확실 · 비합성)가 정답. 같은 문항 재시도는 세지 않는다.
- **TRANSFER 성공** = REPAIR 성공 시각 뒤, 확정·REPAIR 에 쓰지 않은 **다른 item_ref** 의 `phase='transfer'` 독립 첫 시도가 정답.
- **CHECK** = 기존 D-8(미노출 확인 문항) — TRANSFER 성공 뒤로만 연다.
- 저장하지 않고 조회할 때마다 계산(D-1 관례). 기존 `CURRENT_BASIS`·D-2·D-7(c) 불변.

## 4. 테스트(승인 뒤)
- 마이그레이션: 개발 DB 적용 전후 `select count(*)` 동일 · `repair` 삽입이 제약을 통과 · 롤백 가드가 repair 행이 있을 때 멈춤.
- 순수 함수: REPAIR 전 TRANSFER 정답은 성공 아님 · 같은 문항 재시도 무시 · 해설 뒤·시각 불확실·합성 제외 · 순서 위반 거부.

## 5. 사용자 승인 방법(대화형 터미널 — 에이전트 불가)
```
node bin/vfc.mjs approve --kind db_write --summary "UG-c8315ad8-0002@B1 db — learning phase 'repair' 추가(CHECK 2개)" --ref "B-1 승인안 verification/reports/UG-0002-B1-db-approval.md"
```
승인 후에도 실제 적용은 SQL 파일 sha256 고정 → 개발 DB 1회 적용 → 전후 비교 순서로 하고, 담당 세션(learning-map) 이 구현한다.
