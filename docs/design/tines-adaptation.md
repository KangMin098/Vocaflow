# Tines 디자인 적용 판정 — 2026-09-20

> 요청: [tines.com](https://www.tines.com/) 의 디자인을 플랫폼 디자인에 적용.
> 절차: [vocaflow-design](../../.claude/skills/vocaflow-design/SKILL.md) §A 판정 4문 · §2 충돌표 · §G 형태 발명 · [references.md](./references.md) 채택 규칙.
> **확인 방법과 한계**: 세션 네트워크 정책이 `tines.com` · `fontsinuse.com` · `dokument.studio` 직접 열람을 차단, Mobbin MCP 는 유료 플랜 — 아래 사실은 전부 **WebSearch 결과(2차 출처)** 로 확인했다(2026-09-20). 값(hex 등)은 직접 열람으로 재확인 전까지 근사로 취급한다.

## 1. Tines 디자인 언어 — 확인한 사실

| # | 요소 | 내용 | 출처 |
|---|---|---|---|
| T1 | **제품 사물 → 브랜드 프레임** | 제품(스토리보드 캔버스)의 **점 격자**를 마케팅 전 표면의 프레임 장치로 승격 — "a dynamic framing device that becomes a visual tool & identifier for the brand" | [Behance — Tines Brand System](https://www.behance.net/gallery/183496103/Tines-Brand-System) |
| T2 | **컨트롤 형태의 반복** | 워크플로의 「액션」을 뜻하는 **필(pill)·버튼 형태**를 아이덴티티 모티프로 — "button shaped control elements indicate actions being assembled into workflows" | 같은 곳 |
| T3 | **2서체 시스템** | 본문·UI = **Roobert**(기하 산세리프, 둥근 사각 자형이 T2 필 형태를 반향) · 표제 = **Reckless**(세리프). 둘 다 Displaay | [Fonts In Use — Tines](https://fontsinuse.com/uses/57822/tines) (검색 요지) |
| T4 | **색** | 시그니처 보라 Butterfly Bush **#5E4D9A** · 웜 오프화이트 White Linen 지면 · CTA 전용 Sandy Brown · 다크 차콜 잉크. "flexible, bold colour system" | [Mobbin — Tines brand colors](https://mobbin.com/colors/brand/tines-security-services-limited) (검색 요지) · Behance |
| T5 | **일러스트 시스템** | 추상 개념(보안 자동화)을 놀이적 장면·심벌로 — Dokument(디자인) · Patswerk(장면) · Jaroslaw Danilenko(스팟), 2021–2023 | [Tines 블로그](https://www.tines.com/blog/a-new-look-for-tines/) · [Dokument](https://dokument.studio/work/tines) (검색 요지) |
| T6 | **재브랜딩 동기** | "모두가 비슷해 보이는 업계에서 다르게 말하기 위해" — 차별화의 수단으로 **자기 제품의 형태**를 골랐다 | Behance |

## 2. 핵심 판정 — Tines 의 '방법'은 이미 우리 정본이다

Tines 가 한 수는 스타일 수입이 아니라 **자기 제품의 사물(캔버스 격자·액션 필)을 브랜드의 골격으로 세운 것**이다(T1·T2·T6).
그 방법은 이 저장소의 정본과 같은 문장이다 — vocaflow-design §G 「자산이 골격이 된다」, [DESIGN.md](../../DESIGN.md) 「세계의 사물」.
Vocaflow 의 T1 대응물은 이미 있다: R(t) 감쇠 곡선 · 채색 지문 · 주묵 표식 · 시험지 · **모눈 무대**(`--grid-line` 24px — Tines 점 격자와 같은 자리의 사물, DD-24).

따라서 「Tines 적용」의 올바른 형태 = **방법의 철저화**(아래 §4 P1)이지, 스타일 토큰(보라·필·일러스트)의 수입이 아니다.
스타일 쪽은 §A N1 불통과("경쟁사가 하루면 베낀다")이고, 상당수가 이 저장소에서 **명시적 금지**다(§3).

## 3. 요소별 판정표

| Tines 요소 | 판정 | 근거 (정본 조항) |
|---|---|---|
| T1 제품 격자 → 브랜드 프레임 | **방법 채택** — 우리 사물로 | §G · DD-24 모눈 무대. 단 실사용에 구멍(§4 P1 실측) |
| 히어로에 실제 제품 증명 | 이미 정본 | §3 I1–I3 (`CoverageHero` 가 이미 조작 가능 증명) |
| 웜 오프화이트 지면 · 여백 · 절제 모션 | 이미 수렴 | `--bg #FBFAF6` · Calm UI · §5 모션 예산 — Tines 와 같은 방향 |
| CTA 액센트 1색 절제 (Sandy Brown) | 이미 수렴 | 골드 `--active` 면적 <5% · 면적 색은 주묵 하나 |
| T3 세리프+산세리프 2서체 | 방법 수렴 · **값 거부** | 서체 4종 고정(v07 — Hahmlet·Lora·IBM Plex Sans KR·JetBrains Mono). Roobert 는 §2 「폰트 자유 선택」 금지 행 + latin subset 전철(한글 폴백 사고) |
| T4 시그니처 보라 #5E4D9A | **거부** | AI-보라 = 평균 신호 라쳇 1순위 · DD-01(보라 신규 금지) · **DD-59 가 이틀 전 318곳을 0 으로** 만들었다. 도입은 사용자 자신의 결정 역행 |
| T2 필(pill) 컨트롤 | **거부** | 모서리 정본 2–6px(`--r-sm`…) · 평균 신호 라쳇(12px+ 둥근 카드 증가 금지) · v07 판면(뜨지 않는다) |
| T5 장식 일러스트 시스템 | **거부** (제한 수렴) | 증명은 실측 렌더(I1·I5 — 상수·연출 금지). 빈 상태 삽화 10점은 이미 자체 체계(원고지 방향 A · DD-22~36)가 있고, 그것은 Tines 처럼 「개념을 그림으로」가 아니라 「모눈 위 실측 형태」다 |
| bold color fields(면적 색) | 거부 | 면적을 가진 색은 주묵 하나(DESIGN.md 방향) · A4(주묵도 면 금지) |
| lowercase 톤 | 해당 없음 | 한글 UI — 적용 지점이 없다 |

## 4. 실제로 할 일

### P1 — 모눈 무대를 공개 표면의 브랜드 프레임으로 (규칙 개정 불필요 · 제안)

실측(2026-09-20, `grep --grid-line|모눈` `apps/web/src`): 사용 15파일 = **삽화 11 · OG 카드 2 · 게임 1 · 토큰 테스트 1**.
DD-24 가 허용한 4자리(삽화 · 증명 액자 · 공개 히어로 · 빈 상태) 중 **공개 히어로·증명 액자의 화면 DOM 에는 모눈 무대가 없다** —
무대가 삽화 SVG 내부와 OG 카드에만 살아 있어, Tines 가 점 격자로 얻은 「모든 공개 표면에서 같은 프레임」 효과가 나지 않는다.

- 대상: `/` 히어로 증명 액자(`CoverageHero`) · `/fit` 증명 액자 · 공개 빈 상태.
- 제약: `/fit` 은 **골든 1호**(2026-09-19 고정) — 골든 화면 변경이므로 **사람 결정 먼저**. `/` 도 화면별 배정표의 「현행」 화면이라 같다.
- 비용: 배경 CSS(모눈은 `--grid-line` 토큰, 1px 선·24px) — 라쳇 증가 0 · 모션 0 · 학습 중 화면 0 유지.

### P2 — Tines 의 '룩' 자체를 원한다면 (규칙 개정이 먼저 · 사람 결정)

보라·필 버튼·장식 일러스트·기하 산세리프를 화면에 들이는 것은 코드 작업이 아니라 **기존 결정의 명시적 번복**이다:

| 들일 것 | 뒤집어야 하는 것 |
|---|---|
| 보라 #5E4D9A | DD-01 · DD-59(방금 0 으로 만든 라쳇 `admin.ai-purple`) · 평균 신호 라쳇 AI-보라 행 |
| 필 버튼 · 12px+ 라운드 | 모서리 정본(2–6px) · 평균 신호 라쳇 「둥근 카드」 행 · v07 판면 |
| Roobert 류 산세리프 승격 | 서체 4종 고정(v07) — 그리고 한글 자형이 없는 latin 서체의 폴백 사고 전철 |
| 개념 일러스트 히어로 | I1·I5(증명은 실측 렌더) · N1(자산 무관 미감) |

라쳇은 기준선을 올려 통과시키지 않는다(§G5)가 정본이므로, 번복하려면 **라쳇 규칙 자체의 개정**이 선행돼야 한다.
"규칙이 정당한 코드를 걸면 규칙을 고친다"(AGENTS.md)의 절차이고, 그 판단은 사람 몫이다.

## 5. 판정 4문 요약 (스타일 수입안 기준)

- **N1 자산 의존**: 불통과 — 보라·필·일러스트는 우리 실측 자산(사전 49,244 · R(t) · 커버리지) 없이 성립한다. 하루면 복제된다.
- **N2 즉시 증명**: 무관 — 스타일은 증명이 아니다(기존 `CoverageHero` 증명은 유지된다).
- **N3 학습과학**: 불통과 — 7원칙 중 나아지는 번호를 댈 수 없다.
- **N4 형태 판정**: 불통과 — Tines 룩의 골격(필·격자·일러스트)은 자산 없이 그릴 수 있다.

**방법 채택안(P1)** 은 다르다: 골격이 모눈 무대(시험지 사물 계열, G1 축)이고, N4 는 "우리 시험지·원고지 자산 없이는 이 무대를 못 그린다"로 통과한다.
