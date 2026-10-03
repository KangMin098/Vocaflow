# 개발 DB smoke — 오답 원인 Evidence 의 실제 앱 경계

`20261003230000_csat_error_evidence` 가 적용된 **개발 Supabase DB**(`jajenrevcbmrpaliomxv`)에서 PostgREST · Auth · RLS · RPC 노출을 앱과 같은 `@supabase/supabase-js` 경로로 확인한다.
SQL 함수 자체의 동작은 `../isolated-pg`(로컬 격리 PostgreSQL)가 맡는다. 이 하네스는 전송 · 역할 전달만 본다. 운영 환경용이 아니다. 개발 프로젝트가 아니면 시작하지 않는다.

## 실행

```bash
cd scripts/csat/error-evidence/dev-smoke
printf '{ "private": true, "type": "module" }\n' > package.json     # gitignore 대상
npm i --no-audit --no-fund pg @supabase/supabase-js@2.104
cd ../../../..
node --tls-max-v1.2 --env-file=apps/web/.env.local scripts/csat/error-evidence/dev-smoke/smoke.mjs
```

기대값은 `FAIL 0`이다(2026-10-03 기준 142/142). 결과는 `results.json` 에 남는다(감사 기록 — 커밋한다).

## 남는 것 · 지워지는 것

- 테스트 계정 `ec-smoke-<run>-*@example.com` 7개는 끝나면 지운다. 학습자 기록 · 증거 · 판정 · AI 실행은 계정 삭제 cascade 로 사라진다.
- taxonomy `v99.0`(note 「TEST」)과 검수 회차는 설계상 지울 수 없다(append-only). 다시 실행하면 v99.0 은 재사용하고 회차는 2개씩 늘어난다. `eligibility.test` 로 식별한다.
- 실행 중에 예외가 나도 계정 정리는 한다. 정리 실패는 콘솔에 남는다.
