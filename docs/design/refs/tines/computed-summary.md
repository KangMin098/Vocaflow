# Tines — computed values (Stage 1)

> 생성 `scripts/design/extract-computed.mjs` · 2026-09-20 · 출처 https://www.tines.com/
> **손으로 고치지 말 것** — 다음 실행에 덮어써진다. 형용사·판정은 이 파일에 적지 않는다(DD-62).
> 색은 사이트가 `color(display-p3 …)` 로 내보내므로 sRGB 근사 hex 로 환산했다.

## 1440×900

### 타입 스케일

| 선택자 | size | weight | line-height | letter-spacing | family | n |
|---|---|---|---|---|---|---|
| `h1` | 64px | 400 | 67.2px | -1.92px | Roobert | 1 |
| `h2` | 56px | 400 | 58.8px | -1.68px | Roobert | 3 |
| `h2` | 52px | 400 | 57.2px | -1.56px | Reckless | 1 |
| `h3` | 24px | 400 | 27.6px | -0.24px | Reckless | 5 |
| `h3` | 24px | 700 | 26.4px | -0.24px | Reckless | 4 |
| `h3` | 24px | 400 | 28.8px | -0.24px | Reckless | 4 |
| `p` | 16px | 500 | 20px | — | Roobert | 5 |
| `p` | 13px | 700 | 13px | 0.65px | Roobert Mono | 4 |
| `p` | 16px | 500 | 24px | — | Roobert | 4 |
| `p` | 22px | 500 | 30.8px | — | Reckless | 2 |
| `a` | 16px | 400 | 18.4px | — | Roobert | 2 |
| `a` | 13px | 700 | 14.95px | — | Roobert Mono | 1 |
| `button` | 16px | 400 | 18.4px | — | Roobert | 8 |
| `button` | 14px | 500 | 16.1px | — | Roobert | 5 |
| `button` | 14px | 600 | 16.1px | — | Roobert | 4 |
| `button` | 12px | 700 | 13.8px | 0.72px | Roobert Mono | 2 |

### 간격 스케일

- 띠(band) 기준: `div.PageBackdrop-module-scss-module__KKf-uW__pageShell > main > div.HomeContent-module-scss-module__FyCfzG__content` 안에서 전폭 · 흐름 안 · 다른 띠를 품지 않는 가장 안쪽 블록
- 띠 수: 7 — div 298.5 · div 680 · div 1015.7 · section 819.06 · section 1232.98 · section 756.36 · section 518.05
- 띠 사이 세로 간격(px, 순서대로): 477 · 96 · 96 · 156 · 156 · 156
- 섹션 padding(top / bottom / left) 빈도: 0px / 0px / 40px ×3 · 16.5px / 0px / 0px ×1 · 30px / 96px / 40px ×1 · 0px / 0px / 0px ×1

### 컨테이너 폭

| 폭(px) | 등장 |
|---|---|
| 1360 | 13 |
| 1280 | 3 |
| 1296 | 2 |
| 1398 | 1 |
| 1396 | 1 |
| 1158 | 1 |
| 920 | 1 |
| 832 | 1 |

### 격자

| 열 수 | 등장 | 예시 template | gap |
|---|---|---|---|
| 2 | 7 | `140px 140px` | 8px |
| 1 | 2 | `1280px` | 8px |
| 3 | 1 | `650px 28px 650px` | 16px |
| 4 | 1 | `322px 322px 322px 322px` | 24px |

### 모서리 · 그림자

- border-radius: 14px 14px 0px 0px ×5 · 50px ×3 · 990px ×2 · 999px ×2 · 24px ×2 · 50% ×1
- box-shadow: **0건**

### 색 (측정된 요소 기준)

| 속성 · 값 | 등장 |
|---|---|
| `color #714bd0` | 31 |
| `color #fcf9f5` | 31 |
| `color #cae4d4` | 2 |
| `color #000000` | 2 |
| `background-color #cae4d4` | 2 |
| `background-color #542f9c` | 1 |
| `color #6741bf` | 1 |
| `background-color #ece8fd` | 1 |
| `color #542f9c` | 1 |
| `background-color #007f4a` | 1 |
| `background-color #714bd0` | 1 |
| `background-color #008784` | 1 |
| `background-color #c05100` | 1 |
| `background-color #3565cc` | 1 |

### `:root` 커스텀 속성 (536개)

색인 것 467개는 sRGB 근사 hex 를 함께 적는다(Stage 3 ΔE2000 입력).

