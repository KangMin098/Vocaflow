<!-- docs/reports/sources-register.md -->
# 소스GET 원천 등록부 — 라이선스는 경로 선택 키다 (2026-09-23)

> **이 문서의 규칙 하나: 라이선스를 이유로 후보에서 빼지 않는다.**
> 라이선스는 **어떤 변환을 쓸지 고르는 키**이지 통과·탈락 판정이 아니다.
> 발굴 1~3차([v1](./sources-discovery.md) · [v2](./sources-discovery-v2.md) · [v3](./sources-discovery-v3.md))에서
> 내가 「실격」·「반려」로 내렸던 원천을 **전부 되살려** 경로를 붙였다.
>
> 읽기 전용 측정. DB 쓰기 0 · 마이그레이션 0.

---

## 1. 경로표 — 라이선스 → 무엇을 가져올 수 있나

| 경로 | 라이선스 | 가져오는 것 | 산출물 권리 | 비용 |
|---|---|---|---|---|
| **R0 그대로** | PD · PD-Gov · CC0 | **표현 그대로** | 제약 없음 | 최저 |
| **R1 개작** | CC-BY | **표현 개작** + 출처 표시 | 우리 것 + 표시 의무 | 낮음 |
| **R2 개작·전염** | CC-BY-SA | 표현 개작 | **산출 지문도 SA 로 공개** | 낮음 + 정책 판단 |
| **R3 재저작** | CC-BY-NC 계열 | **사실·주제·논지 구조만** → 새로 씀 | **CC0**(우리 저작) | 중 — 드레인 1회 |
| **R4 재저작** | ND · ARR · 라이선스 미확정 | **사실·주제·논지 구조만** → 새로 씀 | **CC0**(우리 저작) | 중 — 드레인 1회 |

**R3·R4 는 같은 작업이다.** 사실과 아이디어는 저작물이 아니므로 원문 표현을 쓰지 않고 새로 쓰면
원 라이선스가 산출물에 미치지 않는다. 저장소가 이미 하는 일이고 이름도 있다 — **ACP §20 사실 재저작**,
소스 키 `original`, 라이선스 `CC0-1.0 (Vocaflow Original)`. **21원천 채점 86.1 로 1위**, 청크 44개 적재 완료,
파일럿 통과율 70%.

> R3·R4 에서 **하는 것**: 쟁점·사실·주장-근거 골격을 읽고 **우리 문장으로** 쓴다.
> R3·R4 에서 **안 하는 것**: 특정 글을 축약·재서술한다(낱말을 바꿔도 파생물이다).
> `original` spec 이 이미 그렇게 적혀 있다 — **"원문 표현 미사용"**.

**경로를 가르는 것은 라이선스 하나뿐이다.** 소재 적합도·논증 밀도·규모는 **우선순위**를 가르지 경로를 가르지 않는다.

---

## 2. 등록부 — 발굴 전체, 제외 없음

측정치는 전부 실측이다. `—` 는 미측정, **미확정**은 라이선스를 못 읽은 것(→ R4 로 라우팅).

### R0 — 표현 그대로

| 원천 | 규모 | 단위 어수 | 논증 | 소재 | 접근 |
|---|---:|---|---|---|---|
| `gutenberg`(보유) | 23,618 | 316 | 22%(비-kids 0.68/편) | 예술·문화·역사 | 가동 |
| `voa`(보유) | 10,649 | 753 | 하 | 전역 | 가동 |
| `usgs`·`nasa`·`noaa`(보유) | 809 | 691~1,073 | 하 | 과학 | 가동 |
| **Standard Ebooks** | ~1,200 | 책 | 서사 | 예술·문화 | Atom 200 · **본문 수집기 필요**(상세 페이지를 쟀던 실수) |
| **NASA Takeaways** | 소량 | **163·193** | **상** | 과학 | 가동 가능 |
| **VOA Editorials** | RSS 20 | **413** | 정책 공지문 | 외교·제재 편중 | PD |
| NPS | 19,643 | 371 | 하(산문 36%) | 역사·인류 | sitemap 200 |
| MedlinePlus | 25,534 | 267 | 하(reference 66%) | 과학 | sitemap 200 |
| CDC · NSF | 3,889 · 1,399 | — | — | 과학 | API·sitemap 200 |

