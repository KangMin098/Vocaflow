# 서비스 키 쓰기 진입점 분류 (2026-10-25 · 정적 조사 · 코드 변경 없음)

조사: 로컬 main(Vocaflow-main-serving) 에서 `SUPABASE_SERVICE_ROLE_KEY` 를 참조하는 추적 파일 576개(`svc-classify.mjs` · 결과 `svc-classify-main-0d3d24659.json`).
판정 규칙: `.insert/.upsert/.update/.delete(` 또는 쓰기 성격 RPC 호출 = 쓰기 · 경로로 제품/테스트/관리 구분 · 관리 쓰기는 `--commit/--apply/--write` 같은 명시 플래그 유무로 gated/ungated. 정적 판정이라 오탐·누락이 있을 수 있다(표본 확인 아래).

| 분류 | 파일 | 처리 원칙 |
|---|---|---|
| 읽기 전용 | 267 | 그대로 |
| 정상 제품 쓰기(apps/web/src 서버 코드) | 19 | 차단하지 않는다 — 학습기록 · 앱 동작 |
| 제품 읽기 | 17 | 그대로 |
| 개발 테스트 쓰기 | 19 | 차단하지 않는다 — 격리 · 테스트 계정 정리 규칙 따름 |
| 테스트 읽기 | 64 | 그대로 |
| 관리 쓰기 · 명시 플래그 있음 | 134 | 드레인 import(AGENTS.md 3단 구조) 등 — 기존 파이프라인 계약 유지 |
| 관리 쓰기 · 플래그 없음 | 56 | 검토 대상(실행하면 바로 쓴다) |
| 스키마 변경 | 0 | (마이그레이션은 승인 러너 · 이력 해시) |

## CSAT 원문·분석 테이블에 쓰는 관리 진입점(11)

| 파일 | 쓰기 | 플래그 | 성격 | 권고 |
|---|---|---|---|---|
| `scripts/csat/source-repair.mjs` | csat_items.update | 있음 | **관리성 원문 정정** — c-src2 와 같은 종류 | 승인형 러너로 연결 대상 1순위(수리 기록 → SQL 생성 → csat-content-fix 단계) |
| `scripts/csat/corpus-sync.mjs` | csat_items.update · delete | 있음 | **관리성 원장 동기화**(삭제 포함) | 연결 대상 2순위 · 동기화 가드 유지 |
| `scripts/csat/analysis-drain-import.mjs` | analyses insert/update · reviews upsert | 있음 | 드레인 파이프라인(새 판 적재) | 기존 계약 유지 — 발행 게이트가 검수 3을 요구 |
| `scripts/csat/design-drain-import.mjs` · `lure-drain-import.mjs` | analyses.update | 있음 | 드레인(기존 행 갱신) | 갱신 대상이 published 이면 관리성 — 검토 |
| `scripts/csat/meaning-support-isolated-seed.mjs` | analyses.update | 있음 | 격리 시드 | 격리 DB 전용 확인 필요 |
| `scripts/csat/units-build.mjs` | csat_item_units.insert | 있음 | 단위 판 적재(새 판) | 유지 |
| `scripts/csat/diagnosis/pilot-run.mts` · `readiness-smoke.mts` | csat_items insert/delete | **없음** | 진단 시험(임시 문항) | 테스트 쓰기로 재분류 · 임시 행 소유 확인 |
| `scripts/csat/map/e2e-cleanup.mjs` · `e2e-map-states.mjs` | csat_items insert/delete | **없음** | E2E 정리 | 테스트 쓰기 · 소유 run id 한정 확인 |

## 노출 최소화

- 서비스 키는 `apps/web/.env.local` 파일에만 있고(에이전트 도구가 그 파일 읽기를 거부한다), 스크립트는 `DOTENV_CONFIG_PATH` 로 **프로세스에만** 주입한다. 공유 셸 환경 변수에는 없다(2026-10-25 확인: 셸에 VF_DEPLOY_DB_URL · 서비스 키 없음, SUPABASE_ACCESS_TOKEN 만 있음).
- MCP 는 Claude · Codex 모두 `--read-only`(로컬 main b8cd19a63) + 전역 훅 vocaflow-db-mcp-guard.

## 하지 않은 것

- 576개 파일 수정 · 일괄 차단 · 일괄 러너 이전(사용자 결정 5).
- source-repair · corpus-sync 의 러너 연결 구현 — 공유 스크립트 계약 변경이라 별도 승인 범위로 둔다.
