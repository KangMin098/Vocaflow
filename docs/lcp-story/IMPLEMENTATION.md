# LCP Story — 단계별 구현 지시 (S0~S8)

> 계약의 정본은 [../LCP_STORY.md](../LCP_STORY.md)다. 이 문서는 **실행 순서 · 현재 상태 · 단계별 시작 지시**만 담는다.
> 설계를 바꿀 때는 정본을 고치고 이 문서의 해당 단계를 맞춘다. 채팅에 사본을 만들어 정본처럼 쓰지 않는다.
> 후속 작업자는 이 문서와 정본만 읽고 다음 한 단계를 시작할 수 있어야 한다. 단계가 바뀌어도 같은 목적이면 같은 브랜치를 이어 쓴다(AGENTS 브랜치 연속성).
> 사용자는 단계적 구현을 승인했다. 일반 개발 단계 사이에 별도 「시작 승인」을 기다리지 않는다. 멈추는 곳은 실제 승인 경계(DB 구조 · 데이터 변경,
> 데이터 삭제, 실제 권리가 불확실한 작품의 발행)뿐이다.

## 상태 표기

| 상태 | 뜻 |
|---|---|
| `PENDING` | 시작하지 않음 |
| `IN_PROGRESS` | 일부 구현·적용은 끝났지만 해당 단계의 나머지 수용 기준은 진행 중 |
| `IMPLEMENTED` | 코드 · 문서가 있고 작성자가 실제 테스트를 돌려 통과했다(작성자 검증). 독립 수용 판정은 이 표가 아니라 수용 기록이 말한다 |
| `VERIFIED` | 별도 owner 의 수용 판정(증거 결속)까지 끝났다 — 판정한 owner 가 실제 판정 뒤에 고친다 |
| `DB_APPROVAL_REQUIRED` | 진행에 사용자의 대화 승인(DB 구조 · 데이터 변경)이 먼저 필요하다 |
| `PILOT_NOT_RUN` | 실제 작품 · 실제 학습자 파일럿을 아직 하지 않았다 |

상태는 실제 결과로만 바꾼다. 안 한 일 · skip · 미실행을 통과로 적지 않는다.

## 현재 상태 (2026-10-26)

| 단계 | 목적 | 상태 | 선행 · 차단 |
|---|---|---|---|
| S0 | 정본 · 편집 기준 · 단계 지시 | `VERIFIED` | Codex 별도 검증: 패키지 2,940 통과 · 추가 검증 33 통과 · skip 0. 최종 커밋·통합 여부는 AI-Control T-0165 수용 기록(`verification/reviews/T-0165-*`)을 따른다 |
| S1 | 도메인 스키마 · 해시 · 원문 대응 · 검수 결속 | `VERIFIED` | 위와 같음. F1~F5 수정 확인 |
| S2 | 로컬 export/validate/plan + 합성 fixture | `VERIFIED` | 위와 같음. 실제 파일 기반 제작 흐름 확인 |
| S3 | live DB 읽기 감사 + 최소 스키마/RPC SQL 초안 | `VERIFIED` | T-0169 작성자 검증: SELECT 감사 · 미적용 SQL(표 12 · RPC 16) · 러너 시험 · 격리 PGlite/PostgreSQL 17 하네스 통과 · 독립 검토 지적 반영. T-0169 Codex 별도 수용 완료(검증 커밋 `6dfa0c0c6`). 승인 뒤 공유 DB는 MCP 원장 `20261025094450`로 적용 완료(승인 SHA 일치 · 사후 15/15 · 원본 지문 10/10 불변). 러너 TLS preflight는 미실행 |
| S4 | 승인된 DB 적용 + 관리자 후보/제작/검수/발행 + 도움말 | `VERIFIED` — 기존 코드 수용 | T-0174 Codex 별도 수용 완료(`fcf57c225e2a`) · 로컬 main 통합 `02411a5f7`. 같은 커밋 단위 235 · 격리 브라우저 7 통과(skip 0), 타입/lint 통과. 후속 승인으로 dev 제작/검수 스태프 구성·정상 Auth/SSR 확인 완료. 공유 DB 발행과 실제 작품 전체 여정은 미실행 |
| S5 | 학습자 탐색 · 판본별 독서 · 이어하기 · 원문 연결 | `IN_PROGRESS` — 코드 · DDL 완료, 실제 작품 live 여정 미실행 | T-0176 코드 `9b39634c5` 독립 수용(격리 UX 1440/1280 포함). SQL r3(SHA `a57ef729…161ab`) 사용자 승인 · 공유 dev DB 적용(원장 `20261025143031`). 공유 DB Story 발행 0 이라 인증 본문/진도 live 여정 · 콘텐츠 적합 · 파일럿은 `NOT_RUN` — 아래 「승인 · 적용 뒤 현재 상태」 |
| S6 | 선택적 Deep/Bridge · 실제 표현 어휘 연결 · 추천 다양성 | `PENDING` | S5 |
| S7 | 권리 확인된 서로 다른 장르 3편 제작 · 파일럿 | `PILOT_NOT_RUN` | 기본 독서 경로는 S4·S5 후 검증. 심화 활동 회차는 S6 후 · 실제 참가자 |
| S8 | 관찰된 근거에 맞춘 운영 자동화 · 품질/활용/비용 계측 | `PENDING` | S7 관찰 기록 |

## 모든 단계 공통