| 이름 | 값 | sRGB |
|---|---|---|
| `--c-green99` | `color(display-p3 .0564 .0994 .089)` | `#0b1a17` |
| `--c-magenta45` | `color(display-p3 .6897 .3037 .7955)` | `#be45d1` |
| `--blue900` | `#20304c` | `#20304c` |
| `--pink` | `#e269a4` | `#e269a4` |
| `--red800` | `#772e2c` | `#772e2c` |
| `--c-coolGray40` | `color(display-p3 .5714 .5734 .6141)` | `#92929e` |
| `--c-orange75` | `color(display-p3 .4275 .2103 .0929)` | `#75320d` |
| `--c-teal99` | `color(display-p3 .0581 .0963 .1106)` | `#0c191d` |
| `--lime800` | `#52601e` | `#52601e` |
| `--lime600` | `#8aa028` | `#8aa028` |
| `--c-lime5` | `color(display-p3 .9387 .9561 .731)` | `#eef4b4` |
| `--c-pink1` | `color(display-p3 .9975 .9542 .9613)` | `#fff3f5` |
| `--c-purple65` | `color(display-p3 .3454 .2253 .6586)` | `#5d38ae` |
| `--purple900` | `#32274b` | `#32274b` |
| `--red` | `#e14f4c` | `#e14f4c` |
| `--c-orange60` | `color(display-p3 .6368 .3044 .0946)` | `#af4700` |
| `--c-darkest` | `color(display-p3 .0839 .0739 .1149)` | `#16131e` |
| `--c-yellow80` | `color(display-p3 .3363 .2022 .0871)` | `#5b320e` |
| `--orange200` | `#ffc8a3` | `#ffc8a3` |
| `--light400` | `#e4e0d9` | `#e4e0d9` |
| `--c-orange5` | `color(display-p3 1.0581 .8897 .786)` | `#ffe1c4` |
| `--fontSystem` | `-apple-system, BlinkMacSystemFont, Arial, Roboto` | — |
| `--green500` | `#25a871` | `#25a871` |
| `--c-green1` | `color(display-p3 .9624 .969 .9592)` | `#f5f7f4` |
| `--c-teal90` | `color(display-p3 .066 .1743 .1877)` | `#032d31` |
| `--lime700` | `#718424` | `#718424` |
| `--footerForegroundColor` | `color(display-p3 .4203 .3017 .7863)` | `#714bd0` |
| `--c-purple99` | `color(display-p3 .0937 .0727 .1432)` | `#191226` |
| `--c-magenta10` | `color(display-p3 .9678 .7914 1.0055)` | `#ffc8ff` |
| `--c-purple45` | `color(display-p3 .505 .4021 .8893)` | `#8665eb` |
| `--c-magenta97` | `color(display-p3 .1229 .08 .1476)` | `#211427` |
| `--acc55` | `color(display-p3 .4203 .3017 .7863)` | `#714bd0` |
| `--c-green10` | `color(display-p3 .8115 .8907 .8359)` | `#cae4d4` |
| `--c-coolGray65` | `color(display-p3 .35 .3476 .3938)` | `#595965` |
| `--c-warmGray97` | `color(display-p3 .1246 .0904 .1152)` | `#21171e` |
| `--yellow800` | `#7a4d16` | `#7a4d16` |
| `--c-purple50` | `color(display-p3 .4583 .3429 .848)` | `#7a56e0` |
| `--green` | `#25a871` | `#25a871` |
| `--gridColumnCount` | `12` | — |
| `--c-purple30` | `color(display-p3 .6523 .5827 .9902)` | `#aa94ff` |
| `--gap` | `2.4rem` | — |
| `--widerPageMargin` | `4rem` | — |
| `--c-sky50` | `color(display-p3 .0632 .4985 .6918)` | `#0082b5` |
| `--c-red70` | `color(display-p3 .5046 .1583 .1355)` | `#8c1e1d` |
| `--c-blue85` | `color(display-p3 .1067 .1531 .3908)` | `#182768` |
| `--c-yellow10` | `color(display-p3 1.032 .8561 .5914)` | `#ffd88c` |
| `--c-orange97` | `color(display-p3 .1431 .0866 .0709)` | `#271511` |
| `--c-teal30` | `color(display-p3 .3756 .7558 .7327)` | `#2ac4bc` |
| `--footerBackgroundColor` | `transparent` | — |
| `--navBackdropRadius` | `99rem` | — |
| `--c-lime97` | `color(display-p3 .0967 .1116 .0668)` | `#181d10` |
| `--pink500` | `#e269a4` | `#e269a4` |
| `--c-yellow65` | `color(display-p3 .529 .3103 .0107)` | `#904c00` |
| `--c-pink2` | `color(display-p3 1.0079 .9335 .9535)` | `#ffedf3` |
| `--c-green25` | `color(display-p3 .5235 .772 .6279)` | `#71c79d` |
| `--blue50` | `#eceff6` | `#eceff6` |
| `--c-yellow45` | `color(display-p3 .7553 .499 .0853)` | `#cc7b00` |
| `--sidebarWidth` | `28.8rem` | — |
| `--yellow300` | `#fdbd74` | `#fdbd74` |
| `--c-magenta40` | `color(display-p3 .7432 .3436 .8504)` | `#cc50e0` |
| `--c-lime2` | `color(display-p3 .9683 .9728 .8405)` | `#f7f8d3` |
| `--c-orange20` | `color(display-p3 1.0455 .692 .4844)` | `#ffab70` |
| `--c-warmGray90` | `color(display-p3 .1771 .1456 .167)` | `#2f252b` |
| `--pink100` | `#ffdce8` | `#ffdce8` |
| `--acc75` | `color(display-p3 .2712 .1627 .5198)` | `#4a288a` |
| `--c-lime65` | `color(display-p3 .3547 .4022 .0509)` | `#576700` |
| `--c-red97` | `color(display-p3 .1455 .0794 .0794)` | `#281314` |
| `--c-orange1` | `color(display-p3 1.0082 .9574 .9207)` | `#fff4ea` |
| `--wideGridGap` | `2.4rem` | — |
| `--yellow25` | `#fdf4ea` | `#fdf4ea` |
| `--c-teal50` | `color(display-p3 -.0737 .5684 .5556)` | `#00948f` |
| `--c-lime15` | `color(display-p3 .8452 .8781 .5031)` | `#d6e071` |
| `--c-purple35` | `color(display-p3 .602 .5213 .9623)` | `#9e84fd` |
| `--lime50` | `#f4f3e0` | `#f4f3e0` |
| `--white` | `#fff` | — |
| `--lime500` | `#99b22a` | `#99b22a` |
| `--lime900` | `#343e17` | `#343e17` |
| `--renderedWideGridWidth` | `calc(min(1520px, 100vw - 0px) - 4rem * 2)` | — |
| `--pink400` | `#f486b8` | `#f486b8` |
| `--c-lime70` | `color(display-p3 .31 .3539 .0707)` | `#4c5b00` |
| … | 나머지 456개는 `computed.json` | |

