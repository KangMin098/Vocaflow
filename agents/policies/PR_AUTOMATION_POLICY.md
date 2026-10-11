# PR 자동화 · 승인 최소화 정책 v1.1

> 기계 판독 정본: [pr-automation.json](./pr-automation.json) — 값(버전 · 필수 체크 · 경로)은 거기가 정본이고, 이 문서는 이유와 절차를 쓴다.
> 채택 2026-10-11(사용자 지시 「전체 세션 승인 최소화 정책 v1.1」) · 이력: [agents/DECISIONS.md](../DECISIONS.md) DD-PR-AUTO-1.1.
> 적용 대상: 모든 Claude Code · Codex · AI-Control 세션과 모든 워크트리.

## 1. 기본값 = AUTO_CONTINUE

사용자에게 매번 진행 여부를 묻지 않는다. 작업 단위의 구현 → 검증 → 수정 → 문서화 → 커밋 → push → PR → CI → 안전 병합을 할 수 있는 데까지 이어서 한다.

**사용자 승인이 필요한 것은 두 가지뿐이다.**

| 유형 | 범위 | 승인 요청에 붙일 것 |
|---|---|---|
| DB 변경 | 테이블 · 컬럼 · 제약 · 인덱스 · 마이그레이션 적용 · RPC · 함수 · 트리거 · RLS · 권한 · 데이터 의미를 바꾸는 대량 변환 | SQL 전문 · 영향 분석 · 되돌리기 |
| 데이터 삭제 | 기존 사용자 · 시험 · 학습 · 콘텐츠 데이터 삭제 · DROP · TRUNCATE · 대량 DELETE · 기록을 잃는 초기화 · 재적재 · 덮어쓰기 | 대상 · 범위 · 복구 방법 |

앱의 정상적인 INSERT · UPDATE · UPSERT, 기존 승인 범위의 데이터 처리, 실행별 소유권이 확인된 임시 테스트 데이터 정리는 승인 없이 한다.
승인을 기다리는 부분만 멈추고, 독립적인 나머지 작업은 계속한다.

## 2. 더 이상 묻지 않는 것

일반 개발 · 리팩터링 · UI/UX · 코드 리뷰 · 테스트 · 오류 수정 · 문서 정합성 · 커밋 · push · PR 생성 · base 변경 · 필수 CI 실행 · 안전 조건을 충족한 main 병합 · AI 역할 검수 · 기존 계약의 콘텐츠 처리.
**파일 30개 이상**은 승인 조건이 아니라 **추가 검증 조건**이다 — PR 본문에 `## 검증` 절(실행한 검증과 결과)을 쓰고, 커밋을 쪼개 우회하지 않는다.

## 3. PR 흐름

개발 완료 → 로컬 검증 → 커밋 · push → PR → 필수 CI → 실패 원인 분석 · 허용 범위 수정 · 재검증 → `safe-merge.mjs` → main 병합 → 결과 보고.

`node agents/scripts/safe-merge.mjs <PR> [--wait] [--dry-run]` 이 병합 직전에 한 번에 확인한다:

1. PR 열림 · MERGEABLE · **base = main**(종속 PR 은 앞 PR 병합 뒤 base 가 main 으로 바뀌고 CI 가 다시 돈 다음에만).
2. **필수 체크 전부**(pr-automation.json `required_checks`)가 최신 HEAD 에서 SUCCESS — 하나라도 없으면(누락) · SKIPPED 뿐이면 · 대기면 병합 안 함.
3. **DB 변경 승인 증거 = 개발 DB 적용 이력** — `supabase/migrations/` 를 바꾼 PR 은 파일마다 개발 DB `supabase_migrations.schema_migrations` 의 statements sha256 이 PR HEAD 본문 sha256 과 같아야 한다. 적용은 사용자 승인 + DB 쓰기 훅을 거쳐서만 생기므로 PR 작성자가 꾸밀 수 없다. **PR 본문 문자열은 증거가 아니다**(이 머신은 에이전트와 사용자가 같은 GitHub 계정을 써서 작성자를 가릴 수 없다). 미적용 · 적용 뒤 수정 · 이력 조회 실패(SUPABASE_ACCESS_TOKEN 없음)는 병합 안 함. `_pending_` 제안본은 적용되지 않으므로 메모로만 남긴다.
4. **데이터 삭제** — 삭제 구문(DROP TABLE · TRUNCATE · DELETE FROM · DROP COLUMN)이 있는 마이그레이션은 종류를 밝히고 같은 적용 이력 증거가 필요하다. 마이그레이션 파일 삭제는 승인 대상이라 막는다.
5. **30파일 이상** → 본문 `## 검증` 절.
6. 필수 체크가 **이 HEAD** 에서 · **마지막 base 변경 뒤에** 성공했는지(check-runs · timeline). 7. 병합 직전 HEAD · base 를 다시 읽어 비교하고, 병합은 `gh pr merge --match-head-commit <확인한 SHA>` — 확인 뒤 새 커밋이 들어오면 GitHub 이 거부한다(SHA 변경 = 재검증).

