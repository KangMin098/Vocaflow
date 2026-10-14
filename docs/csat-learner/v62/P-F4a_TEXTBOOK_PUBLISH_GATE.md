# v6.2 P-F4a — 학습자 교재 발행 게이트

> 2026-10-14 · 감사 [P-F0](./P-F0_FACTORY_AUDIT.md) §1-2 의 결함 수정. **DB 변경 0**(승인안 A 는 제안만).

## 1. 읽기 경로 추적

| 경로 | 무엇을 보이나 | 데이터 | 감사 전 발행 확인 | 이번 변경 |
|---|---|---|---|---|
| `/library/textbooks` 서가 | 권 카드 · 재고 요약 | RPC `textbook_shelf_inventory` 등(재고) | 없음 | 그대로(내용 없음 · 카드만) |
| `/library/textbooks/[series]/[step]` | 서지 · **목차 · 미리보기 · 단어 목록** · 「문항 풀어 보기」 | 정적 `volume-contents.json`(조판 결과) · 재고 | **없음** — 조판만 된 미승인 권의 목차가 보일 수 있었다 | 발행된 권만 목차 · 미리보기 · 단어 · 연습 링크, 아니면 「발행 전」 안내 |
| `/library/textbooks/[series]/[step]/practice` | 연습 문항 | RPC `textbook_practice_items(v_level)` | **없음**(직접 주소로 진입 가능) | 발행 전 · 상태 미확인이면 `notFound()` |
| RPC `textbook_practice_items` 직접 호출 | V레벨 문항 풀(출처 적격 · 지문 상태 · 본인 미시도) | `csat_dcp_items` | 권 발행과 무관(문항이 권에 묶여 있지 않다) | 변경 안 함 — 승인안 A |

발행 정본: `textbook_volume_renders.status = 'published'`(`/admin/csat/press` 결정 → `csat_pipeline_approvals` 와 함께 기록). 이 표는 관리자 RLS 라 학습자 세션이 못 읽는다 → 서버 컴포넌트가 서버 키로 **상태만** 읽는다(`lib/textbook/publish-gate.ts`). 읽기 실패 · 서버 키 없음 = 막는다(fail-closed).

## 2. 검증

- 단위: 발행 단계만 허용 · 읽기 오류/키 없음 = unknown(막음) · 쿼리는 읽기 전용(`publish-gate.test.ts`).
- 실화면(로그인 · 개발 DB): 발행 19권 모두 목차 · 연습 링크 · 연습 화면 정상(회귀 0). 없는 단계 연습 직접 주소 = 빈 화면 · 플레이어 0.
- 미발행 권은 지금 DB 에 없어(19/19 published) 실제 미발행 행으로는 재현하지 못했다 — 판정은 단위 테스트가 고정. 상태를 바꿔 재현하려면 데이터 변경 승인이 필요하다.
- 서가 선택(`user_textbook_selections`) · 학습 기록은 건드리지 않는다.

## 3. 승인안 A(제안 · 적용 안 함) — 연습 RPC 를 발행 권에 묶기

연습 RPC 는 V레벨 문항 풀을 돌려주므로, 직접 호출하면 발행 전 권과 같은 V레벨의 문항을 받을 수 있다(권 「내용」 유출은 아니지만 권 발행 결정을 우회한다).

```sql
-- 시리즈 · 단계를 받아 그 권이 발행됐을 때만 그 권의 V레벨 문항을 준다(기존 시그니처는 호환용으로 남기되 사용처를 옮긴다)
create or replace function public.textbook_practice_items_for(p_series text, p_step smallint, p_v_level smallint, p_limit integer default 10)
returns table(id uuid, type text, paragraph_idx integer, payload jsonb, ref_title text)
language sql stable security definer set search_path to 'public' as $$
  select * from public.textbook_practice_items(p_v_level, p_limit)
  where exists (select 1 from public.textbook_volume_renders r where r.series = p_series and r.band = p_step and r.status = 'published')
$$;
-- 앱: fetchTextbookPracticeItems 가 새 함수를 부르게 바꾼다. 옛 함수 EXECUTE 를 authenticated 에서 회수할지는 사용처 0 확인 뒤
```

- 영향: 지금 19권 모두 published → 학습자 체감 변화 0. V레벨 ↔ 단계 일치 검사는 앱이 카탈로그로 이미 한다(서버 쪽 일치 검사를 넣을지는 승인 시 결정).
- 되돌리기: 앱 호출을 옛 함수로 · 새 함수 drop.
- 체크포인트: `/db-checkpoint` before/after.
