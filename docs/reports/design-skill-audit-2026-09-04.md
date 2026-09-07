# 디자인 스킬 감사 · 병합 결정 (2026-09-04)

> 목적: "혁신적인 디자인이 가능한 skill" 을 외부에서 찾아 **기존 설치분 + 설계 지침과 병합**한다.
> 근거 규칙은 `PLATFORM_AUDIT.md` 와 같다 — **문서가 아니라 실측**. 별점·커밋 수는 조사 시점 값이다.

## 0. 실측 기준선 (2026-09-04)

| 측정 | 값 | 방법 |
|---|---|---|
| 설치된 취향 스킬 | **13개** (344 KB · SKILL.md 14) | `ls .claude/skills` |
| 그중 프론트엔드 UI 작업에 **동시 트리거** | **8개** | description 판독 |
| 동일 목적 중복 설치 | **1쌍** (`design-taste-frontend` v2 / `-v1`) | frontmatter |
| `DESIGN_SYSTEM.md`(1,263줄)의 "첫인상·이탈" 규범 | **0줄** | `grep -ic '첫인상\|이탈'` |
| `CLAUDE.md` 의 같은 규범 | **0줄** | 동일 |
| 랜딩 above-the-fold 의 "작동하는 증명" | **0개** (전부 산문 + 링크) | `app/page.tsx` 판독 |
| 가치(커버리지 숫자)를 눈으로 볼 때까지 클릭 | **3** (랜딩 CTA → /fit → 예시 → 분석) | 경로 계수 |
| 랜딩 **내부** 이탈을 잴 수 있는 이벤트 | **0개** (`landing_viewed`·`landing_cta_clicked` 는 양 끝점) | `lib/analytics/events.ts` |

## 1. 외부 후보 평가 (13개)

평가 5축 — **유지보수**(별·커밋) · **스택 적합**(three 0.184 / r3f **8.17** / drei 9.122 / Next 14) ·
**철학 충돌**(Calm UI · Empathetic · Implicit Progress) · **고유성**(설치분이 이미 덮지 않는가) ·
**검증 가능성**(수치·스크립트로 확인되는가).

