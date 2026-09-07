# 발췌 경로가 생기자 가장 큰 재고가 다시 살아났다 — 그리고 FK 가 못 보는 것

**실측일 2026-09-03** · 도구 `scripts/textbook/longform-pd-probe.mjs`

---

## 1. 왜 다시 꺼냈나

2026-09-02 조사에서 Project Gutenberg 를 이렇게 적고 접었다:

> "열린다 — 영어 아동물 **7,634권** · PD. 다만 본래 단위가 **책 한 권**이라 발췌해야 창에 든다.
> 발췌 경로가 생기면 가장 큰 PD 서사 재고다."

그 발췌 경로가 생겼다(`excerptForBand` — 문단 경계에서 자르고 **자른 뒤 다시 잰다**).
그래서 그때 접었던 것을 다시 꺼냈다.

**라이선스**는 PG 가 명시한다:

> "The vast majority of Project Gutenberg eBooks are in the public domain in the US …
> 'As you please' includes **any commercial use, republishing in any format,
> making derivative works** or performances."

---

## 2. 실측 — 책 한 권에서 칸마다 조각이 나온다

표본 6권 · 문단 앞에서부터 5칸씩 옮기며 최대 400창 · 100~200어 조각을 만들어 FK 를 잰다.

| 학년 칸 | 조각/책 | 적중률(책별 범위) |
|---|---|---|
| 초3~4 | 49.5 | 9~50% |
| 초5~6 | 65.5 | 16~41% |
| **초6~중1** | **82.8** | 20~39% |
| 중1~2 | 63.0 | 9~29% |
| 중3 | 49.2 | 3~27% |

책마다 성격이 뚜렷이 갈린다 — `The Rover Boys on the Farm` 은 초3~4 가 50% 인데
`The Home Book of Verse` 는 중3 이 27% 다. **한 권이 한 학년에만 쓰이는 게 아니다.**

7,634권으로 늘리면 칸마다 **수십만 조각**이 나온다. 즉 **재고는 더 이상 병목이 아니다.**

⚠️ 칸의 FK 창이 겹치므로(초3~4 1.5~4.0 · 초5~6 3.5~5.5) 적중률 합이 100%를 넘는다.
⚠️ 한 책에서 앞쪽 400창만 본다 — 긴 책의 "조각/책" 은 **하한**이다.

---

## 3. ⚠️ FK 가 못 보는 것 — 이 표를 그대로 믿으면 안 되는 이유

표본에 `Little Women`(1868) · `Tom Sawyer`(1876) · `The Turn of the Screw`(1898) 가 있다.
**FK 로는 초6~중1 인데 어휘는 19세기 영어다.** FK 는 문장 길이와 음절만 보고
낱말이 오늘 쓰이는 말인지 모른다 — 이 저장소가 이미 아는 한계다
(NASA 사진설명이 FK 는 낮은데 교육과정 별표 적중이 22.4% 였던 것과 같은 종류).

그리고 `topic=children` 태그가 느슨하다 — `The Turn of the Screw` 는 성인 대상 괴담이고
`The Home Book of Verse` 는 시집이다. **분류를 그대로 믿으면 안 된다.**

**그래서 PG 는 "쓸 수 있다" 가 아니라 "고르면 쓸 수 있다" 이다.** 필요한 가드는 둘:

1. **교육과정 별표 적중률 하한** — FK 만으로는 19세기 어휘를 못 거른다
2. **발행 연도 상한 또는 현대어 판별** — PG 는 저작권 만료본이라 구조적으로 오래된 글이 많다

---

## 4. 도구가 세 번 스스로를 고쳤다 — 남겨 둘 값어치가 있다

**① `HTTP 0` 만 찍고 이유를 버렸다.** 8권 전부 실패했는데 화면에는 `HTTP 0` 만 나왔다.
`error` 를 함께 찍게 고치자 바로 보였다 —
`Client network socket disconnected before secure TLS connection was established`.

**② www.gutenberg.org 는 Node 의 TLS 를 끊는다.** 같은 주소를 curl 은 1.7초에 174KB
받아 오는데 Node 는 `fetch` 든 `node:https` 든 죽고, 헤더를 보강해도 같다.
공식 미러 `gutenberg.pglaf.org/cache/epub/<id>/pg<id>.txt` 는 그대로 열린다.
**소스가 죽은 게 아니라 클라이언트가 못 붙는 것** — 이 저장소가 세 번째 겪는 꼴이다
(africanstorybook TLS 악수 10초 · undici connectTimeout · 이번 TLS 거부).

