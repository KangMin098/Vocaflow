# Vocaflow 세션 진행 로그 (SESSION_LOG)

> **목적** — 세션(대화)이 바뀌어도 작업을 매끄럽게 이어가기 위한 진행상황 누적 기록.
>
> **규칙**
> 1. 세션 종료(또는 논리적 구간 종료) 시 아래 **"세션 기록"** 섹션에 **최신 항목을 맨 위에 prepend**.
> 2. 문서 최상단 **"▶ 지금 이어서 할 일 (RESUME HERE)"** 블록은 매 세션 **통째로 덮어써** 항상 최신 상태만 유지 — 새 세션은 여기부터 읽으면 됨.
> 3. 이 문서가 너무 길어지면(대략 **800줄** 초과) `docs/SESSION_LOG_02.md` 를 새로 만들고, 이전 문서 하단 + 새 문서 상단에 **상호 링크**를 걸어 체인 유지.
> 4. 각 항목은 `날짜 — 제목` + `무엇을 했나 / 무엇이 남았나 / 관련 파일·커밋` 을 담는다.
>
> **관련 문서** — `docs/CHANGELOG.md`(릴리스 단위 요약) · `docs/AI_CONTEXT/`(메모리 미러, **자동 생성 — 수동 편집 금지**) · 외부 메모리 `~/.claude/.../memory/MEMORY.md`.

---

## ▶ 지금 이어서 할 일 (RESUME HERE)

**작업**: `/admin/vocab/*` VCB 파이프라인 프로세스·기능·화면 면밀 재검토·재설계
**브랜치**: `feat/plan-ui`
**상태**: 🔧 **Phase 1 정합성 완료 + Phase 2-A 시작** — 5커밋 push. VCB 파일 tsc 에러 0. 런타임 미검증(dev 서버 다운).

- **진단·재설계안**: [docs/proposals/vcb-admin-redesign.md](proposals/vcb-admin-redesign.md) (5영역 병렬감사 + DB실측). 실체 = run 1개(cast-2000)만 CLI로 발행한 반자동 개발자도구. P0 결함 8건.
- **Phase 1-A** (`e964567`): P0-2 service-role 일관화(13 server files → `createAdminClient`, dev-bypass 0건 해소) · P0-1 `qa→curating` 전이(`beginCuration`, dead-end 해소) · P0-3 큐레이션 500-cap 제거 · P0-4 `/admin/vocab/collections` 신설(404) · 신규 `lib/supabase/admin.ts`.
- **Phase 1-B** (`be1338e`): P0-5 큐레이션 일괄 승인/거절 배선(`VcbCurationView` 툴바).
- **Phase 1-C P0-6** (`7fc53f4`): publishable 정의 단일화(publish/precheck/approved_count) — 미검토 발행 차단. **DB실측 검증**: run#1 accepted 1998=발행 1998, 미검토 0, 회귀 0.
- **Phase 2-A** (`e5b479a`): stale/모순 카피(P5c) 제거 · 원시 status→라벨(STATUS_LABELS export) · 시드 방식 A/B "택1" 재라벨 · Method B jargon 정리.
- **남은**: **P0-7** publish 트랜잭션화(**DB 마이그레이션 RPC → 승인 필수**) · **edit UI**(rich payload, 런타임 검증 유의미) · Phase 2 잔여(step카드 jargon·VcbPipelineGuide 승격·섹션 내비) · Phase 3(위저드필터 dead 정리·CLI결합·큐레이션 UX·접근성 + 열린결정 A/B/C).
- ⚠️ **dev 서버 다운** — VCB 화면 런타임 검증은 재가동 후. ⚠️ **working-tree tsc red = 동시 세션 PlanClient(ACP WIP) 미정의 참조** (내 VCB 파일 아님; 그쪽 커밋 시 해소).
- 열린결정(제안서 §7): A 위저드필터 살릴지/제거 · B CLI결합 유지/제거 · C 도구지향(셀프서비스 vs 저빈도 전문가도구).

**직전 완료작업 (nav 감사, ✅ 종결)**: 커밋 `f98c918`(v06.135 P0+P1)·`56cb8de`(P2)·`5190c0c`(v06.138 경미)·`45e319b`(ContextBar 삭제)·`146070d`(vitest 99 pass). 상세는 아래 2026-07-05 기록.

