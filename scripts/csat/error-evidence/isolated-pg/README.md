# 격리 PostgreSQL 검증 — 오답 원인 Evidence 마이그레이션

운영 · 공유 DB 를 건드리지 않고 `_pending_csat_error_evidence.sql` 을 **실제 PostgreSQL 17** 에 적용해 함수 · 권한 · 수명주기 · 동시성 · rollback 을 실행 검증한다.
Supabase 브랜치를 쓸 수 없는 환경(MCP 에 비용 확인 도구 없음)에서 같은 조건을 재현하려고 만들었다.

## 실행

```bash
cd scripts/csat/error-evidence/isolated-pg
printf '{ "private": true, "type": "module" }\n' > package.json       # gitignore 대상
npm i --no-audit --no-fund embedded-postgres@17.9.0-beta.17 pg       # PostgreSQL 17.9 바이너리(이 폴더에만)
node run.mjs          # 적용 → 전체 테스트 → results.json
node rollback.mjs     # 새 클러스터에서 rollback 실행 검증 → results-rollback.json
```

- 매 실행 새 클러스터(`data/`)를 만들고 끝나면 내린다. 포트 54329.
- Windows 관리자 계정에서는 `postgres` 직접 실행이 거부되므로 initdb 만 embedded-postgres 로, 기동은 `pg_ctl`(제한 토큰)로 한다.

## 운영과 맞춘 조건(`bootstrap.sql`)

운영 DB(2026-10-03 읽기 전용 실측)와 같게 둔다 — 다르면 검증이 무의미하다.

| 항목 | 값 |
|---|---|
| 버전 | 운영 17.6 · 검증 17.9(같은 메이저) |
| 마이그레이션 실행 역할 | `postgres` — 비 superuser · BYPASSRLS (운영과 같음) |
| `service_role` | BYPASSRLS · `anon` · `authenticated` 는 RLS 적용 |
| public 기본 권한 | 새 표 → anon · authenticated · service_role 전체, 새 함수 → postgres · authenticated · service_role (PUBLIC 회수) |
| `auth.uid()` · `is_admin()` | 운영 정의 그대로 |
| 기존 표 7개 | 운영 컬럼 · 제약 그대로(검증과 무관한 FK 대상 `csat_types` · `vocaflow_levels` 만 뺐다) |

호출은 PostgREST 와 같은 방식 — `authenticator` 로 붙어 `SET LOCAL ROLE` + `request.jwt.claim.sub`.

## 파일

| 파일 | 내용 |
|---|---|
| `stage1.mjs` | PRE 검사 · 적용 · 기존 객체 비의도 변경 비교 · POST 검사 |
| `seed.mjs` | 학습자 5(전부 ② 1명 포함) · 판정자 A/B · adjudicator · 관리자 · 외부인, 시험 1회 45문항, **TEST taxonomy v9.0**(검증 전용 — 클러스터째 폐기) |
| `t_flow.mjs` | 학습자 → 봉인 → AI → 회차 → blind → reveal → verify → 합의 → closed |
| `t_rls.mjs` | 표 9 × 역할 5 × 5개 동작 권한 표 · SECURITY DEFINER 감사 · 그림자 객체 공격 |
| `t_funcs.mjs` | 함수별 NULL · 없는 ID · 권한 · 상태 · 중복 · 재시도 · 품질 · 적격 · 표본 |
| `t_rq1.mjs` | rq-1 TS ↔ SQL 동치(fixture 14) |
| `t_hash.mjs` | 정규화 해시 · 회차 중 입력 변경 감지 |
| `t_seal.mjs` | taxonomy 봉인 |
| `t_p1fix.mjs` | 최종 리뷰 P1 회귀(판정자 자기 응답 · 시작 중 대상 교체 · 공개 뒤 원자료) |
| `t_concurrency.mjs` | 실제 겹친 트랜잭션 경합 14 |
| `t_delete.mjs` | 삭제 경계(학습자 기록 · 계정 · 판정자 · 관리자) |
| `rollback.mjs` | rollback 실행 · 객체 실제 개수 |
| `results*.json` | 마지막 실행 결과(2026-10-03) |
