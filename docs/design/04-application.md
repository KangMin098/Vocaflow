# 04 — 전 화면 적용

기록일 2026-09-16. 적용 방식과 **적용되지 않은 것**을 함께 적는다 —
"전부 했다" 고 적고 절반만 한 문서가 가장 비싸다.

---

## 4-1. 적용 전략 — 화면 70개를 손으로 고치지 않는다

학습자 라우트 70개 · `.tsx` 447개다. 5시간 안에 화면 단위로 다시 쓰는 것은 불가능하고,
그렇게 하면 **누락이 반드시 생긴다**(그리고 누락된 화면이 "옛 디자인" 으로 남아 더 나빠 보인다).

그래서 **아래로 흐르는 지점**부터 고쳤다. 비용 대비 도달 범위 순:

| # | 손댄 곳 | 파일 수 | 도달 범위 |
|---|---|---|---|
| 1 | `app/layout.tsx` + `tailwind.config.ts` 폰트 스택 | **2** | 70 라우트 전부의 글자 |
| 2 | `tokens.css` 그림자·radius | **1** | `shadow-*` 235곳 · `rounded-*` 879곳 |
| 3 | `globals.css` `h1~h6` 기본 글꼴 · eyebrow 클래스 | **1** | 모든 제목 |
| 4 | `globals.css` 학습 도메인 토큰(SRS·slot·learn-error) | **1** | 채점·세션 화면 전부 |
| 5 | 셸 3종(Sidebar · CompassRibbon · MobileTabBar) + SessionFrame | **4** | 모든 화면의 테두리 |
| 6 | 기계적 스윕(eyebrow 145 · 1차 CTA 56) | **108** | 화면 단위 방문 없이 |
| 7 | 손으로 다시 쓴 화면 요소 | **6** | 아래 4-3 |

> **1~4 는 마크업을 한 줄도 안 고쳤다.** 클래스 이름을 그대로 두고 그 이름이 가리키는 값만
> 바꿨기 때문이다. 이것이 "447파일을 다시 쓰지 않고 70 라우트를 바꾸는" 방법이다.

---

## 4-2. 기계적 스윕 — 무엇을 바꿨나

| 스윕 | 찾은 패턴 | 바꾼 값 | 적중 |
|---|---|---|---|
| 템플릿 eyebrow | `font-mono text-[10px] font-[700] uppercase tracking-[0.1~0.18em]` | `font-display text-[11px] font-[600] tracking-[0.04em]` | **145곳** |
| 1차 CTA | 같은 `className` 안에 `min-h-[44/48px]` + `px-4~8` + `bg-[var(--p)]` 가 함께 있는 것 | 주묵 채움 + `rounded-[var(--r-md)]` + `--on-ju` | **56곳** |
| 떠돌이 indigo | `#6366F1` · `#4F46E5` | `#0F2540` / `--ju` | **5곳** |

**왜 "큰 버튼" 조건을 걸었나**: `bg-[var(--p)]` 는 진행률 막대·배지·점에도 쓰인다.
그냥 전부 바꾸면 **진행률 막대가 빨개진다.** 세 조건(최소 높이 · 좌우 패딩 · 브랜드 채움)을
동시에 만족하는 것만 사람이 누르는 버튼이다.