- 개발 절차는 중앙 `development_policy`(dev-minimal-20261020)를 따른다. 위험도 L1~L4 로 검증 범위를 정한다.
- AI 제작·편집·독립 검수·기술 검증 역할은 중앙 `ai_work_roles`(ai-work-roles-20261026)로 자동 배정한다. 기존 Story의 `ai_model/ai_review`는 AI 독립 검수를 지원하며, 인증된 서로 다른 staff UID 조건과 사람의 콘텐츠 검수 조건을 혼동하지 않는다. 정본 §14의 사람 권리 확인 및 실제 학습 효과는 별도로 남긴다. 대표 1편의 실제 제작·AI 독립 검수 결과는 [S7 후속 기록](./S7_PILOT.md#2026-10-26-후속--대표-story-1편-제작ai-독립-검수)을 따른다.
- 2026-10-26 사용자가 승인한 개발 계정 4개(curator 제작·admin AI 검수·학습자 A/B)를 생성하고 정확한 역할 SQL을 적용했다. 기존 86개 계정·프로필 지문 불변과 정상 Auth·새 SSR `getUser()`·권한 23검사를 확인했다. 이전 S4 검증 기록의 “두 번째 스태프 미준비”는 당시 상태이며, 현재 구성·실제 브라우저 범위와 미검증은 [S7 후속](./S7_PILOT.md)을 따른다. 계정 준비는 권리 확인·발행·교육 효과가 아니다.
- 실제 dev 후속에서 관리자 초기 조회/History URL 경합을 보완해 기존 인증·RPC를 쓰는 GET 조회로 분리했다. 코드 `c5328c3dc`의 범위 단위 186 · S4 격리 브라우저 7 · 웹/스크립트 타입 · lint 통과, 독립 검토 후 로컬 main `4294d8f7c` 통합. 실제 브라우저 좁힌 15 PASS·0 FAIL·5 NOT_RUN과 실제 Claude 종료 0을 확인했다. 발행된 실제 작품의 Start→Read→Complete→Resume 및 개인 진도 격리는 여전히 미실행이며 이전 실패 이력을 성공으로 덮지 않는다.
- 이후 대표 story-b2 1편을 정상 S4 UI에서 dev 초안으로 등록하고 다른 인증 계정으로 기존 Codex AI 독립 검수를 제출했다(실제 14 PASS·0 FAIL, 테스트·Claude exit0). 별도 SELECT에서 원천1·정책1·자리2·판1·검수1, 제작/검수 UID 분리와 현재 결속을 확인했다. 권리 결정·발행0이며 S5 실제 발행본 전체 여정과 실제 학습자 파일럿은 계속 미검증이다. [상세·화면·증거](./S7_PILOT.md)를 따른다.
- 새 로그인·새로고침의 최신 상태 화면도 실제 7 PASS·0 FAIL, 테스트·Claude exit0으로 확인했다. 검수1·AI 표기·다음 작업 「admin 권리 결정」·발행0이 일치한다. 이는 읽기 확인이며 사람 권리 승인이나 발행을 실행한 것이 아니다.
- S7 후속에서 고정 SE 원문214문단·source identity/text 결속과 권리 원자료10개를 확인했다([결정 자료](./BLUE_CARBUNCLE_RIGHTS.md)). 이후 사용자가 packet v2 SHA `796a77fd…e4e8db`의 특정 source 권리 확인과 AI admin 위임 기록을 명시 수용했다. 원래 사람 결정과 AI 기술적 기록자를 분리해 보존하며 DB 기록·발행은 실제 결과로 별도 판정한다. 별도 AI 재검수에서 찾은 거위 위해·도축 안내 결함은 기존 Claude 세션의 r3 최소 보완 및 새 독립 AI 검수 approve(필수10항목·실제 validator exit0)로 콘텐츠 차원에서 해소했다. 기존 파일·approve 이력은 보존했고 실제 발행본 여정·경고의 학습자 화면 노출·교육 효과는 아직 미검증이다.
- **DB 구조 · 데이터 변경**: SQL 전문 · 전체 SHA-256 · 영향 범위 · 복구 SQL 을 대화에서 보이고 사용자가 승인한 뒤, 승인형 배포 러너
  (`scripts/db/<id>/deploy.mjs apply --stage <s> --confirm-sha <sha>`, 1회용 티켓 · 실행 기록) 또는 Supabase MCP 로 적용한다.
  2026-10-25 후속 사용자 지시로 MCP 쓰기 연결을 허용했다. 적용 본문의 해시 · 실행 결과 · 전후 검증을 보관하며,
  Claude Code 의 MCP 쓰기는 표준 확인 창을 유지한다. 데이터 삭제 · DROP · TRUNCATE 는 내용을 따로 밝혀 별도 명시 승인.
- 기존 비공개 개발 설정은 사용자 지시에 따라 프로세스 내부에서 필요한 항목만 확인·사용하고, 비밀번호·토큰·서비스 키·접속값을 출력하거나 커밋하지 않는다. 설정 경로를 재차 묻기 전에 기존 환경을 조사한다. 별도 사용자 지시 없이 권한 · 훅 · MCP 설정을 바꾸지 않는다. 권한 거부를 우회하지 않고 그대로 보고한다.
- 다른 작업자의 변경을 되돌리지 않는다. 커밋은 `git commit --only <자기 파일>`. 새 파일은 `git add -N` 뒤 커밋하고 `git show --stat` 으로 확인한다.
- 원문 전문이 들어가는 작업 폴더(`work/lcp-story`)는 커밋하지 않는다(`/work/` 는 gitignore).
- **독립 검토**: 일반 단계마다 새 Codex 검토를 강제하지 않는다. L1~L4 검증을 하고, 실제로 적용되는 독립 검토 계약(등록 TASK 의 `require_review_pass` ·
  L3 이상에서 필요한 검토 · 명시 요청)이 있을 때만 그 판정을 받는다. S0~S2 의 T-0165 두 owner 수용 계약은 그대로 유효하다.
- 각 단계의 완료 증거 = 커밋 + 실제 실행한 명령과 결과(통과 · skip 수) + 남은 범위. 효과 · 공개 서비스 완성을 주장하지 않는다.
- 로컬 파일의 권리 · 대응 도서 · 생산자 · 검수자 기록은 입력이 주장하는 값이다(정본 §0). 인증된 권한으로 다루지 않는다.

---

## S0 — 정본과 편집 기준 · `VERIFIED`

- **목적**: 승인된 제품 방향을 구현 가능한 제품 · 데이터 · 상태 · 검수 · 오류/복구 계약으로 고정하고, 후속 단계 지시를 남긴다.
- **선행**: 사용자 방향(2026-10-25) · 원본 LCP 유지.
- **소유 파일**: `docs/LCP_STORY.md` · `docs/lcp-story/IMPLEMENTATION.md` · `docs/LIBRARY_PIPELINE.md`(추가 라인 한 단락) · `docs/CHANGELOG.md`(한 줄).
- **계약**: 정본 §0~§19.
- **수용 기준**
  - `LS-S0-AC1` 목표 · 범위 · 범위 밖 · 현재/제안 경계 · 로컬 메타데이터가 주장이라는 한계를 구분한다(§0 · §1).
  - `LS-S0-AC2` 콘텐츠 5종(본문 판본 · 활동 · 편성)과 변환 유형 · 재서사 제외를 구분한다(§2 · §3).
  - `LS-S0-AC3` 편집 기준 필드와 언어 · 사고 · 배경지식 · 정서 축 분리, 실측 표시 금지, 원작 언어 · 본문 언어 · 번역 구분(§4 · §5 · §6).
  - `LS-S0-AC4` 데이터 · 원문 결속 · 해시(본문 해시와 원천 판본 정체 해시의 구분) · 검수 · 발행(보류 = 학습자 발행 차단, 관리자 초안 저장은 별도 설계) ·
    진도(각색 완독 ≠ 원문 완독) · 근거 · 권리 계약과 노출 게이트 · 추천 · 이벤트 · 관리자 · 효과 경계(§6~§19).
  - `LS-S0-AC5` S0~S8 의존성 · 소유 파일 · 검증 · 수용 기준 · 중단 조건(이 문서).
- **검증(L1)**: 문서 정적 검토. 줄 끝 공백이 없어야 한다(출력 없음 = 정상):
  `grep -nE "[[:space:]]+$" docs/LCP_STORY.md docs/lcp-story/IMPLEMENTATION.md`
  상대 링크 대상(`LEARNING_MODEL.md` · `LIBRARY_PIPELINE.md` · `lcp-story/IMPLEMENTATION.md` · `../LCP_STORY.md`)이 존재해야 한다.
- **DB 승인**: 불필요.
- **중단 조건**: 사용자 방향과 정본이 충돌하면 정본을 임의로 바꾸지 않고 차이를 보고한다.
- **복구**: 문서 커밋 되돌리기.
- **완료 증거**: 커밋 · T-0165 수용 기록.
- **다음**: S1.

## S1 — 도메인 스키마 · 해시 · 원문 대응 · 검수 결속 · `VERIFIED`

- **목적**: 로컬 제작 흐름이 실제로 소비하는 최소 모델과 순수 검증기.
- **선행**: S0.
- **소유 파일**: `packages/library-pipeline/src/story/{canonical,text,schema,validate,plan,index}.ts` 와 각 `*.test.ts` · `fixtures/gull-rock.*.json`.
  패키지 `src/index.ts` · `package.json` 은 수정하지 않았다(S4 에서 소비자가 생기면 exports 추가).
- **계약**: 정본 §2~§14.
- **수용 기준**
  - `LS-S1-AC1` Story/Easy 본문 판본 · Bridge/Deep 활동 · Theme 편성이 서로 다른 스키마이고 strict(정의 밖 키 거부)다.
  - `LS-S1-AC2` 정본 직렬화: 키 순서 무관 · 배열 순서 보존 · undefined/NaN/±Infinity/-0/순환/비평범 객체/잘못된 UTF-16 거부.
  - `LS-S1-AC3` 원문 앵커: 원문 해시 · 문단 · `[start,end)` UTF-16 · 정확 인용을 전문으로 검증 — 허위 인용 · 밀린 구간 · 다른 판 해시 · 서로게이트 쌍 가르기 거부.
  - `LS-S1-AC4` 판본 구조: 빈 값 · 채우지 않은 표시 · 단위 중복 · 원작 순서 변경 · 정렬 누락 · 보존 요소 누락/엉뚱한 대응 · 재서사 · 민감 표현 미처리 · 요청 밖 활동 거부.
  - `LS-S1-AC5` 검수 결속: 본문 · 정답 · 근거 변경 시 stale, 다른 판본 검수 재사용 · 자기 승인 불인정, 합성 검수는 `fixture_only`, 모순 검수 무효.
  - `LS-S1-AC6` 언어 · 사고 `basis` 리터럴(실측 표시 거부), 불변 `release_key`, 판본별 진도 키 · 작품 수 1 · 에피소드 판본의 전권 완료 불인정 ·
    각색 완독 이름(`adapted_full_work` · `adapted_partial`)과 원문 완독 불인정, 권리 미확정 · 자산 미검증 보류.
  - `LS-S1-AC7` 원천 판본 정체 해시: 스냅숏에서 계산(주장 불가) · 판본/검수/원장/발행 키에 결속 · 같은 본문의 다른 원천 판본에서 옛 결과물 · 검수는
    stale/거부, 다시 만들고 다시 검수한 판본은 다른 발행 키 · 키 순서만 다른 스냅숏은 같은 정체.
  - `LS-S1-AC8` 번역: 원작 언어 ≠ 본문 언어면 번역자 · 번역 권리 기록 필수, 선언된 번역 권리가 confirmed 가 아니면(hold · unverified · claimed_by_source) 보류,
    쓰지 않는 오디오 · 삽화 권리 기록은 본문 판본을 막지 않음, 합성 기본값은 fixture_only.
  - `LS-S1-AC9` 잘못된 UTF-16: 짝 없는 높은/낮은 서로게이트를 본문 · 인용 · 해시 · 직렬화 경계에서 치환 없이 거부, 올바른 서로게이트 쌍은 허용.
- **검증(L3 — 데이터 결속)**
  ```bash
  pnpm --filter @vocaflow/library-pipeline exec vitest run src/story
  pnpm --filter @vocaflow/library-pipeline exec tsc --noEmit -p .
  ```
- **DB 승인**: 불필요(DB 없음).
- **중단 조건**: 검증 규칙이 정당한 판본을 막으면 판본을 꾸미지 말고 규칙과 정본을 함께 고친다.
- **복구**: 모듈은 아직 다른 소비자가 없다 — 되돌려도 영향 없음.
- **완료 증거**: 테스트 결과(아래 실행 기록) · T-0165 수용 기록.
- **다음**: S2.

## S2 — 로컬 export/validate/plan + 합성 fixture · `VERIFIED`

- **목적**: DB · 네트워크 · LLM API 없이 원천 스냅숏 → 결속된 과제 → 에이전트 결과 검증 → 발행 계획 미리보기를 재현한다.
- **선행**: S1.
- **소유 파일**: `scripts/lcp/story/story.ts` · `packages/library-pipeline/src/story/{workdir,cli}.ts` · `workdir.test.ts`.
- **계약**: 정본 §20(파일 배치 · 종료 코드 · 예약 규칙 · 오류/복구 표).
- **수용 기준**
  - `LS-S2-AC1` export → 결과 → validate → 검수 과제 → plan 을 실제 CLI 명령으로 재현한다(합성 fixture, 정본 §20 명령).
  - `LS-S2-AC2` 같은 입력 재실행은 no-op, 다른 내용으로 같은 경로 덮기 거부, 원자적 생성, 중단 후 재실행 복원, 남은 임시 파일은 지우지 않고 보고.
  - `LS-S2-AC3` 경로 범위: `--work` · 파일 이름 · `plan --out` 제한, root/작업 폴더/결과 파일 링크(junction 포함) 거부, 입력=출력(경로 · hard link) 거부.
  - `LS-S2-AC4` 빈 · 불완전 · 작업 중 · 충돌 결과를 구분하고 종료 코드 0/2/1 로 낸다. 오류를 0건 성공으로 삼키지 않는다. 오류가 있으면 계획 파일을 쓰지 않는다.
  - `LS-S2-AC5` 과거 `*.out.json` · 옛 검수 파일 보존, 판본이 바뀌면 새 검수 과제가 따로 나온다.
  - `LS-S2-AC6` import · publish · DB 쓰기 명령과 DB 클라이언트가 없다.
  - `LS-S2-AC7` 같은 작업 이름이 다른 root 에 다른 원천 판본(같은 본문)으로 내보내졌을 때 옛 결과물이 통하지 않는다(원장 정체 해시가 다르다).
  - `LS-S2-AC8` 파일은 엄격한 UTF-8 로 해독한다(잘못된 바이트 → `input_invalid_utf8` · `result_invalid_utf8`, 치환 없음).
  - `LS-S2-AC9` CLI 는 `export` · `validate` · `plan` 외 명령(`toString` · `constructor` · `__proto__` 등 Object.prototype 이름 포함)과 정해지지 않은 옵션을
    처리되지 않은 예외 없이 JSON 사용법 오류 · 종료 1 · 파일 없음으로 낸다.
- **검증(L3)**
  ```bash
  pnpm --filter @vocaflow/library-pipeline exec vitest run src/story
  grep -rn "supabase" packages/library-pipeline/src/story scripts/lcp/story   # 결과 없음이 정상
  ```
  그리고 정본 §20 「합성 예시 재현」 명령을 비어 있는 `--root` 에서 그대로 실행한다(종료 코드 0 → 0 → 0 → 2).
- **DB 승인**: 불필요.
- **중단 조건**: CLI 가 작업 root 밖에 쓰거나 기존 결과를 덮는 경로가 발견되면 멈추고 회귀부터 만든다.
- **복구**: 작업 폴더는 커밋 대상이 아니다. 잘못 내보낸 폴더는 그대로 두고 새 `--work`(또는 새 `--root`)로 다시 내보낸다.
- **완료 증거**: 테스트 결과 · 명령 실행 기록 · T-0165 수용 기록.
- **다음**: S3.

### 작성자(Claude) 실행 기록 — 수정 요청 F1~F5 반영 후 (2026-10-25, 커밋 전 작업 트리)

- `vitest run src/story`: 4 파일 · **203 통과 · 0 skip · 0 실패**(canonical 38 · validate 83 · plan 32 · workdir 50). 파일 링크 거부 테스트는 이 환경
  (관리자 권한 Windows)에서 실제 실행됐다 — 파일 심볼릭 링크 권한이 없는 환경에서는 skip 으로 보고되며 그것은 통과가 아니다.
- 패키지 `tsc --noEmit -p .` 통과. 테스트 · CLI 스크립트를 포함한 strict 타입 검사도 통과.
- 정본 §20 합성 예시(비어 있는 root): export 0 · 재실행 0(그대로 5) · 결과 없는 validate 2 · 결과 넣은 validate 0 · 검수 과제 export 0
  (`story-b1.review-29b915bc1785.task.json`) · 검수 넣은 validate 0 · plan 2(`story-b1` fixture_only · `easy-a2` hold) · plan 재실행 no-op ·
  `toString` 명령 종료 1(JSON 사용법 오류). 이전 형식으로 내보낸 옛 폴더에 다시 export 하면 `overwrite_refused`(종료 1)로 옛 폴더를 보존한다.
- 브라우저 E2E 는 해당 없음(runtime 변경 없음) — 통과했다고 하지 않는다.

---

## S3 — live DB 읽기 감사 + 최소 스키마/RPC SQL 초안 · `VERIFIED`(T-0169 Codex 별도 수용 완료)

- **목적**: 실제 DB 의 테이블 · RPC · 트리거 · RLS · 자동 발행 경로를 전수 확인하고, 파생 판본을 안전하게 담을 **최소** 추가 스키마 · RPC SQL ·
  권한 · 복구 · 영향을 준비해 사용자에게 보인다. **적용하지 않는다** — 적용은 S4 의 별도 대화 승인 뒤다.
- **선행**: S0~S2 수용(T-0165). 그 뒤의 읽기 감사와 SQL 준비는 기존 승인 범위 안이다 — 별도 시작 승인을 기다리지 않는다.
  여러 세션이 나누면 TASK 등록(allowed_paths 에 아래 파일).
- **수정 파일(산출물)**: `docs/lcp-story/S3_DB_AUDIT.md`(감사 기록 · 결정) · `supabase/migrations/_pending_lcp_story_*.sql`(적용 전 초안 — 저장소의 `_pending_` 관행) ·
  `scripts/db/lcp-story-<단계>/deploy.mjs`(승인형 배포 러너 — 기존 `scripts/db/<id>/` 관행을 따른다) · 계약이 바뀌면 `docs/LCP_STORY.md`.
- **계약 · 감사 대상**
  1. 존재 확인은 문서가 아니라 `to_regclass`: `library_books` · `library_chapters_master` · `library_book_vocabularies` · `content_chunks` · `texts` · `reading_sessions` · `book_curation_jobs` · `funnel_events`.
  2. 함수 정의(`pg_get_functiondef`) · 권한(`has_function_privilege` anon/authenticated): `auto_curate_book` · `enroll_library_book` · `unenroll_library_book` ·
     `get_chapter_content` · `store_content_chunk` · `publish_book_word_sets` · `insert_book_analysis` · `process_library_pipeline_batch` · `admin_bulk_*`(도서).
  3. RLS(`pg_policies`): 위 테이블 전부. 특히 `content_chunks` 의 로그인 사용자 SELECT 범위와 `library_books` 공개 조건.
  4. 트리거(`pg_trigger`): `library_books` 상태 전이 · 단어장 발행.
  5. 웹 경로: `apps/web/src/app/api/admin/library/force-publish-book/route.ts` · `/api/lcp/process` · `/api/lcp/dev-process` · 리더 · 도서 상세 · `applyBookReadGate` 사용처.
  6. 정본 §15 표의 각 경로가 파생 판본을 우회 발행 · 노출할 수 있는지 판정하고, 막을 위치(RLS · RPC · 트리거 · 서버 액션)를 정한다.
  7. 판본 발행본의 읽기 도서 키를 `library_books` 별도 행으로 둘지 별도 테이블로 둘지 근거와 함께 결정한다(정본 §12 · §6). 단일 작품을 제목으로 합치지 않는다.
  8. 저장 단위 설계: 원천 스냅숏(본문 해시 · **원천 판본 정체 해시** · 대응 `library_book_id` · 원작 언어 · 본문 언어 · 번역자 표기) · 편집 기준 · 판본 결과 ·
     검수 · 발행본 · 철회. 관리자 전용 초안 · 검수 저장(보류 판본 포함)은 학습자 경로에서 읽히지 않는 자체 RLS 로 둔다 — 보류가 학습자 발행을 막는 것과
     관리자 초안 저장이 필요한 것은 따로다.
  9. **로컬 메타데이터는 주장이다**: 로컬 드레인의 권리 기록 · 대응 도서 id · 생산자 · 검수자는 인증되지 않았다. DB 에는 인증된 관리자 신원 · 시각으로
     다시 기록하고, 로컬 값을 권한 근거로 쓰지 않는 적재 경로를 설계한다.
- **SQL 초안이 담아야 할 것**: 대상 객체 · SQL 전문 · 전체 SHA-256 · 영향 행 수(실측) · GRANT/REVOKE · 복구(롤백) SQL · 격리 환경 검증 계획 · 기존 원본 도서 무영향 근거.
- **수용 기준**
  - `LS-S3-AC1` 감사 대상 1~5 의 실측 결과를 날짜와 함께 기록한다(문서 수치 인용 금지).
  - `LS-S3-AC2` 파생 판본의 우회 경로(자동 발행 · force-publish · 직접 링크 · 등록 RPC · RLS · 리더 · `content_chunks`) 전부에 차단 위치가 정해진다.
  - `LS-S3-AC3` 철회가 노출 · 열람을 막고 학습 이력을 지우지 않는 설계다. 관리자 초안 저장이 학습자 경로와 분리된다.
  - `LS-S3-AC4` 원천 판본 정체 · 번역자 표기 · 권리 기록이 저장 단위에 있고, 로컬 주장 값을 인증된 기록으로 바꾸는 적재 경로가 있다.
  - `LS-S3-AC5` SQL 전문 · SHA-256 · 영향 · 권한 · 복구가 대화에서 사용자에게 보여지고, 승인 전에는 적용되지 않는다.
- **검증(L4 준비)**: DB 는 읽기 질의(SELECT)만. SQL 은 정적 검토와 격리 환경 적용 계획까지(격리 하네스 사용 가능 여부도 확인해 기록).
- **DB 승인**: 감사(읽기)는 승인 불필요. SQL 적용은 S4 에서 사용자 승인 후 승인형 배포 러너로.
- **중단 조건**: 쓰기가 필요한 조사 · 실 DB 와 저장소 마이그레이션의 불일치 · 기존 원본 도서에 영향이 생기는 설계 → 기록하고 그 지점에서 사용자에게 보고.
- **복구**: 산출물이 문서 · 미적용 SQL · 실행 전 러너뿐이다.
- **완료 증거**: 감사 문서 커밋 · SQL 초안 커밋 · 사용자에게 보인 SQL 의 SHA-256.
- **실행 기록(T-0169 작성자, 2026-10-25 — SQL 해시는 `docs/DB_SCHEMA.md` 안내문 · 러너 `STAGES` 와 같다)**:
  `node --test scripts/db/lcp-story-s3/deploy.test.mjs` 26 통과 · `pnpm exec tsx scripts/db/lcp-story-s3/verify-isolated.ts` PGlite 47 통과 · 0 실패 · 10 미실행
  (두 연결이 필요한 경합 · 러너 경로 — 종료 코드 3) · `… --engine pg17 --deps <dir>` PostgreSQL 17 59 통과 · 0 실패 · 0 미실행(경합마다 두 번째 연결의 Lock 대기 관찰) ·
  패키지 vitest 2,965 통과 · tsc 통과. **미실행**: 공유 DB 대상 TLS preflight · 적용 · 사후 verify.
- **다음**: S4(사용자 승인 후).

```text
[S3 시작 지시]
LCP Story S3 를 진행한다. docs/LCP_STORY.md 전체와 docs/lcp-story/IMPLEMENTATION.md 의 S3 절을 끝까지 읽고, 중앙 development_policy 를 다시 읽는다.
등록 TASK 가 있으면 vfc task show 로 범위를 확인하고, 없으면 단일 세션 일반 개발로 진행한다(별도 시작 승인을 기다리지 않는다).
S3 의 감사 대상 1~9 를 실제 DB 읽기 질의(SELECT)와 저장소 코드로 확인해 docs/lcp-story/S3_DB_AUDIT.md 에 날짜와 함께 기록한다.
존재 확인은 to_regclass, 정책은 pg_policies, 함수는 pg_get_functiondef 로 한다. DB 쓰기 · 마이그레이션 적용을 하지 않는다.
파생 판본의 최소 스키마 · RPC · RLS(관리자 초안 저장 분리 포함)를 supabase/migrations/_pending_lcp_story_*.sql 초안과 승인형 배포 러너로 준비하고,
영향 행 수 · 권한 · 복구 SQL · 격리 검증 계획을 붙여 대화에서 SQL 전문과 전체 SHA-256 을 보인 뒤 승인을 요청한다.
로컬 드레인의 권리 · 생산자 · 검수자 기록은 인증되지 않은 주장이라는 점을 적재 설계에 반영한다. .env* 를 읽지 않는다.
끝낼 때 실제 질의 결과 · 미확인 항목 · 승인 대기 SQL 만 보고한다.
```

## S4 — 승인된 DB 적용 + 관리자 후보/제작/검수/발행 · `VERIFIED`

- **목적**: 사용자가 승인한 SQL 만 적용하고, 관리자가 후보 → 분석 → 제작(S2 드레인) → 검수 → 발행 → 철회를 할 수 있게 한다.
- **선행**: S3 SQL 의 사용자 대화 승인(승인 SQL SHA-256 · 범위를 `.agent-goal.md` 에 먼저 기록).
- **수정 파일(예정)**: `supabase/migrations/<timestamp>_lcp_story_*.sql`(승인본과 한 글자도 다르지 않게) · `scripts/db/lcp-story-*/`(승인형 배포 러너) ·
  `apps/web/src/app/admin/curation/**`(이야기 라인) · `apps/web/src/lib/admin/help/curation.ts`(화면과 같은 커밋) · `apps/web/src/lib/library/story/**`(서버 게이트 · 액션) ·
  `packages/library-pipeline/src/story/**`(DB 적재 어댑터 · 배럴) · `packages/library-pipeline/package.json`(`./story` exports) ·
  `docs/DB_SCHEMA.md` · `docs/ADMIN_CONSOLE.md` · `docs/LCP_STORY.md` · `docs/CHANGELOG.md`.
- **계약**: 정본 §9 · §10 · §14 · §15 · §18. 발행 = 관리자 승인 + 현재 결속 검수(자기 승인 아님) + 본문 권리(원문 · 선언된 번역) confirmed
  + service_role 검증 증명(현재 결속). S4 는 S3 SQL 이 요구하는 **백엔드 검증 증인 런타임**(서버에서 service_role 로 `story_service_validation_input` →
  `buildValidationAttestation` → `story_service_attest_validation`)을 만든다 — 그것이 없으면 발행은 막힌 채다. 실제 발행 전 **두 번째 인증 스태프 계정**이 있어야 한다
  (live 2026-10-25: admin 1 · curator 0. 계정 생성 · 역할 부여는 이 문서가 하지 않는 운영 조치다).
  DB 는 같은 원천 · 같은 판본 키의 살아 있는 발행본을 하나로 막지만, 원천 스냅숏이 다르면 같은 작품 · 판본 키가 각자 살아 있을 수 있다 —
  관리자 화면은 새 원천으로 발행할 때 옛 발행본 철회를 안내해 학습자 서가 중복을 막는다.
  적재는 S2 `plan` 의 `candidate` 를 서버에서 다시 검증한 뒤에만. `fixture_only` 는 적재하지 않는다. `hold` 판본은 관리자 초안 저장소에만 두고 학습자에게 열지 않는다.
  원본 도서의 `auto_curate_book` · force-publish 경로로 파생 판본이 발행되지 않는다. 철회는 노출 · 열람 차단, 이력 보존.
- **수용 기준**
  - `LS-S4-AC1` 적용 SQL 이 승인본과 같고, 승인한 실행 경로(MCP 또는 승인형 러너)의 실행 기록 · 적용 이력 해시가 남는다. MCP 원장 `20261025094450`와 승인 SHA 일치를 확인했다.
  - `LS-S4-AC2` 미승인 · 낡은 검수 · 권리 미확정 판본은 서버 · RPC · RLS 어디서도 학습자에게 발행되지 않는다(직접 호출 포함).
  - `LS-S4-AC3` 동시 발행 · 철회 경합에서 상태가 하나로 수렴한다.
  - `LS-S4-AC4` 관리자 화면에서 원문 · 각색 · 변경 내역을 비교하고, 도움말이 같은 커밋에 있다.
  - `LS-S4-AC5` 기존 원본 도서의 목록 · 등록 · 리더 동작이 그대로다.
- **검증(L3 + L4)**: 인증 · RLS · 경합 · 서버 결속 통합 테스트와 격리 E2E.
  ```bash
  pnpm --filter web exec vitest run <변경한 테스트 경로>
  pnpm --filter web exec playwright test -c playwright.isolated.config.ts
  pnpm --filter @vocaflow/library-pipeline exec vitest run src/story
  ```
- **DB 승인**: 현재 스키마는 승인·적용 완료(L4). 추가 SQL은 별도 승인.
- **중단 조건**: 승인 범위 밖 변경이 필요해지면 적용을 멈추고 새 SQL 을 보인다. 적용 후 검증 실패 시 복구 SQL 도 승인 범위 안에서만.
- **복구**: S3 의 복구 SQL(승인 포함). 학습 이력은 지우지 않는다.
- **완료 증거**: 승인한 실행 경로의 기록 · 적용 이력 해시 · 통합 · E2E 결과 · 관리자 화면 확인 · 해당하는 독립 검토 계약이 있으면 그 판정.
- **다음**: S5.

### 독립 수용 · 로컬 통합 (T-0174, 2026-10-25)

- 실제 Claude Code + native 서브에이전트 3개 작성 후 Codex 별도 수용. 검증 커밋 `fcf57c225e2ad5759a51001fc24f65fe3bb5be51`, 로컬 main 병합 `02411a5f7c7ed8b8acd23cf63dc31df686f47873`.
- 같은 최종 커밋에서 범위 지정 9파일 235 통과, Playwright 격리 7 통과, skip 0, web 타입·변경 파일 lint 통과. 89개 소스/글꼴 해시 일치, 현재 실행 외부 요청·pageerror 0.
- 덮어쓴 최초 캡처는 복구하지 않았다. 이전 Git 코드로 원본 화면을 재구성해 1440/1280의 내비게이션 6곳·표 4곳 픽셀 일치를 새로 확인했다. 추가 라인 선택기로 전체 페이지 높이는 달라진다. 한글 CDN 글꼴은 미로딩, 시스템 대체 글꼴로 검증했다.
- 독립 수용 기록: AI-Control `verification/reviews/T-0174-lcp-story-s4-codex.md`. 원시 증거: `runtime/lcp-story-20261025/s4-postcommit-*`, `s4-independent-ui.md`, `s4-visual-regression.json`. 작성자 초안의 skip 2개는 새 검증으로 해소했으며 초안은 역사로 보존한다.
- 공유 DB에 콘텐츠를 쓰거나 발행하지 않았다. 실제 인증/Server Action HTTP/PostgREST/RLS 종단 · 두 번째 스태프 · 사람 파일럿은 미실행이며 격리 성공과 구별한다.

### 작성자 구현 현황 (T-0174, 2026-10-25, 커밋 전 작업 트리 · base `b09f63a0c`)

> 아래는 작성 시점의 구현·실행 기록이다. 이후 T-0174 독립 수용을 완료했다(다음 단락). 실제 발행 · 두 번째 스태프 · live 쿠키/RPC E2E 는 검증되지 않았다.

| 범위 | 파일 | 작성자 상태 |
|---|---|---|
| 서버 로직 · 권한 · 증인 | `apps/web/src/lib/library/story/{admin,witness,messages,types}.ts` · `app/admin/curation/story-actions.ts` · 패키지 exports `@vocaflow/library-pipeline/story`(`src/story/server.ts`) | 구현 · 가짜 클라이언트 단위 시험(아래 기록) |
| 관리자 화면 · URL · 도움말 | `app/admin/curation/StoryCurationClient.tsx` · `story-curation.module.css` · `story-view.ts` · `lib/admin/curation-view.ts`(라인 헬퍼 추가) · `AdminCurationClient.tsx`(라인 전환) · `lib/admin/help/curation.ts`(「이야기 판본」) | 구현 · 단위 · 격리 브라우저 하네스 |
| 격리 브라우저 하네스 | `apps/web/scripts/build-lcp-story-harness.mts` · `apps/web/tests/e2e-isolated/lcp-story.isolated.spec.ts` · `apps/web/tests/fixtures/lcp-story/original-curation.ts` · `scripts/lcp/story/s4-harness-{fixtures,eval}.ts` | 구현 · 실행(아래 기록) |

- 하네스 구성: 실제 클라이언트 컴포넌트(AdminShell 시각 틀 · AdminCurationClient · 원본 탭 · AdminScreenHelp · StoryCurationClient)와 실제 앱 CSS(admin 스킨 · CSS module)를 가짜 origin 에 올리고, 알려진 하네스 요청만 응답 · 그 밖은 abort 한다.
  이야기 줄 Server Action 9개는 대역이 요청을 보내고, tsx 자식 프로세스가 **실제** 서버 로직(`lib/library/story/*` · 실제 S2 검증기 · plan · `buildValidationAttestation`)을 가짜 쿠키/서비스 클라이언트 + S3 SQL 규칙을 흉내 낸 메모리 가짜 DB 로 돌린다.
  가짜 DB 의 해시(원천 정체 · 판본 · 결속)는 SQL 정의대로 계산하며, 실제 S2 검증기가 낸 값과 일치해야 등록 · 증인이 통과하므로 두 계산이 맞는지도 함께 확인된다.
- 표현하지 않는 것: `app/admin/layout.tsx` requireAdmin · middleware · `page.tsx` RSC 로딩 · 실제 쿠키 인증 · PostgREST/RPC · RLS · 잠금 · 실제 Server Action 전송. 컴포넌트 수준 브라우저 증거이며 live E2E 가 아니다.
- 하네스가 단언하는 경계: 목록 · 번들 읽기 · 화면 진입만으로는 권리 · 증인 · 발행 요청 0, 증인은 「검증 실행」 클릭 때만 / 판본 제출 단계 실패 시 앞 단계 결과가 화면에 남고 같은 파일 재시도로 이어짐(롤백 주장 문구 없음) /
  source_url(쿼리 · 프래그먼트 http URL · null · ftp)을 바꾸지 않고 http/https 만 링크 / localStorage · sessionStorage · URL 에 원문 · 판본 본문 없음 / 원본 줄 view · q · status · page · selected 복원 · 이야기 줄 뒤로/앞으로 복원 / 1440 · 1280 가로 넘침 없음.

### 작성자 실행 기록 — T-0174 S4 (2026-10-25, 커밋 전 작업 트리 · base `b09f63a0c`)

W3(브라우저 하네스 · 문서)가 직접 돌린 것:
- `pnpm.cmd --dir apps/web exec tsx scripts/build-lcp-story-harness.mts` → 하네스 HTML(gitignored `work/lcp-story-s4/harness/`) · 번들 소스 sha256 목록(`build-manifest.json`).
- `pnpm.cmd --dir apps/web exec playwright test -c playwright.isolated.config.ts tests/e2e-isolated/lcp-story.isolated.spec.ts --reporter=list` → 코디네이터 제품 동결(`work/lcp-story-s4/product-freeze.sha256`) 바이트로 **7 passed · 0 failed · 0 skipped (2.2m)**
  (원본 줄 4: 1440 · 1280 × 목록/수집/검토 · URL 복원/상세/도움말 / 이야기 줄 3: 1440 · 1280 전체 흐름 · source_url 보존). 외부 요청 시도 0 · 미지 하네스 경로 0 · pageerror 0 · admin 글꼴(Inter Variable · JetBrains Mono) 로드 단언.
  하네스 빌드 manifest 의 소스 해시 74개가 실행 뒤 실제 파일과 같고, 동결 목록과 겹치는 파일은 동결 해시와 같다. 원시 로그 `work/lcp-story-s4/run-final2.log` · `network-log.jsonl` · 캡처 `work/lcp-story-s4/shots/`.
  이 실행이 잡아 고친 화면 결함: 합성 검사 판정 문구 · 결과 알림 뷰포트(2회) · 철회 뒤 같은 키 재발행 안내 · 같은 작품 · 판본 키 자리 구분(`work/lcp-story-s4/ui-defects.md`).
  한계: 하네스에 Pretendard(한글 CDN 글꼴)가 없어 한글은 시스템 대체 글꼴로 그려진다. 변경 전 원본 줄 기준선 캡처는 연결 뒤 실행에 덮어써져 픽셀 비교를 하지 않았다(기능 회귀는 단언으로 통과).
- `pnpm.cmd --dir apps/web exec eslint tests/e2e-isolated/lcp-story.isolated.spec.ts tests/fixtures/lcp-story/original-curation.ts scripts/build-lcp-story-harness.mts` → 0 오류. 스코프 `tsc --noEmit`(하네스 · 스펙 · 평가 스크립트 5파일, next 전역 타입 포함) → 0 오류.

서버 담당(W1)이 보고한 결과: web vitest `src/lib/library/story` 2파일 107 통과 · 0 실패 · 0 skip(이후 예상 발행 키 시험이 더해져 아래 코디네이터 실행에 포함), 패키지 story vitest 228 통과, 패키지 tsc 통과, eslint 0.

코디네이터 실행(제품 동결 바이트 · 커밋 전 작업 트리 · base `b09f63a0c` — 최종 커밋 HEAD 의 증거가 아니다):
- 범위 지정 web vitest 9파일(`lib/library/story/__tests__/{story-server,story-actions}` · `app/admin/curation/__tests__/{story-view,story-curation-client}` ·
  `lib/admin/__tests__/{curation-view-line,curation-return,navigation,help-registry,help-diagram}`) → **235 통과 · 0 실패 · 0 skip**.
  (그 전 넓은 실행 `src/lib/admin/__tests__` 전체는 469 통과 · 4 skip — skip 4는 이 작업과 무관한 `*.integration.test.ts` 가 서비스 키 없는 환경에서 건너뛴 것이다.)
- web 전체 `tsc --noEmit` → exit 0. 변경 제품 · 시험 파일 eslint → 0.
- `next build --experimental-build-mode compile`(별도 `NEXT_DIST_DIR`, 네트워크 전면 차단 preload — 루프백 포함) → exit 0, 네트워크 시도 0. 페이지 생성 · SSG 는 하지 않았다.
- 최종 커밋 HEAD 에서의 하네스 재실행 · 정식 UI 증거는 아직 없다 — 커밋 뒤 루트가 기록한다(하네스 manifest 는 빌드 시점의 실제 HEAD · dirty 여부를 적는다).

```text
[S4 시작 지시]
LCP Story S4 를 진행한다. docs/LCP_STORY.md, docs/lcp-story/IMPLEMENTATION.md S3·S4 절, docs/lcp-story/S3_DB_AUDIT.md 를 읽는다.
스키마는 사용자 승인 뒤 MCP 원장 20261025094450로 적용됐고 SQL SHA가 승인본과 같다. 재적용하지 않는다.
새 SQL이 필요한 경우 전문·SHA·영향·복구를 먼저 보여 승인을 받고, MCP 또는 승인형 러너의 실행 기록과 전후 검증을 남긴다.
관리자 /admin/curation 에 이야기 라인(후보 → 분석 → 제작 → 검수 → 발행 → 철회)을 만들고 같은 커밋에 help/curation.ts 를 고친다.
발행은 S2 plan 의 candidate 를 서버에서 다시 검증한 판본만, 자기 승인 · 합성 · 낡은 검수 · 권리 미확정은 RPC/RLS 단에서 막는다. 보류 판본은 관리자 초안 저장소에만 둔다.
원본 도서 경로(auto_curate_book · force-publish)로 파생 판본이 발행되지 않는 것을 통합 테스트로 고정한다. 인증 · RLS · 경합 통합 테스트와 격리 E2E 를 실제로 돌리고
통과 · skip 수를 그대로 보고한다. 승인 범위 밖 SQL 이 필요하면 그 지점에서 새 SQL 을 보이고 승인을 요청한다.
```

## S5 — 학습자 탐색 · 판본별 독서 · 이어하기 · 원문 연결 · `IN_PROGRESS`(코드 수용 · SQL 적용 완료 · live 여정 · 콘텐츠 · 파일럿 미실행)

- **목적**: 학습자가 이야기로 고르고(HOOK 포함) 판본별로 읽고 이어 읽으며, 원하면 원문 대응을 연다.
- **선행**: S4. 새 이벤트의 DB 허용 목록 SQL 승인(정본 §17).
- **수정 파일(예정)**: 학습자 라우트(`/library` 하위 — 라우트 추가 시 `docs/ROUTES.md`) · `apps/web/src/lib/library/story/**` ·
  필요 시 기존 `texts` · 완료 코드(`apps/web/src/lib/library/complete-chapter.ts` 등) · `apps/web/src/lib/analytics/events.ts` + `funnel_events_event_check` SQL · 테스트.
- **계약**: 정본 §12 · §13 · §17. 판본 발행본별 진도(`reading_book_key`) · 작품 단위 묶음(`work_count_key`) · 장면 이동은 진도 승계 없음 ·
  에피소드 완료 ≠ 전권 완료 · 각색 완독(`adapted_full_work`) ≠ 원문 완독 — 화면 문구와 기록 이름이 이 구분을 따른다 · 같은 작품 여러 판본 = 한 작품.
  도움은 요청 시에만. 준비 안 된 판본은 명시적 빈 상태.
- **기존 코드 변경**: `texts` · 완료 로직을 바꿔야 하는 것은 이 단계의 일반 범위다. 멈추지 말고 영향 범위(호출처 · 기존 도서 동작)를 측정하고,
  기존 원본 도서 동작을 보존하는 L3 회귀를 돌린다. 사용자에게 묻는 것은 실제 승인 경계(DB 구조 · 데이터 변경)를 넘을 때뿐이다.
- **수용 기준**
  - `LS-S5-AC1` 판본마다 진도가 분리되고 작품 수는 작품 단위로 센다(DB 단언).
  - `LS-S5-AC2` 미발행 · 철회 · 보류 판본은 목록 · 직접 링크 · 등록 · 리더에서 모두 막힌다(격리 E2E).
  - `LS-S5-AC3` 키보드 · 초점 · 읽기 순서가 보장된다.
  - `LS-S5-AC4` 진입 + 상호작용 이벤트가 같은 커밋에 있고 속성은 숫자 · 불리언 · 닫힌 열거형뿐이다. DB 허용 목록과 코드가 일치한다.
  - `LS-S5-AC5` 열람 · 펼침 · 독서량이 숙달 · FSRS 성공으로 기록되지 않는다. 각색 완독이 원문 완독으로 표시 · 기록되지 않는다.
  - `LS-S5-AC6` 기존 원본 도서의 등록 · 이어하기 · 완료 동작이 그대로다(회귀).
- **검증(L3)**: 단위 · 통합 · 격리 E2E(S4 의 명령 형태). 공개 화면 수치는 DB 실측 또는 즉석 계산만(AGENTS I5).
- **DB 승인**: 필요(이벤트 허용 목록 · S4 범위 밖 진도 스키마가 있으면).
- **중단 조건**: 승인 경계(DB 구조 · 데이터 변경)를 넘는 변경이 필요할 때만 SQL 을 보이고 승인을 요청한다.
- **복구**: 라우트 비노출(게이트) · 코드 되돌리기. 이벤트 허용 목록은 그대로 둔다.
- **완료 증거**: 테스트 결과 · 화면 확인 · 해당하는 독립 검토 계약이 있으면 그 판정.
- **다음**: S6. 기본 독서 경로의 S7 파일럿은 병행할 수 있으며, 선택적 심화 기능 완료를 기다리지 않는다.

### 승인 · 적용 뒤 현재 상태 (2026-10-25 · 이 절이 현재 판정 — 아래 작성자 · 커밋 전 기록은 그때의 역사다)

| 항목 | 실제 결과 | 남은 한계 |
|---|---|---|
| 코드 | T-0176 커밋 `9b39634c511fe43d91bafe013a2f46c3dbc519fe` Codex 독립 수용(AI-Control `verification/reviews/T-0176-lcp-story-s5-codex.md`). 같은 커밋 범위 vitest 35파일 769 · 격리 브라우저 34(1440/1280) · web tsc · eslint 0 · 통과 실행 skip 0 · native 종료 0 · 동결 38파일 · 소스 86 · 글꼴 1049(+CSS 32) · 캡처 148 · 기준선 8 불변 · 로컬 main 코드 통합 `1a5253561` | 전역 `learner-routes` `/csat/listening` 1 실패 · 7 통과는 깨끗한 기준선에서도 재현된 기존 실패 — 새 실패도 전체 통과도 아니다. |
| SQL | 사용자 명시 승인 r3(SHA-256 `a57ef729cedddc9f6271370fa5f93595a1dca6e273230b741bdfffc535f161ab` · 34,577바이트) → MCP 적용 dev `jajenrevcbmrpaliomxv` 원장 `20261025143031` `lcp_story_s5_reader_context`(원장 statements 배열의 단일 원문 항목 · 승인 바이트 그대로). 저장소 `supabase/migrations/20261025143031_lcp_story_s5_reader_context.sql` | 머리말의 제안 · 미적용 문구는 역사적 표기. 복구 SQL 실행 승인 없음 |
| DB 전후 | 새 `public.story_reader_context(text,integer)→jsonb`(STABLE · DEFINER · 고정 search_path · authenticated 만) · 이벤트 2 이름 추가(기존 식 · 검증 · 주석 보존) · 기존 Story RPC 16 정의/ACL · 원본/Story 15표 행 지문 · 정의 15 불변 · 새 표 없음 | `funnel_events` 는 적용 전 50,868행 코호트 지문 보존 · 뒤에 `screen_viewed` 19행 관찰(표 전체 불변 · 행위자 단정 아님) |
| live | 익명 PostgREST: `story_catalog` 200 · 빈 배열 · `story_reader_context` 401/`42501`(노출 · anon 거부 · PGRST202 없음). 실제 CHECK 식 SELECT 평가로 `EVENT_REGISTRY` 62/62 허용 · 실제 로컬 main Next/RSC PC1440/1280 빈 서가 · 비로그인 진입(개인 DOM · 넘침 · 페이지 오류 0, 자체 시험 브라우저 계측 차단) | 공유 DB Story 12표 비어 있음(발행 0) → 인증 RSC · 쿠키 · Server Action HTTP · 본문/진도 여정 **NOT_RUN** · 쓰기형 `db-allowlist.integration.test.ts` **NOT_RUN** |
| 콘텐츠 · 교육 | 편집 목표는 목표 표기이며 진단된 적합이 아니다 | 권리 확인된 실제 작품 0 → 콘텐츠 적합 **NOT_RUN** · `PILOT_NOT_RUN` · 학습 효과 근거 없음 |

S5 는 **코드 · DDL 완료와 격리 UX 수용**까지다. 실제 작품 발행 뒤 인증 학습자의 live 전체 여정 · 콘텐츠 적합 · 파일럿 전에는 S5 전체 완료 · 학습 효과를 주장하지 않는다.

### 작성자 구현 현황 (T-0176, 2026-10-25, 커밋 전 작업 트리 · base `f81a5c1a4`)

| 범위 | 파일 | 상태 |
|---|---|---|
| 서버 판정 · 저장 | `apps/web/src/lib/library/story/{learner,learner-types}.ts` · `app/(main)/library/stories/actions.ts` | 구현. 렌더(GET)는 기록 0. 저장 전 공통 문 = 쿠키 세션 학습자 판정 → `expectedViewerId` 와 다르면 `viewer_changed`(RPC 0) → `story_reader_context` 확인 → 그다음에만 `story_record_position` · `story_complete_unit` |
| 화면 | `app/(main)/library/stories/{page,[releaseKey]/page}.tsx` · `components/library/story/**` · `lib/library/tabs.ts`(Stories 면) | 구현. 개인 내용(본문 · 앵커 · 진도 · 이력)은 브라우저 신원이 서버 viewerId 와 같다고 **긍정 확인된 뒤에만** 그린다(표시 · 요청 발송 보호 — 이미 받은 SSR/RSC 응답 바이트를 회수하지는 않는다) |
| 이벤트 | `lib/analytics/events.ts` `story_catalog_viewed` · `story_reader_action` | 코드만. DB 허용 목록은 SQL r3 §C 미적용 — `db-allowlist.integration.test.ts` **NOT_RUN** |
| DB | AI-Control `runtime/lcp-story-20261025/s5-proposal-forward.sql` r3 · SHA-256 `a57ef729cedddc9f6271370fa5f93595a1dca6e273230b741bdfffc535f161ab` | **미승인 · 미적용**(코디네이터 보고: 루트 PG17 격리 38/38). 적용 전 공유 DB 의 독서 화면 = `reader_not_ready`(꾸민 목차 · 앵커 없음) |
| 격리 브라우저 하네스 | `apps/web/scripts/build-lcp-story-reader-harness.mts` · `tests/e2e-isolated/lcp-story-reader.isolated.spec.ts` · `tests/fixtures/lcp-story/reader-baseline-books.ts` · `scripts/lcp/story/s5-reader-{fixtures,harness-eval}.ts` | 구현 · 작성자 working-tree dev 실행(아래) |

하네스: 실제 클라이언트 컴포넌트 + 실제 앱 CSS(tines 스킨) + `app/layout.tsx` 의 실제 @fontsource 파일(서빙 · 로드 단언 + CDP 실제 렌더 글꼴). 서버 판정 · 액션은 tsx 자식 프로세스가 **실제 `learner.ts`** 를 S3 학습자 RPC 와 미적용 `story_reader_context` 를 흉내 낸 메모리 가짜 DB(합성 gull-rock)로 돌린다.
대역: next/navigation(History API · 소프트 이동은 loader 재실행) · next/link · `@/lib/supabase/client`(인증 이벤트 · 지연 기준선 · 합성 사전 `lookup_word_meaning`) · 계측(전송 없음). 알려진 요청 밖은 전부 abort(Pretendard CDN 은 「알려진 외부」로 기록 — 한글 산세리프는 시스템 대체).
표현하지 않는 것: middleware · RSC 실행(페이지 마크업은 옮겨 적음) · 실제 쿠키 인증 · PostgREST/RLS · 실제 Server Action HTTP · DB 허용 목록. 컴포넌트 수준 증거이며 live E2E 가 아니다.

### 작성자 실행 기록 — working-tree dev run (T-0176 W3, 2026-10-25 · HEAD `f81a5c1a4` + 미커밋 변경)

- 기준선(Stories 면 추가 전, `--baseline` = HEAD 내용으로 구움): `playwright … lcp-story-reader.isolated.spec.ts` 기준선 2 통과 — 캡처 `work/lcp-story-s5/shots/baseline-library-{books,rail}-{1440,1280}.png`(sha256 은 `work/lcp-story-s5/baseline-ready.txt`).
- 마지막 전체 dev 실행: `LCP_STORY_READER_SHOTS=../../work/lcp-story-s5/shots-dev pnpm.cmd exec playwright test -c playwright.isolated.config.ts tests/e2e-isolated/lcp-story-reader.isolated.spec.ts --reporter=list`(apps/web) → **34 passed · 0 failed · 0 skipped (3.9m)**, 로그 `work/lcp-story-s5/scratch/dev-run3.log`.
  그 뒤 전체 여정 시험에 「다른 작품 고르기」를 더해 그 시험만 두 폭에서 다시 돌렸다 → **2 passed · 0 failed · 0 skipped**, 로그 `work/lcp-story-s5/scratch/dev-run4-flow.log`.
  1440 · 1280 각 16: 익명 서가 · 빈 서가 · 조회 실패 · 전체 여정(발견 → 시작 → 읽기 → 떠났다 이어 읽기 → 마지막만 표시는 미완 → 전 단위 표시 → 각색 완독 → 다음 이야기 고르기 → 다른 작품 입구는 자기 메타 · 빈 진도 · 앞 작품 완료 유지) · 에피소드 · 판본 전환 · 저장 실패/응답 유실/연타 · 원문 대응(저장 URL 그대로 링크 · javascript:/data: 비링크) · 철회/권리 보류/서가 누락 · 읽은 뒤 서버 거부 정리 · 읽기 문맥 RPC 없음(쓰기 RPC 0) · 정지 계정 · 지연 기준선(확인 중 개인 DOM 0 · 액션 0) · 인증 경계(`viewer_changed` 쓰기 전 거부) · 단어 뜻 · 키보드 · Books 탭 비교.
  모든 실행: 예상 밖 외부 요청 0 · 하네스가 모르는 요청 0 · pageerror 0 · 계측은 두 이름 · 닫힌 속성만(id · URL · 본문 · 고른 낱말 없음).
- 코디네이터 동결 직전 실행(같은 작업 트리 · 하네스 다시 구움): 하네스 캡처로 본 두 결함을 고친 뒤 — 독서 화면 자기 건너뛰기 링크가 셸의 「본문으로 건너뛰기」와
  이름이 같았던 것(→ 「이야기 본문으로 건너뛰기」, 키보드 시험이 두 링크를 따로 단언) · 서가 작품 머리(제목 · HOOK)가 맨 앞 Story Edition 이 아니라
  Easy Reader 에서 오던 것 — 같은 명령 전체 → **34 passed · 0 failed · 0 skipped (4.3m)**, 로그 `work/lcp-story-s5/scratch/dev-run8-full.log`.
- 이 dev 실행은 **커밋 전 작업 트리**다. 커밋된 HEAD 에서의 정식 하네스 빌드 · 전체 실행 · 독립 수용은 아직 없다 — 그 전에는 「최종 브라우저 통과」로 쓰지 않는다.
- 코디네이터 보고(이 문서 작성자가 실행하지 않음): W1 · W2 단위 시험 · web `tsc` · 범위 vitest 592/592. `lib/framework/learner-routes` 의 `/csat/listening` 실패는 깨끗한 `f81a5c1a4` 에서도 나는 **기존 실패**이며 이 작업에서 고치지 않았다.

### S5 여섯 영역 판정 (2026-10-25 적용 뒤 · 실제 코드 + 브라우저/DB 증거 기준)

| 영역 | 구현됨(S5) | 현재 작업 중 | 후속 계획 | 미설계 |
|---|---|---|---|---|
| Discover | 작품별 묶음 · HOOK · 편집 목표(진단 아님) · 실제 수 · 빈/실패 구분 · 익명 메타 + 로그인 복귀 | — | 추천 · 다양성(S6) | — |
| Start | 입구(HOOK · 편집 목표 · 원천 줄) → 명시적 시작 = 위치 기록 · 읽기 문맥 RPC 공유 DB 적용(2026-10-25) | 실제 작품 발행 뒤 인증 live 여정 확인 | — | — |
| Read | 단위 본문(텍스트 노드) · 원문 대응(요청 시 · 저장 인용) · 단어 뜻(요청 시 · 기존 `WordLookupPopover` 읽기 전용) · 키보드 | — | Deep/Bridge 의미 탐구(S6) | — |
| Continue | 판본별 위치 ≠ 완료 · 이어 읽기 · 전 단위 표시 뒤 완료 · 「다음 이야기 고르기」 · 판본 전환 승계 없음 | — | — | — |
| Quality | 인증 표시 문 · `viewer_changed` · 서버 거부 정리 · 닫힌 계측 · PC 1440/1280 · 커밋 HEAD 정식 실행 · 독립 수용 · DB 권한/노출 확인 | 실제 작품의 인증 live 여정 확인 | 콘텐츠 권리 · 언어 적합성 검토 · 쓰기형 DB 허용 목록 시험은 승인된 범위에서 | — |
| Integration | 사전 단어 뜻(기존 팝오버 · 읽기 전용) | — | TTS 얇은 어댑터 · 낱말 출처 결속 · 인쇄(아래) | Story 를 위한 VCB · FAST 학습지 콘텐츠 계약 |

**후속(S5 확장이 아니다)**: `workspace/tts-controller.ts` 는 이미 `SentenceItem[]{paragraphId,sentenceIdx,text}` 를 받으므로 Story 의 보이는 본문 큐 어댑터에 새 엔진이 필요 없다(단위 · 인증이 바뀌면 멈춰야 하고 완료 근거가 되지 않는다) ·
원본 LibriVox 챕터 오디오 매핑은 Story 정렬이 아니다 · `adaptiveExtractWords` 는 원본 `libraryBookId`/`chapterIdx`/개인 `textId` 를 요구하고 단어장 · FSRS 를 쓰므로 Story 발행 키를 넘기지 않는다 ·
WLP 는 실제 본문 구간을 뽑을 수 있으나 `slice===surface` 를 검증해야 한다 · `PrintSheet` 는 검증된 낱말/뜻 행을 받으므로 나중에 재사용할 수 있다 ·
VCB 컴포저(도서 · 챕터 · 텍스트 · 아티클 범위)와 FAST 학습지(검증된 CSAT 원천 패킷 필요)에는 Story 콘텐츠 계약이 없다 — **미설계**.

**판정 분리(2026-10-25 적용 뒤 갱신)**: 기술 완성 = 코드 `9b39634c5` 독립 수용 + SQL r3 공유 dev DB 적용(전후 지문 · 익명 PostgREST 노출/거부 확인) — 인증 live 여정 전 ·
UX 완성 = 격리 하네스가 실제로 그린 1440/1280 화면 수용까지(실제 로컬 main의 비로그인 · 빈 상태도 확인 · 인증된 본문/진도 화면은 미확인) · 콘텐츠 적합 = 권리 확인된 실제 작품 발행 0 → **`NOT_RUN`** ·
교육 효과 = 실제 학습자 없음 → **`NOT_RUN`**(`PILOT_NOT_RUN` — 흥미 · 이해 · 성장 효과를 주장하지 않고 합성 학습자로 대신하지 않는다).
SQL r3 의 PG17 38/38(작성자 · 루트 격리)은 격리 DB 증거이고, 공유 DB 증거는 위 「승인 · 적용 뒤 현재 상태」의 전후 검사 · 익명 HTTP 뿐이다.

```text
[S5 시작 지시]
LCP Story S5 를 진행한다. docs/LCP_STORY.md §12·§13·§17 과 IMPLEMENTATION.md S5 절, S4 결과를 읽는다.
판본 발행본별 진도와 작품 단위 묶음을 정본 계약대로 구현하고, 장면 이동 · 판본 전환이 완료나 숙달을 만들지 않게 한다.
각색 완독(adapted_full_work)과 원문 완독을 화면 문구 · 기록에서 구분한다. 기존 texts · 완료 코드를 바꿔야 하면 영향 범위를 측정하고
기존 원본 도서 동작을 보존하는 회귀를 돌린 뒤 진행한다. 미발행 · 철회 · 보류 판본의 목록 · 직접 링크 · 등록 · 리더 차단과 키보드 접근을 격리 E2E 로 확인한다.
새 이벤트는 events.ts 와 DB 허용 목록 SQL 둘 다 필요하다 — SQL 은 전문 · SHA-256 을 보이고 승인 후 승인형 러너로 적용한다.
PC 웹만 대상이다. 실제 실행 결과만 보고한다.
```

## S6 — 선택적 Deep/Bridge · 실제 표현 어휘 연결 · 추천 다양성 · `PENDING`

- **목적**: 요청 시 판단 구조의 의미 탐구와 원문 대응, 판본 본문에 실제로 나온 표현 기반 어휘 연결, 다양성을 지키는 추천.
- **선행**: S5.
- **수정 파일(예정)**: 학습자 활동 컴포넌트 · `apps/web/src/lib/library/story/**` · 추천 순수 함수와 테스트 · 계약 변경 시 정본.
- **계약**: 정본 §13 · §16. 사실 정답과 허용 가능한 해석 분리 · 해석은 채점하지 않음 · 자유서술 채점 없음 · 연습 기록과 숙달 기록 분리 ·
  추천 순서(제공 가능 → 언어 적합 → 관심/목표 → 분량/반응 → 다양성) · 미진단 `unknown` · 미평가 ≠ 0 · 도움 요청만으로 수준 하향/취향 고정 금지.
- **수용 기준**
  - `LS-S6-AC1` 활동 기록이 숙달 · FSRS · 독립 수행 근거로 쓰이지 않는다(저장 키 분리 단언).
  - `LS-S6-AC2` 어휘 연결은 판본 본문에 실제로 있는 표현만 가리킨다(구간 검증).
  - `LS-S6-AC3` 추천이 같은 장르만 반복하지 않고, 미진단 · 미평가를 0 점으로 다루지 않는다.
- **검증(L2~L3)**: 순수 함수 단위 테스트 · 활동 화면 상호작용 테스트.
- **DB 승인**: 새 저장이 필요하면 필요.
- **중단 조건**: 활동이 텍스트 덤프 · 단순 펼침으로 흐르면 설계를 정본에서 먼저 고친다.
- **복구**: 활동 · 추천은 판본 본문과 분리돼 있어 끄고 되돌릴 수 있다.
- **완료 증거**: 테스트 · 화면 확인 · 해당하는 독립 검토 계약이 있으면 그 판정.
- **다음**: S7.

```text
[S6 시작 지시]
LCP Story S6 를 진행한다. 정본 §13·§16 과 IMPLEMENTATION.md S6 절을 읽는다.
Deep Reading 은 choose_evidence · order_events, Original Bridge 는 판본 구간 ↔ 원문 앵커 비교로만 구현한다. 해석 문항은 채점하지 않는다.
활동 기록과 숙달 · FSRS 기록을 분리하고 그것을 테스트로 고정한다. 추천은 정본의 순서와 unknown 규칙을 순수 함수로 구현한다.
학습 효과를 주장하지 않는다.
```

## S7 — 실제 작품 3편 제작 · 파일럿 · `PILOT_NOT_RUN`

- **목적**: 권리가 확인된 서로 다른 장르 3편을 골라 완결 단편 또는 연속 에피소드로 제작 · 검수 · 발행 후보까지 만들고, 실제 참가자가 있을 때
  파일럿으로 사용성 · 내용 문제를 관찰한다.
- **선행**: 기본 독서 경로 파일럿은 S4·S5 후 실행한다. S6는 심화 활동을 관찰하는 후속 회차의 선행 조건이며, 첫 독서 경험 검증을 미루는 조건이 아니다.
  작품 선정 · 편집 준비는 기존 승인 범위다(별도 확인을 기다리지 않는다). 실제 권리가 불확실한 작품은 그 작품만 보류하고,
  실제 DB 적재 · 학습자 발행은 승인 경계를 따른다.
- **소유 파일**: `docs/lcp-story/S7_PILOT.md`(선정 · 권리 근거 · 측정 계획 · 관찰 기록) · 작품별 편집 기준 `scripts/lcp/story/pilot/<work>.policy.json`(커밋) ·
  원천 목록 `scripts/lcp/story/pilot/sources.json` · 준비 스크립트 `scripts/lcp/story/pilot/build.ts`. 원문 전문이 든 스냅숏 · 작업 폴더는 커밋하지 않는
  `work/lcp-story-pilot/` 에 둔다. 계약이 바뀌면 정본. (준비 = 원천 · 편집 기준까지. 판본 제작 · 검수 · 권리 확인 · 파일럿은 아직 없다.)
- **계약**: 정본 §14 · §19. 합성 fixture 를 실제 도서나 전문가 검수로 부르지 않는다. AI 검수는 AI 검수로 적는다.
  합성 에이전트 워크스루는 인터페이스 점검이며 학습자 사용성 · 효과 근거가 아니다. 실제 참가자가 없으면 `PILOT_NOT_RUN` 그대로다.
- **측정 계획(실행 전 고정 · 지금 데이터는 모두 NOT_RUN)**

  | 구분 | 관찰 정의 | 분모 · 조건 |
  |---|---|---|
  | 흥미 · 시작 | 진입 장면을 본 뒤 본문을 시작한 비율 | 진입 장면을 본 참가자 · 판본별 · 장르별 |
  | 자발적 지속 | 과제 없이 다음 단위 · 다음 이야기를 스스로 연 비율 | 첫 단위를 마친 참가자 · 안내 · 보상 조건을 함께 기록 |
  | 이해 | 사실 정답 활동의 첫 시도 정오(연습 기록) | 그 활동을 연 참가자 · 해석 문항 제외 · 도움 사용 여부 분리 |
  | 미노출 글 전이 | 읽지 않은 새 글의 독립 독해 과제 결과 | 사전 · 사후 같은 난도 · 같은 형식 · 미노출 확인된 참가자만 |

  - **기준선 먼저**: 목표 수치는 기준선 측정 뒤에 정한다. 임의 완독률 · 향상률을 성공 기준으로 미리 쓰지 않는다.
  - **결측 ≠ 0**: 하지 않은 활동 · 측정 못 한 값 · 시험하지 않은 조건은 0 이 아니라 `missing` · `untested` 로 따로 센다.
  - **작은 파일럿의 경계**: 몇 명 · 몇 편의 파일럿은 사용성 문제 · 내용 결함 · 측정 절차의 실행 가능성을 보여 줄 뿐이다.
    원문 대비 각색 효과 · 학습 효과 · 집단 차이를 입증하지 못한다. 그 비교는 정본 §19 의 통제 조건을 갖춘 별도 설계가 필요하다.
- **수용 기준**
  - `LS-S7-AC1` 3편 모두 원천 권리(원문 · 번역이 있으면 번역) confirmed(근거 · 확인자 · 시각)이며 장르가 서로 다르다.
  - `LS-S7-AC2` 각 판본이 S2 검증 · 독립 검수 · S4 게이트를 통과했다.
  - `LS-S7-AC3` 측정 계획(위 표 · 기준선 · 결측 규칙)이 실행 전에 고정돼 있다.
  - `LS-S7-AC4` 파일럿을 했다면 관찰(사용성 · 내용 문제)로 기록했고, 하지 않았다면 `PILOT_NOT_RUN` 과 이유를 적었다. 효과를 주장하지 않는다.
- **검증 절차**: 작품마다 S2 드레인(export → 결과 → validate → 독립 검수 → plan) 결과 · S4 게이트 통과 기록을 남긴다.
  파일럿 기록은 참가자 수 · 조건 · 결측을 함께 적는다.
- **DB 승인**: 실제 데이터 적재 · 발행은 승인 대상(승인형 러너).
- **중단 조건**: 권리 근거가 없거나 불확실한 작품은 그 작품만 보류한다. 실제 참가자가 없으면 파일럿을 진행한 것처럼 기록하지 않는다.
- **복구**: 발행본 철회(이력 보존). 보류 작품은 관리자 초안으로 남는다.
- **완료 증거**: `S7_PILOT.md` · 작품별 plan 결과 · 게이트 기록 · (실행했다면) 파일럿 관찰 기록.
- **다음**: S8.

```text
[S7 시작 지시]
LCP Story S7 을 진행한다. 정본 §14·§19 와 IMPLEMENTATION.md S7 절을 읽는다.
권리 근거를 확인할 수 있는 서로 다른 장르 3편을 골라 편집 기준을 준비한다(선정 · 준비는 승인 범위 안이다). 권리가 불확실한 작품은 그 작품만 보류한다.
각 작품을 S2 드레인(export → 결과 → validate → 독립 검수 → plan)으로 만들고 S4 게이트로만 발행 후보에 올린다. 실제 적재 · 발행은 승인 경계를 따른다.
docs/lcp-story/S7_PILOT.md 에 측정 계획(흥미 · 시작 / 자발적 지속 / 이해 / 미노출 글 전이, 분모 · 조건, 기준선 먼저, 결측 ≠ 0)을 실행 전에 고정한다.
실제 참가자가 없으면 PILOT_NOT_RUN 을 유지하고, 합성 워크스루는 인터페이스 점검으로만 적는다. 학습 효과를 주장하지 않는다.
```

## S8 — 운영 자동화 · 계측 · `PENDING`

- **목적**: S7 에서 관찰된 품질 · 활용 · 비용 근거가 뒷받침하는 공정만 운영 자동화하고, 그 지표를 계속 잰다.
- **선행**: S7 관찰 기록(제작 · 검수 품질, 실제 활용, 작품당 비용). 긍정적인 효과 결과를 요구하지도 지어내지도 않는다 — 근거가 없는 축은 확대하지 않는다.
- **소유 파일(예정)**: `docs/lcp-story/S8_OPERATIONS.md`(자동화 범위 · 지표 정의 · 관찰 근거) · 자동화 스크립트(`scripts/lcp/story/**`) · 관리자 계측 화면과 도움말(S4 화면 확장).
- **계약**: 자동화가 검수 · 게이트를 우회하지 않는다. 전량 확대 · 전 수준 행렬 생산은 관찰된 품질 · 활용 · 비용 · (있다면) 효과 근거만큼만.
  계측 수치는 DB 실측 · 즉석 계산만, 날짜와 함께 기록한다.
- **지표(예)**: 검수 통과율 · 반려 사유 분포 · 작품당 제작/검수 시간 · 발행본별 실제 사용 · 철회 수 — 각 지표의 분모 · 결측 규칙을 정의서에 둔다.
- **수용 기준**
  - `LS-S8-AC1` 자동화된 모든 경로가 S2 검증 · 독립 검수 · S4 게이트를 그대로 거친다(우회 경로 회귀).
  - `LS-S8-AC2` 품질 · 활용 · 비용 지표가 분모 · 결측 규칙과 함께 날짜별로 기록된다.
  - `LS-S8-AC3` 확대 결정이 기록된 관찰 근거를 가리킨다.
- **검증 절차**: 우회 경로 회귀 테스트 · 지표 계산의 단위 테스트 · 관리자 화면 확인.
- **DB 승인**: 대량 적재 · 단계 배포는 승인형 배포 러너.
- **중단 조건**: 지표가 품질 저하 · 비용 초과를 보이면 확대를 멈추고 기록한다.
- **복구**: 자동화를 끄면 S2~S4 수동 경로가 남는다. 발행본은 철회로 되돌린다(이력 보존).
- **완료 증거**: `S8_OPERATIONS.md` · 회귀 결과 · 지표 기록.
- **다음**: 정본에 운영 상태를 반영하고 분기 진단(PLATFORM_AUDIT)에 지표를 넘긴다.

```text
[S8 시작 지시]
LCP Story S8 을 진행한다. 정본과 IMPLEMENTATION.md S8 절, S7 관찰 기록을 읽는다.
관찰된 품질 · 활용 · 비용 근거가 있는 공정만 자동화하고, 자동화가 검수 · 게이트를 우회하지 않는지 회귀로 먼저 고정한다.
지표는 분모 · 결측 규칙과 함께 DB 실측으로 기록한다. 효과 결과를 요구하거나 지어내지 않는다.
```
