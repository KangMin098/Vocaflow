# 3B 워크스페이스 — 실물 소스를 받는 법

> 왜 필요한가: `https://neon-currant.3b.dev` 는 **인증이 걸린 SPA** 라 에이전트가 열면 본문이 `3B` 한 줄이다.
> 소스 없이는 «얼마나 닮았는지»를 **잴 수가 없어서**, 스크린샷을 보고 손으로 근사하는 일이 반복된다.
> 아래 셋 중 **하나**만 해 주면 그 뒤는 명령 두 줄로 끝난다.

## 무엇을 재는가

숫자로 잴 것은 다섯 가지다. 이것만 맞으면 «체감»의 대부분이 맞는다.

| 재는 것 | 왜 |
|---|---|
| 상단 막대 높이 · 왼쪽 레일 폭 · 탭 줄 높이 | 화면을 몇 등분하는지가 첫인상을 정한다 |
| 판(pane) 개수 · 사이 간격 · 모서리 반경 | 「카드가 떠 있는 정도」 |
| 바닥 카드 개수 · 높이 · 간격 | 참조에서 가장 눈에 띄는 부품 |
| **글자 크기·굵기 히스토그램** | 간격보다 먼저 맞춰야 하는 것 — 계층이 몇 단인지 |
| **면 색 히스토그램** | 어떤 색이 «면적»으로 존재하는지 |

## 방법 ① 저장한 페이지 (가장 쉽고, 자격 증명이 오가지 않는다)

1. 로그인된 브라우저에서 3B 워크스페이스 화면을 연다 — 스크린샷에서 보내 준 **단계 상세 화면**
   (왼쪽 대화 레일 + `README.md` / `Output` 두 판 + 바닥 카드 4개)이 가장 정보가 많다.
2. 창을 **1600×1000 근처**로 맞춘다(전체화면이면 그대로도 된다 — 잴 때 뷰포트를 같이 적는다).
3. `Ctrl + S` → 저장 형식 **「웹페이지, 전체」**(Webpage, Complete) → 아무 폴더에 저장.
   - `workspace.html` 과 `workspace_files/` 폴더가 함께 생긴다. **둘 다** 있어야 한다(CSS 가 폴더에 있다).
   - Chrome 은 **지금 그려진 DOM** 을 저장하므로 SPA 도 그대로 남는다.
4. 파일 경로를 알려 준다. 예: `D:\refs\3b\workspace.html`

> 같은 방법으로 **Runs 화면**(지표 + 간트)과 **Readme 화면**도 저장해 주면 탭마다 대조할 수 있다.
> 한 장만 준다면 **단계 상세 화면**이 가장 쓸모 있다.

## 방법 ② 로그인 상태 파일 (실물에서 직접 잰다 — 가장 정확)

호버·전환까지 같은 조건으로 재려면 실제 페이지를 열어야 한다.

```bash
# 브라우저가 한 번 뜬다 → 사람이 3B 에 로그인하고 워크스페이스까지 간 뒤 터미널에서 Enter
npx playwright open --save-storage=D:\refs\3b\state.json https://neon-currant.3b.dev
```

- `state.json` 은 **쿠키가 든 파일**이다. 저장소에 커밋하지 않고(이 폴더는 `.gitignore`), 대화창에 붙여넣지 않는다.
  경로만 알려 주면 된다.
- 다 쓴 뒤에는 지운다.

## 방법 ③ DevTools 로 부분만

전체 저장이 어려우면 이것만이라도:

1. `F12` → **Elements** → 레일 · 판 · 바닥 카드 각각의 요소를 고르고 **Computed** 탭 내용을 복사
2. 필요한 값: `width` `height` `padding` `gap` `border-radius` `background-color` `border` `font-size` `font-weight` `line-height`
3. 텍스트로 붙여넣어 주면 손으로 표에 옮긴다 — ①·② 보다 부정확하지만 «눈대중»보다는 낫다.

## 받은 뒤 (에이전트가 하는 일)

```bash
# ① 참조를 잰다
node scripts/design/workspace-skeleton.mjs extract \
  --url "file:///D:/refs/3b/workspace.html" --label ref --out docs/design/refs/3b --viewport 1600x1000

# ② 우리 화면을 같은 자로 잰다
node scripts/design/workspace-skeleton.mjs extract \
  --url http://localhost:3000/csat/item/M2706-19 --state apps/web/playwright-auth/.auth-skeleton.json \
  --label ours --out docs/design/refs/3b --viewport 1600x1000

# ③ 대조 — 허용치를 넘으면 exit 1
node scripts/design/workspace-skeleton.mjs diff --dir docs/design/refs/3b --viewport 1600x1000
```

`diff` 가 내는 표에서 **✗ 가 0** 이 될 때까지 화면을 고친다. 이제 «닮았다/안 닮았다» 가
느낌이 아니라 숫자다 — 그것이 이 방법의 전부다.

## 저장소에 남기는 것 · 남기지 않는 것

| 남긴다 | 남기지 않는다 |
|---|---|
| `ref-1600x1000.json` · `ours-1600x1000.json`(수치만) | 저장한 페이지 원본(남의 저작물) |
| 대조 결과 요약(문서) | 로그인 상태 파일 · 쿠키 |
| | 화면 캡처 이미지(DD-47) |