## 375×812

### 타입 스케일

| 선택자 | size | weight | line-height | letter-spacing | family | n |
|---|---|---|---|---|---|---|
| `h1` | 38px | 500 | 42.56px | -1.14px | Roobert | 1 |
| `h2` | 36px | 500 | 39.6px | -1.08px | Roobert | 3 |
| `h2` | 38px | 400 | 41.8px | -0.76px | Reckless | 1 |
| `h3` | 12.75px | 700 | 14.6625px | — | Roobert | 5 |
| `h3` | 18px | 700 | 25.2px | -0.18px | Roobert | 4 |
| `h3` | 18px | 400 | 21.6px | — | Reckless | 4 |
| `p` | 16px | 500 | 22.4px | — | Roobert | 5 |
| `p` | 13px | 700 | 13px | 0.65px | Roobert Mono | 4 |
| `p` | 20px | 500 | 28px | — | Reckless | 2 |
| `p` | 18px | 500 | 22.5px | — | Roobert | 2 |
| `a` | 16px | 400 | 18.4px | — | Roobert | 2 |
| `a` | 14px | 600 | 16.1px | — | Roobert | 1 |
| `button` | 16px | 400 | 18.4px | — | Roobert | 8 |
| `button` | 14px | 500 | 16.1px | — | Roobert | 5 |
| `button` | 12px | 700 | 13.8px | 0.72px | Roobert Mono | 2 |
| `button` | 13px | 400 | 14.95px | — | Roobert | 1 |

### 간격 스케일