### R1 — 개작 (CC-BY)

| 원천 | 규모 | 단위 어수 | 논증 | 소재 | 접근 |
|---|---:|---|---|---|---|
| **FrYM**(보유 119 = **6%**) | **1,981** | 141 | 중 | 과학 | ★가동 · **최우선** |
| **FEE.org** | **24,010** | 835~938 · 문단 40~130 | **상** | 사회·경제 ⚠️논조 편향 | 200 |
| **Rebus 철학6+심리2** | **131섹션** | 문단 86~109 | **최상** | **철학·윤리·미학·심리** | API(내 재확인 403) |
| **LibreTexts 예술사**(Gustlin) | **53섹션** | 문단 **144~190** | 중 | **예술·문화** | 200 |
| **LSE Blogs** | — | 문단 57~91 | **상** | 사회·경제·철학 | **CloudFront 403** · 라이선스가 `abridge`·`teaching materials`·상업·철회불가 명문 |
| **Wellcome Stories** | 미측정 | 1,521 | 중상 | 역사·인류 | `*` 허용 |
| **OpenAlex 예술·인문** | 347,408 | **167** | 자족+논증 24% | 예술·인문 | 200 |
| OpenAlex 사회·심리·경제 | 2.2M | 167~173 | 4~16% | 사회·심리·경제 | 200 |
| **PLOS Author Summary** | 46,182 | **247**(밴드 21.4%) | 하(보고 수사) | 과학 | 200 |
| CC-BY 서평 | 45,932 | 547 · **3문단=185** | **상** | 인문 | EPMC 200 |
| Editorial | 75,183 | 1,252 | 하 | 전역 | EPMC 200 |
| 공개 심사평 | 379,715 | 밴드 13% | **상** · **자족 0%** | 전역 | OpenAlex 200 |
| **SciELO sza**(편당 `by/3.0`) | **≈5,800** | **172**(밴드 23%) | **40%** — 최고 | **인문사회** | articlemeta 200 |
| SciELO scl 전환저널 | ≈14,200(저널 단위) | 165 | 상 | 인문사회 | articlemeta 200 |
| **OBP** | **303권** | 문단 밴드 **11.0%** | **최상** | 인문 | TEI XML 200(브라우저 UA) · **Thoth GraphQL 이 정규 경로** |
| DOAB/OAPEN CC-BY 인문사회 | **4,585권** | 문단 밴드 4.0% | 상 | 인문사회 | CSV 200 · 본문 `/rest/bitstreams/{uuid}/retrieve` 200 |
| Global Voices | 104,378 | 1,443 · 문단 44 | 중상 | 사회·경제 ⚠️맥락 의존 44% | 200 |
| EFF Deeplinks | ~20,000 | 897~1,269 | **최상** | 기술·매체 | RSS 200 |
| SciDev.Net | 13,288 | 2,616 | 중 | 과학·사회 | 200 |
| Wikinews | 22,237 | 449 | 하 · **34% 스포츠** | 사회·경제 | **코드 있음 · 재고 0** |
| **World Bank OKR** | **40,415** | prose-run 121~655 | 중상 | 사회·경제 | **코드 있음 · 재고 0** — §3 |
| BanglaJOL 인문 38지 | CC 258건 | 203 | SSR 36% | 인문사회 | OAI 200 |
| NepJOL 인문 95지 | CC 68% | 214 | 서베이 45% | 인문사회 | OAI 200 |
| Knowledge Commons | 3,118 | 170 | **최상** | 인문 | API 200 · rights 공백 60% |
| OLH | 10,270 | **154~157** | 상 · **FRE 20.8** | 인문 | API 200 · offset 404 함정 |
| Ubiquity Press | 20,755 | 198 | 갈림(논증형 4지 ~1,100) | 혼재 | sitemap 200 |
| Nature Comms / Sci Reports | 대규모 | — | — | 과학 | **Europe PMC 경유** |
| PeerJ · BMC | — | — | — | 과학 | index.json 200 |
| Zenodo · OSF · Figshare | 2.5M · 202k | — | — | 전역 | 전문 수신 100%·100% |
| Internet Archive | 2,463,499 | 책 | 혼재 | 전역 | `licenseurl:` 서버 필터 |
| African Storybook · Wikivoyage · 기타 보유 | 소량 | — | — | — | — |

