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
**`smoke.mjs` 는 첫 실행 전용이다** — v99.0 을 봉인하는 단계를 포함해, 봉인된 뒤 다시 돌리면 「봉인 전 거부 · 봉인 성공 · 학생 claim」 3건이 실패한다(2026-10-05 재실행 139/142, 나머지 권한 · RLS · blind 수명주기는 Pilot 함수 본문에서도 모두 통과). 재실행 결과로 `results.json` 을 덮지 않는다.

### Pilot 데이터 모델 — `smoke-pilot.mjs`

`20261005130000_csat_ec_pilot_evidence` 적용 뒤 실행한다(같은 준비 · 같은 명령에서 파일 이름만 바꾼다). 결과 `results-pilot.json`(2026-10-05 109/109).
경계 정의 · 관찰 표 권한, 탐지기 관찰(service_role), 대기 probe · probe 응답 · skip · supersede · interpretation, pre_probe/all 회차 해시, AI multiple/inconsistent · 후보 무결성, blind 판정 후보 무결성(오타 · 다른 판본 · 폐기 · 중복 · 1개) · 경계 연결, 기존 8인자 호환, 학습 지도 무변화를 본다.
TEST taxonomy `v99.1`(코드 7 · 경계 2, 봉인)은 남고 재실행 때 재사용한다(재실행은 생성 · 봉인 검사 5건을 건너뛰어 104건). `v99.0` · `v99.1` 은 **개발 DB 상시 fixture** 다 — seed 대상이 아니고 지우지 않는다(근거 `docs/csat-learner/codebook/SEED_DRYRUN.md` §1). **이 경계 2행 때문에 `rollback-pilot.sql` 은 정리 전까지 거부된다**(의도된 안전장치).

## 남는 것 · 지워지는 것

- 테스트 계정 `ec-smoke-<run>-*@example.com` 7개는 끝나면 지운다. 학습자 기록 · 증거 · 판정 · AI 실행은 계정 삭제 cascade 로 사라진다.
- taxonomy `v99.0`(note 「TEST」)과 검수 회차는 설계상 지울 수 없다(append-only). 다시 실행하면 v99.0 은 재사용하고 회차는 2개씩 늘어난다. `eligibility.test` 로 식별한다.
- 실행 중에 예외가 나도 계정 정리는 한다. 정리 실패는 콘솔에 남는다.