- 띠(band) 기준: `div.PageBackdrop-module-scss-module__KKf-uW__pageShell > main > div.HomeContent-module-scss-module__FyCfzG__content` 안에서 전폭 · 흐름 안 · 다른 띠를 품지 않는 가장 안쪽 블록
- 띠 수: 9 — div 368.5 · div 198.02 · div 500 · div 403 · div 774.58 · div 1241.67 · div 398.42 · div 665.66 · section 469.39
- 띠 사이 세로 간격(px, 순서대로): 87.41 · 45 · 40 · 0 · 40 · 503.03 · 561.54 · 96
- 섹션 padding(top / bottom / left) 빈도: 0px / 0px / 0px ×2 · 0px / 0px / 18px ×2 · 16.5px / 0px / 0px ×1 · 18px / 40px / 18px ×1

### 컨테이너 폭

| 폭(px) | 등장 |
|---|---|
| 339 | 50 |
| 158 | 4 |
| 359 | 3 |
| 288 | 2 |
| 219 | 1 |
| 205 | 1 |
| 201 | 1 |
| 200 | 1 |

### 격자

| 열 수 | 등장 | 예시 template | gap |
|---|---|---|---|
| 1 | 9 | `339px` | 35px |
| 2 | 5 | `140px 140px` | 8px |
| 3 | 1 | `139.5px 28px 139.5px` | 16px |
| 5 | 1 | `75px 75px 75px 75px 75px` | 0px |

### 모서리 · 그림자

- border-radius: 999px ×2 · 50px ×1 · 990px ×1 · 50% ×1
- box-shadow: **0건**

### 색 (측정된 요소 기준)

| 속성 · 값 | 등장 |
|---|---|
| `color #714bd0` | 30 |
| `color #fcf9f5` | 25 |
| `color #cae4d4` | 3 |
| `color #542f9c` | 1 |
| `background-color #007f4a` | 1 |
| `background-color #714bd0` | 1 |
| `background-color #008784` | 1 |
| `background-color #c05100` | 1 |
| `background-color #3565cc` | 1 |
| `color #000000` | 1 |

### `:root` 커스텀 속성 (536개)

색인 것 467개는 sRGB 근사 hex 를 함께 적는다(Stage 3 ΔE2000 입력).