### R2 — 개작·SA 전염 (CC-BY-SA)

| 원천 | 규모 | 단위 어수 | 논증 | 소재 |
|---|---:|---|---|---|
| **Public Domain Review** | **1,652** | collection **292·496** | 중상 | **예술·문화** |
| **Economics Observatory** | **1,104** | 문단 **55 → 3문단=165** | **상** | 사회·경제 |
| `wikipedia`·`simple_wikipedia`(보유) | 114 | 2,690·900 | 하 | 예술·역사 |
| Wikibooks · Wikiversity | ~6,300 | 문단 76 | 하 | 교육·과학 |
| **Wikiversity Wikidebate** | **129** | 단락 | **최상 · 형태가 정확히 구멍** | 전역 |
| New World Encyclopedia | 16,211 | 3,318 | 하~중 | 전역 |
| Kiddle | 700,000+ | 1,593 | 없음 · A2 | 전역 |
| IBM Debater ArgQ | 30,497 | **최대 44** | 상 | 71주제 |
| BCcampus | 131권 · 8.2M어 | 문단 105 | 책별 | 전역 |

### R3 — 재저작 (NC 계열) · **사실·논지만**

| 원천 | 규모 | 왜 가치 있나 |
|---|---:|---|
| **Smarthistory** | 2,500~3,000 | **예술 논증 내용 최상위** — 예술·문화 칸의 최대 공급선 |
| **Noba Project** | 105모듈 | **심리학 교재 전량** — 심리·인지 칸 |
| **OpenStax 현행 70권** | 1,422섹션 | Philosophy·Psychology·Sociology·World History (2026-03 전 라이브러리 NC-SA 전환) |
| **LibreTexts NC 계열** | **775권 ≈ 63,300섹션** | CC-BY 분의 **2배** |
| **World History Encyclopedia** | 5,245 | 역사·인류 · ToU 가 ML 학습 별도 금지 |
| **punctum books** | 452권(BY-NC-SA 412) | **Thema 예술 70 · 문학 64 · 철학 40** — 주제 적중 최고 |
| ANU Press | **936권** | Thema 사회 240 · 역사 135 — **HSS 적중 최고** |
| Athabasca UP | 180권 | Manifold HTML 판 보유 |
| MIT OCW | — | 강의노트 |
| Nieman Lab · Tax Foundation · Mises · Hechinger | — | 매체·조세·경제·교육 논평 |
| KCI(한국) | 182지 중 NC 148 | **한국 학습자 배경지식과 맞는다** |
| Cochrane PLS · IZA World of Labor | 20,079 · 3,719 | IZA 는 "one-page summary" 포맷 |
| PERSUADE · ELLIPSE | 25,996 · 6,500 | ⚠️**짧은 글 = 못 쓴 글**(140~200어 대역 소문자 시작 10.3%) |
| Kialo Edu | — | 논증 매핑 |

### R4 — 재저작 (ND · ARR · 미확정) · **사실·논지만**

