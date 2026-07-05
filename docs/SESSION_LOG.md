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

**작업**: 플랫폼 전체 "진입 → 닫기(돌아가기) → 제자리 복귀" 네비게이션 오류 점검 & 수정
**브랜치**: `feat/plan-ui`
**상태**: ✅ **감사 15건 + 경미 2건 전량 수정·tsc 통과·커밋 완료·CHANGELOG 반영 완료** (P0+P1=`f98c918` v06.135 / P2=`56cb8de` / 경미+CHANGELOG=v06.138)

- 5개 영역별 감사 에이전트 완료 → 확정 버그 **15건** (아래 2026-07-05 표) **전량 수정 완료**.
- **P0+P1 8건** (#1~#8, 커밋 `f98c918` v06.135): Plan/홈 `?from` · SpellForge/Flashcard 404 반환링크 · GlobalBodyReset 스크롤락 · WordBlitz 나가기 · Dictation back 가드 · ACP stage · AdminSidebar. 신규 `lib/layout/session-return.ts`. CHANGELOG v06.135 + CONVENTIONS "세션 제자리 복귀" 규약.
- **P2 7건** (#9~#15, 별도 커밋): 메인 Sidebar 하이라이트 · WordVaultBrowse `?from` 유지 · 구독 토스트 `?from` · focus 미복원 5모달 · VocabSet 스크롤락 · Type/Voice 팝오버 Esc · Diagnostic "그만두기". `tsc --noEmit` 통과.
- **경미 2건** (v06.138): ScriptQuiz 시작화면 back `/library` → `?from` ?? `/scriptquiz` · PairFlipResultScreen "PairFlip 홈으로" 복귀 링크. **CHANGELOG P2+경미 항목 v06.138로 반영 완료**(브랜치 정착 후).
- ⚠️ **동시 편집 세션 병행** — growth-stats(v06.136) · ACP(v06.137) · Curated Books refactor(`4d5ce5a`)를 다른 세션이 커밋 중. 내 커밋은 매번 **내 파일만 명시 스테이징**해 분리(무관 파일 unstaged 유지). 기존 무관 M 파일(MyLibraryTab.tsx, ADMIN_CONSOLE.md, LIBRARY_PIPELINE.md)도 제외.

**다음 세션 TODO(선택)**: (1) 필요 시 `next build` 전체 검증(현재 tsc만) · (2) `ContextBar.tsx` dead-code 삭제 여부 판단 · (3) 감사 P0~P2 UI 실주행 확인(런타임 미검증).

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
