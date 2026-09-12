<!-- docs/reports/source-probe/smithsonian.md -->
# Smithsonian Magazine 확보 정찰

| | |
|---|---|
| 판정 | **반려** |
| 확보 가능 편수 | **세지 않았다** — 라이선스 관문에서 중단 (목표 표 추정 600편은 미검증) |
| 라이선스 | **All rights reserved** (`© 2026 Smithsonian Magazine`) · CC 아님 · 변형 **불가** |
| 전문 | **미확인** (관문 탈락으로 조사 중단) |
| 안정 식별자 | 미확인 |
| 증분 커서 | 미확인 |
| 정찰 일자 | 2026-09-07 |

---

## 관문: 라이선스 (SPEC §3)

이 정찰은 SPEC 의 7항목 중 **3번(라이선스)** 하나에서 끝났다. CC 가 아니면 나머지 6항목을
조사할 이유가 없으므로 **의도적으로 조사하지 않았다**. 아래는 확인한 것과 확인하지 않은 것의 구분이다.

### 근거 1 — 잡지 자체 「Content Licensing」 페이지 = 허가제

`https://www.smithsonianmag.com/licensing/` (HTTP 200, 실측 2026-09-07). 원문:

> Select your business type below. You will be directed to a custom form allowing you to
> **request permission on the republishing or reuse of an article from Smithsonian magazine.**

사업 유형 4종(영리기업 / 미 연방·주·지방정부 / **비영리·교육기관** / 커뮤니티 단체)별로
**개별 허가 신청 양식**을 제공한다. **교육 목적도 예외가 아니라 신청 대상이다.**
CC 소스라면 존재할 이유가 없는 페이지다 — 이 페이지의 존재 자체가 "사전 허가 없이는 재사용 불가"를 뜻한다.

### 근거 2 — Terms of Use = CC0 는 「아이콘이 붙은 것」에 한정

잡지 푸터의 Terms of Use 링크는 `https://www.si.edu/termsofuse` 로 간다(푸터 `href` 실측).
해당 문서 §2 는 콘텐츠를 **두 갈래로만** 나눈다:

> **a. Content with Creative Commons Zero Icon** — Content **marked with the Creative Commons Zero icon**
> is made available under the Creative Commons Zero (CC0) license.
>
> **b. Other Content – Usage Conditions Apply** — **All other Content** is subject to usage conditions
> due to copyright and/or other restrictions and **may only be used for personal, educational, and other
> non-commercial uses** consistent with the principles of fair use... **All rights not expressly granted
> herein by the Smithsonian are reserved**, unless the Content is marked with the icon.

즉 CC0 는 **옵트인(아이콘 표기)** 이고, 표기가 없으면 자동으로 (b) — 비상업·공정이용 범위로
제한되며 그 외 모든 권리가 유보된다.

### 근거 3 — 실제 기사에는 CC0 아이콘이 없다 (표본 2편)

기사 HTML 을 받아 CC 표기를 전수 grep 했다. 두 편 모두 결과가 동일하다 —
**`creativecommons` 문자열 0건 · `CC0` 0건 · 라이선스 표기 0건**, 발견된 것은 저작권 표기 하나뿐:

| 표본 | HTTP | CC 표기 | 저작권 표기 |
|---|---|---|---|
| `/history/born-1810-margaret-fuller-...-180988800/` | 200 (62,011 B) | **0건** | `© 2026 Smithsonian Magazine` |
| `/arts-culture/georgia-okeefe-...-180988804/` | 200 (70,872 B) | **0건** | `© 2026 Smithsonian Magazine` |

따라서 기사는 Terms of Use §2**b** 에 해당한다.

### 근거 4 — Open Access(CC0) 는 잡지 기사를 포함하지 않는다

`https://www.si.edu/openaccess` (HTTP 200, 실측). 스스로 밝히는 범위:

> download, share, and reuse **millions of the Smithsonian's images**—right now, without asking...
> more than **5.1 million 2D and 3D digital items from our collections**... This includes
> **images and data** from across the Smithsonian's 21 museums, nine research centers, libraries,
> archives, and the National Zoo.

페이지의 CC0 진입점도 전부 소장품 쪽이다 — `/search/images?edan_fq[0]=media_usage:CC0`(이미지 검색)와
`3d.si.edu/cc0`(3D 모델). **텍스트 기사 경로는 없다.**
사전 경고대로 Open Access 는 **소장품 이미지·데이터** 프로그램이고 **잡지 기사는 별개**임이 1차 자료로 확인됐다.

## 결론

`Smithsonian Magazine` 기사는 **CC 라이선스가 아니다.** 저작권 전부 유보 + 개별 허가제이며,
Terms of Use 가 허용하는 최대치조차 **비상업(non-commercial) 공정이용 범위**다.
Vocaflow 는 지문을 **300어대로 발췌·개작(변형)** 하고 **유료 교재로 쓰는** 것이 목적이므로
변형·상업 두 축 모두에서 어긋난다. SPEC §판정 기준의 「변형 금지 라이선스」에 해당 → **반려**.

목표 표의 채택 추정 **600편은 취소**한다.

## 조사하지 않은 것 (정직성 기록)

관문 탈락으로 **의도적으로 중단**했다. 아래는 "없다"가 아니라 **"안 봤다"** 이다 —
훗날 라이선스 상황이 바뀌면 여기서부터 시작하면 된다.

- 대량 접근 경로(RSS·사이트맵·API) 유무 — 미조사
- 전문 제공 여부 — 미조사 (기사 HTML 은 200 으로 열렸으므로 본문 파싱 자체는 가능해 보이나, **확인하지 않았다**)
- 안정 식별자 — URL 말미 9자리 숫자(`180988800`)가 후보로 보이나 고정성 **미검증**
- 증분 커서 · 실측 편수 · 지문 적합성 표본 판정 — 전부 미조사

## 수확기를 짠다면

**짜지 않는다.** 라이선스가 허용하지 않는다.

재검토가 필요한 유일한 조건은 **스미소니언과의 개별 라이선스 계약 체결**이며, 이는 정찰이 아니라
계약 문제다(위 `/licensing/` 의 "Non-profit or Educational entity" 양식). 계약 없이 수확기를 만드는 것은
경로 문제가 아니라 **법적 문제**다.

**대체 후보** — 역사·문화 에세이라는 같은 성격을 CC 로 얻으려면:
- **Wikipedia/Wikisource** (CC BY-SA · 이미 `scripts/textbook/mediawiki-lead-ingest.mjs` 보유) — SA 전염 주의
- **Public Domain Review / Internet Archive PD 텍스트** (PD · 변형 자유)
- **Smithsonian Open Access 소장품 메타데이터** (CC0) — 다만 이것은 **기사가 아니라 이미지·데이터**이므로
  지문 소스로는 쓸 수 없다. 삽화 자산으로서의 가치는 별건이다.
