# Tines — authored CSS values (Stage 1 보강)

> 생성 `scripts/design/extract-css-authored.mjs` · 2026-09-21 · 출처 6페이지(/ /product /pricing /solutions /library /blog)
> **손으로 고치지 말 것** — 다음 실행에 덮어써진다. 형용사·판정은 이 파일에 적지 않는다(DD-62).
> 원문 CSS·서체·키프레임 본문은 저장하지 않는다. rem 은 루트 10px 로 환산했다. 「최근접 토큰」은 거리만 잰 것이고 채택 여부가 아니다.

규모: 시트 30 · 749 KiB · 규칙 4947 · 선언 15421

## 분기점 (@media)

| 조건 | 등장 |
| --- | --- |
| `(min-width:640px)` | 211 |
| `(min-width:920px)` | 167 |
| `(prefers-color-scheme:dark)` | 145 |
| `(min-width:768px)` | 104 |
| `(min-width:1024px)` | 102 |
| `(min-width:1280px)` | 99 |
| `(max-width:639px)` | 89 |
| `(max-width:919px)` | 65 |
| `(hover:hover)` | 54 |
| `(max-width:767px)` | 31 |
| `(prefers-reduced-motion:reduce)` | 29 |
| `(min-width:512px)` | 24 |
| `(max-width:1023px)` | 22 |
| `(min-width:1440px)` | 19 |
| `(min-width:1194px)` | 11 |
| `(prefers-reduced-motion:no-preference)` | 10 |
| `(min-width:1366px)` | 9 |
| `(min-width:640px)and(max-width:1023px)` | 7 |
| `(max-width:1279px)` | 7 |
| `(max-width:919px)and(min-width:640px)` | 5 |

## 모션

우리 토큰: `--dur-fast` 100ms · `--dur-quick` 150ms · `--dur-normal` 200ms · `--dur-slow` 300ms · `--dur-slower` 500ms · `--ease` `cubic-bezier(.4, 0, .2, 1)` · `--ease-in` `cubic-bezier(.4, 0, 1, 1)` · `--ease-out` `cubic-bezier(0, 0, .2, 1)` · `--ease-spring` `cubic-bezier(.34, 1.56, .64, 1)` · `--ease-out-quint` `cubic-bezier(.22, 1, .36, 1)` · `--ease-ios-standard` `cubic-bezier(.4, 0, .2, 1)` · `--ease-ios-emphasized` `cubic-bezier(.2, 0, 0, 1)` · `--ease-ios-spring` `cubic-bezier(.34, 1.56, .64, 1)` · `--ease-ios-spring-bouncy` `cubic-bezier(.5, 1.8, .5, 1)`

### 지속시간

| 값 | ms | 등장 | 최근접 토큰 | Δms |
| --- | --- | --- | --- | --- |
| `.15s` | 150 | 33 | `--dur-quick` | 0 |
| `.2s` | 200 | 22 | `--dur-normal` | 0 |
| `.1s` | 100 | 21 | `--dur-fast` | 0 |
| `.12s` | 120 | 11 | `--dur-fast` | 20 |
| `.4s` | 400 | 10 | `--dur-slow` | 100 |
| `.5s` | 500 | 8 | `--dur-slower` | 0 |
| `.25s` | 250 | 7 | `--dur-normal` | 50 |
| `.3s` | 300 | 7 | `--dur-slow` | 0 |
| `.6s` | 600 | 7 | `--dur-slower` | 100 |
| `1s` | 1000 | 6 | `--dur-slower` | 500 |
| `.18s` | 180 | 6 | `--dur-normal` | -20 |
| `.35s` | 350 | 4 | `--dur-slow` | 50 |
| `4s` | 4000 | 4 | `--dur-slower` | 3500 |
| `.01ms` | 0.01 | 3 | `--dur-fast` | -99.99 |
| `0s` | 0 | 2 | `--dur-fast` | -100 |
| `.75s` | 750 | 2 | `--dur-slower` | 250 |
| `1.8s` | 1800 | 2 | `--dur-slower` | 1300 |
| `1.1s` | 1100 | 2 | `--dur-slower` | 600 |
| `.28s` | 280 | 2 | `--dur-slow` | -20 |
| `.45s` | 450 | 2 | `--dur-slower` | -50 |

