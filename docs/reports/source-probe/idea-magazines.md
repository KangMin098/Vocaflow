<!-- docs/reports/source-probe/idea-magazines.md -->
# 교양 매체 9곳 확보 정찰 — Big Think · Edge.org · Ideas.TED · Greater Good · Behavioral Scientist · JSTOR Daily · MIT Press Reader · Undark · Nieman Lab

| | |
|---|---|
| 판정 | **9곳 전부 반려** (채택 0 · 보류 0) |
| 확보 가능 편수 | **0** — 라이선스 관문에서 전부 탈락. 목표 표 추정 약 1,400편은 **회수 불가** |
| 정찰 일자 | 2026-09-07 |
| 정찰 범위 | SPEC.md §3 라이선스 관문만. 통과한 곳이 없어 나머지 6항목은 조사하지 않음 |

> SPEC.md 판정 기준: 「반려」는 전문이 안 오거나 · **변형 금지 라이선스**거나 · 대량 접근
> 경로가 없을 때. 아홉 곳 모두 첫 번째 또는 세 번째 조건에 걸린다.

---

## 1. 라이선스 한 줄 표 (전부 1차 자료 실호출)

| # | 곳 | 라이선스 (1차 자료 실측) | 변형 | 판정 | 탈락 사유 |
|---|---|---|---|---|---|
| 29 | **Big Think** | © 2007–2026 Freethink Media, Inc. **All rights reserved** (`/terms-of-use/`) | **불가** | 반려 | 저작권 유보 + 명시적 2차저작물 금지 |
| 37 | **Edge.org** | "Copyright © 2023 By Edge Foundation, Inc **All Rights Reserved**" (푸터) | **불가** | 반려 | 저작권 유보 · CC 없음 |
| 47 | **Ideas.TED.com** | 기사 단위 **All rights reserved** (출판사 발췌). TED 본 약관 §6.1 의 CC BY-NC-ND 4.0 은 **Talk 영상 전용**이며 블로그 미포함 | **불가** | 반려 | ND(있어도) + 기사 자체가 출판사 유보 |
| 48 | **Greater Good Magazine** | **CC BY-NC-ND 4.0** — 기사 HTML 에 `rel="license" href="creativecommons.org/licenses/by-nc-nd/4.0/"` | **불가** | 반려 | **ND** = 발췌·재편집 금지. NC 도 겹침 |
| 49 | **Behavioral Scientist** | "© Behavioral Scientist 2026" 뿐 · CC 표기 **없음** | **불가** | 반려 | 저작권 유보 (기본값) |
| 58 | **JSTOR Daily** | "© ITHAKA. All Rights Reserved." + 약관에 **변형 금지·자동 수확 금지** 명문 | **불가** | 반려 | 변형 금지 + 크롤링 자체가 약관 위반 |
| 60 | **MIT Press Reader** | **확인 실패** — Akamai 가 봇 접근 전면 차단(6경로 전부 403). CC 표기 확인 불가 | 불명 | 반려 | **대량 접근 경로 없음** (SPEC 3번째 반려 조건) |
| 62 | **Undark** | CC **아님** — 자체 republish 지침. "You cannot otherwise edit our material" | **불가** | 반려 | 변형 금지 + 재배포 금지 + 90일 시효 |
| — | **Nieman Lab** | **CC BY-NC-SA 4.0** ("unless otherwise noted, all content on this site is licensed under a Creative Commons Attribution-Noncommercial-ShareAlike 4.0 International License") | 가능하나 | 반려 | **NC** — 상업 교재 사용 불가. SA 전염도 겹침 |

**사전 예상 대비 정정 2건**
- Undark 는 "CC BY-ND 로 알려져" 있었으나 **CC 가 아니다** — 자체 republishing guidelines 다.
  결과(변형 금지)는 같지만 근거가 다르므로 CC 도구로 자동 판별되지 않는다.
- Nieman Lab 은 예상대로 CC BY-NC-SA 이나 **버전은 3.0 이 아니라 4.0** 이다.

---

## 2. 곳별 근거 (실호출 인용)

### Big Think (29) — 반려
- `https://bigthink.com/terms-of-use/` (curl 200 · WebFetch 는 403, UA 필요)
- 인용: *"You may not modify, publish, transmit, participate in the transfer or sale of, reproduce, **create new works from**, distribute, perform, display (including framing and inline linking), communicate to the public…"*
- 푸터: *"© Copyright 2007-2026 & BIG THINK, BIG THINK PLUS, SMARTER FASTER trademarks owned by Freethink Media, Inc. All rights reserved."*
- 300어 발췌 = "create new works from" 에 정면으로 걸린다. **즉시 반려.**

