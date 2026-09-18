# S057 `/wordvault` — WordVault 허브 (내 어휘 자산 7구획)

> 생성 2026-09-18 · Claude(감사 서브에이전트) · 근거: 메인 워크트리 코드 읽기 + `tools/screen-graph.mjs` 결과. 카드 ≤ 40줄.

## 목적
- JTBD: "내 단어장을 열었을 때, 몇 개를 모았고 지금 무엇이 흔들리는지 보고 가장 급한 묶음 하나로 바로 들어가고 싶다"
- 주 사용자: 학생 · 인지 계층: L3 능동 부호화(`docs/MODULES.md:22`)

## 흐름
- 진입: 사이드바(`components/layout/sidebar-config.ts:190`) · 세션 셸·게임 19종·/dashboard·/text/[id] 등 34곳(정적) · 옛 `?view=` → 하위 라우트 redirect(`app/(main)/wordvault/page.tsx:57-66`)
- 단계: 1. VaultIdentity(주간 링·총 단어·4버킷·CTA) 2. 수준 지도 3. 면 상태 4. 학습 자산 5. 추천 도서 6. 추천 단어장 7. 28일 흐름
- 완료 조건: 1차 CTA 로 browse 필터 진입
- 1차 행동: 상태 우선 CTA 하나 — risk>shaky>new 순 「지금 다시 만나기」→ `/wordvault/browse?filter=state:risk`(`components/wordvault/hub/VaultIdentity.tsx:57-72,123`, 템플릿이라 정적 누락) · 보조: 상단 세그먼트 허브/둘러보기/학습/복습(`WordVaultHubChrome.tsx:36-44`)
- 나가는 길: /wordvault/browse·study·review · /library/books·vocab · /diagnostic · /text/new

## 상태 5종
| 상태 | 있나 | 근거 file:line | D5(다음 한 걸음) |
|---|---|---|---|
| 빈 | 있음 | 단어 0 → WordVaultEmptyState(`WordVaultHub.tsx:69-75`) | ○ 스크립트 추가 / 라이브러리. 단 카피 오탈자 "스크립트을"(`WordVaultEmptyState.tsx:30`) · "AI가 … 만들어 드립니다"(`:36`) = §F 불통과 카피 |
| 로딩 | 있음 | 셸 먼저 + Suspense 스켈레톤(`wordvault/page.tsx:69-75`, `WordVaultHubSkeleton.tsx:21`) | — |
| 오류 | 있음 | "세지 못했어요 — 단어가 사라진 건 아니에요"(`WordVaultHub.tsx:52-66`) | ✗ 다시 시도 없음 · 비로그인도 같은 문단(로그인 링크 ✗) |
| 부분 | 있음 | 면 요약 실패 시 구획 생략(`WordVaultHub.tsx:96`, `page.tsx:102`) | — |
| 완료 | 해당 없음 | — | — |

## 자산
- N1 자산: R(t) 4버킷 · V-Level 분포 · 면(facet) · 도서/단어장 추천 · daily_activity — 역할: **칩·숫자**(StatPill 4칸 `VaultIdentity.tsx:104-120`, Capsule `:95-99`)
- 형태 씨앗: 없음(S8·S1 둘 다 이 화면에 안 쓰임)
- 학습과학 원칙: #2 Spaced(상태 우선 CTA) · #6(한 CTA) · Implicit Progress 는 숫자 72–96px(`:89`)로 반대 방향

## 첫 시선 (코드 기준 — Gate 3 캡처로 확정)
- 첫 뷰포트: GlassBar(제목+세그먼트) → iOS Card 안 ActivityRing(`:78`) + 72/96px 총 단어 수 + 캡슐 3개 → 4칸 StatPill → 브랜드 버튼
- 골격 판정: **카드 목록**(7구획 세로) — iOS Health/Fitness/Settings 복제를 주석이 스스로 밝힘(`FlowStripe.tsx:5-8`, `ResourcePortfolio.tsx:5-8`, `VaultIdentity.tsx:4`)
- 평균 신호(정적): 24 (ai-purple 15 — 자기 트리 합산, 허브 본체보다 트리 안 모달 `components/library/vocab/VocabSetPreviewModal.tsx:9-10` 등(추정) · gradient 3 · float-hover 3 · glass 2 · grid-3eq 1)

## 근거
- `apps/web/src/app/(main)/wordvault/page.tsx:80-86` — 콜드 진입 본문 2,831ms 실측 → 스트리밍 분리
