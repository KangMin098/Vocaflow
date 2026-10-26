# LCP Story — 이야기 중심 판본 라인 (Story-First Adaptive Reading)

> **정본(계약)** · 작성 2026-10-25 · 등록 작업 T-0165(owner `lcp-story-claude`, 검증 owner `lcp-story-codex`).
> 단계별 실행 순서와 시작 지시: [lcp-story/IMPLEMENTATION.md](./lcp-story/IMPLEMENTATION.md).
> 기존 LCP(원본 도서 큐레이션)는 그대로 유지한다: [LIBRARY_PIPELINE §LCP](./LIBRARY_PIPELINE.md).
> 설계를 바꿀 때는 이 문서를 고친다. 채팅 사본을 정본으로 쓰지 않는다.

## 0. 현재 상태와 경계 (2026-10-26)

| 구분 | 내용 | 상태 |
|---|---|---|
| 정본 · 단계 지시 | 이 문서 · `docs/lcp-story/IMPLEMENTATION.md` | 작성됨 |
| 도메인 스키마 · 순수 검증기 | `packages/library-pipeline/src/story/{canonical,text,schema,validate,plan}.ts` | 구현 · 작성자 테스트 통과(작성자 검증) |
| 로컬 제작 CLI | `scripts/lcp/story/story.ts` → `src/story/{workdir,cli}.ts` (`export` · `validate` · `plan`) | 구현 · 위와 같음 |
| 독립 수용 | T-0165 두 owner 수용 계약(작성 `lcp-story-claude` · 검증 `lcp-story-codex`) | 현재 판정은 AI-Control 의 T-0165 수용 기록(`verification/reviews/T-0165-*`)이 정본 — 이 문서가 미리 적지 않는다 |
| 합성 fixture | `packages/library-pipeline/src/story/fixtures/gull-rock.*.json` — 직접 쓴 짧은 완결 이야기 | 합성 · 실제 도서 아님 |
| live DB 읽기 감사 · 코드 경로 감사 | `docs/lcp-story/S3_DB_AUDIT.md`(SELECT 전용 실측 · 결정) · `docs/lcp-story/S3_CODE_PATHS.md` | 작성됨(T-0169) |
| DB 테이블 · RPC · RLS · 발행 게이트 | `supabase/migrations/20261025094450_lcp_story_s3_schema.sql` · 복구 `_pending_lcp_story_s3_quarantine.sql` · 러너 `scripts/db/lcp-story-s3/deploy.mjs` · 격리 시험 `verify-isolated.ts` | **공유 DB 적용 완료** — 사용자 승인 뒤 MCP 원장 `20261025094450` · 승인 SHA 일치 · 사후 검사 15/15. 관리자/학습자 런타임은 별도(S4/S5) |
| S2 검증 증명 어댑터 | `packages/library-pipeline/src/story/attest.ts`(`buildValidationAttestation`) — DB 가 돌려준 저장값을 S2 검증기로 검사해 발행에 필요한 결속 증명을 만든다(§15) | 순수 함수 구현 · 작성자 테스트 |
| 검증 증인 런타임(S4) | `apps/web/src/lib/library/story/witness.ts` · 서버 액션 `attestStoryValidationAction` — 쿠키 세션 스태프 확인 뒤에만 service_role 로 §15 의 1~3 을 실행(§15) | 기존 독립 수용(T-0174 `fcf57c225e2a`) 유지. 2026-10-26 정상 admin 화면에서 실제 저장값·검수 집합의 증인을 생성해 dev R1·R2를 발행했다. [실행 증거](./lcp-story/S7_PILOT.md) |
| 관리자 화면(S4) | `/admin/curation?line=story` — `app/admin/curation/StoryCurationClient.tsx` · `story-actions.ts` · `lib/library/story/{admin,witness,messages,types}.ts` · 도움말 `help/curation.ts` 「이야기 판본」(§18) | 기존 수용 유지. 서로 다른 정상 dev 제작/검수 계정으로 대표 1편 등록·AI 검수·위임 권리 기록·발행·철회·새 검수 결속의 재발행을 실제 검증했다. 권한·SQL 조건을 우회하지 않음 |
| 학습자 화면(S5) | `/library/stories` · `/library/stories/[releaseKey]?unit=` — `lib/library/story/learner.ts` · `app/(main)/library/stories/**` · `components/library/story/**`(§12) | 기존 코드 독립 수용과 SQL r3 적용 유지. 대표 실제 발행본에서 개발 학습자 A1440/B1280의 독서·도움·저장·재로그인·완료 구분·이어하기·계정 격리·철회 접근을 검증했다. 원본 실패와 표적 재개를 분리한 [종단 증거](./lcp-story/S7_PILOT.md)를 따른다. 사람 학습 효과 아님 |
| 시작 전 선택 안내(U1 · T-0187) | `public.story_release_guidance`·원장`20261026110732`·`StoryGuidance.tsx`·`learner.ts`(§12) | 최신 사용자 승인 v2 SHA`8648c24c…f22eac` 원문 적용. 기존12표/함수 지문 불변·권한/RLS 확인. 실제 화면·통합의 최종 결과는 [D2 후속](./lcp-story/D2_S7_FOLLOWUP.md) |
| 이벤트(S5) | `events.ts` `story_catalog_viewed` · `story_reader_action`(§17) | 코드 + DB 허용 목록 적용(같은 SQL §C · 실제 CHECK SELECT 평가 62/62). 쓰기형 `db-allowlist` 시험은 NOT_RUN |
| 추천 | 없음 | 제안(S6) |
| 실제 대표 도서 판본 · AI 독립 검수 | 《The Adventure of the Blue Carbuncle》 story-b2, 보완 r3·16단위·독립 AI 검수 2건 | R1 철회 이력과 이전 초안·검수를 보존하고 R2 1편을 공개했다. B2는 편집 목표. 정책의 동물 위해 안내는 정정했으나 학습자 화면 노출은 후속 |
| 권리 확인 · 사람 검수 · 학습자 파일럿 | 사용자의 특정 source 권리 결정·AI admin 위임 기록, 정상 DB source_text confirmed | §14의 승인 범위 충족. AI 콘텐츠 검수는 AI로 기록하며 실제 사람 콘텐츠 검수·학습자 파일럿·독해 성장 실증은 없다(S7) |

- 패키지 루트 배럴(`src/index.ts`)에는 싣지 않는다. S4 부터 `package.json` exports `@vocaflow/library-pipeline/story`(= `src/story/server.ts` — 작업 폴더 · CLI 제외)를 관리자 서버 코드가 쓴다. 전체 배럴(`src/story/index.ts`)의 소비자는 `scripts/lcp/story` 다.
- 이 라인이 학습 효과를 낸다는 근거는 없다. 원문 · 흥미 진입 · 각색 효과를 섞어 교육 효과를 주장하지 않는다(§19).
- **로컬 파일의 메타데이터는 주장이다.** 스냅숏의 권리 기록 · 대응 도서 id, 판본의 생산자, 검수의 검수자 · 출처는 입력 파일이 적은 값이며
  인증된 DB 권한 · 신원이 아니다. 로컬 검증은 그 값들의 일관성과 해시 결속만 본다. 실제 권한 · 발행 허가는 S3/S4 의 DB(RLS · RPC)가 맡는다.

## 1. 목표와 범위

LCP Story 는 **검증된 원천**에서 학습자가 **읽고 싶은 이야기**와 **읽을 수 있는 판본**, **선택적 의미 탐구**를 제공한다.
학습자 흐름은 DISCOVER(흥미 발견) → HOOK(스포일러 없는 진입 장면) → IMMERSE(본문 중심 자유 독서) →
UNDERSTAND(요청 시 의미 탐구) → GROW(원문 연결 · 어휘 · 추론으로 선택 확장) → CONTINUE(다음 이야기)다.

- 원본 라인(원문 도서 · 챕터 · 단어장)은 바꾸지 않는다. Story 는 그 옆의 **추가 라인**이다.
- 범위 밖: 원문 읽기 강제 · 매 장면 퀴즈 · 영상 중심 제품 · 전권 일괄 변환 · 전 수준 행렬 생산 ·
  초기 재서사 · 개인별 즉석 생성(초기) · 자유서술 자동 채점 · 학습자 임의 자료 평가.
- 작품마다 **필요한 조합만** 만든다. 편집 기준의 `production` 에 없는 판본 · 활동은 만들지 않는다.

## 2. 콘텐츠 종류 — 다섯 가지를 모두 「책」으로 복제하지 않는다

