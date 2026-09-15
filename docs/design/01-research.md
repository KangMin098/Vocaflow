# 01 — 리서치

작성 2026-09-16. 00-inventory 의 결함 C1~C9 를 고칠 재료를 모은다.
**레퍼런스는 "예뻐서" 고르지 않는다.** 각 줄은 *무엇을 가져오고 무엇을 버리는지*를 말한다 —
가져올 것만 적힌 레퍼런스는 모방이고, 버릴 것이 적혀야 판단이다.

---

## 1-1. 한글 웹폰트 — 결함 C1 의 유일한 해법

`.claude/skills/vocaflow-design` §2 는 **"폰트 4종 고정(Plus Jakarta / DM Sans / Lora / JetBrains Mono)"**
을 외부 스킬과의 충돌 판정으로 못 박고 있다. 그런데 **그 4종에 한글 글리프가 없다**(00-inventory §0-2).
즉 이 규칙은 "한글 UI 를 OS 기본꼴로 둔다"를 의도치 않게 규정하고 있었다.
→ **지침을 고친다.** 근거와 diff 는 `05-report.md` 에 남긴다(의뢰서 규칙).

### 후보 (상업 이용 가능 · 라이선스 실확인)

| 폰트 | 라이선스 | 배포 | 성격 | 채택 판단 |
|---|---|---|---|---|
| **Pretendard (Variable)** | SIL OFL 1.1 | GitHub/CDN (Google Fonts 아님) | 한국 제품 UI 의 사실상 표준 | ❌ **버린다** — 안전하지만 **지금 한국 웹의 절반이 이 얼굴이다.** 목표가 "스크린샷 한 장으로 알아보기" 인데 정반대로 간다 |
| **IBM Plex Sans KR** | SIL OFL 1.1 | Google Fonts (`next/font` 확인됨, w100~700) | "technical and calm" — 절제된 그로테스크, 숫자가 단단함 | ✅ **UI·본문 채택.** Pretendard 만큼 흔하지 않고, 라틴 Plex 와 같은 뼈대라 영문 혼용이 자연스럽다 |
| **Hahmlet** | SIL OFL 1.1 | Google Fonts (`next/font` 확인됨, w100~900 + variable) | "literary and elegant" — 한글·라틴을 **한 사람이 같이 설계한** 세리프 | ✅ **디스플레이 채택.** 이 서비스의 Reading Room 방향과 Lora 시그니처에 정확히 붙는다 |
| Gowun Batang | OFL | Google Fonts (400/700만) | 시적·여백 넓음 | △ 후보. 굵기 2종뿐이라 UI 위계를 못 만든다 |
| Noto Serif KR | OFL | Google Fonts | 단정·신뢰 | △ 무난하지만 개성이 없다 — C1 은 고쳐도 "템플릿 느낌"은 안 고쳐진다 |
| MaruBuri | OFL | NAVER (자체 호스팅 필요) | 따뜻한 명조 | △ 자체 호스팅 비용. 2순위 |
| SUIT / Spoqa Han Sans Neo | OFL | 자체 CDN | UI 특화 | △ Pretendard 와 같은 이유로 후순위 |

> **결론 — Hahmlet(한글 디스플레이) + IBM Plex Sans KR(한글 UI/본문) + Lora(영어 원문·단어) 3면 구성.**
> 라틴 쪽 Plus Jakarta Sans 는 **숫자·라벨 전용으로 축소**하고 DM Sans 는 IBM Plex Sans KR 로 흡수한다
> (같은 역할 두 벌을 둘 이유가 없다).

### ⚠️ 성능 함정 (실측 근거 있는 것만)
Google Fonts 의 한글 폰트는 `unicode-range` 로 **수백 조각**으로 쪼개져 배포된다. `next/font` 는
`preload` 기본값이 `true` 라 루트 레이아웃에서 선언하면 **조각 전부를 preload** 한다 —
공개 사례로 *한글 폰트 281조각 2.32MB 가 모든 페이지에서 preload* 되는 것이 보고돼 있다.
→ **한글 폰트는 `preload: false` 로 선언한다.** 브라우저가 `unicode-range` 를 보고 필요한 조각만
가져간다. `display: 'swap'` 과 `adjustFontFallback` 은 유지해 CLS 를 막는다.
(도입 후 `03-system.md` 에 실제 전송량을 측정해 적는다 — 추정으로 적지 않는다.)

