# 참고 자료 추가분 (Gate 4)

> 생성 2026-09-18 · Claude Code · 근거: 이 세션에서 실제 호출한 MCP·WebFetch 결과.
> **합칠 곳**: `docs/design/references.md` 의 표 형식. 그 파일은 메인 워크트리에만 있는 미추적 파일(다른 세션 작성)이고
> 감사 시점에 메인 워크트리가 Codex 잠금 중이라 여기에 따로 둔다. 잠금이 풀리면 아래 두 표를 그 파일 끝에 옮긴다.
> 레퍼런스는 복제 대상이 아니다 — "무엇이 평균인가" 의 기준과 연구 근거로만 쓴다(A7).

## 도구 (이 세션에서 실제로 호출한 결과)

| 도구 | 상태 | 용도 | 확인 |
|---|---|---|---|
| Supabase MCP `execute_sql` | **사용 가능** | 자산 가용성(도서 312권 레벨별 커버리지·단어 세트), 퍼널 집계(`funnel_events`) — 집계만 | 2026-09-18 질의 성공 |
| Playwright(`@playwright/test`, 저장소 의존성) | **사용 가능** — MCP 아님 | 익명/로그인 응답 · 1280/390 캡처 · 렌더 DOM 평균 신호 (`tools/capture.mjs`) | 2026-09-18 127화면 실행 |
| Figma MCP (claude.ai Figma) | **미연결** — 세션 시작 시 "인증 필요" 로 표시됨 | — | 인증 전에는 쓸 수 없다. 설치됨으로 보고하지 않는다 |
| WebFetch / WebSearch | 사용 가능 | 아래 외부 자료 확인 | 2026-09-18 |

## 외부 자료 (실제로 열어 본 것만)

| 출처 | 확인 | 참고할 요소 | 적용하지 않을 요소 | 적용 화면 |
|---|---|---|---|---|
| [NN/g — Designing Empty States in Complex Applications](https://www.nngroup.com/articles/empty-state-interface-design/) (Kaplan, 2021-09-19) | 2026-09-18 열람 | 빈 상태 3원칙: 상태를 말한다 · 로딩 중에 "없음" 이라 하지 않는다 · 직접 행동 경로를 준다 — 우리 D5 와 같은 방향 | 설명 문구로 빈 칸을 채우는 것까지 — 우리는 렌즈 4(빈 상태 = 실측 예시 전시장)가 더 강하다 | 모든 카드의 "빈" 상태 판정 |
| [NN/g — Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/) (Nielsen, 2006-12-03) | 2026-09-18 열람 | 처음엔 핵심 몇 개만 · 고급은 명확한 라벨로 · **공개 단계는 2단까지** | — | 철학 2 판정, 필터가 많은 매대·설정 |
| [Laws of UX](https://lawsofux.com/) | 2026-09-18 열람(공개, 30개 법칙) | Hick · Cognitive Load · Goal-Gradient · Peak-End · Zeigarnik · Von Restorff — 학습과학 7원칙과 겹치는 것만 인용 | 법칙 이름을 근거 없이 나열하는 것 | 브리프의 "제약" 칸 |
| [Baymard — 2 Key Design Principles for Product Listing Information](https://baymard.com/blog/list-item-design-ecommerce) (2023-08-22) | 2026-09-18 열람 | 목록 항목 속성의 일관성 · 항목 요소의 시각적 구별 | 전자상거래 구매 전환 관점 — 우리 매대의 1차 목적은 "내 수준의 책 찾기" | `/library/*` 매대 |
| [Baymard — Product List UX (benchmark)](https://baymard.com/blog/current-state-product-list-and-filtering) | 2026-09-18 검색 결과 요지 | 데스크톱 58% · 모바일 78% 가 "mediocre 이하" — **목록·필터는 업계 전체가 평균에 머무는 자리**라는 근거 | 수치를 우리 화면 판정에 그대로 쓰지 않는다 | `/library/*` · `/wordvault/browse` |
| [Mobbin](https://mobbin.com/) | **접근 불가**(HTTP 403) | — | — | 대체: 위 NN/g · Baymard |
| [Page Flows](https://pageflows.com/) | 열람했으나 **라이브러리는 유료**(3일 체험 필요) — Duolingo 온보딩 흐름 수록 확인 | 사람이 체험 가입 후 Duolingo 온보딩 흐름을 볼 때 비교 기준으로 | 결제가 필요해 이번 감사에서는 흐름을 보지 않았다 | 여정 ② 가입→첫 학습 |

## "무엇이 평균인가" — 교육 제품의 기준선 (공개 페이지 기준)

| 제품 | 공개 페이지가 보여주는 형태 | 우리 자산이 그들이 못 그리는 형태를 만드는 자리 |
|---|---|---|
| [LingQ](https://www.lingq.com/en/) (2026-09-18 열람) | 모르는 단어 **강조**(이진) · "Words learned" **누적 숫자** · 다음 레벨까지의 통계 | 이진 강조가 아니라 **R(t) 로 흐려지는 단어**(밑줄 두께 3/2/1px) — 아는 단어가 시간이 지나면 다시 모르는 쪽으로 간다는 것을 지문 위에서 보여준다(`/text/[id]`) |
| [Readlang](https://readlang.com/) (2026-09-18 열람) | 클릭하면 번역 → 저장 → **플래시카드** 복습 | 번역을 누르기 **전에** 이 글에서 내가 아는 비율을 칠해서 보여준다(커버리지 × V-Level, `/` · `/fit`) — 읽기 전 판단 |
| Anki (일반 지식 — 이번에 열람하지 않음, 추정) | 카드 한 장 + 4단 평가 버튼 | 카드 뒤에 **망각 곡선**(S1) — 이 카드를 오늘 안 보면 언제 무엇을 잃는가 |
