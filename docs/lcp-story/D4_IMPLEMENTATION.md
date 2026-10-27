<!-- docs/lcp-story/D4_IMPLEMENTATION.md -->
# LCP D4 구현 결과 — 학습자 Story UX 최소 4단위 (T-0190)

2026-10-27 · Claude Code(기존 세션 `25e83007-cf44-4c42-9750-16d5a98a9764` · 브랜치 `feat/lcp-story-20261025` · 기준 `8c12addbe`) 구현 ·
**독립 Codex 검토 · 커밋 · main 통합은 이 문서 작성 시점에 미실행(코디네이터 소관)** · 실제 학습자 적합성 · 교육 효과 **UNVERIFIED**.
설계 정본: [LCP_D4_UX.md](./LCP_D4_UX.md)(감사 · 시안 · 수용 기준 — 이 문서가 바꾸지 않는다). 증거 루트 **R** = `D:/workspace/Vocaflow-AI-Control/runtime/lcp-story-20261025/d4-implementation-20261027`.

## 1. 단위 대응(사용자 W1~W4 ↔ D4 논리 단위)

| 사용자 | D4 단위 | 구현 |
|---|---|---|
| W1 | UX01 로그인 복귀 | 서가 「로그인하고 읽기」가 공용 `loginUrlWithReturn(readerHref(releaseKey, null))`로 **고른 판본 입구**로 돌아온다(이전: 서가 일반 복귀). 새 Auth · 토큰 저장 · 복귀 파서 없음. 돌아온 뒤 기존 서버 판정(로그인 · 계정 · 발행 · 권리)이 다시 확인 |
| W2 | UX01 시작 + UX02 단위 머리 | 입구: 첫 장면 **첫 문장**(저장 HOOK 앞부분 그대로 · 호칭 약어에서 자르지 않음) → 편집 목표(진단 아님) → 부담 · 접힌 주의 → 시작 행동 → 선택 펼침(첫 장면 전체 · 원천 판본 · 도움 사용법). 로그인 전 판본 화면도 같은 순서. Stories 경로의 장식 머리띠(ModuleBanner) 생략. 단위 화면: 작품 이름은 작은 복귀 맥락, 단위 제목이 h1, 본문 판면(19px · 1.75 · 약 610px) 그대로 |
| W3 | UX02 맥락 진입 + UX03 단어 키보드 | 도구 줄에 「이 단위의 시대적 맥락 N가지」(결속된 ready 설명이 있을 때만) → 기존 접힌 설명을 열고 요약에 초점 · 「읽기 도구로 돌아가기」 · Esc 복귀. 단어 창: Stories 만 켜는 비모달 초점(`nonmodalFocus`) · 44px 「뜻 보기 · 낱말」 대체 단추 |
| W4 | UX04 이어 읽기 · 다음 | 「마지막으로 연 단위 N/M」(문장 · 스크롤 위치 아님) · 입구 문구 「그 단위 첫머리부터」. 전 단위 표시 뒤 다음 행동은 **본문 한 곳**, 실제 서가 공급에 맞춤: 다른 작품이 있으면 「다른 이야기 고르기」, 없으면 「지금 공개된 다른 이야기는 없어요」+「Stories 둘러보기」+ 단위 화면의 「처음부터 다시 보기」, 서가 조회 실패면 중립 「Stories 서가로」 |

## 2. 변경 파일(제품 17 + 문서 4)

`apps/web/src/components/library/story/{StoryCatalog,StoryReader,StoryUnitText,StoryContextNotes}.tsx` · `story-view.ts` · `story.module.css` ·
`__tests__/{fixtures.ts,story-render.test.tsx,story-view.test.ts}` · `apps/web/src/components/library/reader/WordLookupPopover.tsx` ·
`apps/web/src/components/layout/ModuleBanner.tsx` · `apps/web/src/lib/library/story/{learner.ts,learner-types.ts,__tests__/story-learner.test.ts}` ·
`apps/web/src/app/(main)/library/stories/page.tsx` · `apps/web/tests/e2e-isolated/lcp-story-reader.isolated.spec.ts` · `apps/web/scripts/build-lcp-story-reader-harness.mts` ·
문서 `docs/lcp-story/D4_IMPLEMENTATION.md`(이 파일) · `LCP_D4_UX.md`(맨 위 현재 결과 링크 한 줄) · `docs/MODULES.md` · `docs/CHANGELOG.md`.
SQL · 마이그레이션 · Auth 공통(`lib/auth/**`) · 계정 · 이벤트 · 표 · 관리자 도움말 변경 없음.

데이터 경계: 로더는 이미 읽던 같은 `story_catalog` 행에서 다른 작품 수(`otherWorks`)만 더 센다(새 RPC · 추천 API 없음 · 실패 = null). 맥락 진입은 기존 `contextNotes` 의 ready · 현재 release/unit 결속 · 인증 same 일 때만 생긴다.

## 3. 시험 · 검증(실제 종료 · 로그 R/logs)

