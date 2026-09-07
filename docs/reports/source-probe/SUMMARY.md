<!-- docs/reports/source-probe/SUMMARY.md -->
# 원문 소스 86곳 정찰 통합 — 목표표를 실측으로 대체한다

**정찰 2026-09-07 · 25갈래 병렬 · 소스 60여 곳 · 1차 자료 실호출만.**
개별 근거는 같은 디렉터리의 소스별 리포트 25종, 규격은 [SPEC.md](./SPEC.md).

---

## 0. 한 줄

**목표표의 「약 3.8만 편」 추정에는 라이선스 검증이 없었다.** 실측하니 상위권 다수가
0 편이고, 대신 한 곳(PMC)이 목표 전체보다 두 자릿수 크다. 그리고 **막는 것은 대부분
소스가 아니라 우리 코드**였다.

---

## 1. 목표표 상위 5개 — 전체의 65%라던 것

| 순위 | 소스 | 목표 추정 | 실측 | 무엇이 갈랐나 |
|---|---|---|---|---|
| 1 | The Conversation | 6,000 | **0** | CC BY-ND. 발췌는 되나 레벨 조정·빈칸·번역이 전부 개작 |
| 2 | DOAB | 5,250 | **재계산 필요** | 전문은 DOAB 가 아니라 OAPEN `.pdf.txt` 에 있다 |
| 3 | PMC OA Subset | 4,500 | **4,998,523** | 목표의 1,110배 |
| 4 | Cambridge/Oxford/Springer | 4,500 | **≈3,027** | Springer 만. Oxford BY-NC-ND 92% · Cambridge NC/ND 86% |
| 5 | Project MUSE / JSTOR | 4,500 | **0** | 전문 전량 차단 + 표본 전량 NC/ND |

상위 5개가 65%라는 계획은 성립하지 않는다. **PMC 하나가 나머지 넷을 합친 것의 1,000배를
주고, 나머지는 대부분 0** 이다.

---

## 2. 채택 — 실측 편수

| 소스 | 편수 | 라이선스 | 병목 적합 | 비고 |
|---|---|---|---|---|
| **PMC OA** | 4,998,523 | 항목별 `license_code` | STEM | ⚠️ **분류기 수정 전 수확 금지**(§5) |
| Nature Comm·SciRep·BMC | 325,163 | 항목별 · **ND 섞임** | STEM | `LICENSE:"cc by"` 필터 필수 |
| **Frontiers** | ≈75,000 | CC BY 4.0 | **교육·언어·사회 12,618** | PMC 로 흡수 **안 됨**(§4) |
| **VOA** | ≈33,300 미확보 | PD | **고1 ≈5,500** | 담을 칸이 없다(§6) |
| **World Bank OKR** | ≈29,000 | 항목별 `dc:rights` | **개발경제·사회과학** | PDF 옆 **`.txt` 형제 파일** |
| Global Voices | ≈11,700 | CC BY 3.0 | 국제·사회 | 2017~ 만. 파트너 재게시본 배제 필수 |
| NPS | ≈9,800 | PD | 역사·생태 | |
| bioRxiv / medRxiv | 6,670 / 5,624 | 항목별 | 과학 | bioRxiv 는 쓸 수 있는 것 23% |
| Wikibooks | ≈5,600 조각 | CC BY-SA | 교과 설명 | 산문형 접두어만. 무작위는 적합 0.11 |
| **BCcampus** | 59권 389만 어 | CC BY 계열 | **역사·인류** | REST 가 챕터 HTML 직접 제공 |
| **Springer OA** | ≈3,027권 | CC BY 82.7% | **Palgrave 855권 인문·사회** | 라이선스가 REST 에 없다 — OAI 로 |
| Climate.gov | **+2,200** | PD | 기후 | **피드 네 줄 추가로 끝**(코드 변경 불필요) |
| UNESCO Courier | ≈940 | CC BY-SA | 문화 | SA 결정 대기 |
| FrYM | ≈670 | CC BY 4.0 | 청소년 과학 | 커서 결함 수정 시 즉시 해금 |
| OWID | 590 | CC BY 4.0 | 도표·통계 | ⚠️ FAQ 가 편집 금지(§7) |
| OpenStax | 474 | CC BY 26권만 | 인문사회 152 | 나머지는 NC-SA |
| NIST | 6,496(sitemap) | PD | 과학 | |

---

## 3. 반려 — 그리고 왜 반려가 성과인가

**목표표 추정 약 12,000 편이 0 이 됐다.** 반려는 실패가 아니라, 넣었다면 저작권 위반이
됐을 것을 넣기 전에 걸러낸 것이다.