### Edge.org (37) — 반려
- `https://www.edge.org/` 푸터 실측: *"Copyright © 2023 By Edge Foundation, Inc All Rights Reserved."*
- 사이트가 갱신 중단 상태(2023 표기) + Internet Archive 영구 호스팅 공지. CC 표기 없음.
- ⚠️ 참고: Edge 는 IA 에 보존돼 있으나 **보존은 라이선스가 아니다** — IA 사본을 쓰는 것도 같은 저작권 유보 아래다.

### Ideas.TED.com (47) — 반려
- TED 본 약관 §6.1: *"Creative Commons Attribution–NonCommercial–NoDerivatives 4.0 International license (CC BY-NC-ND 4.0)"* — 대상은 **TED Talks·TED-Ed 영상·자막**. 블로그 글은 다루지 않음.
- Usage Policy: *"**ND:** means that no derivative works are permitted so you cannot edit, remix, create, modify or alter"*
- 실기사 표본 (`/6-ways-to-give-that-arent-about-money/`, 태그 `book excerpt`) 말미:
  *"Excerpted from Infectious Generosity by Chris Anderson… Copyright © 2024 by Chris Anderson. **All rights reserved. No part of this excerpt may be reproduced or reprinted without permission in writing from the publisher.**"*
- 즉 Ideas.TED 의 상당수는 **제3자 출판사 판권** 이라 TED 가 CC 를 걸 위치에 있지도 않다. 이중 반려.

### Greater Good Magazine (48) — 반려
- 기사 HTML 실측 (`/article/item/am_i_doing_this_right_teens`):
  `rel="license"` · `href="http://creativecommons.org/licenses/by-nc-nd/4.0/"` · *"Republish our articles for free, online or in print, under Creative Commons license."*
- **CC 는 맞으나 ND 다.** SPEC §3 이 The Conversation 을 두고 경고한 바로 그 조건 —
  300어 발췌 자체가 derivative 이므로 지문화가 불가능하다. NC 도 겹친다.
- 이 표에서 유일하게 "CC 라서 될 줄 알았는데 ND 라서 안 되는" 곳이므로 다음 정찰자가 다시 파지 않도록 기록해 둔다.

### Behavioral Scientist (49) — 반려
- `/about/` · 홈 푸터 실측: **"© Behavioral Scientist 2026"** 이 전부. `/terms-of-use/` 404.
- 사이트 전역 grep 결과 `creative commons` · `licensed under` · `republish` 문자열 **0건**.
- 명시 허락이 없으면 기본값은 저작권 유보다. 개별 문의(=대량 수확 불가) 외 경로 없음.

### JSTOR Daily (58) — 반려 (가장 강한 금지)
- 푸터: *"© ITHAKA. All Rights Reserved."*
- `/terms-and-conditions/` 인용: *"You may display and print for your personal, non-commercial use portions of content from JSTOR Daily. **You may not otherwise alter or use any of the content** without ITHAKA's prior written consent **nor may you undertake any activity such as computer programs that automatically download or export JSTOR Daily content**."*
- 변형 금지 + **자동 수확 자체를 약관이 명시적으로 금지**. 정찰 이상으로 접근하지 않았다.

### MIT Press Reader (60) — 반려 (접근 경로 없음)
- 시도한 6경로 전부 Akamai `Access Denied` 403:
  `thereader.mitpress.mit.edu/` · `/about/` (WebFetch·curl 양쪽) · `/wp-json/wp/v2/posts?per_page=1` · `/feed/` · `mitpress.mit.edu/terms-of-use/` (WebFetch·curl).
  WordPress REST 와 RSS 까지 동일하게 막혀 있다 — UA 문제가 아니라 **봇 전면 차단**이다.
- ⚠️ **라이선스는 확인하지 못했다** (추정 금지). 다만 SPEC 판정 기준의 "대량 접근 경로가 없을 때" 에
  해당하므로 라이선스와 무관하게 반려다. 게재물 다수가 MIT Press 단행본 발췌라 CC 일 가능성도 낮으나,
  **이는 확인된 사실이 아니다.**
- 재도전 가치: 낮음. 뚫으려면 계약(허가) 경로여야 하고, 그건 정찰이 아니라 협상이다.

### Undark (62) — 반려
- `https://undark.org/republish/` 실측. **CC 라이선스 아님** — 자체 지침.
- 인용: *"You cannot otherwise edit our material, except to reflect changes in time; to make minor adjustments for editorial style; or as needed to complete a direct and accurate translation."*
- 추가 차단 3중: *"You are not permitted to sell our material. You are not permitted to redistribute our articles to other publishers."* · 전체 카탈로그 재발행 금지(개별 선택만) · **게재 90일 이후는 저자 개별 허락 필요**.
- 300어 발췌 = "substantial cut" 이라 첫 조항에서 탈락. 90일 시효 때문에 백카탈로그는 애초에 대상도 아니다.

