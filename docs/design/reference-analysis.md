# /admin 스타일 교체 — 레퍼런스 분석 · 현황 · 토큰안

> 과제: `/admin` 이하 전 화면을 레퍼런스 `https://neon-currant.3b.dev/` 의 스타일로 바꾼다(2026-09-24 사용자 지시 · DD-76).
> 이 문서는 1~3단계(분석 · 현황 · 토큰안)와 샘플 1화면 결과다. 4단계(개별 화면 전부)는 승인 후 진행한다.

## 0. 레퍼런스가 무엇인가

- `neon-currant.3b.dev` 는 **Tines 3B 앱**(워크플로 자동화 SaaS)의 테넌트다. 로그인 전에는 `login.tines.com` 의
  로그인 화면만 보인다 — 앱 화면은 사용자가 별도 Chrome 에서 로그인한 뒤 CDP 로 붙어서 읽었다.
- **DD-68 의 Tines 스킨과는 다른 체계다.** DD-68 은 `tines.com` **마케팅 사이트**를 실측해 글자·버튼·테두리가
  전부 보라(`#714bd0` · `#542f9c` · `#c3b5ff`)다. 이번 레퍼런스(앱 화면)는 먹색 글자 · 따뜻한 무채색 면 ·
  검정 컨트롤이고 **보라는 차트 계열색에만** 쓴다.
- 캡처 9장(1440×900): Recents · Monitoring · Connectors · Skills · Links · Chats · 워크플로 상세 · 「Create space」 모달 ·
  로그인. 위치 `docs/design/shots/reference-app/`(gitignore — 타사 앱 화면에 계정 이름이 찍힌다).
  계산값 원본 `extract-recents.json` · `extract-screens.json` 같은 폴더.

## 1. 레퍼런스 분석

### 1-1. 색 팔레트

레퍼런스 `:root` 의 변수는 전부 `light-dark(라이트, 다크)` 이고 값은 `color(display-p3 …)` 다. 아래 hex 는 p3 → sRGB 로
옮긴 값(범위 밖은 잘랐다).

| 역할 | 레퍼런스 변수 | 라이트 | 다크 |
|---|---|---|---|
| 글자 1 | `--text-primary` | `#0d0d17` | `#fcf9f5` |
| 글자 2 | `--text-secondary` | `#5e5f6c` | `#8d8e9b` |
| 반전 글자 | `--text-invert` | `#fcf9f5` | `#0d0d17` |
| 면(카드·패널) | `--surface-primary` | `#ffffff` | `#181420` |
| 캔버스(사이드바·바탕) | `--surface-secondary` | `#fbf9f7` | `#0d0d17` |
| 팝오버 | `--surface-popover` | `#ffffff` | `#282531` |
| 호버 | `--surface-hover` | `#f8f7f5` | `#1b1824` |
| 선 | `--border-alpha` | `rgba(13,13,23,.10)` | `rgba(252,249,245,.08)` |
| 선택·채움 | `--alpha8`(웜 브라운 8%) | `rgba(84,50,0,.08)` | `rgba(224,226,255,.08)` |
| 1차 컨트롤 | `--control-bg` / `--control-fg` | `#0d0d17` / `#fcf9f5` | `#fcf9f5` / `#0d0d17` |
| 회색 사다리 | `--gray-200/400/600/800/1000` | `#eeebe7` `#d0cdc9` `#918f8b` `#4a4744` `#1a1815` | `#252530` `#40414d` `#787986` `#bbbcca` `#f3f4ff` |
| 성공 | `--green-200/600/800` | `#e4eee7` `#00a46e` `#007442` | 반전 |
| 오류 | `--red-200/600/800` | `#ffdfd7` `#f04e49` `#b02727` | 반전 |
| 경고 | `--yellow-200/600/800` | `#ffe7b0` `#da8900` `#a05600` | 반전 |
| 정보·포커스 | `--sky-200/600/800` | `#e3edf1` `#009bcb` `#006a9b` | 반전 |
| 기타 계열 | teal · orange · pink · purple | 차트·아바타·상태 점 | — |
| 툴팁 | `--tooltip-bg/fg` | `#282531` / `#fcf9f5` | 같음 |
| 모달 배경막 | `--modal-backdrop` | `rgba(13,13,23,.16)` | 같음 |