| 종류 | 성격 | 지금의 데이터 표현(S1) |
|---|---|---|
| Story Edition | **본문 판본** — 서사를 보존한 현대 영어 | `EditionArtifact` `kind=story_edition` · 제작 `transformation=language_modernization` |
| Easy Reader | **본문 판본** — 핵심 사건 · 동기를 보존하고 언어 부담을 낮춤 | `kind=easy_reader` · `transformation=level_adaptation` |
| Original Bridge | **활동** — 판본 구간과 원문 구간의 대응 자료 | `Activity kind=original_bridge`(판본 구간 + 원문 앵커 + 비교 초점) |
| Deep Reading | **활동** — 판단 구조의 학습 활동 | `Activity kind=deep_reading`(`choose_evidence` · `order_events`) |
| Theme Collection | **편성** — 여러 작품의 발행본을 잇는 목록 | `ThemeCollection` — `release_key` 만 담고 본문은 담지 않음 · 서로 다른 작품 2개 이상 |

## 3. 변환 유형과 변경 기록

| 변경 유형(`change_log[].type`) | 뜻 | story_edition | easy_reader |
|---|---|:-:|:-:|
| `language_modernization` | 고어 · 철자 · 어순 현대화. 사건 · 의미 불변 | ✓ | ✓ |
| `level_adaptation` | 어휘 · 문장 길이 · 비핵심 묘사 조절(축약 · 생략 포함) | ✗ | ✓ |
| `editorial_note` | 서사를 바꾸지 않는 학습자 주석(`gloss` · `context_note`) | ✓ | ✓ |
| `renarration` | 사건 순서 · 시점 · 구조를 바꾸는 재서사 | ✗ 초기 제외 | ✗ 초기 제외 |

- 작업(`operation`): `rewrite` · `condense` · `omit` · `gloss` · `context_note`. `gloss`·`context_note` ⇔ `editorial_note`.
  `omit` 은 결과 단위 없이 원문 앵커로 「무엇을 뺐는지」를 남긴다. 그 밖의 작업은 결과 단위(`unit_ids`)를 가리킨다.
- 모든 변경은 원문 앵커와 `rationale` 을 가진다. 재서사는 편집 기준(`production.transformation`)과 변경 기록 양쪽에서 거부한다.

## 4. 편집 기준(EditorialPolicy) — 작품마다 하나

| 필드 | 계약 |
|---|---|
| `reason_to_read` | 학습자가 이 이야기를 읽을 이유(한 단락) |
| `preserve.events · motivations · causality · foreshadowing · tone_devices` | 보존 요소. 각각 원문 앵커와 `required_in`(반드시 보존할 판본 종류). 예: 언어유희는 story_edition 만 |
| `changeable` | 바꿔도 되는 것 |
| `sensitive_content[]` | 원작 시대의 차별 · 고정관념 표현. `handling` = `retain_with_context` · `revise_with_note` · `omit_with_note`. 은폐하지도 무비판 재생산하지도 않는다 — 판본마다 해당 변경 기록(`context_note` · `rewrite` · `omit`)과 `learner_note` 가 필수 |
| `entry_scene` | 스포일러 없는 진입 구간(원문 앵커). 판본의 `hook` 은 이 구간 안에서만 고른다 |
| `review_concerns` | 검수 쟁점 |
| `production[]` | 제작 범위: `edition_key` · `kind` · `transformation` · `coverage`(`complete_work`·`episode`·`excerpt`) · `scope`(원문 문단 범위) · `target`(§5) · `activities` |

- `policy_sha256` = `production` 을 **뺀** 편집 기준의 정본 해시. 판본을 새로 추가해도 기존 판본 검수가 낡지 않는다.
  보존 요소 · 민감 표현 · 진입 장면이 바뀌면 해시가 바뀌어 모든 판본 결과물 · 검수가 낡는다.
- `target_sha256` = 그 `production` 항목 전체의 정본 해시.
- 편집 기준은 원천 **본문 해시**(`source_sha256`)에 묶인다(앵커가 본문을 가리키므로). 같은 본문의 다른 원천 판본에도 기준을 재사용할 수 있지만,
  판본 결과물 · 검수 · 발행 키는 원천 판본 정체 해시에 따로 묶이므로(§8) 원천 판본이 바뀌면 판본은 다시 만들고 다시 검수한다.
- 판본 범위(`scope`) 밖에만 있는 보존 요소 · 민감 표현은 그 판본의 필수 조건이 아니다.
- `complete_work` 판본은 원문 전 문단을 범위로 가져야 하고, 발췌(`excerpt`) 스냅숏으로는 만들 수 없다.

## 5. 수준 축 분리 — 편집 목표는 실측이 아니다

| 축 | 필드 | 성격 |
|---|---|---|
| 언어 | `language.cefr` · `v_level_min/max` · `basis='editorial_target'` | 편집 목표 |
| 사고 요구 | `cognitive.demand` · `basis='editorial_judgment'` · `note` | 편집 판단 |
| 배경지식 | `background_knowledge.load` · `supports[]` | 편집 판단 |
| 정서 적합성 | `emotional_suitability.note` · `cautions[]` | 편집 판단 |
| 목표 | `goals[]` | 학습 목표 |

- `basis` 는 리터럴이라 `measured` 같은 값을 받지 않는다. 사고 난도 편집 판단을 실측 진단처럼 표시하지 않는다.
- 실측(V-Level centroid · 커버리지)은 사전 결합이 필요한 S3/S4 범위이며, 생기면 편집 목표와 **다른 필드**로 둔다.
- 지금 계산하는 것은 표면 계측(`surface_metrics`: 단어 · 문장 수)뿐이다. CEFR · V-Level 로 표시하지 않는다.
- 새 임의 성장 · 완독 · 독서량 상수를 만들지 않는다.

## 6. 논리 객체와 지금의 표현

모든 개념을 즉시 테이블로 만들지 않는다. 저장 방식은 S3 감사 뒤 SQL 승인으로 정한다.

| 객체 | 뜻 | S1 표현 | 비고 |
|---|---|---|---|
| Work | 작품 | `work.work_key` | 큐레이터가 정한다. **제목 매칭으로 만들거나 합치지 않는다** |
| Source Edition | 원천 판본 | `SourceSnapshot`(`edition.source_kind` · `library_book_id` · `revision` · `text_language` · `translator` · `text_sha256` · `rights`) → **원천 판본 정체 해시**(§8) | `library_book` 원천은 기존 `library_books` 행에 id 로 대응(새 원본 행을 만들지 않음). 본문이 같아도 다른 원천 판본이면 다른 정체다 |
| Story Unit | 장면 · 에피소드 단위 | `StoryUnit`(`unit_id` · `order` · `text` · `source_anchors` · `preserves`) | |
| Learning Edition | 학습 판본 | `EditionArtifact` + `ProductionItem` | |
| Transformation Record | 변경 기록 | `change_log[]` | |
| Learning Asset | 활동 · 자산 | `activities[]` · `assets[]` | |
| Release | 불변 발행본 | `ReleasePreview`(`release_key`) | 지금은 로컬 미리보기 |
| Collection | 편성 | `ThemeCollection` | |
| Learner Evidence | 학습 근거 | `evidence_policy` 계약만(§13) | 저장 없음(S5/S6) |

**원작 언어 · 원천 본문 언어 · 번역.** `work.original_language`(ISO 639 소문자)는 **원작이 쓰인 언어**이고,
`edition.text_language`(지금은 `en` 만)는 이 원천 판본 **본문의 언어**다. 둘이 다르면 번역본이다 — 번역 고전을 영어 원작으로 적지 않는다.

- 번역본은 `edition.translator`(번역자 표기)와 `rights` 의 `translation` 기록이 반드시 있어야 하고, 원작 언어 본문에는 둘 다 없어야 한다(검증 오류).
- 발행 후보가 되려면 본문을 이루는 권리 — `source_text` 와 선언된 `translation` — 가 모두 `confirmed`(근거 · 확인자 · 시각)여야 한다(§14).
- 번역자 표기(credit)를 화면 · DB 에 어떻게 실을지는 S3 에서 정한다.

## 7. 원문 결속

- **정규화 정책 `story-text-v1`**: 올바른 UTF-16(짝 없는 서로게이트 없음) · NFC · LF · BOM/NUL/CR 없음 · 줄 끝 공백 없음 ·
  문단 사이 정확히 빈 줄 하나(`\n\n`) · 본문 앞뒤 공백 없음. 스냅숏 본문은 이미 이 형태여야 한다 — 검증기는 본문을 고치지 않고 거부한다
  (고치면 구간이 어긋난다). 스냅숏 작성기는 `normalizeSourceText()`(멱등, 잘못된 UTF-16 이면 던진다)를 거친다.
- **잘못된 입력은 치환하지 않는다**: 파일은 엄격한 UTF-8 로 해독한다(잘못된 바이트 → `input_invalid_utf8` · `result_invalid_utf8`).
  JSON 이스케이프로 들어온 짝 없는 서로게이트(`\ud800` 등)는 모든 입력(스냅숏 · 기준 · 판본 · 검수 · 원장)에서 `text_ill_formed_unicode` 로 거부한다.
  Node 의 UTF-8 인코더가 짝 없는 서로게이트를 U+FFFD 로 바꿔 다른 문자열이 같은 해시가 되는 것을 막기 위해서다. 올바른 서로게이트 쌍(이모지)은 받는다.