### 이징

| 값 | 등장 |
| --- | --- |
| `cubic-bezier(.22,1,.36,1)` | 23 |
| `linear` | 20 |
| `ease-in-out` | 11 |
| `ease-out` | 8 |
| `cubic-bezier(.16,1,.3,1)` | 3 |
| `cubic-bezier(.075,.82,.165,1)` | 3 |
| `ease-in` | 2 |
| `cubic-bezier(.34,1.56,.64,1)` | 1 |
| `steps(var(--frameCount))` | 1 |
| `cubic-bezier(.5,1.8,.6,1)` | 1 |

### transition 대상 속성

`opacity` ×37 · `transform` ×22 · `background-color` ×14 · `border-color` ×12 · `filter` ×9 · `color` ×7 · `background` ×5 · `all` ×4 · `clip-path` ×3 · `border-radius` ×3 · `grid-template-rows` ×2 · `width` ×1 · `left` ×1 · `flex-grow` ×1 · `inset` ×1

### @keyframes (51개) · animation 반복: 유한 23 · 무한 32

| 이름 | 움직이는 속성 |
| --- | --- |
| `accessMapFlow` | `stroke-dashoffset` |
| `areaDropdownIn` | `opacity` `transform` |
| `areaNavPremeasureReveal` | `opacity` |
| `blink` | `transform` |
| `Bounce` | `transform` |
| `breathe` | `transform` |
| `chatCaretBlink` | `opacity` |
| `clockSegmentFlash` | `filter` |
| `cloudBob` | `translate` |
| `cloudDrift` | `transform` |
| `constellationSpin` | `transform` |
| `depGraphFlow` | `stroke-dashoffset` |
| `droneDrift` | `translate` |
| `droneFlap` | `transform` |
| `fadeIn` | `opacity` |
| `floatZ` | `opacity` `transform` |
| `frameFloatIn` | `opacity` `translate` |
| `grainShimmer` | `background-position` |
| `heroBedDrift` | `transform` |
| `heroQuoteSink` | `transform` |
| `hundredXSink` | `transform` |
| `interactiveCursorSpin` | `transform` |
| `keyPulse` | `background-color` |
| `labelDotBreathe` | `opacity` `transform` |
| `labelRise` | `clip-path` `transform` |
| `lineEnter` | `opacity` |
| `loadingIndicatorRingStretch` | `stroke-dasharray` `stroke-dashoffset` |
| `loadingIndicatorSpin` | `transform` |
| `loadingIndicatorWrapperEnter` | `opacity` |
| `marqueeDrift` | `transform` |
| `panelEnter` | `opacity` `transform` |
| `panelWipe` | `clip-path` |
| `promptCaretBlink` | `opacity` |
| `quoteFlowerParallax` | `transform` |
| `radarSweep` | `transform` |
| `rollUp` | `transform` |
| `scanlineRoll` | `background-position` |
| `snappyDown` | `opacity` `transform` |
| `snappyIn` | `box-shadow` `opacity` `transform` |
| `solutionBedParallax` | `transform` |
| `spin` | `transform` |
| `SvgRotate` | `transform` |
| `teaserPlayBlink` | `opacity` |
| `threeBVisualAppear` | `opacity` `transform` |
| `tileFloat` | `transform` |
| `timelineBarFadeIn` | `visibility` |
| `timelineBarIntro` | `transform` |
| `twinkle` | `opacity` `transform` |
| `useCasesReveal` | `opacity` `transform` |
| `veilDip` | `opacity` |
| `veilLift` | `opacity` |

## 모서리 (작성값 전체)

우리 토큰: `--r-sm` 2px · `--r-md` 3px · `--r-lg` 4px · `--r-xl` 5px · `--r-2xl` 6px · `--r-full` 9999px

