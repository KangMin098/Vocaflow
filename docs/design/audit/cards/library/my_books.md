# S039 `/my/books` — 내 책장 (BookVault)

> 생성 2026-09-18 · Claude(감사 서브에이전트) · 근거: 메인 워크트리 코드 읽기 + `tools/screen-graph.mjs` 결과. 카드 ≤ 40줄.

## 목적
- JTBD: "담아 둔 책들을 볼 때, 어느 책이 몇 장 남았는지 보고 이어 읽을 책을 고르고 싶다"
- 주 사용자: 학생(로그인) · 인지 계층: L0~L2 복귀 지점

## 흐름
- 진입: 워크스페이스에서 되돌아 나오는 자리(`lib/framework/learner-routes.ts:309-316`) — `CompleteChapterButton.tsx:112` · `WorkspaceBookContext.tsx:74`. 셸 사이드바는 이 주소를 걸지 않고 `owns` 로만 가진다(`sidebar-config.ts:170-171`)
- 단계: 1. Hero(BookVault·「내 책장」+총 권수·완독·학습 중 장) 2. 책 카드 격자 1~3열(`page.tsx:199`) — 카드마다 챕터 점 줄(`:384-399`) 3. 카드 → `/my/books/[bookId]`(재개 redirect)
- 완료 조건: 책 하나를 골라 학습 재개
- 1차 행동: 책 카드 열기(`page.tsx:286-287`) · 보조: 없음
- 나가는 길: /my/books/[bookId] · 빈 상태 /library/books(`:504`)

## 상태 5종
| 상태 | 있나 | 근거 file:line | D5(다음 한 걸음) |
|---|---|---|---|
| 빈 | 있음 | `page.tsx:172-176` + `Empty` `:494-509` | ○ 「Library에서 책 발견 →」 |
| 로딩 | 있음 | Suspense 스켈레톤 6장 `page.tsx:21, 481-486` — 이 그룹에서 유일한 화면 전용 로딩 | — |
| 오류 | 있음 | `page.tsx:113-114` — 빈 상태와 **같은 `Empty`** | △ 도서로만, 재시도 없음 · 「없다/못 읽었다」 미구분(도서 서가 규칙 `library/books/page.tsx:413-414` 불이행) |
| 부분 | 없음 | — | — |
| 완료 | 있음 | 카드 격자 `page.tsx:199-204` | ○ |

## 자산
- N1 자산: 챕터 진행(`texts.status`) · V-Level/CEFR 칩 — 역할: **칩·숫자**. R(t)·FSRS·커버리지 없음(그 책에서 가져온 단어의 기억 상태를 안 봄)
- 형태 씨앗: 없음 — `00-form-seeds.md` 가 "서가가 차오른다(코드 0)"라 한 바로 그 자리
- 학습과학 원칙: Implicit Progress 부분(챕터 점 줄) — 그러나 Hero 는 명시 숫자 3개(`page.tsx:242-246`)

## 첫 시선 (코드 기준 — Gate 3 캡처로 확정)
- 첫 뷰포트: 그라디언트 Hero(`page.tsx:221` `bg-gradient-to-br` + 흐린 원 장식 `:224` `blur-2xl`) + 3 스탯 → 카드 격자
- 골격 판정: 카드 격자. G1 없음
- 평균 신호(정적): 5 — infinite-anim 1 = 진행 중 챕터 점 무한 pulse(`page.tsx:471`), 끝나는 상태가 없는 상시 모션(AGENTS.md 모션 예산 "장식적 상시 모션" 금지 해당 추정)

## 근거
- `apps/web/src/lib/library/tabs.ts:106-113` — `/text?view=books` says '챕터로 나뉜 내 책' = `learner-routes.ts:312` 의 `/my/books` 설명과 **같은 문장** → 병합 후보
- `apps/web/src/app/(main)/my/page.tsx:3-5` — BookVault 이름은 폐지 세트인데 metadata title 은 아직 'BookVault'(`my/books/page.tsx:12`) · `revalidate = 60`(`:16`) 은 도서 서가가 지운 "죽은 캐시 설정"(`library/books/page.tsx:28-32`)