| 묶음 | 곳 | 사유 |
|---|---|---|
| 교양 매체 | Aeon($650/편 유료계약)·Psyche·Nautilus·Knowable·Quanta·Big Think·Edge·Ideas.TED·Greater Good·Behavioral Scientist·JSTOR Daily·MIT Press Reader·Undark·Nieman Lab | CC 아님 또는 ND/NC |
| 철학 | SEP·IEP·Philosophers' Imprint·PhilArchive·PhilSci | CC 아님 또는 ND. IEP 는 자칭 "not open source or public domain" |
| 대학 뉴스룸 | Harvard·Stanford·MIT·Cambridge | MIT News 는 BY-NC-ND. **Futurity 에 없는 이유가 곧 CC 미참여** |
| 싱크탱크 | Pew·Brookings·RAND·World Bank Blogs | 저작권 유보 |
| 교육 | ReadWorks·CommonLit·CK-12·Khan | NC 또는 유상 라이선싱 |
| 언론 | Mongabay·Inside Climate News·ProPublica·Grist·Al Jazeera | **언론사 CC 는 거의 예외 없이 ND** — 전문 그대로 재게시로 크레딧을 얻는 구조 |
| 국제기구 | UN News·UNEP·WHO·Scholarpedia | 유보 또는 NC. Scholarpedia 는 사이트가 죽어 502 |
| PD 고전 | Standard Ebooks·Bartleby·Perseus | Gutenberg 와 74~85% 중복 · Perseus 적합률 9% = 기준선과 동일 |
| 기타 | Smithsonian · MUSE/JSTOR · SSRN · LibreTexts · OER Commons · Census · LOC · NIH News in Health · **Federal Reserve Education** | |

⚠️ **Federal Reserve Education 은 목표표가 PD 묶음에 잘못 넣었다.** 연준은행은 미국
저작권법 §105 대상이 아니고, St. Louis Fed 가 저작권을 보유하며 "do not modify the
content in any way" + 비상업 한정이다.

---

## 4. 목표표의 전제가 실측으로 깨진 것 5가지

| 전제 | 실측 |
|---|---|
| "무료로 읽히면 쓸 수 있다" | **아니다.** 무료 열람과 재배포 허가는 다르다 |
| Aeon·Quanta 는 ND 라 변형만 금지 | **아예 CC 가 아니다** — 건별 유료 계약 |
| Wikipedia 의 "Overview·Criticism 절" | **Criticism 11편 · Overview 7편.** 문서 지침이 그 절을 권장하지 않아 **좋은 글일수록 없다** |
| Frontiers 는 PMC 가 다 갖고 있다 | **아니다.** 비-PMC 18종 79,956편의 수록률 **0.4%** |
| DOAB↔출판사 OA 중복 30% | **93~97%.** 조인 키는 DOI·ISBN 이 아니라 **OAPEN 핸들** |

---

## 5. 막는 것은 대부분 우리 코드다

정찰이 소스보다 저장소에서 더 많이 찾았다.

| 결함 | 실측 | 결과 |
|---|---|---|
| **`lib-topic.mjs` 오분류** | 표본 20편 중 9편을 「예술·문화」로 보내고 **8편이 틀림**(중환자의학·심장학·소아과) | **빈 칸을 재는 자가 고장.** `topic-gap.json` 의 "부족 0" 도 이 분류에 기댄다. 고치기 전 대량 수확 = 칸 오염 |
| **중복 방지 3곳 무력** | FrYM 커서 파일 없음 · Wikipedia 키 불일치(`Title_slug` vs `pageid`) · VOA 키 불일치(`voa:숫자` vs base36) | 셋 다 검사가 **영구 0건**이고 오류 없이 통과. 미방문 1,667편에 닿지 않고 조용히 정상 종료 |
| **인용 제거기** | 교육·사회 계열은 `<xref>` 가 문장 주어 | 지우면 문장이 무너진다. **인문·사회를 늘릴수록 커진다** |
| **VOA RSS 천장** | `?count=` 201 이상은 오류 없이 20 으로 되돌아감 | 아카이브의 1.4% 만 보고 있었다 |
| **Climate.gov 배선** | `NOAA_FEEDS` 에 2개만 | sitemap 산문 2,632 중 15.5% |
| **`probe-openstax.mjs`** | 라이선스를 한 번도 읽지 않음 | 그래서 확보로 이어지지 않았다 |
| **Gutenberg 소비율** | 영어 52,608권 중 **1,642권(3.1%)** | **가장 값싼 확장은 새 소스가 아니라 이미 가진 수확기** |

### 논증문 공급 0 은 소스 문제가 아니다

`argumentative-supply.test.ts` 가 **2026-08-21 에 이미 기록**했다 — 교재 논증문 문항이
0 개인데 지표는 하나도 안 깨졌다(지문 84편 보유·수집 정상). 원인은 **71편이 The
Conversation ND → `display_only` → 문항 생성기가 통째로 스킵**. 그 주석은 대체 후보였던
Aeon·Quanta·Knowable 도 전부 ND/NC 라 갈아타도 같다고 적어 뒀고, 이번 25갈래가 그것을
확인했다. **논증문을 쓰는 매체가 구조적으로 ND** 다.