### Nieman Lab — 반려
- `https://www.niemanlab.org/about/` 「Copyright and licensing」 절 실측:
  *"unless otherwise noted, all content on this site is licensed under a Creative Commons Attribution-Noncommercial-ShareAlike 4.0 International License"*
  조건: *"(c) you release any work you build on top of our work under a similar license."*
- **변형은 허용된다.** 탈락 사유는 두 가지:
  1. **NC** — SPEC §3: "NC 는 상업 교재에 못 쓴다". Vocaflow 는 유료 전환을 전제한 제품이다.
  2. **SA 전염** — 지문을 실으면 그 지문이 들어간 산출물도 BY-NC-SA 로 풀어야 한다.
- "unless otherwise noted" 단서가 붙어 있어 **항목별 예외가 존재**하므로, NC 를 감수하더라도
  기사마다 개별 확인이 필요하다 — 자동 수확과 상성이 나쁘다.
- ⚠️ 소재도 부적합하다: Nieman Lab 은 **언론산업 내부 뉴스**다. 매체 이름·인사·조직 개편이
  전제 지식으로 깔려 자족적 설명문(`use`)이 되기 어렵다. 라이선스가 CC BY 였어도 지문 적합성에서
  다시 걸렸을 가능성이 높다.

---

## 3. 왜 나머지 6항목을 조사하지 않았는가

SPEC §3 이 라이선스를 "⚠️ 가장 중요" 로 둔 이유가 그대로다 — **변형 불가면 전문이 와도,
안정 식별자가 있어도, 편수가 만 편이어도 한 편도 못 쓴다.** 아홉 곳 중 관문을 통과한 곳이
없으므로 대량 접근 경로·전문 여부·식별자·커서·편수·표본 판정은 조사하지 않았다.
표본 판정은 Ideas.TED 1편(판권 표기 확인 목적)과 Greater Good 1편(CC 배지 확인 목적)만
열었고, 지문 적합성 판정은 하지 않았다.

**이 묶음에 더 시간을 쓰지 말 것.** 재정찰이 정당해지는 조건은 하나뿐이다 —
어느 한 곳이 라이선스 정책을 바꿨다는 **1차 근거**가 새로 생겼을 때.

## 4. 이 정찰이 남기는 일반 규칙

목표 표에 남은 교양·잡지형 소스를 팔 때 **라이선스부터** 확인하고, 아래 순서가 가장 빠르다
(이번에 실제로 효과가 있었던 순서다):

1. **기사 HTML 에서 `rel="license"` 를 grep 한다** — 사이트 약관 페이지를 뒤지는 것보다 빠르고
   정확하다. Greater Good 은 약관 페이지가 404 였는데 기사 HTML 이 ND 를 자백했다.
2. 약관 페이지는 **`/terms-of-use/` · `/terms-and-conditions/` · `/about/` 세 곳**을 본다.
   404 가 많다 (Behavioral Scientist · Greater Good).
3. **WebFetch 403 이면 curl + 브라우저 UA 로 한 번 더** — Big Think·Nieman Lab 이 이 한 단계로 열렸다.
   그래도 403 이면(MIT Press Reader) 봇 차단이므로 그 자체가 반려 근거다.
4. **"CC 라고 알려져 있다" 를 믿지 않는다** — 이번 9곳 중 사전 정보가 맞은 곳은 1곳(Nieman Lab,
   그나마 버전이 틀렸다), 틀린 곳이 1곳(Undark 는 CC 가 아니었다)이다.

## 5. 수확기를 짠다면

**짜지 않는다.** 채택 0곳이다.

기록만 남긴다 — 만약 프로젝트가 훗날 NC 를 허용하기로 정책을 바꾸면(즉 무료 콘텐츠로만 쓰거나
비영리 전환 시) **Nieman Lab 한 곳**이 되살아난다. 그 경우에도:
- 형: RSS/WordPress 형 → `scripts/acp/collect-daily.mjs` 를 본뜬다 (WordPress REST `wp-json/wp/v2/posts`
  가 살아 있는지부터 재확인 — 이번엔 확인하지 않았다).
- 커서: `?after=<ISO8601>` 날짜 필터 (WordPress REST 표준). 커서 파일은 `scripts/csat/data/` 관례를 따른다.
- ⚠️ 선행 조건 2개: (a) 항목별 "unless otherwise noted" 예외를 메타데이터에서 걸러낼 방법,
  (b) SA 전염이 Vocaflow 산출물에 미치는 범위에 대한 법적 판단. 둘 다 미해결이면 착수하지 않는다.