**③ 상한을 수율로 착각할 뻔했다.** 처음엔 `hits < 20` 으로 끊었더니
**모든 책이 모든 칸에서 정확히 20** 이 나왔다. 그건 수율이 아니라 상한이다 —
수율로 읽힐 수가 상한에 닿아 있으면 그 표는 아무것도 말하지 않는다.
상한을 없앴더니 이번엔 `excerptForBand` 를 시작점마다 부르는 바람에 **O(문단²)** 이 되어
10분을 넘겨 죽었다(그 함수가 이미 모든 시작점을 훑는다). 시작점마다 한 번만 앞으로
불려 나가는 선형 계산으로 바꿔서야 §2 의 표가 나왔다.

---

## 5. 이번에 함께 확인한 라이선스

| 소스 | 라이선스 | 판정 |
|---|---|---|
| **Project Gutenberg** | PD — **상업 이용·재발행·파생물 명시 허용** | ✅ |
| **Standard Ebooks** | "dedicates its own work to the public domain" (CC0) | ✅ |
| **UK OGL v3** (gov.uk · Met Office) | "use and re-use … freely and flexibly, with only a few conditions" | ✅ |
| 미 연방정부 PD (NOAA Ocean Service · NPS · EPA) | PD | ✅ |
| **WHO** | **CC BY-NC-SA 3.0 IGO** — NC 가 상업 이용을 막는다 | ✗ |
| UNICEF | 미확인 | 후보 아님 |
| NASA Climate Kids | **독립 사이트가 사라진 듯** — `science.nasa.gov` 로 흡수돼 기사 링크가 0 | 재확인 필요 |

---

## 6. 다음

1. **PG 에 어휘 가드를 붙인다** — 교육과정 별표 적중률 하한. FK 만으로는 19세기 영어를 못 거른다.
2. NOAA Ocean Service `facts/` — `<p>` 추출이 되고 정부 배너 문단만 빼면 ~190어(창 안)다.
3. Standard Ebooks · UK Met Office 수준 측정.

```bash
pnpm dlx tsx scripts/textbook/longform-pd-probe.mjs --sample 6
```


---

## 7. 어휘 가드를 붙였다 — FK 만으로는 절반 넘게 통과하고 있었다 (2026-09-03)

§3 에서 "교육과정 별표 적중률 하한이 필요하다" 고 적었고, 그 자를 만들었다.

**`textbook/curriculum.ts`** — 2022 개정 교육과정 기본어휘 3,000 을 패키지가 소유한다.
CSV 는 이미 저장소에 있었는데(`data/curriculum/kcurr2022_*.csv`) **읽는 코드가 없어**
일회성 임포트 산출물로 놀고 있었다.

| 등급 | 낱말 | 표본 |
|---|---|---|
| `kcurr2022_1` 단일 별표 `*` | 819 | a · about · above · across |
| `kcurr2022_2` 이중 별표 `**` | 1,215 | able · absolute · accent |
| `kcurr2022_0` 무표시 | 1,011 | abandon · aboard · abort |

### 붙여 보니 — **54~61% 탈락**

| 학년 칸 | FK 적중 | 어휘 가드 통과 | 탈락 |
|---|---|---|---|
| 초3~4 | 260 | 102 | **61%** |
| 초5~6 | 321 | 132 | 59% |
| 초6~중1 | 380 | 153 | 60% |
| 중1~2 | 273 | 119 | 56% |
| 중3 | 187 | 86 | 54% |

**FK 만으로는 쓸 수 없는 것을 절반 넘게 통과시키고 있었다.**
남는 것은 책당 17~31 조각이고, 7,634권이면 칸마다 **13만~23만** 이다 — 여전히 넉넉하다.

⚠️ **문턱(교육과정 밖 40%)은 아직 실측값이 아니라 정한 값이다.** 우리 지문 실측에서
NASA(밖 64%)와 재저작문(밖 21%)이 크게 갈렸고 그 사이 어딘가라는 것만 안다.
**시중 교재 지문으로 같은 값을 재면 그때 이 수를 실측으로 바꿔야 한다** — 테스트가 이 사실을 못 박는다.

⚠️ 원문 목록에 고유명사·숫자·파생형이 없다(CSV 머리말). **사람 이름이 많은 이야기는
그만큼 적중률이 낮게 나온다** — 이야기와 설명문을 이 값 하나로 견주면 안 된다.

회귀 `curriculum.test.ts` **11종** · 패키지 전체 **1,242 tests 통과** · `tsc --noEmit` exit 0.