---

## 6. 소스로 풀 수 없는 것

- **고1 칸이 `READING_LEVEL_BANDS` 에 아예 없다**(중3 이 천장). 목표표의 「고1 전용
  1,650편」은 담을 그릇이 없다. VOA 가 고1 5,500편을 준비해도 못 담는다.
  **사다리 확장이 소스 확보보다 앞선다.**

---

## 7. 결정 대기 — 임의로 정하지 않는다

| # | 사안 | 걸린 물량 |
|---|---|---|
| 1 | **CC BY-SA 전염** — `adapt-drain-export.mjs:74-79` 는 각색에서 제외("모르는 채로 쓰는 것보다 빼는 편이 싸다"), `source-eligibility.ts:220` 과 발행 게이트는 허용. **저장소 안에서 두 자가 어긋나 있다** | Wikipedia 1,000 · Wikibooks 5,600 · UNESCO 940 |
| 2 | **OWID FAQ** 가 CC BY 와 별개로 "must not edit the material" 요구 | 이미 확보한 14편 |
| 3 | **arXiv 재도입** — v06.69 에서 사용자가 삭제 지시. 당시 사유 중 "CC 는 일부뿐" 은 낡음(2016 1.1% → 2026 **44.4%**), C2 난도·LaTeX 오염 사유는 유효 | ≈650 |
| 4 | **robots.txt 의 AI 크롤러 명시 차단** — UNESCO·DOAB·The Conversation·JSTOR 가 ClaudeBot 을 `Disallow: /` + `ai-train=no`. 자체 UA + 학습 미사용이면 조건 충족이나 임의로 넘을 선이 아니다 | UNESCO 940 · DOAB 전량 |

---

## 8. 착수 순서 — 값싼 것부터, 근거 있는 것부터

1. **`lib-topic.mjs` 분류기 수정** — 모든 우선순위의 근거다. 이게 틀린 채로는 어느 소스를
   얼마나 넣을지 정할 수 없다
2. **중복 방지 공통 규약** — 소스마다 제각각인 것을 `sourceKey()` 한 벌 + 커서 규약으로
   모으고 **회귀로 잠근다**. 목록기와 적재기가 다른 키를 만들면 테스트가 잡게
3. **Climate.gov 피드 네 줄** — +2,200편, 코드 변경 없음
4. **FrYM 커서** — 수정 즉시 1,667편 해금
5. **Gutenberg 재수확** — 3.1% → 확대. 새 소스보다 싸다
6. **VOA 사이트맵** — 아카이브 98.6% 가 미개봉
7. 주제 칸별 재고 **재**실측(분류기 수정 후) → `csat_source_targets` 등록
8. 대형 수확기: World Bank OKR → Frontiers(비-PMC) → BCcampus/Springer → PMC OA

---

## 9. 정찰 방법론 — 다음 회차가 쓸 것

전부 이번에 값을 치르고 배운 것이다. 상세는 [SPEC.md](./SPEC.md).

1. 기사 HTML 의 `rel="license"` grep 이 약관 페이지보다 빠르고 정확하다
2. `WebFetch` 403 이어도 `curl` 로 재확인 — 도구 한계를 소스 한계로 적지 말 것
3. **"CC 라고 알려져 있다" 를 믿지 않는다** — 이번에 사전 가설이 5건 틀렸다
4. 봇 차단 = 반려. 우회하지 않고 **막힌 방식을 적는다**
5. 집계 API 의 라이선스 필드는 **그 사본**의 라이선스가 아니다(OpenAlex 로 PhilSci 를
   세면 cc-by 1,606편이지만 리포지터리 사본은 114 중 1)
6. **총 편수 ≠ 쓸 수 있는 편수**(Global Voices 104,352 → 실사용 11,700)
7. 재게시본은 원 사이트 라이선스가 아니다
8. 라이선스는 **내려받기 전에** 항목별 필드로 거른다
9. "PMC 가 다 갖고 있다" 를 검증 없이 믿지 말 것
10. **문서가 아니라 코드·DB·마이그레이션으로 확인**(CLAUDE.md 가 3개월 낡아 arXiv 를
    현역으로 적고 있었다)
11. 목표표의 「채택 부위」 가정도 실측할 것(Overview·Criticism 절이 11편이었다)

### 조용히 틀린 답을 내던 함정 7

Wikisource `action=raw`·XML 덤프에 **본문이 없다**(트랜스클루전) · Wikibooks
`prop=extracts` 가 **빈 값** · Perseus TEI 가 가제티어를 본문에 섞음 · Bartleby 403 은
소멸이 아니라 **봇 차단** · OpenStax 은퇴 슬러그가 NC 신판으로 **200 리디렉션** ·
VOA RSS `?count=` 가 **조용히 20 으로 되돌아감** · **OAPEN 웹 403 ≠ REST 403**.
