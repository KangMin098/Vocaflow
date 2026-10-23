# 29 · 판단 장면 정답 지연 공개(결정 b) — 누출 경로 조사 · 최소 변경안

- 기준: worktree `D:/workspace/Vocaflow-lecture-learner-control`, `feat/lecture-learner-control` HEAD `6eb6f3451` (2026-10-24 · 읽기 전용 조사, 구현 없음)
- 결정 (b): 판단 장면의 정답 데이터는 초기 HTML·RSC·client props·prefetch·cache 어디에도 없어야 한다. 학습자가 명시적으로 공개를 요청하면 서버가 `learning_exposure_record`(kind `answer_direct`, source `judgment_scene`)를 먼저 커밋하고 그 뒤에만 돌려준다. 기록에 실패하면 아무것도 돌려주지 않는다(fail-closed).

## 1. 누출 경로 목록 (page.tsx → client)

`page.tsx` = `apps/web/src/app/(app)/csat/item/[slug]/page.tsx`. `export const dynamic = 'force-dynamic'`(57행)이라 fetch/세그먼트 캐시는 없다. 대신 RSC 페이로드에 모든 props가 직렬화되어 들어간다. 이것이 핵심 누출 경로다.

| # | 경로 | file:line | 분류 |
|---|---|---|---|
| 1 | `gate.answer` (정답 번호) | page.tsx:286-287 | DIRECT_ANSWER |
| 2 | `gate.evidence` (정답 근거 문장 번호) | page.tsx:288 | HINT (근거 문장 → 정답 추론 가능) |
| 3 | `gate.design` (PassageDesign: roles·selection·transform·transform_note) → TransformDiagram(judgment)·DesignSelection·StructurePredict | page.tsx:289 · AnalysisTheater.tsx:997-1001 · lib/csat/learner.ts:635(`answer_locus.passage_design`) | HINT~DETERMINES_ANSWER (`selection`·`transform_note`은 정답 선지 문장을 서술할 수 있음, NOT_VERIFIED: 문항별 내용) |
| 4 | `blocks` — `theaterBlocks(item)`의 head 칩 `정답 ①` | lib/csat/theater.ts:183-184 · page.tsx:143,243 | DIRECT_ANSWER |
| 5 | `blocks` kind `answer` (칩 = 정답 번호, body = why_correct + evidence_reasoning) | theater.ts:216-226 | DIRECT_ANSWER |
| 6 | `blocks` kind `reject` × 4 (오답 번호·why_tempting·how_to_reject) | theater.ts:234-247 | DETERMINES_ANSWER (오답 4개 = 소거로 정답) |
| 7 | `map.anchors` id `answer` (label=정답 번호, detail=why_correct) + `reject:n` (how_to_reject, tempting) + `map.placements` | page.tsx:116-136, 271 | DIRECT_ANSWER / DETERMINES_ANSWER |
| 8 | `checks` — evidence check `correct`=정답 근거 문장, lure check `choice`=오답 번호 + `correct` trap | lib/csat/understanding-check.ts:18-34(파일 기준 78·87-93행 부근) · page.tsx:147-152, 244 | HINT(evidence) · DETERMINES_ANSWER(lure: 오답 번호가 드러남, 4개 모이면 소거) |
| 9 | `comparePairs` — `choice`·`otherChoice`·`trap`·`note` (compare 데이터의 선지 번호) | page.tsx:167-171, 245 | DETERMINES_ANSWER 가능 (choice 가 함정 오답 번호인지 정답인지 NOT_VERIFIED) |
| 10 | `v3Pairs` — Side `choices?: number[]` | lib/csat/inquiry/compare-v3.ts:15 · page.tsx:196-205, 246 | HINT (NOT_VERIFIED) |
| 11 | `inquiry` 레코드 전체(ready 시) | page.tsx:261 · lib/csat/inquiry/data.ts | NOT_VERIFIED (판단 장면 패널이 선지 판정을 포함할 가능성 높음) |
| 12 | `meaningSupport` — bridge `choiceNumbers`·`designClaimIndices` | lib/csat/meaning-support/model.ts:89-92 · page.tsx:263 | HINT (선지↔단위 연결) |
| 13 | 원리 패널 `principle.panel` (Evidence/ContextSense/Cohesion/PrinciplePanel) | page.tsx:305-311, 350-357 | NOT_VERIFIED (근거 문장 정답 포함 가능 → HINT) |
| 14 | `steps` = `maskDisclosureSteps(theaterSteps(outline))` | page.tsx:140 | SAFE(마스킹됨, T-0140 소관) |
| 15 | `lectureDisclosure` (stopBefore 등) | page.tsx:242 | SAFE |
| 16 | `siblings`·`next`·`paper`(catalog)·`source`·`typeId` | page.tsx:155-165, 283-296 | SAFE |
| 17 | ItemPaper `/api/csat/dev-paper` (dev 전용 fetch, 원문만) | components/csat/theater/ItemPaper.tsx:33 | SAFE (정답 표시 여부 NOT_VERIFIED) |
| 18 | 로드 시 API 호출: 없음. `/reveal` POST 는 공개 버튼 후에만(AnalysisTheater.tsx:132, keepalive), `/task`·`/structure` 는 학습자 제출 후 | — | SAFE |

