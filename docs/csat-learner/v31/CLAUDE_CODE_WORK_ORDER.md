# Claude Code 실행 지시문 — Vocaflow v3.1 원문 이해 교수 모델

## 0. 그대로 실행할 요청

사용자 첨부의 v3.1 보완안을 이 문서와 [MEANING_SUPPORT_DESIGN.md](MEANING_SUPPORT_DESIGN.md)의 계약대로 구현·검수·문서화하고 PR까지 준비하라. [CURRENT_STATE_AUDIT.md](CURRENT_STATE_AUDIT.md)의 사실과 현재 저장소를 먼저 대조하라. 이 문서 자체는 구현 완료 증거가 아니다.

목적은 원문 의미 형성→쉬운 재구성→의미 보존→문장 연결→전체 통합→추론 경계→문항 설계 연결이다. 여섯 지원을 필수 과제나 별도 메뉴로 만들지 마라. 기존 7장면의 `scene=meaning` 안에서 선택적으로 제공하라.

다크 제외, PC 1280/1440 라이트. 모바일·메뉴·강의 확장·학평·검수 충돌 비교 12쌍 보류. 정답 제출/진단/강의 완주 관문을 새로 만들지 않는다. 독립 확인 기록과 해설 뒤 자기 대조 기록을 구별한다.

이번 보완은 기존 F01~F16과 M0~M5를 폐기하지 않는다. 신규 단계 이름은 **C0~C5**로 하고 M5 잔여 원장은 별도로 유지한다. PR #235의 수정은 재개발하지 않는다.

## 1. 착수 규약과 제공 자료

