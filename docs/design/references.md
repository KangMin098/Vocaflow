# 디자인 레퍼런스 인덱스

레퍼런스는 전체 화면의 복제 대상이 아니다. 무엇을 채택하고 무엇을 적용하지 않을지 적는다.
현재 저장소에 있는 근거부터 사용한다. 이미지가 오래됐으면 해당 화면을 새로 캡처한다.

| 근거 | 참고하는 부분 | 적용 범위 |
|---|---|---|
| [01-research](01-research.md) | 기존 조사와 시각 정체성의 근거 | 외부 사례의 현재 모습·링크는 다시 확인 |
| [02-directions](02-directions.md) | 방향 비교와 선택의 근거 | 모든 수정에 과거 시안 구조를 강제하지 않음 |
| [03-system](03-system.md) | 한글·영문 역할, 판면·괘선·근거 표식 | 현재 토큰·컴포넌트와 함께 확인 |
| [04-application](04-application.md) | 실제 화면 적용 방식 | 현재 라우트와 렌더로 재확인 |
| [CSAT 통합 경험](../csat-learner/integrated-experience.md) | 예측·대조와 읽기·듣기의 연결 | CSAT 도메인에 한정 |
| [기존 허브 캡처 도구](../../apps/web/tests/e2e/91-hub-design-capture.spec.ts) | 동일 조건의 화면과 계측 | 실행 결과는 로컬 파일로 열어 확인 |

새 레퍼런스를 채택할 때 출처 URL/로컬 파일, 확인 날짜, 참고할 요소(타이포·내비·정보 관계·동작),
적용하지 않을 요소, 적용 화면, 선택 이유를 결정 문서에 남긴다. 외부 원문·사용자 정보가 담긴
캡처와 Figma 산출물은 공유 범위를 확인하며 저장소에 무조건 넣지 않는다.

화면 증거는 [Visual QA](06-workflow.md)의 로컬 산출물 경로를 사용한다.
캡처 파일의 존재와 검토 완료를 구분하고, 새 피드백을 근거 없이 제품 전체 규칙으로 승격하지 않는다.

## UX 감사 추가분 (2026-09-18)

> 출처: 브랜치 `feat/ux-audit` 의 `docs/design/audit/references-additions.md`. 이 세션에서 실제로 호출·열람한 것만.

### 도구 (이 세션에서 실제로 호출한 결과)

| 도구 | 상태 | 용도 | 확인 |
|---|---|---|---|
| Supabase MCP `execute_sql` | **사용 가능** | 자산 가용성(도서 312권 레벨별 커버리지·단어 세트), 퍼널 집계(`funnel_events`) — 집계만 | 2026-09-18 질의 성공 |
| Playwright(`@playwright/test`, 저장소 의존성) | **사용 가능** — MCP 아님 | 익명/로그인 응답 · 1280/390 캡처 · 렌더 DOM 평균 신호 (`tools/capture.mjs`) | 2026-09-18 127화면 실행 |
| Figma MCP (claude.ai Figma) | **미연결** — 세션 시작 시 "인증 필요" 로 표시됨 | — | 인증 전에는 쓸 수 없다. 설치됨으로 보고하지 않는다 |
| WebFetch / WebSearch | 사용 가능 | 아래 외부 자료 확인 | 2026-09-18 |

### 외부 자료 (실제로 열어 본 것만)