---

## 세션 기록 (최신 ▲)

### 2026-07-05 — 플랫폼 네비게이션 "진입→닫기→제자리" 감사 (감사 완료, 수정 대기)

**요청**: 플랫폼 전체에서 `진입 → 닫기(돌아가기) → 제자리`(기본화면·팝업·탭 화면 등) 흐름을 점검하고 오류 수정.

**방법**: 공통 인프라 규약 파악 후 5개 영역별 병렬 조사 에이전트 실행. 핵심 규약:
- 풀스크린 세션(`components/layout/SessionFrame.tsx`): 닫기(X)/Esc → `?from=` 파라미터의 출처로 복귀, 없으면 `SESSION_META[path].closeHref`(모듈 hub). **진입 지점이 `?from=`을 안 넘기면 hub로 튕김.**
- 풀스크린 판정: `lib/layout/full-screen-routes.ts` — `*/play`, `/dictate/session`, `/play/*`, `/wordvault/browse`.
- 워크스페이스 진입은 `components/workspace/ModePills.tsx`의 `withReturn()`이 `?from=/text/[id]`를 올바로 부착(정상).
- 모달 참조 구현: `ui/Modal.tsx`, `ui/ios/SheetContainer.tsx`(Esc+backdrop+X, body scroll lock+cleanup, focus 복원).

**확정 버그 (우선순위순)**

| # | 우선 | 위치 | 증상 | 수정 방향 |
|---|---|---|---|---|
| 1 | **P0** | `lib/learner/plan-activities.ts:109-139` `activityLaunchHref` + `components/plan/PlanClient.tsx:571,927` + `components/home/TodayPlanCard.tsx:84` | Plan/홈에서 세션 진입 시 `?from=` 없음 → 닫기가 `/plan`·`/`가 아닌 모듈 hub로 (핵심 "제자리" 실패, feat/plan-ui 주력 기능) | `activityLaunchHref`에 `origin` 인자 추가 → 풀스크린 play 라우트에만 `from` 부착(`isFullScreenRoute` 재사용). 콜러가 pathname 전달 |
| 2 | **P0** | `app/(main)/spellforge/play/page.tsx:52,76` + `components/spellforge/SpellForge.tsx:380` + `SpellForgeCompletion.tsx:81` | play page가 `textId="vocab"/"script"/"all"` 리터럴 전달 → 종료 링크 `/text/vocab` 등 = **404** | page가 실제 `?text` id 전달; 링크는 유효 text 아니면 `/spellforge` fallback (또는 `?from`) |
| 3 | **P0** | `components/flashcard/CompletionState.tsx:148` (+ `FlashcardSession.tsx:210`, `lib/flashcard/scoped-words.ts:44`) | scoped 진입 시 `textId`=단어 id → 완료 "Workspace 돌아가기" = `/text/<wordId>` **404**; hub/SRS는 엉뚱한 원문으로 | 실제 `scope.text` 사용; word_set/hub는 `/flashcard`; `?from` 우선 |
| 4 | **P0** | `components/layout/GlobalBodyReset.tsx:46` + `app/(main)/text/[id]/page.tsx:407` | pointerdown 안전망 셀렉터가 실제 모달(`aria-modal="true"`, `aria-hidden` 없음)과 미매칭 → **모달 안 첫 클릭에 배경 스크롤락 해제**(거의 모든 모달). SheetContainer는 배경 절반 노출로 특히 티남 | 셀렉터에 `[role="dialog"]:not([aria-hidden="true"])` 추가 (두 파일 동일 수정) |
| 5 | P1 | `app/(app)/play/wordblitz/page.tsx:157` | 인게임 나가기 → `router.push(scoped ? '/text' : '/library')` (text id 유실, `?from` 무시) | `from` 읽어 이동, 없으면 `/wordblitz`; scoped는 `/text/${text}` |
| 6 | P1 | `components/dictation/DictationSetupClient.tsx:175` + `DictationSessionClient.tsx:256` | `router.back()` — 직접 진입(북마크/새로고침) 시 히스토리 없어 **앱 이탈** | `window.history.length>1 ? back() : router.push('/dictate')`; 세션은 `from ?? '/dictate'` |
| 7 | P1 | `app/admin/articles/CurationConsole.tsx:66` (useState) + preview back `/admin/articles` | ACP 기사 콘솔 stage가 프리뷰 복귀 시 '커버리지'로 리셋 (검수 큐 반복 진입 강제) | stage를 `?stage=`로 URL 동기화(참고: `VocabularyBrowserClient`) + 프리뷰 back에 stage 전달 |
| 8 | P1 | `components/admin/AdminSidebar.tsx:153-155` | `pathname.startsWith(item.href)` — `/admin/vocabulary`에서 VCB도, `/admin/vrl/automation`에서 VRL도 **동시 하이라이트** | 경계(`+ '/'`) + 최장일치 1개만 활성 |
| 9 | P2 | `components/layout/Sidebar.tsx:233` | 메인 Sidebar가 `/wordvault/study`·`/review`에서 WordVault 항목 하이라이트 안 됨(exact match) | 비루트 항목은 `pathname===href \|\| startsWith(href+'/')` |
| 10 | P2 | `components/wordvault/WordVaultBrowseClient.tsx:68-79` | 브라우즈 세션 챕터 이동 시 `?from` 재부착 안 함 → reload/bookmark 시 복귀 대상 유실 | `goToChapter`에서 기존 `from` 보존 |
| 11 | P2 | `components/library/vocab/SubscribeSuccessToast.tsx:57-59` | 구독 토스트 CTA `/wordvault/browse` 진입에 `?from` 없음 → 닫기가 `/library/vocab` 대신 hub | `?from=/library/vocab`(또는 현재 pathname) 부착 |
| 12 | P2 | `NetflixDetailSheet.tsx:142`, `VocabSetPreviewModal.tsx:78`, `ChapterQuizPreviewModal.tsx:34`, `ChapterWordSetPreviewModal.tsx:87`, `ArticleWordSetPreviewModal.tsx:36` | 닫기 후 트리거로 focus 미복원(body로 이동) | open 전 `document.activeElement` 저장 → cleanup에서 `prev?.focus()` (`ui/Modal.tsx` 패턴) |
| 13 | P2 | `components/library/vocab/VocabSetPreviewModal.tsx:72-80` | body scroll lock 없음(일관성 결여, 트랩은 아님) | `NetflixDetailSheet` 패턴 미러 |
| 14 | P2 | `components/workspace/TypePopover.tsx` + `VoicePickerPopover.tsx` | Esc 닫기 미지원(outside-click만) — a11y | Esc keydown 핸들러 추가 |
| 15 | P2 | `components/diagnostic/DiagnosticClient.tsx` (question/submitting) | 진단 진행 중 명시적 닫기/그만두기 affordance 없음 | 질문 헤더에 '그만두기' → phase `'start'` 복귀 |

