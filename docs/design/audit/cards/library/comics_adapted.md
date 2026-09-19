# S015 `/comics/adapted` — 책 만화 서가 (Book Comics)

> 생성 2026-09-18 · Claude(감사 서브에이전트) · 근거: 메인 워크트리 코드 읽기 + `tools/screen-graph.mjs` 결과. 카드 ≤ 40줄.

## 목적
- JTBD: "원서를 읽기 전에, 같은 책을 만화로 먼저 보고 줄거리를 잡고 싶다, 그래서 본문이 수월해진다"
- 주 사용자: 학생 · 방문자 · 인지 계층: L0(Dual Coding 입구)

## 흐름
- 진입: 사이드바 Comics 그룹(`sidebar-config.ts:286`) · `/comics` redirect(`app/(main)/comics/page.tsx`) · ComicsTabs(`ComicsTabs.tsx:24`) · 복원 서가 빈 상태(`comics/restored/page.tsx:334`) · 상세 뒤로(`adapted/[bookId]/page.tsx:172`)
- 단계: 1. 헤더(색 상자 아이콘+「책 만화」+캡슐) 2. 이어서 보기 격자(`ComicsBrowser.tsx:104-116`) 3. 전체 만화 + 레벨 칩 필터(`:119-150`) 4. 카드 → 미수강 `/comics/adapted/[id]` · 수강 `/text/[id]/comic`(`page.tsx:103-105`)
- 완료 조건: 만화 상세 또는 만화 리더 진입
- 1차 행동: 만화 카드 열기(`ComicsBrowser.tsx:180`) · 보조: 레벨 필터
- 나가는 길: /comics/adapted/[bookId] · /text/[id]/comic · 빈/오류 시 /library/books

## 상태 5종
| 상태 | 있나 | 근거 file:line | D5(다음 한 걸음) |
|---|---|---|---|
| 빈 | 있음 | `ComicsBrowser.tsx:92-97`(공용 `ShelfEmptyState`) | ○ 도서 보러 가기 |
| 로딩 | 전역만 | `app/loading.tsx` | — |
| 오류 | 있음 | `page.tsx:35` → `ComicsBrowser.tsx:83-90` | △ 도서로만 — 도서·글 서가에 있는 「다시 시도」(`LibraryGrid.tsx:189-190`, `ScriptsBrowser.tsx:84-85`)가 없음 |
| 부분 | 있음 | 레벨 필터 0건 `ComicsBrowser.tsx:152-159` | ○ 필터 초기화 |
| 완료 | 있음 | 격자 1~3열 `ComicsBrowser.tsx:163` | ○ |

## 자산
- N1 자산: V-Level(레벨 칩 필터) · 만화 진도 % — 역할: **칩·숫자**. 커버리지는 이 목록에서 안 씀(상세 S016 에서만)
- 형태 씨앗: 없음. 완독 배지가 `--memory-stable` 을 씀(`ComicsBrowser.tsx:204`) — 망각 4색을 '완독' 뜻으로 전용(도서 카드도 같음 `BookGridCard.tsx:149-151`)
- 학습과학 원칙: #4 Dual Coding(그림 → 원문)

## 첫 시선 (코드 기준 — Gate 3 캡처로 확정)
- 첫 뷰포트: 44/56px 제목 + 캡슐(`page.tsx:136-161`) → 이어서 보기 또는 전체 만화 격자
- 골격 판정: 카드 격자 1~3열. G1 없음
- 평균 신호(정적): 4 (grid-3eq 2 · float-hover 2). 제목 아이콘을 색 상자에 담고 글자색 하드코딩 `#231a09`(`page.tsx:138-144`)

## 근거
- `apps/web/src/app/(main)/library/books/page.tsx:308-321, 411` — 도서 서가가 **같은 카탈로그**(`lib/comic/catalog.ts`)에서 만화 4편 히어로를 첫 자리에 이미 보여 준다 → 병합 후보
- `apps/web/src/app/(main)/comics/adapted/page.tsx:133-163` — 헤더+Capsule+Browser = 도서·글 서가와 같은 틀