집계: DIRECT_ANSWER 4 (1·4·5·7a) · DETERMINES_ANSWER 4 (6·7b·8 lure·9) · HINT 5 (2·3·10·12·8 evidence) · NOT_VERIFIED 2 (11·13) · SAFE 5.
SWR/prefetch 호출은 이 페이지에서 찾지 못했다. `next/link` 기본 prefetch는 다른 문항 페이지의 RSC(=그 문항 정답)를 미리 받는다(siblings/next/compare 링크). NOT_VERIFIED: `prefetch={false}` 지정 여부.

## 2. `/api/csat/item/[slug]/reveal` 현황

- 있다: `apps/web/src/app/api/csat/item/[slug]/reveal/route.ts` (이 브랜치·main 모두).
- POST `{sessionId, help, revealedAt, userId}` → `learning_session_apply`(activity theater, stage revealed, `p_explanation_viewed_at`) 기록만 하고 `{ok, outcome}` 을 돌려준다. **정답 데이터를 돌려주지 않는다.** 정답은 이미 props에 있고, 이 라우트는 사후 기록이다(클라이언트가 keepalive로 보내는 fire-and-forget).
- `learning_exposures`·`learning_exposure_record` 는 코드·migrations에 없다. 연구 브랜치 `research/csat-all-types-20261024` 의 `p6-sql/20261024100000_learning_exposures.v2.sql` 초안에만 있다(DB 미적용, 승인 필요 · L4).

## 3. 최소 변경안

전제: `learning_exposures` + `learning_exposure_record` 마이그레이션이 먼저 사용자 승인 후 적용돼야 한다(28_P6_SQL_V2). 그 전에는 서버 경로가 항상 503이므로, 결정 (b)는 정답 표시 자체를 막는다. 이것이 의도된 fail-closed다.

### 서버(page.tsx)에서 뺄 것
- `gate.answer` → 제거(또는 `hasAnswer: boolean` 만). `gate.evidence` 제거. `gate.design` 은 judgment 장면 렌더(TransformDiagram)에서 빼고, meaning/design 장면용으로는 정답을 가리키지 않는 필드만(roles·pattern·cues) 남긴다. `selection`·`transform_note` 는 공개 페이로드로 옮긴다.
- `theaterBlocks`: head 정답 칩, `answer`·`reject` 블록을 초기 blocks에서 빼는 `theaterBlocks(item, { withAnswer: false })` 옵션 추가. 남는 블록: head(정답 칩 없음)·ability·intent·procedure·vocab.
- `map.anchors`: `answer`·`reject:*` 앵커의 label/detail/tempting 제거. 지도는 문장 골격만 보내고 앵커는 공개 뒤 채운다.
- `checks`: lure check(오답 번호)·evidence check(정답 근거)는 공개 뒤에만 쓰이므로 초기 props에서 빼고 공개 페이로드에 넣는다.
- `comparePairs`·`v3Pairs` choices·`meaningSupport` choiceNumbers·`inquiry` 판단 패널: 선지 번호 필드를 공개 페이로드로 옮긴다(NOT_VERIFIED 항목은 구현 전 필드별 재확인).
- 문항 간 `<Link>` 에 `prefetch={false}`.