**참고(비-라이브 / 의도적)**
- `components/workspace/ContextBar.tsx:51-52` — back을 `/library/books`로 하드코딩(user script엔 오답)이나 **미사용**(dead code). 부활 시 버그.
- `components/game/scriptquiz/ScriptQuiz.tsx:320` start/empty back → `/library` 하드코딩(경미).
- `components/pairflip/PairFlipGameScreen.tsx:100` 결과 화면에 원점 복귀 경로 없음(경미, 엉뚱한 곳으로 가진 않음).
- EchoMatch `/text/[id]/echo` 는 의도적으로 풀스크린 아님 — "본문으로" → `/text/[id]?mode=read` 정상.

**정상 확인 영역** — 워크스페이스 세션 진입(ModePills), `?preview=1` back 루프(UnifiedHeader→도서 개요, enroll redirect 우회), 대부분 모달/시트 닫기 위생(Esc+backdrop+X, scroll cleanup), 스크롤락 leak **없음**(GlobalBodyReset가 오히려 과잉 해제 — #4), WordVault hub 탭(`?view=` URL 구동), Reports/Teacher(탭 없음), 진단 history back(하드코딩 Link 안전).

**남은 것**: 위 표의 수정 적용 (우선순위 배치) → typecheck → docs(ROUTES/CONVENTIONS/CHANGELOG 해당분) 갱신 → 커밋. 진행 방식(전체 일괄 vs P0+P1 우선 vs 검토 후) 사용자 선택 대기 중.
