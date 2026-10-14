# v6.2 P-F7a — 발행 RPC 최종 보안 감사 · 승인안 A 2판 패킷

> 상태: **DB 미적용.** 앱 호출자 전환은 병합 가능(새 함수가 없으면 옛 함수로 가므로 지금 화면 그대로).
> 실측 2026-10-14(개발 DB 읽기 전용 조회).

## 1. 접근 경로 감사

| # | 경로 | 실측 | 판정 |
|---|---|---|---|
| 1 | 교재 상세 `/library/textbooks/[series]/[step]` | 서버 게이트 `publish-gate.ts`(P-F4a) · 실패 시 막음 | 화면 결속 ✓ |
| 2 | 교재 연습 화면 | 같은 게이트 + `fetchTextbookPracticeItems` | 화면 결속 ✓ · 데이터는 3번에 의존 |
| 3 | 옛 RPC `textbook_practice_items(v_level, limit)` 직접 호출 | SECURITY DEFINER · owner postgres · `search_path=public` · authenticated 실행 · anon 없음 | **우회 가능** — 권 · 발행 · 권 유형 무관 V레벨 풀 |
| 4 | 새 RPC `textbook_practice_items_for(series, step, limit)` | 미설치 | 2판 SQL(아래) |
| 5 | `grade_dcp_item(item_id, answer)` | authenticated · 로그인 필수 · `csat_source_is_gradeable` 만 확인 · 권 · 발행 무관 · **오답이면 answer_key 전체 반환** · attempt 기록 | 아래 §2 |
| 6 | `prescribe_today(user_id, v_levels)` | 본인 또는 관리자만 · 학습자 단계(S3+) 밴드 · 출처 적격 · `order`/`insert` 만 · 5문항 | **독립 처방 서비스** — 교재 발행과 무관한 것이 설계 |
| 7 | 관리자 · 배치 | `csat_dcp_items` RLS = `is_admin_or_curator()` 하나 · `textbook_volume_renders` 읽기도 관리자만 | 학습자 직접 조회 불가 ✓ |
| 8 | 권한 | 위 함수 모두 anon 실행 없음 · `csat_stage_catalog` 는 RLS 없는 뷰(anon 읽기) — 제목 · 밴드 메타만, 문항 · 정답 없음 | 문항 노출 없음 |

## 2. 허용 범위 — 교재 연습 ≠ 학습 처방

- **교재 연습**은 「이 권을 편다」 이므로 그 권의 발행 · V레벨 · 유형에 묶여야 한다 → 승인안 A.
- **오늘 처방**(`prescribe_today`)은 학습자 단계 · 출처 적격성으로 고르는 독립 서비스다. 교재 발행에 묶지 않는다(묶으면 서가 상태가 처방을 끈다). 권리 게이트는 `csat_source_is_eligible` 로 이미 건다.
- **채점**(`grade_dcp_item`)은 두 경로가 함께 쓴다. 문항 ID 는 UUID 이고 학습자는 문항 표를 못 읽으므로 **받은 문항만** 채점할 수 있다. 오답 시 정답 공개는 학습 피드백 설계다.
  남는 위험: 이미 받은 문항 ID 를 저장해 두면 그 권이 미발행으로 바뀐 뒤에도 채점 · 정답을 받을 수 있다. 막으려면 「공급 기록에 있는 문항만 채점」이 필요하고, 그 기록은 영속 공급(승인안 B)의 `workspace_content_delivery` 가 생긴 뒤에 건다. **지금은 바꾸지 않는다**(바꾸면 처방 경로 채점이 깨진다).

## 3. 새로 찾은 결함 — 어휘 · 구문 권이 독해 문항을 냈다

카탈로그 권 유형 ∩ 연습 재생 유형(기사 17종):
- 어휘 6권(`vocab_choice` · `unit_vocab` · `blank_word`) · 구문 6권(`grammar_*` · `word_order`) · 독해 1단 → **교집합 0**.
- 그런데 옛 RPC 는 V레벨만 보므로 이 권들의 연습 화면은 **그 권에 없는 독해 문항**을 냈다.