- 보이는 면적 최빈 배경: 먹색(아이콘·아바타) → 회색 2 → 웜 알파 4% → 흰색 → 캔버스 순. 보라 배경은 차트 칠 6건뿐이다.
- 상태 점: Live = 초록 `#00a46e` 원 6px.

### 1-2. 서체와 크기

| 항목 | 값 |
|---|---|
| 본문 서체 | `InterVariable, sans-serif` (계산값 481회) |
| 고정폭 | `"Geist Mono", monospace` — 날짜·수치·단축키 |
| 크기 스케일(최빈) | 10px/350 · 12px/350 · 10px/450 · 12px/450 · 9px/450 · 18px/600(제목) |
| 굵기 | 350(본문) · 450(라벨·내비) · 600(제목) · 700(아이콘 속 글자) — Variable 폰트의 중간 굵기를 쓴다 |
| 줄 높이 | 12px→16px · 10px→12px (약 1.33 / 1.2) |

밀도가 높은 앱 UI 다(본문 12px). 우리 admin 은 11~16px 이라 **크기 스케일은 이번에 옮기지 않는다** — 글자 크기를
한꺼번에 줄이면 한글 가독성과 44px 터치 타겟 규칙이 깨진다. 굵기·서체·색만 옮긴다(§3 결정 3).

### 1-3. 간격 · 모서리 · 그림자

| 항목 | 값 |
|---|---|
| 모서리 최빈 | 8px(467) · 9999px 알약(203) · 50% 원(115) · 12px(112) · 4px(64) · 24px(42) · 16px(20) |
| 그림자 — 면 | `0 0.5px 0 rgba(13,13,23,.1)` · `inset 0 0 0 .5px rgba(13,13,23,.1)` — 0.5px 링이 테두리 역할 |
| 그림자 — 떠 있는 것 | `--elevation-low` = `0 6px 12px /.04, 0 1px 3px /.05, 0 1px 0 /.02` |
| 그림자 — 모달 | `--elevation-high` = 5겹(154/98/55/25/6px, 알파 0~.06) |
| 테두리 | `1px rgba(13,13,23,.1)` 72회 — 사실상 유일한 선 |
| 간격 | 내비 항목 높이 32px · 좌우 패딩 8~12px · 카드 내부 24~32px · 격자 간격 12px |

### 1-4. 아이콘

- 선 아이콘 16px, 굵기 약 1.5px, 먹색 또는 글자 2색. 사이드바·탭·표 머리에 쓴다.
- 우리 `lucide-react` 와 같은 계열(선·둥근 끝)이라 **아이콘은 교체하지 않는다**. 크기·굵기만 맞춘다.
- 레퍼런스 로고·일러스트(겹친 원 무늬)는 Tines 저작물이라 가져오지 않는다.

### 1-5. 레이아웃

```
┌ 사이드바 216px(캔버스색 · 테두리 없음) ┬───────────────────────────────┐
│ 로고 · 검색 · 아바타 = 상단 56px 가로띠  │ 흰 패널: 캔버스 위에 12px 여백 ·  │
│ 내비 32px 행 · 선택 = 웜 알파 8% 면     │ 1px 알파 선 · 모서리 12px        │
│ 구역 사이 1px 구분선 · 구역 제목 10px    │ 패널 머리 = 알약 탭(선택 = 회색 면)│
│ 하단: 사이드바 접기                     │ 본문 = 표 또는 카드 격자          │
└─────────────────────────────────────────┴───────────────────────────────┘
```