- **앵커** = `{source_sha256, paragraph, start, end, quote}`. 오프셋은 JavaScript 문자열 인덱스(**UTF-16 코드 단위**),
  **반열린 범위 `[start, end)`**, 한 문단 안. `quote === text.slice(start, end)` 이고 앞뒤 공백이 없어야 한다.
  경계는 서로게이트 쌍(한 글자)을 가를 수 없다(`anchor_splits_surrogate` · `span_splits_surrogate`). 문단은 `\n\n` 구분자를 포함하지 않는다.
- **전원문 전달**: export 가 작업 폴더에 원천 전문 사본(`source.snapshot.json`)을 두고, 검증기는 그 전문으로 해시 · 범위 · 인용을 확인한다.
  과제 파일에도 문단별 본문과 오프셋이 들어간다.
- **다대다 정렬**: 한 단위가 여러 앵커를, 같은 원문 구간이 여러 단위를 가리킬 수 있다(압축 · 확장).
- **정렬 누락 금지**: 제작 범위의 모든 문단은 단위 앵커가 가리키거나 `omit` 변경 기록이 있어야 한다.
- **순서**: 단위의 첫 원문 위치(앵커 최소 `start`)는 단위 순서대로 줄지 않는다. 원작 순서를 바꾼 단위는 거부한다(재서사 제외).
  `hook` 은 읽기 순서 밖의 미리보기이며 `entry_scene` 구간 안이어야 한다.
- **보존 요소**: `required_in` 에 해당하는 판본은 그 요소를 `preserves` 에 적은 단위가 있어야 하고, 그 단위의 앵커가 요소의 원문 구간과 겹쳐야 한다.
- 이것은 **구조 검사**다. 의미 보존 · 자연스러움 · 수준 적합은 검수자 판단이며 구조 검사를 의미 검수로 승격하지 않는다.

## 8. 해시와 정본 직렬화

- **본문 해시** `source_sha256` = `sha256(UTF-8(text))` — 앵커 검증용. 입력의 선언값은 비교용이며, 계산값만 신뢰한다.
- **원천 판본 정체 해시** `source_identity_sha256` = 본문을 뺀 스냅숏 전체(작품 · 원천 판본 · revision · 대응 도서 id · 원천 · URL ·
  본문 언어 · 번역자 · 확보 시각 · 정규화 · 범위 · 권리 기록) + **계산한** 본문 해시의 정본 해시. 권리 기록은 자산마다 하나라 자산 이름 순으로 정렬한다.
  입력이 이 값을 주장할 자리는 없다(스냅숏 스키마에 키가 없다) — 검증기가 스냅숏에서 계산한다.
  본문이 글자 하나 다르지 않아도 다른 원천 판본(다른 snapshot_id · revision · 대응 도서 · 권리 근거 · 확보 기록)이면 정체가 다르다.
  판본 결과물 · 검수 · 원장 · 발행 키가 이 값에 결속되므로, 다른 원천 판본으로 내보낸 작업에 옛 결과물 · 검수를 옮기면 낡은 것(stale)이 된다.
  같은 이름의 작업 폴더가 서로 다른 root 에 있어도 마찬가지다. 키 순서만 다른 스냅숏은 같은 정체다.
- 객체 해시 = `sha256(canonicalJson(value))`. 객체 키는 UTF-16 코드 단위 순 정렬, **배열 순서는 보존**(선택지 · 순서 정답 · 단위 순서는 순서가 곧 내용).
  지원: null · boolean · string(올바른 UTF-16) · 유한 number · 배열 · 평범한 객체. 거부: undefined · NaN · ±Infinity · -0 · bigint · symbol ·
  function · Date · Map · Set · 클래스 인스턴스 · 희소 배열 · 순환 참조(같은 객체의 중복 참조는 허용) · 짝 없는 서로게이트가 든 값 · 키.
  `textbook/review-digest.ts` 의 `canonicalJson` 은 undefined 를 빼고 NaN 을 null 로 바꿔 서로 다른 입력이 같은 해시가 될 수 있어 쓰지 않는다.
- `edition_sha256` = 활동을 뺀 판본 결과물 전체(생산자 · 결속 포함). `activities_sha256` = 활동 배열. 정답 · 근거 구간만 바뀌어도 활동 해시가 바뀐다.
- 판본 결속(`binding`) = `{source_sha256, source_identity_sha256, policy_sha256, target_sha256}`.
- 검수 결속(`ReviewBinding`) = `{task_id, edition_key, source_sha256, source_identity_sha256, policy_sha256, target_sha256, edition_sha256, activities_sha256}`.
  검수 파일 이름에 결속 해시 앞 12자를 넣는다(`<edition_key>.review-<12자>.out.json`).
- `release_key` = `lsr_` + `sha256(canonicalJson({work_key, edition_key, source_identity_sha256, source_text_sha256, policy_sha256, target_sha256, edition_sha256, activities_sha256, review_sha256s(정렬), quality_contract}))` 앞 32자.
  미리보기의 `versions.source` 에 `identity_sha256` 과 `text_sha256` 을 함께 적는다.

## 9. 검수 계약

- 검수 결과(`ReviewArtifact`): 결속 · 검수자(`kind` ai_model|human · `agent` · `session_id` · `role`) · 출처(`provenance`
  ai_review|human_review|synthetic_fixture) · 항목 판정(`checks`) · 문제(`issues` severity/status) · 결론(`verdict`) · 시각.
- 필수 항목: `source_alignment` · `meaning_preservation` · `preserve_items` · `language_target` · `cognitive_target` ·
  `background_supports` · `sensitivity_handling` · `hook_spoiler_free` · `naturalness` + 활동이 있으면 `activities` + 자산이 있으면 `assets`.
- **현재 결속만 센다.** 원천 판본 정체 · 본문 · 기준 · 목표 · 판본 · 활동 중 하나라도 바뀌면 그 검수는 옛 판 기록(`stale`)이 된다. 지우지 않고 보존하며 재사용하지 않는다.
- 다른 판본의 검수를 옮겨 쓰면 오류(`review_wrong_edition`), 다른 결속 자리의 파일 이름이면 오류(`review_slot_mismatch`).
- **생성기 자기 승인 없음**: `reviewer.session_id` 가 판본 `produced_by.session_id` 와 같으면 승인으로 세지 않는다. 생산자를 바꾸면 판본 해시가 바뀐다.
- 합성 검수(`synthetic_fixture`)는 실제 검토가 아니다 — 계획에서 `fixture_only` 로 남는다.
- 모순은 무효: 승인인데 항목 fail/hold 또는 열린 critical · critical 의 `accepted_risk` · 사람 검수가 아닌데 `human_review` · 현재보다 뒤의 시각.
- 현재 검수 둘 이상이 엇갈리면(승인 + 보류 등) 보류다. 열린 major 도 보류다.
- AI 검수는 교사 · 전문가 검수가 아니다. 사람 검수가 없으면 미리보기에 `human_review_not_performed` 가 붙는다.
- 개발 단계의 제작·편집·독립 콘텐츠 검수는 중앙 `development_policy.ai_work_roles`에 따라 Claude Code/Codex에 배정한다. 제작에 참여하지 않은 실제 세션이 원문·최종 판본을 직접 대조하고 제작 판단을 복제하지 않았는지 확인한다. `ai_model/ai_review`는 AI 검수로 기록하며 사람 검수로 바꾸지 않는다. 이 역할 배정과 §15의 인증 UID·활성 상태·권한 검사는 서로 다른 요건이다. §14의 사람 권리 확인 조건과 §19의 실사용 교육 효과 검증은 별도로 유지한다.

## 10. 발행(Release) 계약

- 발행본은 원천 판본 정체 · 본문 · 기준 · 목표 · 판본 · 활동 · 검수 판으로 결속돼 **불변**이다. 하나라도 바뀌면 새 `release_key` 다. 옛 키의 기록은 남긴다.
  본문이 같은 두 원천 판본에서 각각 정당하게 다시 만들고 다시 검수한 판본은 서로 다른 발행 키를 받는다.
- 원천 · 기준을 바꾸면 새 작업 이름(새 revision)으로 내보낸다. 같은 이름에 다른 내용을 덮는 것은 거부한다.
  원천 URL · 내용 · 권리 기록이 바뀌어도 발행 스냅숏을 조용히 덮지 않는다 — 새 스냅숏(새 정체) → 새 판본 결과 → 새 검수 → 새 발행본.
- 계획 상태: `candidate`(로컬 후보) · `fixture_only`(합성이라 실제 발행 대상 아님) · `hold`(사유 목록) · `pending`(결과 없음/작업 중).
- **`hold` 는 학습자 발행을 막는다.** 관리자만 보는 초안 · 검수 저장(보류 판본의 내용 · 사유 · 검수 이력 보관)은 막지 않는다 —
  S3 에서 그 저장소를 학습자 노출과 분리된 자체 SQL · RLS 로 설계하고 승인받는다. 학습자 쪽 목록 · 직접 링크 · 등록 · 리더는 발행본만 연다.