2판은 권 유형으로도 묶는다. 실측 풀(출처 적격성 전, `kind=article`):

| 권 | 지금 | 2판 |
|---|---|---|
| 독해 1단 | 0 | 0 |
| 독해 2단 | 830 | 300 |
| 독해 3단 | 867 | 536 |
| 독해 4단 | 1,618 | 914 |
| 독해 5단 | 11,089 | 11,025 |
| 독해 6 · 7단 | 157,187 · 39,661 | 동일 |
| 어휘 · 구문 12권 | V레벨 독해 풀 | **0** — 화면은 기존 빈 상태 문구 |

**V레벨 공용 풀의 한계**: 문항은 권 소속을 저장하지 않는다. 2판도 「그 권의 V레벨 · 유형에 맞는 공용 풀」 이지 「그 권에 실제 조판된 60문항」 이 아니다. 같은 V레벨 · 유형을 쓰는 다른 발행 권은 같은 문항을 본다.

## 4. 2판 SQL — `supabase/migrations/_pending_textbook_practice_publish_gate.sql`

생성기 `scripts/textbook/gen-practice-gate-sql.mts`(카탈로그 → 행). 손으로 고치지 않는다.

- `textbook_rung_level`(19행) · `textbook_rung_type`(139행) — RLS 켬 · 정책 없음 · anon/authenticated 권한 회수.
- `textbook_practice_items_for(p_series, p_step, p_limit)` — V레벨 매개변수 없음. 조건 전부 AND:
  로그인 · 재생 유형 · 권 유형 · 그 권 published · 대응 V레벨 · 기사 상태 · `display_only=false` · 출처 적격 · 본인 미시도.
  하나라도 없거나 조회 실패면 0행.
- SECURITY DEFINER · owner(적용자 postgres) · `search_path=public` · public/anon 회수 · authenticated 실행.

**서버 코드 ↔ DB 대응 어긋남 방지**: `practice-gate-sql.test.ts` 가 SQL 행 = `SERIES_CATALOG` 를 지킨다. 카탈로그가 바뀌면 생성기를 다시 돌리고 **새 마이그레이션**으로 대응 표를 갱신해야 한다(적용 뒤에는 이 파일이 아니라 증분).

## 5. 앱 호출자 전환(이 PR · 병합 가능)

`lib/textbook/practice-rpc.ts` `fetchVolumePracticeRows` — 새 함수 우선, **「함수 없음」(PGRST202 · 42883)일 때만** 옛 함수. 권한 · 기타 오류는 우회하지 않고 실패(`practice-rpc.test.ts` 5건).
→ 적용 전: 지금과 동일. 적용 후: 자동으로 새 경로. 회수 후: 옛 갈래는 권한 오류 → 「불러오지 못했어요」.

## 6. 승인 요청 — 승인안 A 2판

| 단계 | 내용 | 영향 | 되돌리기 |
|---|---|---|---|
| ① | 보류 SQL 적용(표 2 · 함수 1 · 권한) | 연습 화면이 권 유형 · 발행에 묶임. 어휘 · 구문 12권 연습 0 · 독해 2~4단 풀 축소. 기록 불변 | 파일 머리말 drop 문 |
| ② | 확인 | `sql/practice-gate-verify.sql`(트랜잭션 · rollback) | — |
| ③ | 옛 함수 authenticated 회수 | 앱 배포 뒤. 테스트 파일 `dcp-grade-records.integration.test.ts` 가 옛 함수를 직접 부르므로 같은 PR 에서 새 함수로 바꾼다 | `grant execute … to authenticated` |

체크포인트: 적용 전후 `/db-checkpoint practice-gate-a2`.

## 7. 적용 전 격리 검증(실행함 · 읽기 전용)

함수 본문을 CTE 로 바꿔 대응 표 · 발행 상태를 가짜로 둔 조회(DDL 없음):
발행 독해 5단 50(상한) · **draft 로 바꾼 독해 5단 0** · 없는 단 0 · 없는 시리즈 0 · 어휘 5단 0 · 발행 독해 2단 40.
V레벨 위조: 매개변수가 없어 구조적으로 불가(테스트).