### 새 라우트: `POST /api/csat/item/[slug]/judgment` (기존 `/reveal` 확장보다 분리를 권장. `/reveal` 은 G2 세션 기록 계약이 따로 있다)
1. `learnerContext()` 인증(401) · slug 형식(404).
2. 본문 `{ analysisVersion, requestId }` — 서버가 읽은 `item.analysis_version` 과 다르면 409(stale).
3. `canRevealItem(item.id)` 엠바고·보류 확인(403/423), 페이지와 같은 접근 검사.
4. service-role 클라이언트로 `learning_exposure_record(p_user, p_item, p_analysis_version, kind 'answer_direct', source 'judgment_scene', p_request_id)` 호출. 오류·커밋 확인 실패 시 **503, 본문에 데이터 없음**.
5. 기록 성공 뒤에만 `{ answer, evidence, blocks(answer·reject), anchors, checks, design.selection/transform_note, choice 필드들 }` 반환. 헤더 `Cache-Control: no-store`, `dynamic='force-dynamic'`, `runtime='nodejs'`. 강의 정책(lecture scope=full / boundary continue)과 같은 원장을 쓴다.

### 클라이언트(AnalysisTheater 와 판단 장면)
- 판단 장면에 「정답 확인」 버튼(`<button>`, 44px, focus-visible). 누를 때만 POST. 자동 fetch·useEffect fetch·hover prefetch 없음.
- 성공하면 응답을 컴포넌트 state에만 둔다(localStorage/SWR 캐시 금지). 실패(503/409)면 「지금은 정답을 열 수 없어요」 문구, 데이터 없음. 공개 뒤 포커스를 공개된 정답 영역 제목으로 이동하고 `aria-live="polite"`.
- 기존 `/reveal` 세션 기록(AnalysisTheater.tsx:132)은 공개 성공 뒤 그대로 보낸다.
- 정답이 아닌 내용(지문 골격·ability·intent·procedure·vocab·강의 마스킹 레일·원문 문제지)은 그대로 둔다.

### 테스트
- 서버 렌더 가드: 픽스처 문항으로 page를 렌더해 HTML/RSC 직렬화 문자열에 정답 칩(`정답 ①`), `why_correct`, `how_to_reject`, `why_tempting`, `answer` 앵커 detail 이 **없음**을 확인(`theater-delivery-guard.test.ts` 확장).
- 라우트: RPC 오류 → 503 · 본문에 answer 키 없음; analysis_version 불일치 → 409; 비로그인 → 401; 보류 → 403; 성공 → RPC 호출이 응답 직렬화보다 먼저(호출 순서 mock 검증) · `no-store` 헤더.
- 클라이언트: 마운트 시 fetch 0회, 버튼 클릭(키보드 Enter/Space 포함) 시 1회.
- E2E(isolated): 판단 장면 첫 화면의 HTML에서 정답 문자열이 없고, 클릭 뒤에만 표시. L3(학습기록·데이터 결속) + DB L4.

## 4. 소유권 충돌

- **T-0140**(owner csat-lecture-disclosure, BLOCKED, `feat/lecture-learner-control`): `AnalysisTheater.tsx`·`theater.module.css`·`api/csat/lecture/`·`csat/item/**`(page.tsx)·`theater-delivery-guard.test.ts` 를 잡고 있다. 위 변경의 핵심 파일과 겹친다. 같은 브랜치에서 T-0140 owner가 이어 하거나 T-0140 통합 뒤 새 작업으로 해야 한다.
- **T-0091**(BLOCKED, `feat/csat-system-learning-20261023`): `components/csat/theater/**`, `lib/csat/inquiry/**` 를 잡고 있다. 판단 장면 패널·inquiry 필드 분리와 겹친다.
- **T-0043**(REVIEW, `review/lm-g1-5a-v2-acceptance`): `components/csat/theater/**`, `app/(app)/csat/item/**` 를 잡고 있다.
- 최근 로컬 브랜치 25개 중 main 대비 위 파일을 바꾼 것은 `feat/lecture-learner-control`(3파일)뿐이다. 원격·다른 worktree 미커밋 변경은 NOT_VERIFIED.
- `lib/csat/theater.ts`·`understanding-check.ts` 를 명시적으로 잡은 활성 TASK는 찾지 못했다.