- **`candidate` 는 DB 발행 허가가 아니다.** 미리보기는 `db_write:false` · `publish_permission:'none_local_preview'` ·
  `structural_checks:'passed_structure_only'` 와 후속 확인 목록을 스스로 적는다.

| `requires_followup` | 뜻 |
|---|---|
| `db_publish_gate_not_implemented` | DB 스키마 · RLS · 직접 링크 차단 게이트가 없다(S3/S4) |
| `language_level_not_measured` | V-Level · 커버리지 실측 전 |
| `meaning_preservation_is_reviewer_judgment` | 의미 보존은 구조 검사가 아니라 검수 판단 |
| `learner_pilot_not_run` | 학습자 파일럿 전 |
| `human_review_not_performed` | 사람 검수 없음(AI 검수만) |
| `asset_rights_recheck_at_publish` | 자산이 있으면 발행 시 권리 재확인 |
| `synthetic_fixture_not_publishable` | 합성 자료 |

## 11. 상태 기계 (작업 폴더의 판본 하나)

```
export ─▶ edition: missing ─(에이전트가 <out>.inprogress 생성)▶ in_progress ─(이름 바꿈)▶ valid | invalid | incomplete
                                                         완성본+예약 공존 ▶ conflict
valid ─ export --stage review ─▶ review task(<key>.review-<12자>.task.json)
      ─▶ review: in_progress ▶ current | stale | invalid | incomplete | conflict
plan ─▶ candidate | fixture_only | hold | pending        (여기까지 구현 · DB 없음)
(S4 제안) candidate ─사람 승인 + DB 게이트▶ published ─철회▶ withdrawn(노출 · 열람 차단, 학습 이력 보존)
```

## 12. 학습자 진도 · 완료 계약 (DB 는 S3 · S5 적용 완료 · 화면 S5 코드 수용 · 실제 작품 · live 여정 미실행)

- 기존 runtime 은 `library_book_id` 중심이다: `enroll_library_book(p_book_id)` 가 챕터별 `texts` 를 만들고,
  `completeChapter` 는 같은 `library_book_id` 의 모든 `texts` 가 completed 면 도서 완료로 본다(`apps/web/src/lib/library/complete-chapter.ts`).
- 계약: 판본 발행본마다 **별도 읽기 도서 키**(`reading_identity.reading_book_key` = `release_key`)로 진도를 분리하고, `work_count_key` 로 작품 단위로 묶어 노출한다.
- 장면 맵 이동 · 판본 전환은 진도를 승계해 완료 · 숙달을 만들지 않는다(`progress_inheritance:'none'`).
- `counts_as_work_completion` 은 `complete_work` 판본(완전 스냅숏)만 참이다. 단편 일부 · 에피소드 완료를 원작 전권 완료로 올리지 않는다.
- **각색 완독 ≠ 원문 완독.** Story Edition · Easy Reader 전권 완독은 「그 작품을 (각색으로) 끝까지 경험했다」로 셀 수 있지만 원문 전문을 읽었다는 증거가 아니다.
  그래서 완료 이름을 `completion_label` 로 나눈다 — 각색 전권 `adapted_full_work` · 각색 일부 `adapted_partial`. Story 라인의 판본은
  `counts_as_original_text_completion:false` 로 고정이며, 원문 완독 이름 · 기록은 원본 라인에만 둔다. 화면 문구도 이 구분을 따른다.
- 같은 작품의 여러 판본을 여러 작품 읽은 것으로 세지 않는다(`countReleases` 의 `distinct_works`).
- **읽은 위치는 완료가 아니다.** 위치(마지막 · 가장 먼 단위)는 이동 기록일 뿐이다. 단위 완료는 학습자가 단위마다 명시적으로 표시한 기록이고,
  각색 전권 완료(`completed_at`)는 그 발행본의 **모든 단위**(0..unit_count-1)에 완료 기록이 있을 때 한 번만 생긴다. 마지막 단위로 건너뛰기 ·
  마지막 단위만 완료 · 중간 단위 누락은 완료가 아니다. 순서와 무관하게 전 단위를 덮으면 완료다. 완료 기록은 숙달 · FSRS 성공 · 원문 완독이 아니다.
- DB 쪽 계약은 S3 SQL 의 `story_record_position`(위치만) · `story_complete_unit`(단위 하나 완료) · `story_my_progress` 다(§15).
- **화면(S5, T-0176 작성자 구현)**: 서가 `/library/stories`(공개 · 작품별 HOOK · 편집 목표 · 로그인하면 내 진도)와 판본 `/library/stories/[releaseKey]`(`?unit=` 없음 = 입구, `?unit=N` = 단위 본문 · 로그인 필요).
  화면 렌더 · 새로 고침은 기록하지 않는다. 위치는 시작 · 이어 읽기 · 이동 클릭, 완료는 「이 단위 읽음 표시」로만 기록한다. 모든 저장은 서버에서 쿠키 세션 학습자 판정 →
  화면 주인(`expectedViewerId`)과 다르면 `viewer_changed`(RPC 0) → 읽기 문맥 확인 뒤에만 쓴다. 개인 내용(본문 · 앵커 · 진도 · 이력)은 브라우저 신원이 서버 viewerId 와 같다고 확인된 뒤에만 보이며
  이는 표시 · 요청 보호다(이미 받은 응답 바이트는 회수하지 않는다). 완료 문구는 전 단위 표시 뒤에만: `adapted_full_work` = 「각색 완독」, 그 밖 = 「이 부분 읽기 완료」 — 원문 완독 · 숙달 · FSRS 를 말하지 않는다.
- **읽기 문맥 RPC**: `public.story_reader_context(p_release_key, p_unit_index) returns jsonb`(목차 · 내 진도 · 고른 단위 앵커 인용 · 원천 메타 · authenticated 만 · 읽기 전용)는
  사용자 승인 SQL r3(SHA-256 `a57ef729cedddc9f6271370fa5f93595a1dca6e273230b741bdfffc535f161ab`)로 **공유 dev DB 에 적용됐다**(2026-10-25 · 원장 `20261025143031` ·
  `supabase/migrations/20261025143031_lcp_story_s5_reader_context.sql` — 머리말의 「제안 · 미적용」은 승인 당시 문구). 이 RPC 가 없는 환경(PGRST202)에서는 여전히 독서 화면이 「준비 중」이고 저장은 쓰기 RPC 에 닿지 않는다.
- **시작 전 선택 안내(D2 U1 · T-0187)**: 서가 판본 줄 · 로그인 전 판본 화면 · 작품 입구(`?unit` 없음)에 공개 정보로 보인다(단위 화면 · 필수 확인 · 자동 열림 · 이벤트 없음).
  - 출처는 발행본이 가리키는 불변 판본 자리 `edition_slots.production.target` 뿐이다(판본 artifact 에는 target 이 없다). 새 RPC
    `public.story_release_guidance(p_release_key text default null)`(anon + authenticated · 서가와 같은 이용 가능 범위 · 읽기 전용)가 자리 · 기준 · 판 · 원천을 발행본 행과 대조하고
    production 을 다시 해시해 발행 `target_sha256` 와 같을 때만 허용 목록을 돌려준다 — `target_cefr` · `cognitive.demand` · `background_knowledge.load`(등급) · `emotional_suitability.cautions`(저장 문장 그대로).
    `cognitive.note` · `background_knowledge.supports`(편집 의도 — 동작하는 도움 기능이 아니다) · `emotional_suitability.note`(줄거리 상세) · `goals` 는 싣지 않는다.
    주의 문장은 S2 Text 계약을 따른다 — 개수 · 길이 상한이 없으므로 RPC · 화면 검사도 상한을 두지 않는다(유효한 발행 데이터를 거부하지 않는다 · 문자열 그대로).
    SQL 은 커밋 때 `notify pgrst, 'reload schema'` 를 같은 트랜잭션에서 보낸다(별도 캐시 조작 단계 없음).
  - 화면: 「편집 판단 · 추론 부담 … · 배경지식 부담 … (측정한 값이 아니에요)」 한 줄 + 주의가 있으면 접힌 `<details>`(요약은 개수와 「펼치면 장면 내용이 조금 드러나요」만 — 장면을 쓰지 않는다).
    주의가 빈 배열이면 경고 요소를 만들지 않는다. 작품 입구에는 시작 행동 바로 위에 지금 실제로 동작하는 요청형 도움 한 줄(단위 화면의 「단어 뜻 보기」 ·
    원문 인용이 연결된 단위의 「원문 대응 보기」)을 둔다 — 편집 기준의 지원 의도를 기능처럼 말하지 않는다. RPC 없음(PGRST202) · 일시 오류 · 결속/모양 불일치(`story:guidance_mismatch` · 서가 CEFR 불일치)는 「주의할 내용이 없다는 뜻은 아니에요」라고 말하는 한 줄이며 서가 · 독서 · 진도는 그대로다.
  - 상태: 승인 v2 원문은 **공유 dev 적용 완료**(원장`20261026110732`, SHA`8648c24c…f22eac`). 적용 전/없는 환경은 여전히 「불러오지 못함」으로 구분한다. 복구는 권한 회수만의 별도 미실행안이다. 실제 새 안내·통합 검증은 [후속 결과](./lcp-story/D2_S7_FOLLOWUP.md)를 따른다.