| 출처 | 확인 | 참고할 요소 | 적용하지 않을 요소 | 적용 화면 |
|---|---|---|---|---|
| [NN/g — Designing Empty States in Complex Applications](https://www.nngroup.com/articles/empty-state-interface-design/) (Kaplan, 2021-09-19) | 2026-09-18 열람 | 빈 상태 3원칙: 상태를 말한다 · 로딩 중에 "없음" 이라 하지 않는다 · 직접 행동 경로를 준다 — 우리 D5 와 같은 방향 | 설명 문구로 빈 칸을 채우는 것까지 — 우리는 렌즈 4(빈 상태 = 실측 예시 전시장)가 더 강하다 | 모든 카드의 "빈" 상태 판정 |
| [NN/g — Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/) (Nielsen, 2006-12-03) | 2026-09-18 열람 | 처음엔 핵심 몇 개만 · 고급은 명확한 라벨로 · **공개 단계는 2단까지** | — | 철학 2 판정, 필터가 많은 매대·설정 |
| [Laws of UX](https://lawsofux.com/) | 2026-09-18 열람(공개, 30개 법칙) | Hick · Cognitive Load · Goal-Gradient · Peak-End · Zeigarnik · Von Restorff — 학습과학 7원칙과 겹치는 것만 인용 | 법칙 이름을 근거 없이 나열하는 것 | 브리프의 "제약" 칸 |
| [Baymard — 2 Key Design Principles for Product Listing Information](https://baymard.com/blog/list-item-design-ecommerce) (2023-08-22) | 2026-09-18 열람 | 목록 항목 속성의 일관성 · 항목 요소의 시각적 구별 | 전자상거래 구매 전환 관점 — 우리 매대의 1차 목적은 "내 수준의 책 찾기" | `/library/*` 매대 |
| [Baymard — Product List UX (benchmark)](https://baymard.com/blog/current-state-product-list-and-filtering) | 2026-09-18 검색 결과 요지 | 데스크톱 58% · 모바일 78% 가 "mediocre 이하" — **목록·필터는 업계 전체가 평균에 머무는 자리**라는 근거 | 수치를 우리 화면 판정에 그대로 쓰지 않는다 | `/library/*` · `/wordvault/browse` |
| [Mobbin](https://mobbin.com/) | **접근 불가**(HTTP 403) | — | — | 대체: 위 NN/g · Baymard |
| [Page Flows](https://pageflows.com/) | 열람했으나 **라이브러리는 유료**(3일 체험 필요) — Duolingo 온보딩 흐름 수록 확인 | 사람이 체험 가입 후 Duolingo 온보딩 흐름을 볼 때 비교 기준으로 | 결제가 필요해 이번 감사에서는 흐름을 보지 않았다 | 여정 ② 가입→첫 학습 |

### "무엇이 평균인가" — 교육 제품의 기준선 (공개 페이지 기준)

| 제품 | 공개 페이지가 보여주는 형태 | 우리 자산이 그들이 못 그리는 형태를 만드는 자리 |
|---|---|---|
| [LingQ](https://www.lingq.com/en/) (2026-09-18 열람) | 모르는 단어 **강조**(이진) · "Words learned" **누적 숫자** · 다음 레벨까지의 통계 | 이진 강조가 아니라 **R(t) 로 흐려지는 단어**(밑줄 두께 3/2/1px) — 아는 단어가 시간이 지나면 다시 모르는 쪽으로 간다는 것을 지문 위에서 보여준다(`/text/[id]`) |
| [Readlang](https://readlang.com/) (2026-09-18 열람) | 클릭하면 번역 → 저장 → **플래시카드** 복습 | 번역을 누르기 **전에** 이 글에서 내가 아는 비율을 칠해서 보여준다(커버리지 × V-Level, `/` · `/fit`) — 읽기 전 판단 |
| Anki (일반 지식 — 이번에 열람하지 않음, 추정) | 카드 한 장 + 4단 평가 버튼 | 카드 뒤에 **망각 곡선**(S1) — 이 카드를 오늘 안 보면 언제 무엇을 잃는가 |

## Tines (2026-09-20) — 판정 [tines-adaptation.md](tines-adaptation.md) · 결정 DD-61

> 직접 열람은 세션 네트워크 정책에 차단 — WebSearch 2차 출처로만 확인. 값은 근사.

| 출처 | 확인 | 참고하는 부분 | 적용하지 않을 요소 | 적용 화면 |
|---|---|---|---|---|
| [tines.com](https://www.tines.com/) · [Behance 브랜드 시스템](https://www.behance.net/gallery/183496103/Tines-Brand-System) · [Fonts In Use](https://fontsinuse.com/uses/57822/tines) · [Mobbin 팔레트](https://mobbin.com/colors/brand/tines-security-services-limited) | 2026-09-20 검색 요지(직접 열람 차단) | **방법만**: 제품 사물(점 격자·액션 필)을 브랜드 프레임으로 승격 — 우리 §G 와 같은 문장. 구체 적용은 모눈 무대(`--grid-line`)의 공개 표면 일관화(P1, 사람 결정 대기) | 보라 #5E4D9A(DD-01·DD-59 역행) · 필 버튼(모서리 2–6px 정본) · 장식 일러스트(I1·I5) · Roobert 류 산세리프(4종 고정) | `/` · `/fit` 증명 액자 · 공개 빈 상태(P1 승인 시) |