- 캔버스(`#fbf9f7`) 위에 흰 패널이 **떠 있고** 사이드바는 캔버스와 한 면이다(경계선이 없다).
- 모니터링 대시보드: 흰 패널 안에 캔버스색 카드(모서리 12 · 1px 선)가 12px 간격 격자.

### 1-6. 컴포넌트

| 부품 | 레퍼런스 |
|---|---|
| 버튼 1차 | 먹색 알약(`--control-bg`), 크림 글자 12px/500. 비활성은 회색 `#918f8b` 면 |
| 버튼 2차 · 아이콘 | 투명 알약 32×32, 호버 `--surface-hover` |
| 탭 | 알약 32px, 선택 = 회색 채움 + 먹색 글자, 비선택 = 글자 2색 + 아이콘. 개수 배지 붙음 |
| 표 | 머리 12px 글자 2색 · 행 높이 약 80px · 행 사이 1px 알파 선 · 세로선 없음 |
| 입력 | 높이 32px · 모서리 8px · 흰 면 · 포커스 = 먹색 1px + 3px 알파 링(`0 0 0 3px rgba(13,13,23,.1)`) |
| 입력 묶음 | 캔버스색 상자(모서리 12 · 1px 선) 안에 라벨 12px/500 + 입력 |
| 배지·칩 | 알약, 회색 2 면 + `#` 아이콘 + 글자 2색 11px. 숫자 배지는 고정폭 |
| 모달 | 흰 면 · 모서리 24px · 너비 680 · 머리 56px(아이콘 타일 + 제목 + 알약 탭 + 닫기) · 머리/발 1px 선 · 배경막 알파 16% |
| 토글 | 회색 트랙 알약 · 흰 손잡이 |
| 토스트·툴팁 | 짙은 회보라 `#282531` 면 · 크림 글자(툴팁 변수 실측, 토스트는 화면에 뜨지 않아 미측정) |

### 1-7. 다크 모드

있다 — 모든 색 변수가 `light-dark()` 이고 `color-scheme` 으로 전환된다(캡처는 라이트만). 다크 값은 §1-1 표.

### 1-8. 라이선스

| 자산 | 판정 | 사용 |
|---|---|---|
| InterVariable | Inter — SIL OFL 1.1 | **그대로 쓴다**(next/font `Inter`) |
| Geist Mono | SIL OFL 1.1 | 쓸 수 있으나 next 14.2 폰트 목록에 없다 → 이미 싣는 **JetBrains Mono**(OFL, 비슷한 기하 고정폭)로 대체 |
| 로고 · 겹친 원 일러스트 · 아이콘 세트 | Tines 저작물 | **쓰지 않는다** — 아이콘은 lucide 유지, 일러스트는 5단계에서 같은 화풍 대체물 검토 |
| 색 값 · 치수 | 사실 정보 | 토큰으로 옮긴다 |

## 2. 현황

- **라우트 61개**(`find apps/web/src/app/admin -name page.tsx`): `/admin` · analytics · articles(+preview) · billing ·
  comic(+[bookId], drain) · compose · csat(13) · curation(+preview) · db · kice(6) · library · pd-comics(+reader) ·
  pending-words · quality(3) · reports · settings · topic-corpus · users · video · vocab(13) · vocabulary · vrl(7).
- **공통 레이아웃**: `app/admin/layout.tsx`(requireAdmin + `AdminSidebar` + main). 공통 부품: `components/admin/`
  (`AdminSidebar` · `AdminPageHeader` · `AdminKpiGrid` · `AdminScreenHelp` · `MockDataBanner` · 패널 4) + 전역 `components/ui/`(Dialog · Toast 등).
- **보라가 오는 곳 — 코드가 아니라 토큰이다.** admin 코드의 `var(--…)` 사용 상위: `--t2` 1,632 · `--bd` 1,078 · `--t1` 797 ·
  `--p` 723. 기본 켜진 Tines 스킨(DD-68)이 이 토큰을 보라로 칠한다: 라이트 25개 · 다크 25개(다크는 바탕 `--bg2 #211735` 까지 보라).