---

## 1-2. 레퍼런스 — 가져올 것 / 버릴 것

### 교육·언어 학습

| 레퍼런스 | 가져온다 | 버린다 |
|---|---|---|
| **Duolingo** | 학습 단위를 "길(path)"로 공간화해 **다음 한 걸음이 늘 한 곳에** 있다 | 마스코트·폭죽·하트·연속 압박. 철학 1(Calm UI)·3(Empathetic) 정면 위반이고 우리 청중은 고등학생~성인이다 |
| **Anki / AnkiDroid** | 카드 뒷면까지의 **무장식 직행**. 세션 화면에 브랜딩을 얹지 않는다 | 설정이 곧 UI 인 구조. 우리는 처방이 대신 정한다 |
| **Speak** | 발화 결과를 **파형·음높이로 즉시 되돌려 준다**(EchoMatch 가 이미 같은 축) | 구독 유도를 세션 안에 끼워 넣는 흐름 |
| **Elsa Speak** | 음소 단위 진단을 색으로 칠해 "어디가 틀렸는지"를 문장 위에서 바로 본다 | 점수 뱃지·리더보드 |
| **Readlang / LingQ** | **지문이 곧 인터페이스** — 모르는 단어가 지문 위에서 색으로 살고, 클릭이 툴바가 아니라 본문에서 일어난다 | 촘촘한 회색 크롬. 우리는 지면을 더 비운다 |
| **Quizlet** | (반면교사) 기능은 많은데 화면마다 얼굴이 달라 **어느 화면도 기억에 안 남는다** | 로고·아이콘·브랜드색 일체 (CLAUDE.md 절대 금지) |

### 에디토리얼 · 타이포 중심 (비교육 분야)

| 레퍼런스 | 가져온다 | 버린다 |
|---|---|---|
| **Are.na** | **괘선(rule)과 여백만으로 만드는 위계.** 카드 테두리가 거의 없고 구획은 선 한 줄로 갈린다 — 우리 C2(균일 카드)의 직접적 해답 | 극단적 저대비 회색. 접근성 4.5:1 을 못 지킨다 |
| **Readymag / It's Nice That** | 헤드라인을 **본문의 3~5배**로 키워 한 화면에 큰 목소리 하나만 두는 스케일 대비 | 스크롤 하이재킹·패럴랙스 (§2 gpt-taste 충돌 판정) |
| **Substack / Apple Books** | 읽기 지면의 **따뜻한 종이색 + 세리프 본문.** 이미 이 저장소의 방향과 같다 | 없음 — 유지 |
| **Linear** | 단일 액센트 원칙, 극도로 절제된 그림자, 밀도 높은 리스트 | 다크 퍼스트·네온 글로우 |
| **Monocle / Kinfolk (인쇄)** | **섹션 번호 + 얇은 괘선 + 넉넉한 윗여백**이 만드는 "지면감". 디지털에서 거의 안 쓰여 곧바로 식별된다 | 인쇄용 극세 헤어라인(모바일에서 사라진다) — 최소 1px 유지 |
| **NYT / Guardian 데이터 기사** | 숫자를 카드에 담지 않고 **지면에 직접 조판**한다. 큰 수 + 얇은 설명 한 줄 | 인터랙티브 과잉 |
| **Teenage Engineering / Braun 계열** | 기능 라벨을 **작게 대문자 아닌 소문자**로, 모든 장식 제거. 도구감 | 산업용 회색·노랑 (학습 정서에 안 맞는다) |

### 한국 맥락

| 레퍼런스 | 가져온다 | 버린다 |
|---|---|---|
| **밀리의서재 / 리디** | 한글 **명조 헤드라인 + 고딕 본문** 조합이 "책"을 즉시 환기한다. 학습 앱에서는 거의 안 쓰는 조합 | 표지 그리드 위주 구성(우리는 표지 자산이 0개다 — 00-inventory §0-5) |
| **토스** | 한 화면 한 질문, 큰 숫자, 문장형 한국어 카피 | 파랑 단일 브랜드 · 모션 밀도 |
| **교보/알라딘 상세** | (반면교사) 정보 밀도만 높이면 **아무것도 안 읽힌다** — `/wordvault/browse` 5,154px 캡처가 그 상태다 | 전부 |