| 원천 | 규모 | 왜 가치 있나 |
|---|---:|---|
| **Issues in Science and Technology** | ≥2,000 | **조사 전체 내용 1위** · 문단 57~81 · "이 정책은 틀렸다 + 근거 3개"가 기본 골격 |
| **Britannica ProCon** | — | **쟁점별 찬반 논거가 이미 구조화** |
| **Gale Opposing Viewpoints** | **20,000+** | viewpoint 에세이 |
| **IDEA Debatabase** | **700 논제** | 찬반 |
| **args.me** | **31,700이 정확히 140~200어** | 논지 뼈대로는 조사 전체 최적 |
| **Phi Delta Kappan** | ≥1,000 | **B1~B2 에 가장 정확** · copyright.com 에서 **구매 가능** |
| **The Conversation** | 6만+ | **발췌 수율 82%** — 텍스트 품질 최상 |
| **AJOL** | **174,201 OA 전문** | **초록 중앙 162어**(목표 164 — 최근접) · 영어 100% · 논증 25% |
| **SAPIENS** | 1,540 | 인류학 · 역사·인류 |
| **Érudit** | 영어 ≈44% | 기호학·연극학·건축사 — **소재가 정확히 맞는다** |
| **Project MUSE** | — | 대학출판부 인문 저널 |
| **JSTOR** | — | Early Journal Content 등 |
| **EBSCO Research Starters** | 수십만 | History 한 분야만 3,991 |
| **PhilPapers / PhilArchive** | 135,836 초록 | **초록 150~300어** — 철학 |
| **SEP / IEP** | ~1,800 / ~900 | 철학 서베이 · **단락 중앙 126~135어** |
| **Aeon / Psyche** | 수천 | 논증 밀도 최상 |
| Knowable · Undark | — | 과학 저널리즘 |
| **RePEc / EconPapers** | 550만+ | 경제 — 전문은 각 출판사 |
| Dialnet · Redalyc · LA Referencia | 773,161 등 | 라이선스 미확정 |
| J-STAGE | philosophy 21,998 | 라이선스 필드 자체가 없음 |
| SSOAR · EconStor | 59,499 · 321,139 | ⚠️**EconStor 는 초록 167어로 길이 게이트를 통과하는데 주장동사 1.5%** |
| CK-12 · NCERT | — | ToU 가 AI 학습·개작을 별도 금지 |
| Liverpool UP · White Rose UP | 749 · 366 | 본사 403 |
| 학회 매거진(American Scientist·Physics Today·APA Monitor·AHA 등) | — | 라이선스 미확정 또는 ARR |
| 국내 ELT(NE능률·비상·천재·Compass) | — | **장르 적합도 조사 전체 최고** |
| VJOL | 230,412(영어 6%) | — |

---

## 3. 이 재구성이 바꾸는 것

**① 순위가 뒤집힌다.** 라이선스로 줄 세우면 1등이 LSE Blogs 였다. 경로별로 보면 **R4 상단이 앞선다** —
Issues in S&T · ProCon · Gale · args.me · AJOL 은 **논증 구조가 이미 만들어져 있어서** R4 재저작의
입력으로 가장 싸다. 「쟁점 + 찬반 논거」를 읽고 164어를 쓰는 것이, 논증 없는 CC-BY 초록에
없는 논증을 넣는 것보다 싸다.

**② 예술·문화와 심리·인지 칸이 열린다.** 두 칸은 CC-BY 공급선이 거의 없어 막혀 있었다.
R3 로 보면 **Smarthistory**(예술 논증 최상위) · **Noba**(심리학 교재 전량) · **punctum**(Thema 예술 70·철학 40) ·
**LibreTexts NC 775권** 이 전부 입력이 된다.

**③ 병목이 라이선스에서 compose 게이트로 옮겨간다.** 그리고 거기에 측정된 결함이 있다 —
자작 지문 표본 50편에서 선언 CEFR 과 실측이 **29편 불일치**, **`A2` 발주 12편은 12편 전부 B1 이상**이다.
어휘만 통제하고 구문 길이·전문어 밀도를 안 잡는다. **입력을 어디서 가져와도 A2 칸은 지금 방식으로 안 채워진다.**

**④ 그래도 R0·R1 을 먼저 한다.** 표현까지 쓸 수 있으면 재저작 드레인이 통째로 빠지므로 비용이 다르다.
**FrYM 잔여 1,862편**(새 코드 0) · **World Bank 40,415편**(CHECK 제약 한 줄) 이 그래서 맨 앞이다.