- 그 밖의 보라 토큰: 전역 `--admin #8B5CF6` · `--admin-strong #6D28D9` · `--combo #8B5CF6` · `--cefr-c1 #7C3AED` · `--cefr-c2 #581C87` ·
  자두 계열 `--ios-purple*` · `--accent-plum` · `--track-topic`.
- Tailwind 설정: `violet`/`purple` 클래스 정의 0 · admin 코드의 `violet-*`/`purple-*`/`indigo-*` 클래스 **0건**.
- **하드코딩 보라 hex(4단계 대상)**: `quality/gates/GateCheckClient.tsx:165` · `quality/judge/JudgeClient.tsx:271,405`(`#7c4ff0`) ·
  `admin/page.tsx:360`(`#F5F3FF`) · `vocabulary/VocabularyTable.tsx:24`(`C2 #581C87`) · 테스트 픽스처 `csat/__tests__/order-wizard.test.tsx:53`.
  `db/__tests__/legacy/*` 는 렌더되지 않는 옛 화면 보존본이다.
- 보라 아닌 하드코딩 hex 도 있다(`#9C3A30` 91 · `#2E7D5A` 79 · `#B5803A` 54 · `#8A8278` 38 = Memory Decay 4색, AGENTS.md 가 값을 고정한 의미색) —
  4단계에서 토큰 참조(`--memory-*`)로 바꾸되 값은 유지한다.

## 3. 토큰안

한 곳: **`packages/design-tokens/src/skins/admin-app.css`**. 새 이름을 만들지 않고 **기존 토큰 이름에 레퍼런스 값을 얹는다** —
admin 화면 61개가 이미 토큰만 읽으므로 이 파일 하나로 전 화면이 바뀐다.

| 결정 | 내용 | 이유 |
|---|---|---|
| 1. 범위 | `:root:has([data-area="admin"])` — `app/admin/layout.tsx` 가 표지를 건다 | 변수가 `:root` 에 있어 body 포털(Dialog·Toast)도 받는다. `/admin` 밖은 그대로 |
| 2. 우선순위 | `globals.css` 에서 `tines.css` **뒤에** import | 명시도가 tines 와 같아(0,2,0 / 다크 0,3,0) 순서로 이긴다 |
| 3. 크기 스케일 | 옮기지 않는다 | §1-2 — 한글 가독성 · 44px 터치 타겟 |
| 4. 서체 | `--font-admin-sans`(Inter) · `--font-admin-mono`(JetBrains Mono 두 번째 선언) | `--font-mono` 를 덮으면 원래 변수를 가리킬 수 없어 별도 변수가 필요 |
| 5. CEFR C 단 | C1 주황 `#a05600` · C2 빨강 `#b02727` | 원래 보라였다. A 초록 → B 파랑 → C 뜨거운 색으로 순서가 유지된다 |

토큰 대응(라이트):

| 우리 토큰 | 값 | 레퍼런스 |
|---|---|---|
| `--p` · `--admin` · `--ju` | `#0d0d17` | `--control-bg` |
| `--on-p` | `#fcf9f5` | `--control-fg` |
| `--p-light` · `--ju-light` · `--bg3` · `--tint-lavender` | `#eeebe7` | `--gray-200` |
| `--bg` / `--bg2` | `#ffffff` / `#fbf9f7` | `--surface-primary` / `--surface-secondary` |
| `--t1` / `--t2` / `--t3` | `#0d0d17` / `#5e5f6c` / `#62616a` | text-primary / text-secondary / (AA 보정) |
| `--bd` / `--bd-input` / `--bd-strong` | `rgba(13,13,23,.1)` / `.14` / `#d0cdc9` | `--border-alpha` / — / `--gray-400` |
| `--bdf`(포커스) | `#006a9b` | `--sky-800` (sky-600 은 흰 면 3.0 이라 한 단 짙게) |
| `--success` / `--error` / `--warning` / `--info` | `#007442` / `#b02727` / `#a05600` / `#006a9b` | 각 계열 800 |
| `*-light` | `#e4eee7` / `#ffdfd7` / `#ffe7b0` / `#e3edf1` | 각 계열 200 |
| `--r-sm/md/lg/xl/2xl` | 4 / 8 / 12 / 16 / 24px | 실측 최빈 |
| `--sh-sm` · `--sh-md` · `--sh-float` | 0.5px 링 · elevation-low · elevation-high | 실측 |