| 값 | px | 등장 | 최근접 토큰 | 우리 상한 6px 초과 | var 작성값 (빈도순) |
| --- | --- | --- | --- | --- | --- |
| `var(--radius)` | — | 93 | — | — | `1.2rem` 12px ×1 · `1.4rem` 14px ×1 |
| `0` | 0 | 43 | — | — | — |
| `.5em` | — | 33 | — | — | — |
| `50%` | — | 31 | — | — | — |
| `.6rem` | 6 | 24 | `--r-2xl` | — | — |
| `999px` | 999 | 21 | `--r-full` | — | — |
| `inherit` | — | 14 | — | — | — |
| `99rem` | 990 | 12 | `--r-full` | — | — |
| `1.4rem` | 14 | 10 | `--r-2xl` | 예 | — |
| `1.2rem` | 12 | 9 | `--r-2xl` | 예 | — |
| `1em` | — | 9 | — | — | — |
| `2.4rem` | 24 | 9 | `--r-2xl` | 예 | — |
| `4px` | 4 | 8 | `--r-lg` | — | — |
| `var(--cardRadius)` | — | 7 | — | — | `1.6rem` 16px ×1 · `2.4rem` 24px ×1 |
| `3px` | 3 | 6 | `--r-md` | — | — |
| `.8rem` | 8 | 6 | `--r-2xl` | 예 | — |
| `1.8rem` | 18 | 6 | `--r-2xl` | 예 | — |
| `6px` | 6 | 6 | `--r-2xl` | — | — |
| `1.6rem` | 16 | 5 | `--r-2xl` | 예 | — |
| `5rem` | 50 | 5 | `--r-2xl` | 예 | — |
| `2em` | — | 5 | — | — | — |
| `1rem` | 10 | 5 | `--r-2xl` | 예 | — |
| `12px` | 12 | 4 | `--r-2xl` | 예 | — |
| `.35em` | — | 4 | — | — | — |
| `.75em` | — | 4 | — | — | — |

## 그림자 · 블러 · 층

- box-shadow 작성 13건: `var(--shadowTo)` ×2 · `0px 1px 3px color-mix(in srgb, var(--black) 6%, transparent)` ×2 · `none` ×2 · `var(--shadowFrom)` ×1 · `0 0 2px 2px var(--ac40),0 0 2px 2px var(--ac40)` ×1 · `0 0 0 .4rem var(--barFocusRing)` ×1 · `0 0 2px 2px color-mix(in srgb, var(--focusRingColor,var(--c-green40)) 90%, var(--lightest))` ×1 · `0 24px 80px #00000040` ×1 · `0 0 3px var(--acc40)` ×1 · `0 1em 1em -.5em #0000001a` ×1
- backdrop-filter 작성 18건: `blur(12px)` ×4 · `blur(10px)` ×3 · `blur(1em)` ×3 · `blur(16px)` ×2 · `blur(var(--barBlur))` ×2 · `blur(18px)` ×1 · `blur(20px)` ×1 · `blur(8px)` ×1 · `blur(1.2rem)` ×1
- z-index: 1 ×73 · 0 ×23 · 2 ×14 · 99999 ×9 · -1 ×8 · 2000 ×6 · 200 ×5 · 3 ×5 · 10 ×3 · 5 ×2 · 1200 ×2 · 90 ×2 · 1000 ×1 · 2147483001 ×1 · var(--monitorLayer,1) ×1 · 4 ×1

## @font-face (패밀리 · 굵기 · 스타일만)

- Roobert: 400 italic, 400 normal, 500 italic, 500 normal, 600 italic, 600 normal, 700 italic, 700 normal
- Reckless Neue VF: var italic, var normal
- Reckless: 300 normal, 400 italic, 400 normal, 700 italic, 700 normal
- Roobert Mono: 300 italic, 300 normal, 400 italic, 400 normal, 500 italic, 500 normal, 600 italic, 600 normal, 700 italic, 700 normal, 800 italic, 800 normal
- Pangea 4px Sans: 400 normal
- Pangea 4px Mono: 400 normal