1. AGENTS.md→앱 하위 지시→영역 계약→최신 main/PR 상태 순서로 읽는다. 공유 인덱스·작업트리·DB를 다른 작업과 함께 쓰지 않는다. 별도 worktree, 고정 owner/task, 잠금, .agent-goal.md를 준비한다.
2. 사용자 대화의 제한·권한이 저장소의 오래된 디자인/모바일/다크/리뷰 규칙과 다르면 최신 사용자 지시를 적용한다. 본 대화의 main 병합 확인 요구와 현재 AUTO_CONTINUE 문서 차이도 명시한다. 승인 없이 DB 변경·데이터 삭제를 실행하지 않는다.
3. 앱·공개 자료 기준은 `521944f227c9cf5b957cb8b366fb27a6d81a3d42`(PR #235), 최종 main 대조는 `b691cb7f2d93df46725c2bd87483b2b49f1998c6`(PR #236)이다. #236의 변경은 E2E·문서이고 앱·공개 자료 diff는 0이다. 최신 main이 더 달라졌으면 실제 diff를 감사한 뒤 이미 구현된 항목을 완료표로 옮긴다. docs PR #223의 전체 설계 미반영과 현재 코드의 낡은 문서 링크를 인지한다. main의 v3 폴더에는 M5_RELEASE_CHECK.md가 추가되었지만 그 PR 전체를 합쳐야 시작할 수 있다고 가정하지 않는다.
4. 이 문서와 같은 폴더의 설계·감사·corpus-audit.json을 실제로 읽는다. 별도 첨부 파일이나 223줄 다운로드 문서가 있다고 가정하지 않는다.
   이 문서 PR이 main에 아직 없으면 문서 브랜치 `docs/csat-v31-meaning-design-20261012`의 `docs/csat-learner/v31/`만 자기 구현 브랜치에 가져와 정본을 갖춘다. 예전 v3 설계 전체나 다른 작업자의 코드·인덱스를 함께 가져오지 않는다. 원문 포함 로컬 입력은 별도로 존재를 확인한다.
5. 기본 산출물은 별도 검수된 교수 sidecar다. 기존 inquiry-data.json/compare-v3-data.json/analysis DB/검수 판정을 일괄 재작성하지 않는다.

## 2. C0 — 최신 감사와 파일럿 manifest

### 실제 조사할 파일

- `apps/web/src/lib/csat/inquiry/labels.ts`, `data.ts`, `scenes.ts`, `compare-v3.ts`
- `apps/web/src/lib/csat/inquiry-data.json`, `compare-v3-data.json`, `skeleton-data/`
- `apps/web/src/components/csat/theater/AnalysisTheater.tsx`, `InquiryV3Panels.tsx`, `SceneDiagrams.tsx`, `ReasoningNoteForm.tsx`, `ItemPaper.tsx`, `theater.module.css`
- `apps/web/src/components/csat/PassageMap.tsx`, `apps/web/src/lib/csat/session/passage-model.ts`, `apps/web/src/lib/csat/dissection-passage.ts`
- `apps/web/src/lib/csat/lecture/types.ts`, `apps/web/src/lib/analytics/events.ts`
- `scripts/csat/inquiry-v3-export.mjs`, `inquiry-drain-export.mjs`, `inquiry-drain-validate.mjs`, `inquiry-drain-build.mjs`, `lib-inquiry-review.mjs`, `inquiry-v3-ledger.mjs`
- `scripts/csat/inquiry-drain/WRITER_V3.md`, `REVIEWER.md`, `scripts/csat/data/blueprint-registry.json`
- `apps/web/tests/e2e/csat-v3-m5-explore.spec.ts`, `csat-v3-screens.spec.ts`, `.github/workflows/ci.yml`

실제 구현을 다시 찾아 후보를 좁힌다. 특히 MeaningAnnotation은 현재 csat 타입이 아니라 설계 개념이다.

### 조사와 선택

- `node docs/csat-learner/v31/audit-corpus.mjs`로 공개 자료를 읽기 계수하고 기존 786/3,971 수치를 현재 실계수와 대조한다. 구조 감사와 의미 검수 결과를 구별한다.
- 기존 문맥 뜻·범위·meaning_ids·문장 역할·구절 anchor·현재 기기 원문을 재사용할 수 있는지 전량 필드/참조 검사와 대표 내용 대조를 분리해 기록한다.
- baseline 실제 화면을 PC 두 폭 라이트에서 캡처하고 이미지를 열어 본다. 현재 의미 목록과 구조 도식의 학습 행동을 직접 조작한다. 접근 실패는 미검증으로 남기고 설계/오프라인 검증을 계속한다.
- 대표 manifest: 2026#34·36·38·22·23·29·25·43. source ref, type, 분석 버전, units/basePublic/source hash, 공개 상태, 원문/도표 유무, 다룰 unit, 적용 가능한 지원, 제외 사유를 기록한다.
- 인용 기준선은 문항별 현재 v3.expression의 단어 수·중복 제거 원문 구간·원문 대비 비율이다. 파일럿 신규 공개 영어 구간0, 재사용 표현당8단어 이하를 가드로 검사한다. 기존 인용 밖 구문은 원문 없는 sourceRange/해시로 기기 원문에서만 표시한다(설계 §5.1b).
- 첫 수직 구현은 #34와 #38. 이후 #36·22·23·29·43 확장, #25는 원본 도표 확인 상태에 맞춰 언어 부분과 수치 부분을 분리한다.
- 원문은 로컬 비공개 입력 또는 승인된 읽기 경로로 확보한다. 없는 입력을 기존 설명/정답표에서 복원하지 않는다. 새 DB 조회도 task의 read scope와 기존 권한을 따른다.
- 이번 감사가 실제 읽은 비민감 inputRef는 `inquiry-origin:chunk-inq-15`(#22·23·25·29·34·36·38), `inquiry-origin:chunk-inq-16`(#43)이다. 실제 sourceInputRoot는 비공개 인수인계 `.agent-handoff/v31-source-inputs.json` 또는 사용자가 받은 단일 전달 파일의 로컬 입력 안내에서 확인한다. 다른 작업트리의 입력은 읽기 전용이며 원 파일을 수정하지 않는다. 현재 버전/원문 결속을 다시 확인한다. 원문 전체·기기 파일 경로를 공용 artifact/커밋으로 복사하지 않는다. 해당 경로가 없으면 승인된 read scope에서 자기 작업의 비공개 입력을 새로 확보하고 없는 원문을 needs_source로 기록한다.
- 구문/한국어 설명이 실제 DB 다른 자산에 있다면 직접 읽고 출처/품질/범위를 확인한 후 재사용한다. 타입 이름만으로 자산 존재를 단정하지 않는다.
- M5 잔여는 `docs/csat-learner/v3/M5_RELEASE_CHECK.md`와 실제 결과를 대조한다. #236은 학습 루프13개 통과를 보고하므로 옛 미검증1개를 새 결함으로 반복하지 않는다. 원본 도표·밑줄 영역·embargo 실화면·새 패널 참조 미확보와 교육 효과를 구별해 남긴다. 다크를 다시 추가하지 않는다.

**C0 완료:** 실제 기준 커밋·전량 필드/참조 감사·8문항 manifest·baseline 화면 또는 구체 미확인·새/기존 파일 대응·권리 검수 기준이 있다. 문서 수치를 live DB 통계처럼 쓰지 않는다.

## 3. C1 — 데이터·검수·공개 가드부터

### 기존 수정과 신규 파일 책임

| 책임 | 기존 / 신규 경로 |
|---|---|
| 서버 lookup 연결 | 기존 `apps/web/src/app/(app)/csat/item/[slug]/page.tsx` |
| schema/labels | 신규 `apps/web/src/lib/csat/meaning-support/labels.ts` |
| 순수 검증·public projection | 신규 `apps/web/src/lib/csat/meaning-support/model.ts` |
| 서버 데이터 조회·base 결속 | 신규 `apps/web/src/lib/csat/meaning-support/data.ts` |
| 공개 artifact | 신규 `apps/web/src/lib/csat/meaning-support-data.json` |
| export/validate/hash/build | 신규 `scripts/csat/meaning-support-export.mjs`, `meaning-support-validate.mjs`, `meaning-support-hash.mjs`, `meaning-support-build.mjs` |
| 작성·검수·manifest | 신규 `scripts/csat/meaning-support-drain/WRITER.md`, `REVIEWER.md`, `pilot-manifest.json` |
| 형식·결속·공개 테스트 | 신규 `scripts/csat/__tests__/meaning-support-*.test.mjs`, `apps/web/src/lib/csat/meaning-support/__tests__/model.test.ts` |

경로는 제안된 구현 계약이며 이번 문서 작성 시 존재하지 않는다. 같은 책임의 모듈이 이미 추가되어 있으면 재사용하고 계약/지시문 경로를 갱신한다.

### 필수 작업

- MEANING_SUPPORT_DESIGN §5의 타입과 invariant를 구현한다. 새 sidecar의 해시/criteria는 기존 base v3와 분리한다. contentHash의 안정적 직렬화는 기존 검수 모듈 원칙을 재사용한다.
- 서버 lookup은 현재 접근 가능한 item, live 분석 버전, ready base inquiry, sidecar binding, 독립 pass를 확인한다. 전체 JSON을 클라이언트에 import하지 않는다.
- binding.basePublicHash는 **현재 배포된 inquiry-data.json의 해당 item 전체 레코드 직접 해시**다. 객체 키 재귀 정렬·배열 순서 보존·문자열 원형 보존의 canonical SHA-256 함수를 빌드/CI/서버가 공유한다. writer contentHash나 별도 옛 manifest로 대체하지 않는다. 같은 analysis_version/units_hash에서 문맥 뜻만 바뀐 negative fixture도 stale이어야 한다. 원문 소스용 FS 스캔을 클라이언트/요청 핫패스에 가져오지 않는다. 기존 base/compare 해시 함수의 의미는 바꾸지 않는다.
- 수동 교수 초안은 writer status=`ok|needs_source|needs_review|not_applicable`; coverage에 미작성/불필요/보류 사유를 구별한다. empty 값을 ready로 만들지 않는다.
- independent verdict: item ID, schema, revision, binding, content hash, criteria version, writer run, reviewer run, pass/revise/hold, 구체 이유. 기준 정본은 [CONTENT_REVIEW_CRITERIA.md](CONTENT_REVIEW_CRITERIA.md)의 meaning-support-v1.0이며 writer/reviewer는 분리된 세션·컨텍스트다. 작성자의 자기평가를 주지 않고 새 설명 자체와 원문을 대조한다. 서명 없는 기존 pass를 새 pass로 사용하지 않는다.
- sourceSnapshotHash·anchor 검증 보고서·내용 검수도 같은 출력 revision/hash에 묶는다. 원문 **전체 입력**·학습자 PDF 기기 경로는 커밋하지 않는다. 공개 anchor.quote/inline 영어 인용은 기존 v3.expression 범위의 재사용만, 8단어 이하, 신규 원문 구간0이다. C0 기준선에 새 공개 인용 합집합을 대조하는 가드를 만들고 한국어 재구성의 권리 검수도 별도로 한다. 기존 인용 밖 구문은 sourceRange/해시로 기기 원문에서만 표시한다. 인용을 쪼개 원문을 우회 재구성하지 않는다.
- export는 manifest 범위만, 같은 schema+binding+완료 revision이면 skip; 원문/분석 버전이 바뀌면 신규 revision. 기존 출력/검수 덮어쓰기 금지.
- 검증·재빌드 전 원문 입력 존재와 버전부터 점검한다. 없으면 기존 산출물을 보존하고 build 실패한다. 입력 없음 때문에 기존 공개 자료가 사라지는 결과를 쓰지 않는다.
- 원문 대조 full build는 비공개 입력을 사용한다. 커밋된 artifact guard는 원문 없이 CI에서 schema/참조/공개 base 결속/현재 독립 pass를 검사한다. 두 검사의 증거 수준을 구별한다.
- build `--dry`는 diff와 added/unchanged/stale/held/revise/missing_input 사유별 수를 출력, 파일을 안 쓴다. 정상 build는 같은 입력에서 byte-identical, 원자적 파일 교체, manifest 밖 기존 확장은 보존한다.
- held/revise 후보는 배포 JSON에 싣지 않는다. 누락 사유/coverage 요약은 개인정보·원문 없는 별도 원장으로 남긴다. 잘못된 새 설명은 기존 V3Meaning으로 fallback한다.
- **보류는 두 층이다.** `review_hold`(콘텐츠 검수 보류)는 빌드 입력 후보이고 배포 artifact에서 제외되며 Node/가드 테스트로 제외를 검사한다. `access_withheld`(공개/접근 권한 보류)는 이미 독립 pass인 sidecar에 대한 현재 문항의 접근 정책 결과이며 서버 projection/RSC 검사의 대상이다. E2E의 ‘held 비노출’은 후자를 뜻한다. 검수 보류 후보를 production JSON에 넣어 화면 테스트하지 않는다.
- build/CI는 전체 basePublicHash 결속 때문에 stale된 문항을 이유별 계수한다. 기대 공개 manifest의 항목이 새로 stale이면 실패시켜 설명이 조용히 사라지는 회귀를 막는다.
- 새 schema/public artifact guard 두 스펙은 기존 공개 정본 가드와 함께 CI에 **필수 편입**한다. 테스트 파일 생성만으로 완료하지 않는다.

### 격리 화면 검증의 데이터 전제

현재 isolated job은 마이그레이션과 학습 지도 seed만 실행하므로 문항 라우트용 fixture를 별도로 준비한다. 신규 `scripts/csat/meaning-support-isolated-seed.mjs`와 `.github/workflows/ci.yml` 적재 단계를 C1 책임에 포함한다.

- 실제 `loadCsatItemExplain`·`loadRevealScope` 쿼리와 최신 migrations로 문항/회차/분석/공개 상태/테스트 계정의 필요한 행·관계를 확인한다. 없는 테이블/필드를 추측하지 않는다. 스키마 변경 없이 현재 테이블의 테스트 행만 적재한다.
- fixture는 해당 CI 러너의 **127.0.0.1/localhost 로컬 Supabase + isolated test namespace**일 때만 적재한다. 둘 중 하나라도 확인 안 되면 즉시 거부. shared-dev·원격·production 대상은 거부하고 키/DB URL은 출력하지 않는다.
- namespace는 현재 존재하는 기능이 아니라 **C1에서 구현할 명시 계약**이다. 신규 CI seed 단계는 `VOCAFLOW_CSAT_ISOLATED_NAMESPACE=csat-v31`과 `VOCAFLOW_CSAT_ISOLATED_RUN_ID=${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}`를 환경으로 전달한다. seed는 namespace가 정확히 csat-v31인지, run ID가 `^[0-9]+-[0-9]+$` 형식의 64자 이하인지, 실제 Supabase host/port가 러너의 loopback인지 모두 검사한다. 로컬 재현도 동일 변수를 명시적으로 설정하며 미설정은 거부한다.
- 소유 manifest는 기존에 gitignore된 **`.agent-logs/csat-v31-owner.json`**에 namespace/run ID·fixture manifest hash·정해진 문항 ID/시험 계정 ID·대상 fingerprint(키/URL 원문 없음)를 기록한다. Playwright가 지우는 test-results 폴더에 두지 않는다. 같은 run/manifest이면 재실행, 다른 소유 marker면 중단한다. marker 없는 상태에서 대상 fixture ID가 이미 존재하면 새로 소유를 주장하거나 덮지 말고 중단한다. 문항 ID 형식은 실제 라우트 규칙을 유지하므로 임의 접두사를 붙이지 않고 marker의 allowlist로 소유를 확인한다. 계정/세션 fixture도 같은 marker에 결속한다. CI 러너 폐기가 복구 경계이며 공유 개발환경에는 이 marker/플래그를 만들지 않는다.
- 공개 정본의 비민감 문항 metadata/버전과 검수된 짧은 설명을 재사용할 수 있으나 원문·선지 전체·도표 본체·개인 PDF·실사용 기록은 seed하지 않는다. 공개/access_withheld/stale의 상태 조합은 기존 문항 접근·공개 정책을 통해 만들고 production 가드를 우회하는 앱 플래그/테스트 전용 공개 API를 만들지 않는다.
- 신규 교수 설명 fixture는 production JSON을 조작해 넣지 않는다. 이미 C1 검수를 지난 실제 파일럿 sidecar와 그 base 버전에 맞는 최소 DB fixture를 사용한다. 테스트 전용 작성 결과를 검수된 실제 콘텐츠로 발행하지 않는다.
- 러너 안 반복 적재는 소유 namespace/정해진 ID에만 멱등 적용한다. 전역 truncate/delete나 공유 DB 정리를 하지 않는다. 테스트 종료 후 러너 환경 자체를 폐기한다.
- 양성 대조: 같은 검수 완료 sidecar와 같은 fixture 문항이 정상 접근 조건에서는 실제로 렌더되어 식별 가능한 설명이 SSR/Flight/화면에 있는지 먼저 단언한다. 그 문항을 기존 접근 정책상 제외한 별도 케이스에서는 같은 설명이 응답/RSC/화면에 없어야 한다. 새 공개 API·production 데이터 주입 경로는 만들지 않는다. review_hold 후보의 비노출은 별도 builder/public guard가 후보를 실제로 읽은 뒤 출력에서 제외했음을 단언한다.
- 기존 CI의 격리 환경 확인/마이그레이션/학습 지도 seed 다음, 웹 build/기동 전에 문항 fixture 적재를 실행한다. 스펙은 실제 라우트가 notFound가 아님을 먼저 단언한 뒤 공개/held SSR·Flight 비노출/stale fallback을 검사한다. 분석 버전 변경·held 상태 변경은 러너의 소유 fixture에만 적용하고 케이스별 격리/복원을 한다.
- seed 가드 단위 테스트는 원격/잘못된 port 대상, namespace 누락/잘못된 값, run ID 형식/길이 위반, 다른 소유 marker, marker 없는 기존 fixture ID, allowlist 밖 ID를 각각 거부하고 **쓰기0**임을 단언한다. 같은 run/manifest 두 번 적재는 결과 동일, 다른 manifest 충돌은 중단한다. 실제 CI 로그의 seed 성공·새 스펙 실행·skip0을 완료 증거로 남긴다. 입력/권한 전제 실패는 skip/pass로 바꾸지 않는다.
- DB 스키마/정책 변경이나 shared DB 쓰기가 필요해지면 별도 승인 작업으로 분리한다. 임시 isolated fixture를 만드는 일을 승인 없이 공유 DB에 쓰는 근거로 사용하지 않는다.

**C1 완료:** 최소 두 대표의 원문 기반 작성→기계 검증→독립 내용 검수→공개 가드가 존재하고 negative fixture가 실제 차단된다. 아직 공개 UI 활성화 전 단계다. 이 게이트를 C4 이후로 미루지 않는다.

## 4. C2 — 대표 문항 수직 구현

### 수정할 기존 파일과 신규 UI

- 기존 `AnalysisTheater.tsx`: item 단위 선택·깊이·메모리 초안 상태, navigation, check/reveal 맥락, same-evidence adapter.
- 기존 `InquiryV3Panels.tsx`: V3Meaning fallback 유지, verified support가 있을 때 신규 교수 판에 연결.
- 기존 `PassageMap.tsx`: 근거 칩과 구별되는 문장 선택 callback·focus 계약.
- 기존 `ItemPaper.tsx`/기기 passage 경로: 정확 매핑이 가능한 경우만 구절 선택 연결. 원문 제공/저작권 경로를 바꾸지 않는다.
- 기존 `SceneDiagrams.tsx`: 기존 passage_design 가설을 보존하고 새 독해 관계와 구별. 설계 라벨과 의미 설명 중복 렌더 제거.
- 신규 `apps/web/src/components/csat/theater/MeaningSupportPanel.tsx`, `MeaningRelationView.tsx`, `MeaningDraft.tsx` 및 관련 UI 테스트.
- 기존 `theater.module.css`: 참조를 확보한 값은 측정·CSS 변수로 적용. 두 폭 라이트, keyboard/focus/44px, break-keep, 대비·오버플로.
- 기존 `lib/csat/inquiry/scenes.ts`: 새 scene 추가 없이 의미/depth URL parser 계약 연결. 현재 모든 맥락을 다루는 공용 parser는 없다. 신규 pure parser/URL builder를 support/model.ts에 두고 기존 scene/pair 로직을 결합해 allowlist·pair/back/from/check 보존을 검증한다.

### 실제 행동

설계 §2~4대로 #34·#38에서 원문/의미 선택→정확한 뜻/쉬운말→보존 조건→관계→전체 의미→문항 성립/설계 재구성→복귀를 구현한다. 자동 재생·답 제출·정답 확인 단계는 없다.

설명 깊이는 brief/why/deep. 한 설명 판을 재사용한다. 관계도는 labels뿐 아니라 두 명제와 changeKo를 보여 준다. 원문 없고 mapping 틀려도 기존 분석은 읽을 수 있다. 교정/비유/오해 변형을 실제 원문으로 표시하지 않는다.

내 말로 초안은 600자 한 필드, 메모리만, 같은 문항 안에서 unit/장면별 보존. 새로고침·문항 이탈 소실 안내, 로그아웃 시 초기화. 서버 저장·원리 노트·진단 반영은 이번 구현에 추가하지 않는다.

기존 analytics 진입은 유지. 설명 펼침은 기존 more 이벤트의 실제 의미에 맞을 때만 사용, 중복 전송 금지. 새 세부 이벤트 전송은 별도 DB CHECK 변경 승인 전 보류한다.

**C2 완료:** 두 대표에서 UI가 실제 검수 데이터를 사용하고, 선택과 근거/관계/URL가 일치한다. raw 원문 서버 복제·client corpus import가 없다. 기존 7장면/원리 노트/비교/지도 확인을 회귀 검증한다.

## 5. C3 — 8문항 파일럿과 유형 경계 검증

- 설계 §7의 실제 시나리오는 작성 초안이다. 독립 검수자가 원문·선지·분석·새 설명을 직접 대조한 후 공개한다. 문서에 있는 한국어를 그대로 pass로 복사하지 않는다.
- #36의 인쇄 순서/읽기 순서, #38의 주어진 문장, #43의 공통 지문/대화/사건 순서, #29의 오류/교정, #25의 언어/수치 상태를 각각 별도 테스트한다.
- #22·23의 may/Often/Unless/only/범위·예외가 쉬운 말에서 유지되는지 검수한다. 쉬운 표현이 유창하다는 이유로 원문에 없는 주장을 통과시키지 않는다.
- 실제 원문 매핑은 중복 구절·같은 길이 다른 문장·PDF 재업로드·입력 번호 불일치·도표 이미지·긴 서사에서 확인한다.
- 26유형 대응표는 공통 엔진의 처리 경계다. 8문항으로 전체26유형 공개 완료를 보고하지 않는다. 나머지는 기존 UI+명시적인 확장 없음 상태로 유지한다.
- 파일럿에서 원문/검수 미확인 항목은 needs_source/hold; 전량 성공 분모에 넣지 않는다. 공개 언어 부분과 보류 수치 부분이 섞이지 않는지 검증한다.

**C3 완료:** 8문항 각각 공개/부분공개/보류 이유, 근거·조건·관계·전체 의미, content review, 화면 결과가 기록된다. ‘도표를 처리했다’와 ‘도표 수치를 확인했다’를 구별한다.

## 6. C4 — 수요 기반 확장과 배치 공정

최초 두 문항과 8문항 파일럿 검수 뒤에 진행한다. 이 문서가 786문항 재생성 지시는 아니다.

1. 전량 필드 감사·파일럿 결함·가능하면 실제 사용성 관찰을 근거로 미충족 지원을 분류한다. 단순 문자열 유무로 어려움을 자동 진단하지 않는다.
2. 첫 확대는 미대표 26유형의 대표 및 실제 의미 이해 결손 후보로 한정한다. 선정 manifest·분모·지원 종류·보류 사유를 먼저 만든다.
3. 기존 조사/분석·원문·검수 자산을 재사용하고 신규 교수 extension만 작성한다. 처음에는 10문항 이하 청크, 결과 크기와 검수 난이도에 따라 조정한다. 작업자와 독립 검수자의 청크 책임을 분리한다.
4. 에이전트가 직접 원문을 읽고 작성한다. API 키가 없다는 이유로 중단하지 않는다. 병렬 드레인을 쓰면 사용자가 승인한 task 범위·공정 지침을 따라 파일/청크 소유권을 명시하고 다른 사람 편집을 되돌리지 않는다.
5. 형식 검사→별도 내용 검수→revise 수정→새 revision 재검수→dry-run→변경량 대조→정적 artifact build. 기존 base/compare에 변화 0인지 deep compare/hash로 확인한다.
6. 재실행은 schema+binding+content revision으로 판정한다. v3가 채워졌다는 이유로 v3.1을 영구 skip하지 않는다. 원문 개정과 분석 개정의 영향 범위를 별도로 기록한다.
7. unresolved conflict는 비공개 원장으로 남기고 루프를 끊는다. 공급량 목표 때문에 검수 gate를 완화하지 않는다.

기본 배치는 정적 파일이며 DB 변경이 없다. DB 이동/마이그레이션/데이터 의미를 바꾸는 대량 UPDATE가 필요하면 현재 저장소의 `.claude/commands/db-checkpoint.md`(`/db-checkpoint`)와 승인 정책을 읽고 SQL·영향·dry-run·복구안을 준비한 뒤 별도 승인을 받는다. Codex 환경에 `source-command-db-checkpoint` 스킬이 있으면 같은 절차를 적용하되 저장소에 실제 존재하는 경로를 확인한다. 기존 jsonb 전체를 덮지 않는다. 콘텐츠 수치 변동은 저장소 규약대로 생성형 통계 문서를 실행 갱신하며 손으로 고치지 않는다.

**C4 완료:** 승인/선정된 확대 범위만 검수된 확장으로 제공, 미처리 분모·제외 사유·현재 hash/버전·재실행/복구 기록이 있다. 전량 완료나 교육 효과를 가정하지 않는다.

## 7. C5 — 테스트·실화면·문서·PR

### 반드시 실패를 검증할 사례

| 계층 | 검증 |
|---|---|
| schema | dangling unit/proposition/anchor/legacyMeaning/choice/design index, 잘못된 sentence/occurrence, 빈 의미, unknown schema |
| public gate | unreviewed/revise/동일 writer·reviewer/옛 criteria/옛 contentHash/원문 증거 결속 없음은 공개 불가 |
| binding | base 분석 버전·units·inquiry 내용 hash 변경 시 sidecar stale, 기존 유효 base는 유지 |
| mapping | 같은 문장 수·길이 다른 텍스트, 중복 구절, 입력1=주어진문장, 인쇄 순서≠읽기 순서, 교정 범위는 원문 범위와 별개 |
| interaction | 문장→unit, 다중 후보, 선택/관계/깊이 변경, 해제, popstate, deep link 정규화, 장면 복귀, 유효한 pair/back/from/check 맥락 유지 |
| source/rights | 원문 없음·이미지·추출 실패·지도 없음·분할 불일치·접근 제한·현재 원문 교체, held 데이터 SSR/Flight/클라이언트 비노출 |
| draft/privacy | 600자 초과 입력 보존, unit/장면 이동 보존, 새로고침 소실 안내, logout 초기화, 네트워크/이벤트 자유 텍스트 유출 0 |
| regressions | 기존 v3 fallback·compare749·principle110·ReasoningNote 저장 실패/재개·지도 check/help/reveal·TTS 자동 재생/키 충돌 |

### 실행 명령

기존 명령(실제 존재):

```powershell
node docs/csat-learner/v31/audit-corpus.mjs
node --test scripts/csat/__tests__/compare-v3-binding.test.mjs scripts/csat/__tests__/compare-v3-types.test.mjs scripts/csat/__tests__/compare-v3-guard.test.mjs scripts/csat/__tests__/inquiry-review-guard.test.mjs
pnpm.cmd --filter web exec vitest run src/lib/csat/inquiry/__tests__/compare-v3.test.ts
pnpm.cmd turbo run lint typecheck test
node agents/scripts/check.mjs
pnpm.cmd --filter web exec playwright test csat-v3-m5-explore.spec.ts
```

현재 main의 프로젝트 명령/환경이 바뀌면 실제 package/config에서 확인해 사용한다. PowerShell에서는 pnpm.ps1 실행 정책을 바꾸지 않고 pnpm.cmd를 사용할 수 있다. 런타임 계정은 .env*에서 읽고 출력/커밋하지 않는다.

C1~C2에서 새 스크립트와 테스트를 만든 뒤 실행할 명령(현재는 미구현):

```powershell
node scripts/csat/meaning-support-export.mjs --manifest scripts/csat/meaning-support-drain/pilot-manifest.json
node scripts/csat/meaning-support-validate.mjs --manifest scripts/csat/meaning-support-drain/pilot-manifest.json
node scripts/csat/meaning-support-hash.mjs --manifest scripts/csat/meaning-support-drain/pilot-manifest.json
node scripts/csat/meaning-support-build.mjs --dry --manifest scripts/csat/meaning-support-drain/pilot-manifest.json
node --test scripts/csat/__tests__/meaning-support-schema.test.mjs scripts/csat/__tests__/meaning-support-public.test.mjs
pnpm.cmd --filter web exec vitest run src/lib/csat/meaning-support/__tests__/model.test.ts src/components/csat/theater/__tests__/MeaningSupportPanel.test.tsx
pnpm.cmd --filter web exec playwright test csat-v31-meaning.spec.ts
```

CLI는 manifest 출력 경로·source input root·dry-run·재실행 안전 여부를 help에 명시한다. 필요한 입력이 없으면 clean checkout에서도 원문을 재구성하는 척하지 않는다.

새 `apps/web/tests/e2e/csat-v31-meaning.spec.ts`는 로컬 실제 원문 여정을 확인한다. 별도로 `apps/web/tests/e2e-isolated/`에 접근 gate·access_withheld SSR/Flight 비노출·stale fallback·핵심 선택 상태 스펙을 **필수 추가**하여 CI에서 실행한다. review_hold는 builder/Node public guard에서 제외를 검사한다. 비민감 fixture로 인증/접근 상태를 만들어도 production 권한 우회 경로는 만들지 않는다. CI 로그에서 이 스펙의 실행/skip0을 확인해야 C5 pass다. 기존 smoke만 통과한 것을 새 E2E 통과로 대신하지 않는다. 공유 개발 DB와 isolated DB 테스트/승인 범위를 구별한다.

격리 스펙의 실행 명령은 `pnpm.cmd --filter web exec playwright test -c playwright.isolated.config.ts`다. 러너의 로컬 Supabase/fixture 전제와 실제 대상 URL을 확인한다. 이 명령의 통과를 비공개 실제 기출 원문 대조 검증의 대체로 쓰지 않는다.
격리 seed 실행은 `node scripts/csat/meaning-support-isolated-seed.mjs`이며 C1에서 구현하기 전에는 현재 존재하는 명령으로 보고하지 않는다. 대상/namespace 가드가 내부에서 항상 실행되어야 한다.

### 화면 검증과 디자인

- PC 1280·1440 라이트에서 8대표, 확장 없음, 원문 없음, 데이터 stale, 권한 제한, mapping 실패를 직접 조작하고 정상 상태 캡처를 열어 검토한다.
- 한 문장 선택으로 원문·구문·쉬운 말·관계가 같은 근거를 가리키는지 확인한다. 문장 길이 막대를 의미 이해 시각화의 완료 증거로 삼지 않는다.
- 기존 참조 캡처/측정 spec은 대응되는 부품에만 적용한다. 새로운 교수 판 참조가 없으면 관련 3B 작업면 부품을 확보하고 대상을 측정한다. 학습 지도 16/16 결과를 새 교수 판의 참조 일치 결과로 재사용하지 않는다.
- `pnpm.cmd design:ref-measure <참조png>`/`design:ref-compare`로 적용 가능한 부품을 대조하고 표를 낸다. 참조에 없는 의미 관계도는 제품 설계·접근성/학습 행동 검수임을 구별한다. 캡처 부재를 디자인 검수 pass로 기록하지 않는다.
- focus, 대비, 색 이외 상태 표시, 한글 줄바꿈, 44px, 구절 선택과 클릭 구별, reduced-motion, 스크롤·넘침·콘솔·TTS 회귀. 새 특수 모바일 작업은 하지 않는다.

### 문서·커밋·PR 완료 기준

- 각 C단계에서 목적/수용 기준과 실제 결과를 갱신한다. 코드와 `docs/csat-learner/ITEM_INQUIRY_V2_CONTRACT.md`, 이 설계의 차이 원장, `docs/MODULES.md`, `docs/LEARNING_MODEL.md`, `docs/CSAT_LEARNER_DELIVERY.md`, CHANGELOG를 함께 갱신한다.
- 토큰/패턴이 바뀌면 DESIGN_SYSTEM, route가 바뀌면 ROUTES(기본안은 새 route 없음), Admin 파이프라인을 바꾸면 `apps/web/src/lib/admin/help/csat.ts`를 같은 커밋에 갱신한다. 이번 보완 때문에 Admin 화면을 새로 만들지 않는다.
- 판정 작업의 통과/보류/실패/skip 수와 분모를 별도로 보고한다. 의미 검수 pass를 교육 효과/이해도 pass로 말하지 않는다.
- 대표 파일럿(C2/C3), 확대(C4), QA(C5)는 논리적 milestone로 나눠 자기 파일만 커밋+push. Conventional commits, Co-Authored-By, hooks 유지. main 직접 push/force/no-verify 금지.
- 설계 차이가 생기면 이유·실제 근거·영향·새 검증을 계약에 먼저 남긴다. 범위 밖 지적은 별도 작업으로 분리한다.
- 반대 에이전트 리뷰 정책은 실제 적용 사용자 지시를 따른다. 현재 `review.mjs`에는 --plan 모드가 없으므로 존재하지 않는 검증을 수행했다고 쓰지 않는다. 계획 리뷰는 실제 문서를 읽는 별도 읽기 전용 Claude/Codex 절차로 기록한다.
- main 병합은 현재 사용자 승인 범위를 확인하고 허용될 때만 safe-merge 게이트를 사용한다. 승인 없는 본 설계 단계에서는 PR 준비까지다.

**C5 완료표:** 기능 구현, 기계 검사, 독립 의미·권리 검수, 실제 PC 화면, 참조 확보/측정, 원문/권한 예외, 기존 M5 잔여, 실사용자 사용성, 실제 교육 효과를 각각 pass/fail/hold/미검증/범위제외로 구별한다. 교육 효과 미검증은 기술 출시 검수와 별도로 남긴다. 실제 화면 미확인을 기능 완료로 숨기지 않는다.

## 8. F01~F16·M5 연결과 회귀 범위

| 기존 과제 | v3.1 책임 |
|---|---|
| F01, F03, F15 | 설명 자유 진입·기존 분석 fallback·원문 이해→문항 성립 연결 |
| F04, F07, F08, F10 | 단일 선택·정확한 근거/구절·입력 번호와 읽기 순서·실제 명제 관계 |
| F05, F06 | 기존 오답·유인 근거 자산 보존; 신규 이해 주석과 연결할 때 검수된 referent만 사용 |
| F11 | 도표 언어 이해와 원본 수치 확인 분리 |
| F12, F13 | 읽기/선택이 재생하지 않음·키보드 소유권·열람을 이해/완주로 환산하지 않음 |
| F14 | 기존 다음 문항·복귀 흐름 회귀; 새 추천 엔진을 이번에 만들지 않음 |
| F16 | 실제 산출물 통합 가드·대표 학습 여정·CI 실행 범위 증거 |
| F02 | 현재 공개 분모와 보류 원장; 786을 live DB 사실로 쓰지 않음 |
| F09 | 학평 확장은 계속 보류; 보류를 해결/완료로 바꾸지 않음 |

기존 M5 출시 검수는 자체 증거로 닫는다. C0~C5 교수 보강을 했다는 이유로 TTS 미검증·참조 부재·교육 효과 미측정이 해결됐다고 말하지 않는다.