---

## 1-3. 설치된 디자인 스킬 — 새로 설치한 것은 없다

`.claude/skills/` 에 **13개가 이미 설치**돼 있다(`design-taste-frontend` · `design-taste-frontend-v1` ·
`gpt-taste` · `high-end-visual-design` · `minimalist-ui` · `stitch-design-taste` ·
`industrial-brutalist-ui` · `redesign-existing-projects` · `imagegen-frontend-web` ·
`imagegen-frontend-mobile` · `image-to-code` · `brandkit` · `vocaflow-design`).

**추가 설치 0건.** 이유:
- 2026-09-04 감사에서 **13개 통째 설치는 전량 반려**되고 판정표만 채택됐다
  (`docs/reports/design-skill-audit-2026-09-04.md`). 같은 결론을 되풀이할 이유가 없다.
- 정본은 `.claude/skills/vocaflow-design/SKILL.md` 이고, 그 §1 라우팅 표가
  **"학습 중 화면에서는 외부 취향 스킬 전부 비활성"** 이라고 이미 정해 두었다.

### 이번 작업에서 실제로 부르는 것

| 단계 | 부른 스킬 | 왜 |
|---|---|---|
| 방향 결정 | `vocaflow-design` Part 1 §A/§C | 혁신 판정 3문과 디자인 렌즈 6 |
| 기존 화면 감사 | `redesign-existing-projects` 의 **감사 단계만** | §1 라우팅 표가 허용한 범위 |
| 공개/진입 화면 타입스케일 | `design-taste-frontend`(v2) | 같은 표가 허용 |
| 통계·리포트 화면 | 내장 `dataviz` | 같은 표 |
| **부르지 않는 것** | `gpt-taste`(GSAP pinning) · `stitch-design-taste`(perpetual micro-motion, 세리프 금지) · `high-end-visual-design`(글래스·헤비 섀도) | §2 충돌 판정표에서 이미 금지 |

---

## 1-4. 리서치가 내린 결론 3개

1. **한글 글꼴 도입이 1순위다.** 다른 어떤 작업보다 레버리지가 크고(70 라우트 × 글자 절반 이상),
   Hahmlet + IBM Plex Sans KR 로 라이선스·호스팅·성능 문제가 전부 해결된다.
2. **카드를 줄이고 괘선·여백·스케일 대비로 위계를 만든다.** Are.na / Monocle 계열의 지면 문법이
   C2(균일 카드 스택)의 직접 해답이고, Calm UI 와도 충돌하지 않는다 — 오히려 더 조용하다.
3. **색은 "많이"가 아니라 "한 곳에 크게".** 2026 트렌드 기사들은 5~7색 시스템을 말하지만
   이 제품에는 안 맞는다(원칙 6 Cognitive Load). 대신 **면적을 가진 브랜드 색 1개**를 만든다 —
   지금은 글자색 94%가 같은 잉크라 색이 사실상 0이다(00-inventory §0-4).

---

## 출처

- [korean-vibe-fonts — 상업 이용 가능 한글 웹폰트 목록](https://github.com/seulkikaang/korean-vibe-fonts/)
- [IBM Plex Sans KR — Google Fonts](https://fonts.google.com/specimen/IBM+Plex+Sans+KR)
- [Next.js — Font 컴포넌트 레퍼런스](https://nextjs.org/docs/pages/api-reference/components/font)
- [Next.js — Missing specified subset 경고](https://nextjs.org/docs/messages/google-fonts-missing-subsets)
- [한글 폰트 281개(2.32MB)가 모든 페이지에서 preload 된다 — inflace-client #8](https://github.com/in-flace/inflace-client/issues/8)
- [Fontfabric — 2026 타이포그래피 트렌드](https://www.fontfabric.com/blog/10-design-trends-shaping-the-visual-typographic-landscape-in-2026/)
- [Creative Bloq — 2026 그래픽 디자인 트렌드(질감·따뜻함)](https://www.creativebloq.com/design/graphic-design/texture-warmth-and-tactile-rebellion-the-big-graphic-design-trends-for-2026)
