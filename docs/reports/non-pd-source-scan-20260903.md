# 비PD 소스까지 넓혀 봤다 — 막는 것은 robots 가 아니라 저작권 고지였다

**실측일 2026-09-03** · 도구 `scripts/textbook/graded-source-probe.mjs`

---

## 1. 이 조사에서 배운 것 하나

> **robots.txt 는 라이선스가 아니다.**

Breaking News English 는 robots 가 `User-agent: * / Disallow:` — **전면 허용**이다.
그것만 보고 "재저작 경로 대상" 이라고 적어 두었다. 저작권 고지를 열어 보니 정반대였다:

```
NONE OF THE MATERIALS ON THIS WEBSITE CAN BE SOLD OR MONETIZED IN ANY FORM.
Permission is not granted to reproduce the Article … on any other website,
  social media platform, … app, Learning Management System (LMS) …
Permission is not granted to copy and paste sections of the materials
  to create different versions or formats of the materials.
This site uses anti-plagiarism software.
```

**크롤을 막지 않는 것과 쓰게 해 주는 것은 다른 일이다.** 그래서 이 프로브는 후보마다
**① robots ② 저작권 고지** 를 따로 적고, **둘 다** 통과한 것만 측정한다.

---

## 2. 후보 12곳 — 4등급으로 갈렸다

| 등급 | 사이트 | robots | 저작권 | 판정 |
|---|---|---|---|---|
| **쓸 수 있다** | **NASA Space Place** | 허용 | **PD (미 연방정부)** | ✅ 측정함 |
| 확인 필요 | NASA Climate Kids · NatGeo Kids · TimeForKids · British Council Teens · Newsela | 허용 | **미확인** | 고지 읽기 전엔 후보 아님 |
| 라이선스가 막음 | **Breaking News English** · News in Levels | **전면 허용** | 판매·앱 게재·부분 복사 금지 / 고지 없음(=전부 보유) | ✗ |
| AI 이용 거부 | CommonLit · DOGO News · Science News Explores | `ai-train=no` / GPTBot 차단 | — | ✗ 측정도 안 함 |
| 명시적 전면 금지 | **BBC Newsround** | scraping·AI·RAG·데이터셋 **조목조목 금지** | — | ✗ 측정도 안 함 |

`ai-train=no` 를 선언한 곳은 **측정도 하지 않았다.** 크롤은 허용돼 있지만 뜻이 분명한
신호이고, "허용 범위" 를 넓게 읽는 것은 우리가 할 일이 아니다.

---

## 3. 쓸 수 있는 것 — NASA Space Place

미 연방정부 저작물이라 **판매·변형·재배포 제한이 없다.** robots 도 본문을 허용한다.

| | |
|---|---|
| 전체 | **42편** (영문, 메뉴 6곳에서 수집) |
| 표본 | 29편 |
| 어수 | p25 250 · **중앙 354** · p75 609 |
| FK | p25 5.51 · **중앙 6.63** · p75 7.63 |
| 문장 | 13어 (시중 중1 교재 13.9어) |
| 규격(97~200어) 안 | 4/29 — **나머지는 발췌하면 든다** |

**학년 칸 분포**: 초6~중1 11 · 중1~2 10 · 초5~6 5 · 초3~4 2 · 중3 1

즉 **난이도는 초·중 한가운데에 정확히 앉는다**(FK 중앙 6.63 = 초6~중1). 문제는 길이뿐이고,
그건 이미 만들어 둔 발췌 경로(`excerptForBand`)가 푸는 문제다. 문단 구조가 뚜렷해
쪽 경계 대신 문단 경계로 자르면 된다.

---

## 4. 내가 이 조사에서 세 번 틀렸다 — 남겨 둘 값어치가 있다

**① robots 만 보고 라이선스를 판단했다.** §1. 가장 큰 실수다.