---

## 4. 라우팅에 필요한 사실 — 착수 전 확인할 것

라이선스를 **탈락이 아니라 경로 선택에 쓰므로**, 틀린 라이선스는 틀린 경로를 낳는다.
이번 조사에서 잡은 오보 7건이 전부 그 위험의 실례다.

| 원천 | 잘못 알려진 것 | 실제 |
|---|---|---|
| Prindle Post | CC BY-SA | **인쇄판 4권에만**. 웹은 비상업 한정 |
| Aeon Ideas | CC BY-ND | **폐지된 구 정책**. 현행 편당 $650 |
| Getty Open Content | 개방 | **CC0 는 이미지 16만 점에만 · 텍스트 0** |
| SEP | 무료=자유 | 저자 저작권 + Stanford 독점 · 재배포 금지 |
| PERSUADE HF 미러 | `license: mit` | 저자 저장소는 **CC BY-NC-SA 4.0** |
| justice-everywhere | CC 링크 있음 | 본문이 아니라 **위키미디어 이미지 크레딧** |
| **SciELO** | 저널 단위 CC-BY 65% | **편당은 라이선스 없음 56% · `by/3.0` 12%** |

**규칙 셋:**
1. **라이선스는 가장 가까운 원천에서 읽는다** — Crossref 는 OpenEdition 라이선스를 32.5%만 안다. OAI `dc:rights` 가 정본이다.
2. **저널 단위를 편당 판단에 쓰지 않는다** — SciELO 가 그 실례다.
3. **`open_access` 는 재사용 허가가 아니다** — SSOAR 101,714 · EconStor 321,139 둘 다 저장소 전체다.

그리고 접근 차단(403 · WAF · 레이트리밋)은 **라이선스 판단이 아니라 운영 사실**이다. 별도로 기록한다 —
LSE(CloudFront) · AJOL(202 레이트리밋) · Rebus(내 재확인 403) · LA Referencia(Anubis) ·
AgEcon(AWS WAF) · Liverpool/White Rose 본사(403).

---

## 5. 착수 순서 — 경로별 비용순

| # | 할 일 | 경로 | 비용 |
|---|---|---|---|
| 0 | **compose 게이트에 3중 합의 검사** · **off-list(≤13%) 게이트로 교체** | 공통 | 코드 2 |
| 1 | **FrYM 잔여 1,862편** | R1 | **새 코드 0** |
| 2 | **World Bank CHECK 제약 SQL**(승인 후) | R1 | SQL 1줄 → 40,415편 |
| 3 | `europe-pmc.ts` 가 `stripJatsCitations` 를 쓰게 | 공통 | import 1줄 → 잔해 78%→9% |
| 4 | **Rebus 131섹션 · LibreTexts 예술사 53섹션** | R1 | 어댑터 2 |
| 5 | **FEE 24,010 · Economics Observatory 1,104 · PDR 1,652** | R1·R2 | 어댑터 3 |
| 6 | **SciELO** 편당 `license` 전수 재계수 → 파이프라인 | R1 | 어댑터 1 + 평이화 |
| 7 | **R4 논지 뼈대 파일럿 20편** — ProCon·Gale·args.me·Issues | R4 | 드레인 1 |
| 8 | **R3 예술·심리 파일럿 20편** — Smarthistory·Noba | R3 | 드레인 1 |
| — | 사람: **CORE API 키** · **LSE 접근 문의** · **AJOL 라이선싱 문의** | — | 0원 |

**7·8 이 이 재구성의 핵심 실험이다.** R3·R4 재저작의 통과율을 실측해야 「라이선스 무관 발굴」의
실제 수율이 나온다. `original` 파일럿이 70% 였으므로 기대할 근거는 있다.

---

*관련: [v1](./sources-discovery.md) · [v2](./sources-discovery-v2.md) · [v3](./sources-discovery-v3.md) ·
[sources-scorecard](./sources-scorecard.md) · ACP §20 사실 재저작 · `scripts/csat/compose-drain-export.mjs`*