### 스윕에서 배운 함정 (기록해 둔다)
쉘 heredoc 이 `[\\/]` 를 `[\/]` 로 접어서 Windows 경로의 `\admin\` 제외가 **조용히 무력화**됐다.
관리자 화면 2파일이 딸려 들어왔고(되돌렸다), 아케이드도 한 파일 통과했다.
→ 이후 스윕은 스크립트를 **파일로 쓰고** 경로를 `/` 로 정규화해서 판정한다
(`scratchpad/sweep3.cjs` 패턴). 제외가 안 먹는 것은 **에러가 아니라 침묵**이라 더 위험하다.

---

## 4-3. 손으로 다시 쓴 것

| 요소 | 무엇이 문제였나 | 지금 |
|---|---|---|
| `components/ui/press/*` (신규) | 공용 `Card` 를 447파일 중 5개만 쓰고 있었다 | Rule · Panel · Wash · JuMark · DecayUnderline · PressButton · Eyebrow |
| `layout/Sidebar` 로고 | 그라디언트 라운드 사각형 + 산세리프 `V` | 주묵 각인 + Lora 워드마크 + 권점 |
| `(auth)/layout` 로고 | `Sparkles` 아이콘 — **지금 전 세계 AI 생성 UI 의 공통 표식** | 같은 워드마크 |
| `layout/SessionFrame` 머리 | 이모지 🎯⚡🏆🎙🎴📖 | 주묵 세로 획 하나 + Lora 제목 |
| `flashcard/SRSBar` | 😅🤔😊✨ + 하드코딩 `rgba(239,68,68,.2)` | 채움 눈금 1~4칸 + 전량 토큰 |
| `flashcard/FirstJudge` | 😅💡 + "모르겠어요" 쪽 붉은 테두리·붉은 hover | 「아직이에요 / 떠올랐어요」 대칭 |
| `home/NextWordsStrip` | 단어를 그냥 나열 | **DecayUnderline** — 밑줄 두께가 밀린 정도 |
| `home/TodayStage` | 뜻이 UI 글꼴(= OS 기본 고딕) · 표제어에 표식 없음 | 뜻을 Hahmlet 21px · 표제어 옆 권점 · 밀림에 망각 밑줄 |

---

## 4-4. 지금 상태 — 라우트별

| 층위 | 라우트 | 상태 |
|---|---|---|
| **A. 새 시스템이 형태까지 닿았다** | `/hub` · `/flashcard/play` · `/dashboard`(부분) | 주묵·판면·망각 밑줄·한글 글꼴 |
| **B. 토큰·글꼴·셸은 닿았다** (형태 어휘는 아직) | 나머지 67 라우트 | 한글 글꼴 · radius · 그림자 · eyebrow · CTA · 셸 |
| **C. 대상 아님** | `/admin/*` 37 라우트 · `components/game/` 아케이드 | 의뢰서 제외 범위 |

> **B 를 "완료" 로 적지 않는다.** 그 화면들은 *새 재료로 그려지지만* 아직 옛 배치다 —
> 카드 스택이 판면(괘선·섹션 번호·스케일 대비)으로 바뀐 것은 아니다.
> 남은 작업 목록은 `05-report.md` §남은 것.

---

## 4-5. before / after

캡처 하네스 `scripts/design/capture-learner.mjs` — **같은 라우트·같은 폭·같은 계정**으로만 찍는다.

| | before | after |
|---|---|---|
| `/hub` 390px | `shots/before/` (없음 — 첫 실행이 `/hub` 에서 타임아웃, 아래 주 참조) | `shots/after-s4/hub@390.png` |
| `/dashboard` 390px | `shots/before/dashboard@390.png` | `shots/after-s3/dashboard@390.png` |
| `/flashcard/play` 390px | `shots/before/flashcard_play@390.png` | `shots/after-s5/flashcard_play@390.png` |
| `/wordvault/browse` 390px | `shots/before/wordvault_browse@390.png` | (재캡처 대기) |
| 3안 비교 | — | `shots/directions-3up.png` |

> ⚠️ `before/hub@390.png` 이 없다. 첫 캡처 때 **Git Bash 가 `/hub` 를 `C:/Program Files/Git/hub`
> 로 변환**해 잘못된 URL 로 이동했다(MSYS 경로 변환). 이후 `MSYS_NO_PATHCONV=1` 로 고쳤지만
> **그 시점의 화면은 이미 지나갔다** — 없는 것을 있는 척하지 않고 빠졌다고 적는다.
> `/dashboard` before 가 같은 시점·같은 조건이라 비교의 기준은 그쪽을 쓴다.