| 검사 | 결과 | 종료 |
|---|---|---|
| 단위 첫 실행 `vitest run …story …reader` | 5 실패(의도한 문구 · 순서 변경을 옛 기대가 잡음) — 기대를 새 계약으로 고침(보호 단언 유지) | 1 (보존) |
| 단위 최종 `vitest run src/components/library/story src/lib/library/story src/components/library/reader src/components/layout` | 14 파일 · **447 통과** | 0 |
| 타입 `tsc --noEmit -p apps/web` | 통과(첫 실행의 fixture 타입 오류 2건은 같은 작업에서 고침) | 0 |
| 범위 lint(변경 web 파일 16) | 통과 | 0 |
| 격리 브라우저 전체 1차 | 32 통과 · 8 실패(로그인 복귀 · HOOK 미리보기 · 도움 줄 위치 · 확인 중 HOOK — 의도한 변경) | 1 (보존) |
| 격리 D4 신규만 | 2 통과(1440 · 1280) | 0 |
| 격리 브라우저 전체 2차(최종) | **42 통과**(기존 40 + D4 2) · 실패 0 · 건너뜀 0 | 0 |
| 실제 dev 미리보기 run1 · run3 | 60 · 60 검사 PASS | 0 · 0 |
| 실제 dev 미리보기 run2 | 1440 첫 본문 y 398 1건 FAIL — 공통 셸(CompassRibbon/탭 줄)이 늦게 접히는 순간 측정. run3 에서 안정 대기 · 첫 값 함께 기록(318 → 318) | 1 (보존) |

격리 시험이 지키는 기존 경계(그대로 통과): 인증 확인 중 · 계정 전환 · 늦은 응답 폐기 · 저장 실패/응답 유실 · 철회 · 권리 보류 · 빈 서가 · 조회 실패 · 맥락 설명 결속 · 위치 ≠ 완료 · 판본별 진도(승계 없음).
D4 신규 격리 시험: 판본별 로그인 복귀 · 입구 순서 · 단위 h1 · 맥락 진입(Enter 열기 → 요약 초점 → 돌아가기 → 토글 → Esc 복귀 · 쓰기 0 · 주소 그대로) ·
**실제 `WordLookupPopover` 컴포넌트**(하네스는 Supabase 클라이언트만 합성 사전으로 대역 — 창은 실제 코드)의 창 초점 · 이름 · aria-modal 없음 · Tab 창 안 · Esc/닫기 → 같은 낱말 · 스크롤 그대로 · 로빙 탭 정지 1 · Home/End · 44px 단추 → 단추 복귀 · Tab 이탈 시 닫힘 · 계정 전환 시 진입 · 창 · 설명 사라짐 · 공급 1편/여러 편 완료 문구(가짜 DB 진도 · 서가 숨김으로만).

## 4. 실제 dev 화면(소유 미리보기 3015 · 정상 Auth · C01 R2 · 읽기 전용)

미리보기: `node next dev -p 3015`(이 작업 트리 · `DEV_ADMIN_BYPASS=0` · 공개 Supabase URL/anon 키만 메모리 전달). 학습자 A=1440 · B=1280 × 1000. 허용 POST = 정상 로그인 · `lookup_word_meaning` 뿐 — 막힌 POST 는 모두 분석 이벤트였고 서버 액션(위치 · 완료) 시도 0. 시작 · 이동 · 완료 버튼은 누르지 않고 단위는 GET 주소로 열었다. 공유 DB 쓰기 · 계정 · 발행 변경 없음. 실제 공개 = 작품 1편 · 판본 1개(R2).

| 측정(1440 · 1280 같음) | 이전(D4 감사) | 이후(run3 · 안정값) | 목표 |
|---|---|---|---|
| 입구 시작 행동 y | 826 | **575.9** | ≤ 620 |
| 단위 u03 첫 본문 y | 453 | **318** | ≤ 360 |
| 본문 글자 · 줄 높이 · 폭 | 19px · 33.25px · 610.22px | 19px · 33.25px · 610.22px(11문단 · 넘침 0) | 유지 |
| 서가 첫 작품 y(익명) | 약 489(머리띠 포함) | 324.3 | — |
| 주의 요약 y < 시작 y | — | 442.1 < 575.9 | 시작 전 접근 |

실제 확인: 서가 로그인 링크 next = `/library/stories/lsr_58490bb…` → 정상 로그인 → **같은 판본 입구**(경로 일치) · 직접 판본 로그인 복귀도 그 판본 · u03 맥락 진입 2 · u04 1 · u01 없음 · 키보드 열기 → 요약 초점 → Esc → 진입 복귀 · 실제 사전 `hat`(모자 · 예문 · 관련어) 창 초점 · Tab 창 안 · Esc → 같은 낱말 · 스크롤 변화 없음 · 44px 단추(높이 44) → 단추 복귀 · 창은 뷰포트 안 · 원문 대응 그대로 · 마지막 단위 열기 ≠ 완료 · 철회 R1 본문 0.
캡처: `R/live/run-2026-10-27T013638893Z/`(서가 익명/인증 · 입구 익명/인증 · 주의 · 상세 펼침 · u01/u03/u04 · 맥락 열림 · 단어 창 · 원문 · 마지막 단위 · 철회). 비교: `R/compare/compare.html`(이전 · 시안 · 이후).
실제 dev 학습자 A/B 는 R2 진도가 없어 **완료 뒤 공급 문구는 실제 dev 에서 관측하지 못했다**(쓰기 금지) — 합성 fixture 로만 확인.

