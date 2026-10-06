# pilot-runs — 오답 원인 Pilot run 메타 · G6 시작 게이트

> 정본 규칙: `docs/csat-learner/codebook/PILOT_PROTOCOL.md` §9(모델 입력 비식별화) · §16(run 봉인) · §19(저장소에 남기는 것) · §20(G6 체크리스트).
> 이 디렉터리에는 **익명 key · 해시 · assignment · 검증 기록 요약만** 둔다. 계정 id · 이름 · 이메일 · 학교/반 · 자유서술 원문 · 모델 packet · 익명 key ↔ 계정 매핑은 넣지 않는다.
> `run-gate.test.ts` 가 이 디렉터리의 모든 `.json` 에 식별정보 가드(UUID · 이메일 · 전화 꼴 · 금지 키)를 건다.

## 파일

| 파일 | 만드는 것 | 내용 |
|---|---|---|
| `<run id>.json` | `scripts/csat/pilot/seal-run.mjs` | run 메타(기계용 정본 · 형식 `ec-pilot-run-1`) — 앱 게이트가 읽는 값 |
| `<run id>.md` | 같은 스크립트 | 사람이 읽는 요약 |
| `<run id>.pii-guard.json` | `scripts/csat/error-evidence/model-input/model-packets.mjs selftest --run <run id>` | PII 가드 자가검사 기록(형식 `ec-pilot-pii-guard-1`) |
| `<run id>.e2e.json` | Playwright E2E 실행자(아래 형식) | E2E 통과 기록(형식 `ec-pilot-e2e-1`) |

run id 꼴: `ec-pilot-run-<YYYYMMDD>-<n>`. 봉인된 run 은 고치지 않는다 — 무엇이든 바뀌면 새 run id(§16).

## run 메타 필드(`ec-pilot-run-1`)

| 필드 | 뜻 · 게이트 조건 |
|---|---|
| `taxonomy.version` · `definitionsHash` | `v0.1` 고정 · DB `csat_ec_taxonomy_version.definitions_hash` 와 같고 sealed · TEST 표기 없음 |
| `detectorVersion` | `bd-0.1.0` — 앱 상수(`gate.ts DETECTOR_VERSION`, 최신 감지기 마이그레이션과 테스트로 대조) · 점검 스크립트는 live 함수 본문 |
| `probe.capPerSession` · `configHash` | 3(결정 C) · `config.ts probeCapPerSession` 과 같아야 한다(지금 `null` 이면 닫힘) · `probeConfigHash(captureProbeConfig(), cap)` |
| `appCommit` | **검증 커밋** 40자(PII 가드 · E2E 를 돌린 커밋). 앱은 세 값을 섞지 않고 대조한다: env `CSAT_EC_APP_COMMIT` = appCommit · 플랫폼이 주입한 빌드 커밋 `VERCEL_GIT_COMMIT_SHA`(운영자가 덮어쓰지 못한다) = appCommit **또는** env `CSAT_EC_ACTIVATION_COMMIT`. 빌드 커밋이 없거나 둘 다 아니면 닫힘(다른 코드가 배포되면 env 가 낡아도 닫힌다) |
| `db.latestMigration` · `migrationCount` | 점검 스크립트만 대조(앱은 schema_migrations 를 못 읽는다) |
| `exams[]` | 정확히 2개 · `examId` · `itemSetHash` · `answerKeyHash` · `corpusHash`(정의는 `run-gate.ts`) |
| `participants[]` | `{ key: "P001", exams: [...] }` 3–8명(결정 A) — 개수가 서버 env `CSAT_EC_PILOT_USER_IDS` 의 유효 UUID 개수와 같아야 한다. 배열 순서가 attempt key 의 시험 순번(E1, E2) |
| `verification.piiGuard` | `commit`(= appCommit) · `rulesHash`(= 지금 `deidentify.mjs` 규칙) · `passed ≥ 1` · `failed = 0` · `at` · `recordSha256`(= `.pii-guard.json` 파일 sha256) |
| `verification.e2e` | `commit`(= appCommit) · `passed ≥ 1` · `failed = 0` · `skipped = 0` · `at` · `recordSha256`(= `.e2e.json` 파일 sha256) |
| `sealedAt` · `seal` | `seal` = `seal` 을 뺀 메타의 정규화 sha256 — 봉인 뒤 한 글자라도 바뀌면 닫힘 |

### 해시 정의(`apps/web/src/lib/csat/ec-pilot/run-gate.ts` — 앱 · 점검 스크립트 공용 파일)

- 정규화: 키를 정렬한 JSON 의 sha256(`canonicalJson`) — pg · supabase-js 어느 쪽으로 읽어도 같은 값(2026-10-06 수능 2019 · 2020 에서 두 경로 일치 확인).
- `itemSetHash`: `csat_items` 번호순 `[id, no, sha256([stem, passage, choices, body_ok])]`
- `answerKeyHash`: `csat_dx_answer_key` 번호순 `[no, answers, points]`
- `corpusHash`: 시험(`id · organizer · source_note · item_count · listening_end`) + 문항 분류(`no · id · section · in_scope · type_id · sha256(raw_block)`) + 선지 함정(`csat_dx_option_trap` 의 `item_id · option_no · trap_key · source · analysis_version`)

## E2E 통과 기록 형식(`<run id>.e2e.json`)