## 4. 자동 main 병합 활성화 조건(지금은 꺼짐)

`merge.auto_merge_enabled = false`. 다음이 모두 확인되면 켠다(정책 버전을 올리고 DECISIONS 에 기록):

1. PR 필수 `e2e` 가 실제로 돈다 — 2026-10-11 전에는 시크릿이 없으면 건너뛰고도 SUCCESS 였다(가짜 통과). 이제 PR 필수 `e2e` 는 **격리 실행**(러너 안 로컬 Supabase + 저장소 마이그레이션 실제 적용 + next start + Playwright + DB 단언 · 공유 DB · 시크릿 불필요)이고, 공유 개발 DB E2E 는 `e2e-shared-dev`(main push · 수동 실행만 · 시크릿 필요)로 분리했다.
2. 모든 base 의 PR 에서 필수 CI 가 돈다 — 전에는 `pull_request: branches: [main]` 이라 종속 PR(#206 · #207 · #209)에 CI 가 없었다. 필터를 풀었다.
3. (선택) 공유 개발 DB 통합 E2E(`e2e-shared-dev`)에 쓸 저장소 시크릿 — PR 필수 조건은 아니다. 비밀값은 에이전트가 외부에 올리지 않는다.
4. main 브랜치 보호(필수 체크) — 2026-10-11 실측 「Branch not protected」. 설정은 GitHub 관리자 권한이 필요하다.

꺼져 있는 동안 `safe-merge.mjs` 는 **어떤 경로로도 병합하지 않는다**(`--dry-run` 판정만 · 자동/수동 구분 없음). 켜는 길은 이 값을 바꾸는 PR 하나뿐이고, 그 PR 도 보호된 main 의 필수 CI 를 거친다. 켜진 뒤에는 게이트를 통과한 PR 을 묻지 않고 병합한다.

## 5. 실패 · 예외

| 상황 | 할 일 |
|---|---|
| 코드 오류 · 테스트 실패 | 원인 분석 → 수정 → 재검증 |
| CI 미실행 | 실행 조건 복구(트리거 · base) |
| PR 충돌 | 허용 범위에서 안전하게 해결(force push 금지) |
| 교육적 근거 부족 | 검증 전 상태 유지 |
| DB 변경 필요 | SQL · 영향 분석 작성 → 승인 요청 |
| 데이터 삭제 필요 | 대상 · 범위 · 복구 방법 → 승인 요청 |
| 비밀정보 · 권한 우회 · 보안 위험 | 멈추고 보호장치 유지 |
| 고칠 수 없는 외부 장애 | blocker 보고 |

테스트 실패나 권한 부족을 사용자 승인으로 우회하지 않는다.

## 6. AI 역할 위임

사람 검수자가 필요한 일반 교육 · 개발 업무는 Claude Code · Codex · ChatGPT 에 역할을 나눠 맡긴다(독립 판정 · 반증 · 이견 조정 · 근거 검증, 기록을 남긴다). 실제 사람의 수행 데이터나 법적으로 필요한 동의를 AI 가 대신 만들거나 충족했다고 주장하지 않는다.

## 7. 보고

PR 마다 승인을 요청하지 않는다. 최종 보고는 네 가지: ① 제품 목표 대비 결과 ② 검증 · CI · 병합 결과 ③ DB 변경 · 데이터 삭제 승인 필요 사항 ④ 실제 blocker.

## 8. 적용 확인

- `node agents/scripts/check.mjs` D11 — 정책 파일 존재 · JSON 유효 · AGENTS.md 정책 줄 버전 = JSON 버전 · DECISIONS 이력.
- 세션 시작 훅(`handoff-inject.mjs` — Claude Code `.claude/settings.json` · Codex `.codex/config.toml` 이 같은 스크립트를 부른다)이 이 워크트리 정책 버전을 origin/main 과 비교해 다르거나 없으면 「[정책 낡음]」 을 주입한다(`policyNotice` · 2026-10-11 연결). 동기화: `git merge origin/main`.
- **이미 실행 중인 세션은 정책을 다시 읽지 않는다** — AGENTS.md · 훅은 세션 시작에 한 번 읽힌다. 정책이 바뀌면 그 세션을 다시 시작하거나 정본을 직접 다시 읽게 한다.