시각 반복: 1회 — 진입으로 연 설명이 화면 아래 끝에 걸리던 것을 `block:start` + `scroll-margin-top` 으로 고정 머리 아래 첫머리가 보이게 고쳤다. 요구 정보를 지워 목표를 맞추지 않았다.

## 5. 지키는 계약

같은 판본(release) 진도 · 명시적 읽음 표시 · 판본 사이 진도 승계 없음(R1/R2 기록 보존) · GET 무기록 · 인증 확인 중/바뀜에는 개인 내용 · 진입 · 창 없음 · 오류/미적용/어긋남을 「없음」으로 바꾸지 않음 · 공개 경계(로그인 전 본문 · 목차 · 앵커 · 맥락 없음) · 다른 독서 화면의 `WordLookupPopover` 기본 동작(초점은 누른 낱말에 남음) 그대로 · 새 이벤트 · 표 · 추천 · 퀴즈 · 진단 · 보상 없음 · 지어낸 장르 · 소개 · 적합 판정 · 예상 시간 없음.

## 6. 접근성 · 스크린리더

DOM · 키보드 · axe(기존 U1/W2 범위) · 실측 44px 은 확인했다. **실제 스크린리더 사용: NOT_RUN** — NVDA 미설치(설치하지 않음), Windows 내레이터는 있으나 음성 출력을 관찰 · 기록하지 못해 실행했다고 하지 않는다. 비모달 창은 이름 · `aria-describedby` · `aria-busy` · 뜻 영역 `aria-live=polite` 를 갖지만 실제 낭독 순서 · 알림은 미검증이다.

## 7. 남은 한계 · DEFER

- 철회 · 예외 화면의 「먼저 5분 진단…」 줄(F10)은 공통 `CompassRibbon` 소관이라 이번 소유 범위 밖 — 그대로 둠.
- 실제 Auth 실패 · 취소 · 만료 변형은 새로 실행하지 않았다 — 기존 가드 · 격리 증거(인증 확인 중 · 계정 전환 · 로그아웃)를 재사용.
- 공통 셸의 늦은 레이아웃 이동(run2 에서 80px)은 Story 코드 밖 — 첫 측정과 안정값을 함께 기록.
- 문장 단위 위치 · 맥락 설명의 문장 앵커 · 다른 작품의 실제 선택(공급 1편 → `NOT_RUN_NO_ALTERNATIVE`) · 쉬운 판본 · 시리즈는 DEFER.
- 사람 학습자 관찰 · 도움 발견/시작 마찰의 실제 감소 · 이해 · 흥미 · 지속: **UNVERIFIED**.

## 8. 실행 상태

미리보기 서버(3015)는 코디네이터의 확인을 위해 실행 중으로 남긴다(PID 은 `R/live/preview-active.json`). 공유 main 서버 3000 · 다른 작업자 프로세스는 건드리지 않았다.

## 9. 증거 위치

`R/logs/*`(단위 · 타입 · lint · 격리 · 하네스 빌드 로그와 exit) · `R/fixture/shots-full-attempt2/`(격리 캡처 · `d4-fixture-metrics.jsonl`) · `R/live/run-*/result.json`(실제 측정 · 검사 · 막힌 요청 목록) · `R/implementation-result.json`.

## 10. D5 인계

- 단위 화면 머리 · 도구 줄(단어 뜻 · 고른 낱말 · 맥락 진입)은 듣기 · VCP · 교재 연계 진입을 붙일 자리 후보다. 붙일 때 release/unit 결속 · 인증 same · 「없음 ≠ 못 불러옴」 규칙을 같은 방식으로 따른다.
- `WordLookupPopover` 의 `nonmodalFocus` 는 다른 독서 화면에 켜지 않았다. 확대하려면 그 화면의 낱말 탐색 · 닫힘 복귀 대상을 각각 정해 별도 검증한다.
- `otherWorks` 는 같은 서가 행에서 센 수일 뿐 추천이 아니다. 실제 두 번째 Story 가 공급되면 완료 뒤 「다른 이야기 고르기」의 실제 선택 행동을 관찰표로 확인한다.
- 맥락 설명의 문장 수준 위치(현재 unit_ids 만)와 문장 위치 이어 읽기는 데이터 계약이 먼저다.
- 실제 SR(NVDA 등) 낭독 확인과 사람 관찰(D6)은 별도로 남는다.