- **S5 현재 상태(2026-10-25 적용 뒤)**:

  | 항목 | 상태 · 증거 | 남은 한계 |
  |---|---|---|
  | 코드 | T-0176 `9b39634c5` 독립 수용 · 로컬 main 코드 통합 `1a5253561` — 범위 vitest 35파일 769 · 격리 브라우저 34(1440/1280) · tsc · eslint 0 · skip 0 | 전역 `learner-routes` 의 `/csat/listening` 1 실패는 깨끗한 기준선에도 있는 기존 실패(전체 통과 아님) |
  | DB | r3 적용 · 새 RPC 1(authenticated 만) · 이벤트 2 · 기존 Story RPC 16 정의 · ACL 불변 · 원본/Story 15표 행 · 정의 지문 불변 | 복구 SQL 실행 승인 없음 |
  | 최초 live 확인(2026-10-25) | 익명 PostgREST: 서가 200 · 빈 배열 · 읽기 문맥 401/`42501`(노출 · anon 거부) · 실제 로컬 main Next/RSC PC1440/1280 빈 서가 · 비로그인 진입(개인 DOM · 넘침 · 페이지 오류 0) | 당시 Story 발행0으로 인증 본문/진도 여정 NOT_RUN. 아래 후속 결과와 구분 |
  | S7 실제 작품 후속(2026-10-26) | 정상 개발 학습자 A1440/B1280의 실제 본문·뜻/원문 도움·위치/완료 분리·새 정상 세션 복원·계정 전환/지연 응답 격리·철회 저장 거부를 확인. R1 이력 보존 및 R2 공개·진도 비상속도 검증 | 첫 실행 실패를 보존하고 진도를 초기화하지 않은 표적 재개로 수용했다. 실제 사람 흥미·이해·성장 및 별도 다음 작품 선택은 미검증. [단계별 결과](./lcp-story/S7_PILOT.md) |
  | 콘텐츠 · 교육 | 편집 목표는 목표일 뿐 진단 적합이 아니다 | 권리 확인 실제 작품 0 · 콘텐츠 적합 **NOT_RUN** · `PILOT_NOT_RUN` · 학습 효과 근거 없음 |

## 13. 학습 근거 정책 (`EVIDENCE_POLICY`)

| 키 | 값 | 뜻 |
|---|---|---|
| `reading_progress` | `reading_record_not_mastery` | 읽기 진도 · 열람 · 펼침은 숙달이 아니다 |
| `help_requests` | `no_level_or_preference_change` | 도움 요청만으로 수준을 내리거나 취향을 고정하지 않는다 |
| `deep_reading_factual` | `practice_record_not_independent_evidence` | 사실 정답 활동은 연습 기록이다 |
| `deep_reading_interpretive` | `not_scored` | 허용 가능한 해석은 채점하지 않고 근거 연결만 보여 준다 |
| `free_text` | `not_collected_not_scored` | 자유서술 응답 형식 자체가 스키마에 없다 |
| `fsrs` | `no_fsrs_success_from_reading_or_clicks` | 클릭 · 펼침 · 독서량을 FSRS 성공으로 기록하지 않는다 |

의미 탐구는 해설 덤프가 아니라 선택 → 근거 연결(`choose_evidence`), 인과 배열(`order_events`), 표현 비교(`original_bridge`) 같은 판단 구조다
([LEARNING_MODEL](./LEARNING_MODEL.md) 2026-10-23 교수 화면 원칙).

## 14. 자산 권리

- 원본 오디오 · 삽화 · 퀴즈를 판본에 자동 상속하지 않는다. 쓰려면 `assets[]` 에 선언하고, 자산별 권리(`rights_status=confirmed` + 근거) ·
  이 판본 본문과의 정합(`alignment=verified`) · 검수 항목 `assets` 통과가 모두 있어야 한다. 원천에서 상속하는 오디오 · 삽화는 원천의 해당 권리도 confirmed 여야 한다.
- **본문을 이루는 권리는 전부 확인돼야 한다**: `source_text` 와 선언된 `translation` 기록이 모두 `confirmed`(근거 · 확인자 · 시각)가 아니면
  계획은 `hold`(`rights_unconfirmed:source_text` · `rights_unconfirmed:translation`)다. 쓰지 않는 오디오 · 삽화 권리 기록은 본문 판본을 막지 않는다.