Playwright E2E(§18 — production 빌드 · 테스트 계정)를 돌린 쪽이 **이 형식 그대로** 쓴다. 식별정보(이메일 · 계정 id · base URL 의 개인 호스트)는 넣지 않는다.

```json
{
  "format": "ec-pilot-e2e-1",
  "runId": "ec-pilot-run-20261020-1",
  "commit": "<테스트한 배포 커밋 40자 — run 메타 appCommit 과 같아야 한다>",
  "build": "production",
  "specs": ["tests/e2e/52-csat-ec-capture.spec.ts"],
  "passed": 9,
  "failed": 0,
  "skipped": 0,
  "at": "2026-10-19T10:00:00Z",
  "playwright": "1.x.y",
  "reportSha256": "<Playwright JSON 리포터 출력 파일의 sha256 — 리포트 원본은 저장소 밖>"
}
```

- `at` 은 초 단위 UTC(`YYYY-MM-DDTHH:MM:SSZ`). `failed` · `skipped` 가 0 이 아니면 봉인 · 게이트가 거부한다(건너뛴 테스트를 통과로 치지 않는다).
- 봉인 · 점검이 원본을 검사한다(`scripts/csat/pilot/live.mjs recordFailures`): `format` · `runId` 일치 · `build = "production"` · `specs` 에 `tests/e2e/52-csat-ec-capture.spec.ts` 포함 · `reportSha256` 64자 hex(`--e2e-report-sha256` 를 주면 리포트와 대조) · PII 가드 기록과 같은 `commit`.
- run 메타 `verification.e2e.recordSha256` = 이 파일 그대로의 sha256(줄바꿈 포함 — 봉인 뒤 파일을 다시 쓰지 않는다).

## 개발 · 검증 모드(활성 run 없음)

| 모드 | 조건 | 열리는 대상 |
|---|---|---|
| `run` | `active-run.ts` 의 `ACTIVE_RUN` 이 있고 env `CSAT_EC_PILOT_MODE` 가 비었거나 `run` · 게이트 전 항목 통과 | env 참가자 · run 의 두 시험만(다른 시험은 참가자 플래그를 세우지 않고 수집 경로도 404) |
| `verification` | `ACTIVE_RUN = null` + env `CSAT_EC_PILOT_MODE=verification` | env 참가자 중 로그인 이메일이 `@example.com` 인 테스트 계정만 · 시험 제한 없음 |
| `closed` | 그 밖 전부(메타 없음 + env 없음 · 메타 있음 + verification) | 아무도 |

- 근거: e2e 52 와 §18 마지막 smoke 는 **production 빌드 + 개발 DB**(Pilot 이 실제로 쓰는 DB)에서 돈다 — NODE_ENV · DB 로는 실제 run 과 구별할 수 없다. `@example.com` 은 §2 가 실제 참가자에서 제외한 테스트 계정이고 §12 가 run 데이터 혼입을 감시한다. 활성 run 이 있으면 verification 을 거부해 run 기간에 테스트 계정이 v0.1 수집 경로를 열지 못하게 한다.
- e2e 52 실행 서버에는 `CSAT_EC_PILOT_USER_IDS=<임시 계정 id>` 에 더해 **`CSAT_EC_PILOT_MODE=verification`** 을 준다(임시 계정 이메일은 `@example.com`).
- `smoke-capture` · `smoke-detector` · `smoke-pilot` 은 RPC 를 직접 부르고 앱 게이트를 지나지 않아 영향이 없다.

## G6 시작 순서

1. 참가자 · 시험 결정 → 저장소 밖 매핑(`{ "runId", "participants": { "P001": "<계정 id>" } }` — `.pilot-private/` 또는 저장소 밖 절대경로)
2. `config.ts probeCapPerSession = 3` 커밋 · 배포 = **검증 커밋**(env `CSAT_EC_PILOT_USER_IDS` · `CSAT_EC_APP_COMMIT=<검증 커밋>`)
3. `node scripts/csat/error-evidence/model-input/model-packets.mjs selftest --run <run id>` → `.pii-guard.json`
4. Playwright E2E(verification 모드 서버 · 같은 커밋) → `.e2e.json`
5. `node --tls-max-v1.2 --env-file=<배포 env> scripts/csat/pilot/seal-run.mjs --run <run id> --exams A,B --participants "P001=A+B,…" --app-commit <sha> --activate` → 커밋 · 배포(배포 env 에서 `CSAT_EC_PILOT_MODE` 를 지운다)
6. 활성화 커밋(5의 산출물만) 배포 · env `CSAT_EC_ACTIVATION_COMMIT=<활성화 커밋>` · `CSAT_EC_PILOT_MODE` 제거
7. `node --tls-max-v1.2 --env-file=<배포 env> scripts/csat/pilot/start-check.mjs --run <run id> --build-commit <플랫폼에 표시된 배포 커밋>` 전 항목 PASS → G6 시작 승인 요청

활성화 커밋 범위: 검증 커밋의 **후손**이고 차이가 `apps/web/src/lib/csat/ec-pilot/active-run.ts` 와 `docs/csat-learner/pilot-runs/<run id>.{json,md,pii-guard.json,e2e.json}` 뿐이어야 한다 — `start-check.mjs` 가 git 으로 확인한다(`activationDiffFailures`). 그 밖의 파일이 섞이면 실패(검증하지 않은 코드가 배포된 것이다).