| 이름 | 값 | sRGB |
|---|---|---|
| `--c-green99` | `color(display-p3 .0564 .0994 .089)` | `#0b1a17` |
| `--c-magenta45` | `color(display-p3 .6897 .3037 .7955)` | `#be45d1` |
| `--red800` | `#772e2c` | `#772e2c` |
| `--pink` | `#e269a4` | `#e269a4` |
| `--blue900` | `#20304c` | `#20304c` |
| `--c-coolGray40` | `color(display-p3 .5714 .5734 .6141)` | `#92929e` |
| `--c-orange75` | `color(display-p3 .4275 .2103 .0929)` | `#75320d` |
| `--c-teal99` | `color(display-p3 .0581 .0963 .1106)` | `#0c191d` |
| `--lime800` | `#52601e` | `#52601e` |
| `--c-lime5` | `color(display-p3 .9387 .9561 .731)` | `#eef4b4` |
| `--lime600` | `#8aa028` | `#8aa028` |
| `--c-pink1` | `color(display-p3 .9975 .9542 .9613)` | `#fff3f5` |
| `--c-purple65` | `color(display-p3 .3454 .2253 .6586)` | `#5d38ae` |
| `--purple900` | `#32274b` | `#32274b` |
| `--red` | `#e14f4c` | `#e14f4c` |
| `--c-orange60` | `color(display-p3 .6368 .3044 .0946)` | `#af4700` |
| `--c-darkest` | `color(display-p3 .0839 .0739 .1149)` | `#16131e` |
| `--c-yellow80` | `color(display-p3 .3363 .2022 .0871)` | `#5b320e` |
| `--orange200` | `#ffc8a3` | `#ffc8a3` |
| `--light400` | `#e4e0d9` | `#e4e0d9` |
| `--c-orange5` | `color(display-p3 1.0581 .8897 .786)` | `#ffe1c4` |
| `--fontSystem` | `-apple-system, BlinkMacSystemFont, Arial, Roboto` | — |
| `--green500` | `#25a871` | `#25a871` |
| `--c-green1` | `color(display-p3 .9624 .969 .9592)` | `#f5f7f4` |
| `--c-teal90` | `color(display-p3 .066 .1743 .1877)` | `#032d31` |
| `--lime700` | `#718424` | `#718424` |
| `--footerForegroundColor` | `color(display-p3 .4203 .3017 .7863)` | `#714bd0` |
| `--c-magenta97` | `color(display-p3 .1229 .08 .1476)` | `#211427` |
| `--acc55` | `color(display-p3 .4203 .3017 .7863)` | `#714bd0` |
| `--c-purple45` | `color(display-p3 .505 .4021 .8893)` | `#8665eb` |
| `--c-purple99` | `color(display-p3 .0937 .0727 .1432)` | `#191226` |
| `--c-magenta10` | `color(display-p3 .9678 .7914 1.0055)` | `#ffc8ff` |
| `--c-green10` | `color(display-p3 .8115 .8907 .8359)` | `#cae4d4` |
| `--c-coolGray65` | `color(display-p3 .35 .3476 .3938)` | `#595965` |
| `--c-warmGray97` | `color(display-p3 .1246 .0904 .1152)` | `#21171e` |
| `--yellow800` | `#7a4d16` | `#7a4d16` |
| `--c-purple50` | `color(display-p3 .4583 .3429 .848)` | `#7a56e0` |
| `--green` | `#25a871` | `#25a871` |
| `--gridColumnCount` | `4` | — |
| `--c-purple30` | `color(display-p3 .6523 .5827 .9902)` | `#aa94ff` |
| `--gap` | `1.6rem` | — |
| `--widerPageMargin` | `1.8rem` | — |
| `--c-sky50` | `color(display-p3 .0632 .4985 .6918)` | `#0082b5` |
| `--c-red70` | `color(display-p3 .5046 .1583 .1355)` | `#8c1e1d` |
| `--c-blue85` | `color(display-p3 .1067 .1531 .3908)` | `#182768` |
| `--c-yellow10` | `color(display-p3 1.032 .8561 .5914)` | `#ffd88c` |
| `--c-orange97` | `color(display-p3 .1431 .0866 .0709)` | `#271511` |
| `--c-teal30` | `color(display-p3 .3756 .7558 .7327)` | `#2ac4bc` |
| `--footerBackgroundColor` | `transparent` | — |
| `--navBackdropRadius` | `99rem` | — |
| `--c-lime97` | `color(display-p3 .0967 .1116 .0668)` | `#181d10` |
| `--pink500` | `#e269a4` | `#e269a4` |
| `--c-pink2` | `color(display-p3 1.0079 .9335 .9535)` | `#ffedf3` |
| `--c-yellow65` | `color(display-p3 .529 .3103 .0107)` | `#904c00` |
| `--c-green25` | `color(display-p3 .5235 .772 .6279)` | `#71c79d` |
| `--blue50` | `#eceff6` | `#eceff6` |
| `--c-yellow45` | `color(display-p3 .7553 .499 .0853)` | `#cc7b00` |
| `--sidebarWidth` | `0rem` | — |
| `--yellow300` | `#fdbd74` | `#fdbd74` |
| `--c-lime2` | `color(display-p3 .9683 .9728 .8405)` | `#f7f8d3` |
| `--c-magenta40` | `color(display-p3 .7432 .3436 .8504)` | `#cc50e0` |
| `--c-orange20` | `color(display-p3 1.0455 .692 .4844)` | `#ffab70` |
| `--c-warmGray90` | `color(display-p3 .1771 .1456 .167)` | `#2f252b` |
| `--pink100` | `#ffdce8` | `#ffdce8` |
| `--acc75` | `color(display-p3 .2712 .1627 .5198)` | `#4a288a` |
| `--c-lime65` | `color(display-p3 .3547 .4022 .0509)` | `#576700` |
| `--c-red97` | `color(display-p3 .1455 .0794 .0794)` | `#281314` |
| `--c-orange1` | `color(display-p3 1.0082 .9574 .9207)` | `#fff4ea` |
| `--wideGridGap` | `1.6rem` | — |
| `--yellow25` | `#fdf4ea` | `#fdf4ea` |
| `--c-teal50` | `color(display-p3 -.0737 .5684 .5556)` | `#00948f` |
| `--c-lime15` | `color(display-p3 .8452 .8781 .5031)` | `#d6e071` |
| `--c-purple35` | `color(display-p3 .602 .5213 .9623)` | `#9e84fd` |
| `--lime50` | `#f4f3e0` | `#f4f3e0` |
| `--white` | `#fff` | — |
| `--lime500` | `#99b22a` | `#99b22a` |
| `--lime900` | `#343e17` | `#343e17` |
| `--renderedWideGridWidth` | `calc(min(1520px, 100vw - 0px) - 1.8rem * 2)` | — |
| `--pink400` | `#f486b8` | `#f486b8` |
| `--c-lime70` | `color(display-p3 .31 .3539 .0707)` | `#4c5b00` |
| … | 나머지 456개는 `computed.json` | |