- 사이트 단위 PD 표지(`claimed_by_source`)로 판본 · 번역 · 삽화 · 오디오 권리를 확정하지 않는다. 근거가 없으면 보류다.
- 이 알고리즘은 법적 적법성을 판정하지 않는다. 권리 확인은 사람이 근거와 함께 기록한다. 로컬 파일의 권리 기록은 주장일 뿐이다(§0).
- 2026-10-26 사용자 명시 수용에 따른 위임 기록: 사람 사용자가 특정 고정 권리 자료를 근거로 직접 결정하고 AI 개발 admin의 기록을 승인한 경우, 기존 정상 인증 admin 경로로 그 결정을 기록할 수 있다. 원래 사람 결정의 참조·수신 시각·증거 해시와 AI 기술적 기록자를 구분해 보존한다. 인증 uploader를 실제 사람으로 표시하거나 AI 콘텐츠 검수를 사람 검수로 바꾸지 않는다. 해당 권리 결정은 source 자산 단위로 작용하며 다른 판본의 검수·증인·발행은 각각 필요하다. AI만의 검토나 계정 준비로 사람 결정을 대신하지 않는다. 이번 특정 결정과 범위는 [고정 자료 및 승인 기록](./lcp-story/S7_PILOT.md#2026-10-26-후속--14-권리-증거와-콘텐츠-안내-결함)을 따른다.

## 15. 노출 게이트 (S3 결정 · 공유 DB 적용 완료 · S4 증인 런타임)

live DB 실측(2026-10-25, [S3_DB_AUDIT](./lcp-story/S3_DB_AUDIT.md))과 코드 경로 감사([S3_CODE_PATHS](./lcp-story/S3_CODE_PATHS.md))로 원본 경로의 실제 동작을 확인했다:

| 원본 경로(live) | 실제 동작 | Story 를 `library_books` 행으로 두면 |
|---|---|---|
| `auto_curate_book` · `admin_force_publish_book` · 정책 `admin_curator_all_books` 직접 UPDATE · `scripts/lcp/publish-ready-books.mjs` | 검수 · 권리 근거 없이 `status='published'`(권리는 license 문자열 트리거 `copyright_safe_in_kr`) | 검수 없이 발행된다 |
| `trg_lb_enqueue` · 단어장 발행 트리거 · `failed` 30일 보관 cron | 새 행 · 상태 전이에 자동으로 붙는다 | 파이프라인 · 단어장이 붙는다 |
| `content_chunks` 정책 `authenticated_read_chunks` | 로그인 사용자 누구나 전체 본문 SELECT(도서 · 상태 열 없음) | 미발행 · 보류 · 철회 본문이 읽힌다 |
| `get_chapter_content`(DEFINER) · `texts` 직접 INSERT | 소유만 확인, 도서 상태 무관 — 미발행 도서를 가리키는 `texts` 를 만들면 본문이 나온다(정의상) | 철회 뒤에도 읽힌다 |
| `applyBookReadGate`(웹) | `status='published'` 조회 편의 함수 | **보안 보장이 아니다** |

**결정: Story 는 원본 표 · 함수 · 정책을 하나도 쓰지 않는 격리 스키마 `story` 에 둔다**(PostgREST 비노출 · `supabase/config.toml` 은 `public` · `graphql_public` 만 노출).
- `story.*` 표 12개: RLS 켜짐 · 정책 없음 · PUBLIC/anon/authenticated/service_role 에 스키마 USAGE · 표 · 시퀀스 · 내부 함수 권한 없음.
  원본 표에 FK 를 걸지 않는다(원본 도서 삭제 · 재처리를 막지 않는다).
- 문은 `public.story_*` RPC 16개뿐(SECURITY DEFINER · `search_path = pg_catalog, pg_temp` · 표는 모두 스키마를 붙여 부름):
  - 관리 9개 — authenticated 실행 · 내부에서 `auth.uid()` 의 `user_profiles` 역할 + `status='active'` 확인(`register_source` · `register_policy` · `submit_edition` ·
    `submit_review` · `record_rights` · `publish` · `withdraw` · `list_slots` · `get_bundle`).
  - 검증 증인 2개 — **service_role 만** 실행: `story_service_validation_input`(검증할 저장값 그대로) · `story_service_attest_validation`(증명 기록).
  - 학습자 5개 — 서가 `story_catalog`(anon + authenticated · 메타 · 진입 장면만) · 본문 `story_read_unit` · 위치 `story_record_position` · 단위 완료 `story_complete_unit` ·
    `story_my_progress`(authenticated).
- 원본 경로는 `story` 를 읽지도 쓰지도 않는다 — 저장소 코드 · 마이그레이션의 `story.` · `story_` 참조 0(코드 경로 감사 기준선). 그래서 원본 쪽 수정 없이 우회가 닫힌다.

**행위자.** DB 가 강제하는 분리는 「검수 계정 ≠ 판본 제출 계정」(검수자 세션 주장 ≠ 생산자 세션 주장도) · 「발행자 = admin 이고 제출 계정이 아님」 · 「권리 결정 · 철회 = admin」이다.
검수자와 발행 admin 은 같은 계정이어도 된다 — 실제 발행에 필요한 인증 계정은 최소 2개(예: curator 제출 + admin 검수 · 발행)이며, 세 사람을 요구하지 않는다.
live 감사(2026-10-25)는 active admin 1 · curator 0 을 보았다 — 두 번째 인증 스태프 계정은 **실제 발행 · 운영의 전제**다(빈 스키마 설치의 전제는 아니다 — SQL · preflight 는 계정 수를 검사하지 않는다).

2026-10-26 사용자 승인으로 기존 관리자를 유지하면서 개발용 AI 제작 curator · AI 검수 admin · 학습자 2개를 정상 Auth로 생성했다. 승인된 역할 DML 원문과 적용 기록은 [dev-accounts](../scripts/db/lcp-story-s3/dev-accounts/README.md)에 있다. 정상 비밀번호 로그인·새 SSR 쿠키의 `getUser()`·역할/권한 23검사를 통과했다. 계정은 개발용이며 실제 사람 검수·권리 결정·실사용 학습자 증거가 아니다.
2026-10-25 최초 감사에서는 계정 추가·역할 부여를 승인받거나 실행하지 않았다. 위 2026-10-26 후속 승인·구성 완료와 구분한다. 로컬 AI 세션 id 자체는 인증된 스태프 계정이 아니다.

**검증 증명(발행의 마지막 문).** 초안 · 검수는 검증 없이 저장된다(학습자에게 보이지 않는다). 발행은 백엔드 서비스 주체가 쓴 증명이 **지금 저장된 결속**과 맞을 때만 된다:
1. service_role 이 `story_service_validation_input(판 id)` 로 저장값 그대로(`snapshot` = 저장 메타 + 본문 + 본문 해시 · `policy` · `artifact` · 그 판의 `reviews` 전부)를 받는다.
2. S2 어댑터 `buildValidationAttestation({ validationInput, now })`(`packages/library-pipeline/src/story/attest.ts`)가 `validateSnapshot` · `validatePolicy` · `validateEdition` ·
   모든 검수 `validateReview`(현재 결속)를 실제로 돌린다. 하나라도 어기면(앵커 누락 · 거짓 진입 장면 · 허위 인용 · 범위 밖 구간 · 정렬 누락 · 보존 누락 · 민감 처리 누락 ·
   요청 활동 누락 · 낡은/다른 판 검수 · 합성 자료 · 잘못된 시각) 증명을 만들지 않고 단계(`input`/`snapshot`/`policy`/`edition`/`reviews`)와 오류를 돌려준다.
3. 통과하면 결속 `{source_sha256, source_identity_sha256, policy_sha256, target_sha256, edition_sha256, activities_sha256, review_sha256s(그 판 검수 전부, 오름차순)}` 과
   증명 `{schema:'lcp-story/validation-attestation@1', validator, binding, checks(4개 valid), validated_at}` 를 `story_service_attest_validation` 으로 쓴다.
   DB 는 정확히 그 다섯 키만 받고, 결속을 저장값에서 다시 계산해 대조하며, DB 시계(`clock_timestamp()`)보다 30초 넘게 앞선 `validated_at` 을 거부한다
   (**시계 계약**: 백엔드 서버 시계는 DB 와 30초 안으로 동기화돼 있어야 한다. 어댑터는 주입받은 `now` 를 쓴다).
4. `story_admin_publish` 는 지금 결속의 증명이 없으면 `story:validation_attestation_missing` 으로 실패한다. 증명 뒤 검수가 더해지면 결속이 바뀌어 다시 증명해야 한다.
   발행은 **현재 검증기 계약판**(`story.current_validator()` = `{name:'lcp-story-s2', contract:'lcp-story/s2@1'}`)으로 쓴 증명만 인정한다. 발행본은 자신을 허가한 증명 id 를 기록한다.
- DB 는 S2 구조 검증을 SQL 로 다시 구현하지 않는다(제출 RPC 의 일부 검사는 방어용일 뿐이다). 클라이언트가 보낸 `validated` 같은 값은 어디에서도 믿지 않는다.
- authenticated · curator · admin 은 증인 RPC 실행 권한도 표 권한도 없어 증명을 쓸 수 없다. 증인 RPC 는 실행 권한(service_role 만)에 더해 **JWT 역할 주장이 실제로 `service_role`** 이어야 한다 —
  주장이 없거나(소유자 · SQL 편집기 · MCP SQL 세션) 깨졌거나 서로 다르면 `story:service_role_required` 다. PostgREST 의 service_role 요청은 이 주장을 항상 싣는다.
  서비스 주체는 증인일 뿐 생산자 · 검수자 · 권리 결정자 · 발행자로 기록되지 않는다(`action_log.actor_kind='service_validator'` · `actor` 없음).
- **신뢰 경계**: 증명은 「service_role 자격을 가진 백엔드가 S2 통과를 주장했다」는 기록이다. S2 가 실제로 돌았다는 암호학적 증거가 아니다 —
  service_role 키를 가진 주체는 결속을 맞춘 증명을 손으로 쓸 수 있다. 보호 수단은 그 키의 보관과 백엔드 어댑터 경로다.
- **S2 규칙을 강화하면** 어댑터의 `ATTESTATION_VALIDATOR.contract` 와 DB `story.current_validator()` 를 함께 올리는 새 승인 마이그레이션이 필요하다 — 그러면 옛 계약판 증명은 발행을 허가하지 못한다.
- **증인 런타임(S4, 독립 수용 완료 · T-0174 `fcf57c225e2a`)**: `lib/library/story/witness.ts` 가 위 1~3 을 이 순서로만 한다 — 쿠키 세션의 활성 스태프(admin · curator) 확인이 실패하면 service_role 클라이언트를 만들지도, 어떤 RPC 도 부르지 않는다.
  `story_service_validation_input` 응답을 복사 · 정규화 없이 어댑터에 넘기고, 통과했을 때만 `story_service_attest_validation` 을 부른다. 클라이언트가 보낸 증명 · 검증 결과는 받지 않는다(입력은 판 id 하나).
  증인은 관리자 화면의 「검증 실행」 버튼(명시적 액션)으로만 돈다 — 목록 · 번들 읽기 · 화면 진입은 증인 · 권리 · 발행 요청을 보내지 않는다(격리 브라우저 하네스가 요청 기록으로 단언). 증인 뒤 발행은 별개의 쿠키 세션 `story_admin_publish` 다.
  이 런타임은 공유 DB 에서 실제로 실행되지 않았다 — 검증은 가짜 클라이언트 시험과 격리 하네스(실제 서버 로직 + 메모리 가짜 DB)까지다. 증인이 배포되지 않은 환경에서는 여전히 발행이 막힌다(fail closed).

**발행본 유일성.** 같은 원천 판본(`source_id` = 원천 정체) · 같은 판본 키에 살아 있는 발행본은 하나다(편집 기준을 다시 등록해 판본 자리가 새로 생겨도 같다) —
두 번째 발행은 `story:live_release_exists`. 철회하면 그 자리를 새 발행본이 이어받을 수 있다. 원천 판본이 다르면(다른 스냅숏 · 정체) 같은 작품이라도 각자 발행본을 가질 수 있다.
같은 스냅숏을 동시에 등록해도 한 행만 생기고 둘 다 성공한다(`created=false` 가 기존 행을 돌려준다).

**권리 — 열람 때마다.** 발행본 「이용 가능」 = 철회되지 않음 AND 필요 권리(원문 `source_text`, 그리고 원작 언어 ≠ 본문 언어이거나 스냅숏이 번역 권리를 주장하면 `translation`)의
최신 인증 결정이 모두 `confirmed`. 서가 · 본문 · 위치 · 단위 완료 · 내 진도(`release_available`) · 발행이 같은 판정을 쓴다. 나중의 `hold` · `rejected` 는 발행본 행을 바꾸지 않고
즉시 열람을 닫고(이력 · 진도 보존), 다시 `confirmed` 면 열린다. 쓰지 않는 오디오 · 삽화 결정은 본문을 막지 않는다. DB 권리 결정은 스냅숏의 권리 주장 · 원천 정체를 고쳐 쓰지 않는다 —
로컬 plan 의 권리 `hold`(§14)는 스냅숏 주장에서 나온 별개 판정이며, DB 결정으로 그 판정을 우회하지 않는다.

**동시성.** 관리 · 증인 변경 RPC 의 잠금 순서는 `story.sources` → `story.edition_slots` → `story.releases`(FOR UPDATE)다(원천 등록은 잠글 행이 아직 없고,
학습자 위치 · 완료 RPC 는 외래 키의 KEY SHARE 만 잡는다). 「현재 판」은 판본 자리 잠금을 쥔 채 계산한 max(seq)다.
권리 결정은 원천 잠금을 쥐므로 동시 발행이 보류를 넘어 다시 열 수 없다. 발행 · 증명은 READ COMMITTED(PostgREST 기본)에서만 실행된다(`story:read_committed_required`).

**진도.** §12 의 위치 ≠ 완료 계약을 DB 가 강제한다: `story_record_position` 은 이동만, `story_complete_unit` 은 단위 하나(중복 무해 · 위치도 옮김), 발행본 완료는 전 단위 완료 기록이 있을 때 한 번.
진도는 발행본별이고 원본 `texts` · 학습 · FSRS 표를 쓰지 않으며 다른 판본 · 발행본으로 승계하지 않는다.
- 위 표의 원본 노출(`content_chunks` · `get_chapter_content`)은 **원본 LCP 자체의 기존 결함**이다. Story 와 무관하게 남아 있으며, 고치려면 원본 객체 변경이 필요해 이 작업 범위 밖이다(별도 작업 · 승인 필요).
- 철회는 노출 · 열람을 막되 학습 이력을 지우지 않는다.
- **학습 기록 보존의 한계**: S3 의 Story 위치 · 단위 완료 기록에는 지우는 경로가 없다(불변 트리거 · `auth.users` FK 없음). 계정 삭제 때 이 기록을 어떻게 할지는
  이 단계에서 정하지 않았다 — 별도로 승인된 설계가 필요하다.
- **복구 뒤 다시 열기**: 복구 SQL 은 RPC 실행 권한만 회수한다. 다시 열려면 새 SQL 파일 · 새 러너 단계 · 새 사용자 승인이 필요하다(지금 러너 단계는 schema · quarantine 둘뿐이다).
- 학습자 노출 게이트와 별개로, 관리자 전용 초안 · 검수 저장(보류 판본 포함)은 학습자 경로에서 읽히지 않는 자체 RLS 로 둔다(§10).
- 로컬 드레인의 권리 · 대응 도서 · 생산자 · 검수자 기록은 입력이 주장하는 값이다(§0). DB 로 옮길 때 인증된 관리자 신원 · 권한으로 다시 기록하고,
  로컬 값을 권한 근거로 쓰지 않는다.
- DB 구조 · 데이터 변경은 SQL 전문 · 전체 SHA-256 · 영향 범위 · 복구 SQL 을 대화에서 보이고 사용자가 승인한 뒤 **승인형 배포 러너**
  (`scripts/db/<id>/deploy.mjs apply --stage <s> --confirm-sha <sha>`) 또는 Supabase MCP로 적용한다. 후속 사용자 지시(2026-10-25)로 MCP 쓰기 연결을 허용했으며,
  SQL 원본 해시·실행 결과·전후 검증과 도구의 승인 확인을 유지한다. 데이터 삭제·DROP·TRUNCATE는 별도 명시 승인이다.

## 16. 추천 (S6 제안)

검수된 판본 중 **제공 가능 → 언어 적합 → 관심 · 목표 → 분량 · 반응 → 다양성 조정** 순서로 고른다. 개인별 즉석 생성은 초기 제외.
미진단은 `unknown` 이며 점수 0 이 아니다. 미평가도 0 이 아니다. 도움 요청만으로 수준을 내리거나 취향을 고정하지 않는다.

## 17. 이벤트 (S5 — 코드 구현 · DB 허용 목록 적용 완료)

새 공개 화면은 진입 + 내부 상호작용 이벤트를 같은 커밋에 둔다(AGENTS D2). 속성은 숫자 · 불리언 · 닫힌 열거형만(D3) —
본문 · 원문 · 자유 텍스트 · UUID · URL 을 넣지 않는다. 세부 식별자는 서버 쪽 데이터 계약에서 다룬다.
이벤트 이름은 `apps/web/src/lib/analytics/events.ts` 와 DB `funnel_events_event_check` 허용 목록 **둘 다**에 있어야 한다(후자는 마이그레이션 = DB 승인).
- `story_catalog_viewed {works, editions, signed_in}` — 서가 데이터를 받은 뒤 한 번(조회 실패 때는 보내지 않는다).
- `story_reader_action {action: start|resume|navigate|unit_complete|source_open|edition_switch, kind, coverage, unit_index, completed}` — 저장 행동은 RPC 성공 뒤에만(실패 · 버린 응답은 보내지 않는다). 발행 키 · 제목 · URL · 인용 · 사용자 id · 고른 낱말은 싣지 않는다.
- 코드와 DB 둘 다에 있다. DB 허용 목록은 승인 SQL r3 §C 로 적용됐다(원장 `20261025143031` · 기존 식 보존 + 두 이름 추가). 적용 뒤 실제 CHECK 식을 SELECT 로 평가해
  현재 `EVENT_REGISTRY` 62개 이름이 모두 허용됨을 확인했다. 행을 쓰는 코드 ⊆ DB 시험(`db-allowlist.integration.test.ts`)은 공유 DB INSERT/DELETE 승인이 없어 **NOT_RUN** 이다.

## 18. 관리자 화면 (S4 — 독립 수용 완료 · T-0174 `fcf57c225e2a`, T-0174)

`/admin/curation` 맨 위 「작업 라인」에서 **원본 도서**와 **이야기 판본**(`line=story`)을 고른다. 라인 전환은 `line` 하나만 바꿔 원본 라인의 보기 · 검색 · 필터 · 쪽 · 선택 URL 이 그대로 남는다.
이야기 라인 URL 에는 식별자만 둔다(`story_slot` · `story_panel=files`) — 원문 · 파일 내용은 URL · 브라우저 저장소에 넣지 않는다. 화면 · 경계 표는 [ADMIN_CONSOLE §/admin/curation](./ADMIN_CONSOLE.md).

- 흐름(구현됨): 후보 파일 검사(서버가 S2 검증기 · plan 으로 재검사, DB 쓰기 없음) → 원천 등록 → 편집 기준 등록(판본 자리) → 판본 제출 → 다른 스태프 검수 → admin 권리 결정 → 검증 증인(버튼) → admin 발행 → 철회.
  §18 초안의 「반응」 단계(학습자 반응 관찰)는 S5 이후다.
- 판본 자리를 고르면 판본 단위를 고르는 대로 그 단위의 원문 구간이 강조되고 그 단위의 변경 기록만 남는다(원문 · 각색 · 변경 내역 비교). 현재 판 · 검수 · 권리 · 증명 · 발행본 상태와 다음 행동 하나를 보인다.
- **부분 성공 · 재개**: 등록은 원천 → 편집 기준 → 판본 RPC 여러 번이며 **원자적이 아니다**. 뒤 단계가 실패하면 앞 단계 저장 결과를 그대로 보이고, 같은 파일로 다시 등록하면 기존 행(`created=false`)을 돌려받아 이어 간다. 롤백을 주장하지 않는다.
- **source_url**: 스냅숏 값은 다듬지 않고 RPC 에 넘긴다(정체 해시에 포함). 화면은 저장값을 바꾸지 않고 보이며 http/https 만 링크로 만든다.
- **인증 계정 분리**: 제출 계정은 같은 판을 검수 · 발행할 수 없다. 실제 발행에는 인증 스태프 계정이 최소 2개 필요하다(§15 행위자). 이 조건을 물리적 사람 콘텐츠 검수자 2명으로 해석하지 않는다. AI 검수와 개발 계정 사용은 출처를 그대로 기록한다. 2026-10-26 승인된 개발 계정 4개를 구성했으며, 실제 발행은 아직 하지 않았다.
- 도움말: `apps/web/src/lib/admin/help/curation.ts` 의 `tabs['이야기 판본']`(라인 라벨 문자열이 키). 관리자는 3B 스킨, PC 웹만. 이 라인은 계측 이벤트를 보내지 않는다.
- 검증 경계: 컴포넌트 수준 격리 브라우저 하네스(실제 클라이언트 컴포넌트 · 앱 CSS + Server Action 대역 뒤 실제 서버 로직 · 메모리 가짜 DB)와 가짜 클라이언트 서버 시험까지다.
  AdminShell 레이아웃의 requireAdmin · middleware · RSC 로딩 · 실제 쿠키 인증 · PostgREST/RPC · 실제 Server Action 전송을 포함한 live E2E 는 하지 않았다. DB 규칙은 S3 격리 PostgreSQL 17 시험이 검증했다.

## 19. 효과 검증 경계 (S7)

- 원문 · 흥미 진입 · 각색 효과를 섞어 교육 효과를 주장하지 않는다.
- 비교하려면 미노출 독립 평가 · 난도 · 사전 수준 · 재독과 같은 작품 공유의 영향 · 중도 이탈을 통제한다.
- 작은 파일럿은 사용성 · 내용 개선을 관찰하는 것이며 학습 효과를 입증하지 않는다. 합성 fixture 를 실제 도서나 전문가 검수로 부르지 않는다.
- 합성 에이전트(합성 학습자 역할) 워크스루는 **화면 · 인터페이스 점검**이다. 학습자 사용성 근거도 학습 효과 근거도 아니다.
  실제 참가자가 없으면 파일럿 상태는 `PILOT_NOT_RUN` 그대로다. 측정 계획은 [IMPLEMENTATION S7](./lcp-story/IMPLEMENTATION.md) 에 있다.

## 20. 로컬 제작 드레인 (S2 — 구현됨)

DB · 네트워크 · LLM API 를 쓰지 않는다. import · publish 명령은 없다. 작업 root 는 저장소 안이면 gitignore 된 `work/lcp-story` 를 쓴다
(원문 전문이 들어가므로 커밋하지 않는다).

```bash
pnpm exec tsx scripts/lcp/story/story.ts export   --root work/lcp-story --work <name> --source <snapshot.json> --policy <policy.json>
pnpm exec tsx scripts/lcp/story/story.ts validate --root work/lcp-story --work <name>
pnpm exec tsx scripts/lcp/story/story.ts export   --root work/lcp-story --work <name> --stage review
pnpm exec tsx scripts/lcp/story/story.ts plan     --root work/lcp-story --work <name> [--out plan.json]
# 재현용 시각 주입: --now 2026-10-25T09:00:00+09:00
```

| 파일(`<root>/<work>/`) | 쓰는 쪽 | 내용 |
|---|---|---|
| `source.snapshot.json` · `policy.json` | CLI | 입력의 정본 사본(키 정렬). 내보낸 뒤 고치면 무결성 오류 |
| `<key>.task.json` | CLI | 판본 과제: 결속 · 지시 · 원문 문단(오프셋 포함) · 기준 · 제작 항목 · 결과 템플릿 |
| `export.json` | CLI | 원장(마지막에 씀): 본문 해시 · 원천 판본 정체 해시 · 기준 해시, 사본 · 과제 파일 해시 |
| `<key>.edition.out.json` | 에이전트 | 판본 결과물 |
| `<key>.review-<12자>.task.json` | CLI | 검수 과제(현재 판본 결속) |
| `<key>.review-<12자>[.<slot>].out.json` | 검수 에이전트 | 검수 결과 |
| `plan*.json` | CLI(`--out`) | 계획 미리보기(검증 오류가 있으면 쓰지 않음) |
| `<결과>.inprogress` | 에이전트 | 작업 중 예약 — 시작할 때 만들고, 다 쓴 뒤 결과 파일 이름으로 바꾼다 |

- 종료 코드: `0` 성공 · `2` 대기(결과 없음 · 작업 중) 또는 계획 후보 없음 · `1` 오류. 실패를 0건 성공으로 삼키지 않는다.
- 쓰기는 임시 파일 → hard link(있으면 실패하는 원자적 생성). 같은 내용이면 no-op, 다른 내용이면 덮지 않고 실패. CLI 는 `*.out.json` 을 쓰거나 지우지 않는다.
- 경로: `--work` 는 `a-z0-9-` 이름만. 절대 경로 · `..` · 링크(Windows junction 포함)인 root/작업 폴더/결과 파일을 거부한다. 입력과 출력이 같은 파일(경로 · hard link)이면 거부한다.
- 인자: 명령은 `export` · `validate` · `plan` 셋만 받는다(`toString` · `constructor` 같은 이름도 예외 없이 사용법 오류 · 종료 1 · 파일 없음). 명령마다 정해진 옵션만 받는다.

| 오류 · 상태 | 뜻 | 복구 |
|---|---|---|
| `overwrite_refused` | 같은 경로에 다른 내용 | 원천 · 기준이 바뀌었으면 새 `--work` 이름(새 revision). 옛 폴더는 그대로 둔다 |
| `input_is_output` | 입력이 출력 파일과 같음 | 작업 폴더 밖의 입력 파일을 쓴다 |
| `workdir_tampered` · `workdir_file_missing` | 사본 · 원장 · 과제가 바뀌었거나 없음 | 사본을 고치지 않는다. 원래 입력으로 export 를 다시 하거나 새 `--work` 로 내보낸다 |
| `incomplete`(`result_incomplete` · `result_invalid_utf8`) | 빈 파일 · 해석 못 하는 JSON(쓰다 멈춤) · UTF-8 이 아닌 바이트 | 에이전트가 결과를 다시 쓴다(CLI 는 지우지 않는다) |
| `input_invalid_utf8` · `text_ill_formed_unicode` | 입력 파일의 잘못된 UTF-8 바이트 · 짝 없는 서로게이트 | 원천 · 결과를 올바른 UTF-8 / UTF-16 으로 다시 만든다(치환하지 않는다) |
| `edition_binding_stale` | 결과물이 다른 원천 판본 정체 · 본문 · 기준 · 목표에 대해 만들어짐 | 이 작업의 과제 파일로 다시 만든다. 다른 원천 판본의 결과물 · 검수를 옮기지 않는다 |
| `in_progress` · `conflict` | 예약만 있음 · 예약과 완성본 공존 | 작업 중이면 기다린다. 공존이면 어느 쪽이 최신인지 확인해 하나만 남긴다 |
| `leftover_temp_files` | 중단된 CLI 의 임시 파일(`.<이름>.tmp-<pid>-<8자>`) | 결과에 영향 없음. 다른 실행이 없을 때 지워도 된다 |
| `stale` 검수 · `review_stale` | 판본이 검수 뒤 바뀜 | `export --stage review` 로 새 검수 과제. 옛 검수 파일은 보존 |
| `time_in_future` | 기록 시각이 현재보다 뒤 | 시계 · 기록 확인(`--now` 는 재현용) |
| `plan_out_skipped` | 검증 오류가 있어 계획 파일을 쓰지 않음 | 오류를 고친 뒤 다시 실행 |

**합성 예시 재현**(저장소 루트, 결과물 자리에 합성 fixture 를 넣는다 — 실제 에이전트 결과가 아니다):

```bash
F=packages/library-pipeline/src/story/fixtures
pnpm exec tsx scripts/lcp/story/story.ts export --root work/lcp-story --work gull-rock-r1 --source $F/gull-rock.snapshot.json --policy $F/gull-rock.policy.json
cp $F/gull-rock.story-b1.edition.out.json work/lcp-story/gull-rock-r1/story-b1.edition.out.json
cp $F/gull-rock.easy-a2.edition.out.json  work/lcp-story/gull-rock-r1/easy-a2.edition.out.json
pnpm exec tsx scripts/lcp/story/story.ts validate --root work/lcp-story --work gull-rock-r1                 # 종료 0
pnpm exec tsx scripts/lcp/story/story.ts export   --root work/lcp-story --work gull-rock-r1 --stage review  # story-b1.review-29b915bc1785.task.json …
cp $F/gull-rock.story-b1.review.synthetic.out.json work/lcp-story/gull-rock-r1/story-b1.review-29b915bc1785.out.json
pnpm exec tsx scripts/lcp/story/story.ts plan     --root work/lcp-story --work gull-rock-r1 --out plan.json # 종료 2
```

결과: `story-b1` = `fixture_only`(`synthetic_source` · `synthetic_edition` · `synthetic_rights:source_text` · `synthetic_review:…`),
`easy-a2` = `hold`(`review_missing` + 합성 사유). 후보 0 이라 종료 2 다. 같은 상태의 plan 재실행은 no-op 이다.
fixture 의 판본 `task_id` 는 작업 이름 `gull-rock-r1` 에, 결속은 fixture 스냅숏의 원천 판본 정체에 묶여 있다 — 다른 작업 이름이면 `edition_task_mismatch`,
다른 원천 판본이면 `edition_binding_stale` 로 거부된다. 같은 root 에 이전 형식 · 다른 원천으로 내보낸 `gull-rock-r1` 이 이미 있으면 export 가
`overwrite_refused` 로 멈추고 옛 폴더를 보존한다 — 비어 있는 다른 `--root` 로 다시 실행한다.