다크는 레퍼런스 `light-dark()` 의 두 번째 값(파일 두 번째 블록).

## 4. 대비 (WCAG AA)

| 글자 \ 면 | 흰 `#fff` | 캔버스 `#fbf9f7` | 채움 `#eeebe7` |
|---|---|---|---|
| `--t1` `#0d0d17` | 19.32 | 18.39 | 16.26 |
| `--t2` `#5e5f6c` | 6.31 | 6.01 | 5.31 |
| `--t3` `#62616a` | 6.11 | 5.82 | 5.14 |
| `--success` `#007442` | 5.87 | 5.59 | 4.94 |
| `--error` `#b02727` | 6.63 | 6.32 | 5.58 |
| `--warning` `#a05600` | 5.49 | 5.23 | 4.62 |
| `--info` `#006a9b` | 5.94 | 5.66 | 5.00 |
| 1차 버튼 크림 on 먹색 | 18.41 | | |

다크: `--t1` 17.25 · `--t2` 7.86 · `--t3` 5.58 · 의미색 8.05~10.25(바탕 `#181420`). 전부 4.5 이상.
(`--t3` 는 처음 `#6b6a72` 로 잡았는데 채움면 위 4.50 · 의미색 틴트 위 4.27 이라 한 단 짙게 고쳤다.)

## 5. 샘플 적용 — `/admin/users`

바뀐 파일 4개: `skins/admin-app.css`(신규) · `design-tokens/package.json`(exports) · `app/globals.css`(import 한 줄) ·
`app/layout.tsx`(Inter · JetBrains Mono 변수) · `app/admin/layout.tsx`(`data-area="admin"`).

| 검증 | 결과 |
|---|---|
| 계산된 색의 보라(색상 245~320°) — `scripts/design/admin-purple-scan.mjs` | `/admin/users` · `/admin` 라이트 **0** · 다크 **0** |
| 서체(계산값) | Inter ×60 · JetBrains Mono ×12 (`/admin/users`) |
| 전/후 캡처 | `docs/design/shots/replica/admin-before/` → `authed-admin-users-1440-01.png`(gitignore) |

토큰만 바꿨으므로 **레이아웃은 아직 레퍼런스와 다르다**: 사이드바 오른쪽 경계선 · 흰 패널이 떠 있는 구조 ·
알약 탭 · 32px 내비 행은 4단계의 「공통 레이아웃」에서 한다. 로고 타일의 그러데이션도 같은 단계.

## 6. 남은 단계(승인 후)

1. 공통 레이아웃 — `AdminSidebar`(경계선 제거 · 32px 행 · 선택 = 웜 알파 면) · 콘텐츠를 흰 떠 있는 패널로 · `AdminPageHeader`.
2. 공통 컴포넌트 — 버튼(알약) · 카드 · 표 · 입력 · 배지 · Dialog(모서리 24 · 배경막) · Toast. **여기서 한 번 더 보고.**
3. 개별 화면 61개 — 하드코딩 hex 제거(§2 목록) + 라우트마다 전/후 캡처 + `admin-purple-scan` 0.
4. 이미지·일러스트 — 레퍼런스 무늬는 쓰지 않는다. 필요한 자리만 같은 화풍 대체물.
5. 빌드 · 타입 · 주요 화면 동작 확인 → DD-76 · ADMIN_CONSOLE · DESIGN_SYSTEM · CHANGELOG 갱신.