**② Breaking News English 구조를 두 번 잘못 읽었다.**
- 홈페이지에 "7 Levels" 라고 쓰여 있어 `-0` ~ `-6` URL 을 가정했다 → `-0`~`-3`·`-6` 은 **403**.
  실제로 기사마다 나오는 것은 **Level 4·5·6 셋**이다("All 3 graded readings" 라고 쪽에 적혀 있다).
- `-reading-200/300/400/500.html` 을 어수 등급으로 읽었다 → **분당 읽기 속도(wpm)** 였고
  넷 다 **같은 본문**이다. 그래서 7등급이 전부 FK 9.6~11.3 으로 거의 같게 나왔다 —
  **등급이 다른데 값이 같으면 추출이 틀린 것**이라는 신호였고, 실제로 그랬다.

**③ 파일을 덮어썼다.** `for L in "" "-6"` 루프가 홈페이지를 받아 둔 `bne.html` 을
기사 쪽으로 덮어썼고, 그 뒤 "홈페이지 분석" 은 전부 엉뚱한 파일을 본 것이었다.
링크 꼴이 앞뒤로 달라진 것(`2609/…` → `260907-…`)이 그 단서였다.

---

## 5. 다음

1. **NASA Space Place 배선** — PD 라 라이선스 관문이 없다. 발췌 경로를 문단 단위로 태우면
   42편에서 초5~6·초6~중1·중1~2 칸을 함께 채운다.
2. **미확인 5곳의 저작권 고지 읽기** — NASA Climate Kids(PD 가능성 높음) 가 먼저다.
   NatGeo Kids·TimeForKids·British Council 은 고지를 읽기 전엔 후보가 아니다.
3. **막힌 곳을 쓰려면 사람이 협의해야 한다** — Breaking News English 는 수준이 후보 중
   가장 알맞지만 서면 허락 없이는 불가다. 협의는 코드가 못 하는 일이다.

```bash
pnpm dlx tsx scripts/textbook/graded-source-probe.mjs --sample 30
```

---

## 6. 적재 결과 (2026-09-03) — 두 가드가 함께 작동한다

마이그레이션 `20260903120000_space_place_source.sql` 승인·적용 후 적재했다.

**적재 18편 · 실패 0 · 처리 18편 · 실패 0** (전부 CEFR **B1** — 초·중 밴드).

### 어휘 가드가 16편을 막았다

| | 편수 |
|---|---|
| 추가 | **18** |
| 규격(100~200어) 밖 — 발췌해도 못 맞춤 | 4 |
| **어휘 가드 차단** | **16** |
| 실패 | 0 |

막힌 것들의 이유가 숫자로 남는다:

```
⊘ 내용어의 44.8% 가 교육과정 3,000 밖이다(상한 40%) — All About the Moon (앞부분 발췌)
⊘ 내용어의 54.9% 가 교육과정 3,000 밖이다(상한 40%) — About Us
⊘ 내용어의 44.4% 가 교육과정 3,000 밖이다(상한 40%) — Where Does the Sun's Energy Come From?
```

**같은 NASA 라도 글마다 갈린다** — `What Are the Moon's Phases?`(밖 35.6%)는 통과하고
`All About the Moon`(밖 44.8%)은 막힌다. 소스 단위로 "쉽다/어렵다" 를 정하면 이걸 못 본다.

### 발췌가 대부분이었다

18편 중 통째로 들어간 것은 1편(`Make Sun Paper` 173어)뿐이고 나머지는 발췌다.
실측대로 이 소스는 **난이도는 맞고 길이가 안 맞는** 소스다(어수 중앙 354 · 창 100~200).

### ⚠️ 같은 자리에서 두 번 걸린 것

1. **`PASSAGE_WORDS` 가 배럴에 없었다** — 스크립트가 `undefined.min` 으로 죽었다. 추가했다.
2. **dev 서버가 내려가 있었다** — 적재는 됐는데 처리가 18건 전부 실패했다.
   `queued` 로 남으면 재고 질의(`status in ('ready','published')`)에 **안 보인다** —
   "넣었는데 0" 이 되는 자리다. 서버를 되살려 다시 `--process` 로 마쳤다(재실행 안전).