| # | 후보 | 규모 | 스택 | 충돌 | 고유성 | 판정 |
|---|---|---|---|---|---|---|
| 1 | [freshtechbro/claudedesignskills](https://github.com/freshtechbro/claudedesignskills) 22스킬 5번들 | ⭐841 | r3f 9.x 전제 다수 | 중(GSAP 스크롤 강제) | 높음 | **부분 채택** — r3f/three 패턴만 참조, 통째 설치 안 함 |
| 2 | [OpenAEC Three.js Package](https://github.com/OpenAEC-Foundation/Three.js-Claude-Skill-Package) 24스킬 | ⭐11 | three r160+ | 낮음 | 높음 | **부분 채택** — ALWAYS/NEVER 서술 방식만 차용 |
| 3 | [nextlevelbuilder/ui-ux-pro-max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) | 대형 DB | 무관 | 중(팔레트·폰트가 SSoT 침범) | 중 | **반려** — Vocaflow 는 팔레트·폰트가 이미 고정 |
| 4 | [camilleroux/genart-skill](https://github.com/camilleroux/genart-skill) | ⭐132 | 무관 | 낮음 | **높음** | **채택(원리)** — 해시 시드 결정론 → Implicit Progress 시각화 규칙으로 |
| 5 | [iart-ai/web-animation-skills](https://github.com/iart-ai/web-animation-skills) 9스킬 | ⭐17 | 무관 | 낮음 | 높음 | **채택(원리)** — tiered reduced-motion(끄기 아닌 낮추기) |
| 6 | [emil-anim (gist)](https://gist.github.com/corysimmons/1e2f64603ae234602f92dafe2b549ea9) | gist | 무관 | **없음** | **높음** | **채택(수치)** — 모션 예산 숫자의 출처 |
| 7 | [iart-ai/webgl-animation-skills](https://github.com/iart-ai/webgl-animation-skills) | ⭐9 | three 무버전 | 낮음 | 중 | 보류 — 3D 착수 시 재평가 |
| 8 | [zyliu0/3d-frontend](https://github.com/zyliu0/3d-frontend) | ⭐16 | three **r128** CDN | 낮음 | 낮음 | **반려** — 스택 4년 차이, 단일 HTML 산출은 Next 14 와 무관 |
| 9 | [ga14ctic/awwwards-skill](https://github.com/ga14ctic/awwwards-skill) | ⭐1 · 커밋 1 | — | 높음 | — | **반려** — 검증 불가 |
| 10 | [199-biotech/motion-dev-animations](https://github.com/199-biotechnologies/motion-dev-animations-skill) | 소 | Motion.dev 미도입 | 중 | 중 | 보류 |
| 11 | [CloudAI-X/threejs-skills](https://github.com/cloudai-x/threejs-skills) | 소 | 미확인 | 낮음 | 낮음(#1·#2 와 중복) | 반려 |
| 12 | [anthropics/skills](https://github.com/anthropics/skills) | 공식 | 문서 스킬 중심 | 없음 | — | 해당 없음(디자인 스킬 아님) |
| 13 | [wilwaldon/Frontend-Design-Toolkit](https://github.com/wilwaldon/Claude-Code-Frontend-Design-Toolkit) | ⭐1.1k | — | — | 큐레이션 | **참조 문서로만** |

### 왜 "통째 설치" 를 하지 않는가

이미 8개가 같은 트리거에서 서로 다른 처방을 내고 있다. 하나 더 넣으면 **충돌이 9방향**이 된다.
그리고 이 저장소의 실패 모드는 공급 비대다 — 스킬도 같은 함정을 판다.
그래서 외부에서 가져온 것은 **검증된 수치와 원리**뿐이고, 그것을 **단일 판정 스킬 하나**로 접었다.

## 2. 산출물

| 산출 | 경로 | 역할 |
|---|---|---|
| 병합 정본 스킬 | `.claude/skills/vocaflow-design/SKILL.md` | 우선순위 · 라우팅 · 충돌 판정 · 모션 예산 · 3D 스택 고정 |
| 지침 (always-on) | `CLAUDE.md` §🎯 첫인상 · 이탈 방지 | I1–I6 · D1–D5 · 모션 예산 요약 |
| 지침 (상세) | `docs/DESIGN_SYSTEM.md` §🎯 (문서 최상단) | 규칙 전문 + 외부 스킬 판정표 |

## 3. 격차 해소 — 규칙을 화면에 이행했다

| 지표 | 이전 | 이후 | 방법 |
|---|---|---|---|
| 랜딩 above-the-fold "작동하는 증명" | 0개 | **1개** | `CoverageHero` — 서버가 실제 분석한 지문 |
| 가치(커버리지)를 눈으로 보기까지 클릭 | 3 | **0** | 진입 즉시 고1 기준으로 칠해져 있다 |
| 조작 가능성 | 없음 | **레벨 슬라이더 8칸** | 네트워크 0(사전 계산) · 실브라우저 반응 **65ms** |
| 랜딩 내부 이탈 관측 이벤트 | 0개 | **2개** | `landing_demo_moved` · `landing_section_reached` |
| 지침의 첫인상·이탈 규범 | 0조 | **23조** | CLAUDE.md · DESIGN_SYSTEM.md (I1–I8 · D1–D7 · 모션 예산) |
| 접근성 (axe WCAG2 A/AA) | — | **위반 0** | 모바일·데스크톱 × 라이트·다크 |
| 지문 해석률 | 0.916 | **0.991** | 사전 RPC 경로 (§4) |

**실브라우저 실측** (`next build` → `next start` → Playwright, 2026-09-05):

| 슬라이더 위치 | 커버리지 | 칠해진 미지어 |
|---|---|---|
| 초등 고학년 | **67%** | **20낱말** |
| 고1 (기본) | **93%** | 4낱말 |
| 학술 · 원서 | **100%** | 0낱말 |

같은 글의 숫자가 **33%p** 움직이고 칠해진 낱말이 **0 ↔ 20** 으로 오간다 — 이것이 증명이다.
접힌 위 배치: 데스크톱 커버리지 736 · CTA 867 (뷰포트 900) · 모바일 커버리지 766 (뷰포트 844).

## 4. 조사 중 드러난 결함 — 해결됨 (2026-09-05)

`/fit` 의 레벨 맵이 **상시 잘려 있었다.** anon 가시 `shared_words` 681,021행을 PostgREST 가
1,000행씩 돌려주는데 로더 상한은 200,000행이라, **콜드 88초를 쓰고도 30%만 읽고 멈췄다.**
빠진 낱말은 '미지어' 로 세어져 커버리지가 낮게 나왔다.

**원인 진단을 한 번 틀렸다.** "anon 에 EXECUTE 가 없다" 고 보고 `GRANT` 를 제안했는데, 확인하니
`anon=X` 도 PUBLIC `=X` 도 이미 있었다(Postgres 기본값). 실제 장벽은 **RLS** 였다 —
`shared_dictionary` 정책이 `authenticated` 뿐이라 anon 은 0행을 보고, `SECURITY INVOKER` 함수가
그 권한 그대로 돌아 **오류 없이 빈 결과**를 냈다.

→ 마이그레이션 **`20260905084613`** `textfit_resolve_levels_public`(SECURITY DEFINER · 3열 반환 ·
PUBLIC REVOKE 후 anon/authenticated 에만 EXECUTE)를 적용하고 전량 적재 코드를 삭제했다
(`level-map.ts` 454 → 303줄).

| 지문 한 편 (표면형 112) | 전량 적재 | 사전 RPC |
|---|---|---|
| 소스 | `shared_words` 681,021행 (distinct 29,308) | `shared_dictionary` 48,969행 |
| 시간 | 콜드 **88초** + 잘림 | **294ms** (분석 전체 1.97초) |
| 해석률 | 0.916 | **0.991** |
| 로그인 경로와 해석기 | 다름 | **같음** |

숫자가 움직였고 방향이 예측과 맞았다 — 히어로 기준 레벨 미상 6 → **0**, 고1 89% → **93%**.
일반형 교훈은 [CONVENTIONS.md §전량 적재 캐시](../CONVENTIONS.md)에 적었다.
