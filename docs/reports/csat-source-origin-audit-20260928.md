# 평가원 영어 기출 원천 전수 조사 — 2026-09-28

## 결론

DB의 평가원 영어 독해 지문 **802문항 전부**를 본문 정규화 해시로 묶어 **713개 고유 지문**으로 조사했다. 그 결과 원문 또는 근접 원문을 직접 확인한 지문은 **26개**, 서지는 강하게 지지되지만 공개 원문 대조가 덜 된 후보는 **22개**, 소재 계보만 확인된 것은 **1개**, 현재 근거로 확정할 수 없는 것은 **664개**다.

이 수치는 “검색 결과가 있었다”가 아니라 아래의 근거 등급을 통과한 수치다. 시험 문제 재게시·학원 자료·AI 생성형 출처 페이지는 그 자체만으로 확정 근거로 쓰지 않았다.

## 조사 범위

| 항목 | DB 실측 |
|---|---:|
| 시험 행 | 30 |
| 수능 / 평가원 모의평가 | 14 / 16 |
| 문항이 있는 시험 | 29 |
| 조사 문항 | 802 |
| 고유 지문 | 713 |
| 중복을 포함한 문항 커버리지 | 802 |
| 교육청 학평 | 0 |

- `M2009`는 시험 행만 있고 문항이 0개다.
- 현재 DB 범위는 수능과 한국교육과정평가원 모의평가다. 교육청 전국연합학력평가는 들어 있지 않다.
- 한 지문을 여러 문항이 공유하는 41–42번, 43–45번 등은 한 번만 검색하고 모든 연결 문항을 결과에 남겼다.

## 근거 등급

| 상태 | 뜻 |
|---|---|
| `confirmed_exact` | 출판사·저자·학술 페이지 또는 서지가 확인되는 전문 사본에서 시험 지문과 동일하거나 가벼운 편집만 거친 문장을 직접 확인 |
| `supported_candidate` | 책·논문 서지는 공식 페이지로 확인되고 독립적인 귀속 단서가 있으나, 공개된 원문에서 해당 문단을 직접 재확인하지 못함 |
| `topic_lineage_only` | 같은 연구·사례의 학술 원천은 찾았지만 시험 문장의 직접 원전이라고 볼 수 없음 |
| `unresolved` | 여러 독특한 구절을 검색했으나 시험 재게시물 밖에서 검증 가능한 원천을 찾지 못함 |

## 방법

1. `csat_items.passage`를 소문자·구두점·공백 기준으로 정규화하고 SHA-256으로 묶었다.
2. 713개 지문마다 문서 빈도가 낮은 7–11단어 구절을 최대 3개 골라 정확 구절 검색을 수행했다.
3. 일반 웹, 도서 본문, 출판사 미리보기, 학술 페이지, 저자 페이지 순으로 대조했다.
4. 시험지·EBS·학원·Quizlet·Scribd 등 재게시물은 원문 발견이 아니라 지문 동일성 확인에만 썼다.
5. 출처 집계에는 본문을 저장하지 않고 문항 ID, 본문 해시, 서지, 근거 URL만 남겼다.

재현 시작점은 `node scripts/csat/source-origin-export.mjs`, 결과 조립은 `node scripts/csat/source-origin-build.mjs`다. 검색 원문 로그는 평가원 지문과 대용량 검색 응답을 포함하므로 저장소에서 제외한다.

## 확인·후보 목록

| 문항 | 상태 | 원천 | 대표 근거 |
|---|---|---|---|
| 2015#34 | confirmed_exact | Jan van Dijk — *The Network Society* | [New-media definition with van Dijk citation](https://bilgiyonetimi.net/essential-mooc/en/module_2_9.html?userType=trainee) |
| 2016#34 | confirmed_exact | David Haven Blake — *Walt Whitman and the Culture of American Celebrity* | [Oxford Academic publisher page and exact preface text](https://academic.oup.com/yale-scholarship-online/book/22558/chapter-abstract/182889838) |
| 2020#34 | confirmed_exact | Nicholas Cook — *Music, Imagination, and Culture* | [Oxford Academic chapter text](https://academic.oup.com/book/49192/chapter-abstract/422321663) |
| 2021#36 | confirmed_exact | Thomas Rid — *Cyber War Will Not Take Place* | [Publisher preview, chapter 1](https://api.pageplace.de/preview/DT0400.9780199365463_A24395982/preview-9780199365463_A24395982.pdf) |
| 2022#20 | supported_candidate | Olivier Blanchard — *Social Media ROI: Managing and Measuring Social Media Efforts in Your Organization* | [InformIT/Que metadata](https://www.informit.com/store/social-media-roi-managing-and-measuring-social-media-9780789747419) |
| 2022#21 | supported_candidate | Naomi Oreskes, Erik M. Conway — *Merchants of Doubt* | [Bloomsbury metadata](https://www.bloomsbury.com/us/merchants-of-doubt-9781608192939/) |
| 2022#22 | confirmed_exact | William H. Markle, Melanie A. Fisher, Raymond A. Smego Jr. — *Understanding Global Health* (Chapter 6, Environmental Health in the Global Context) | [McGraw-Hill AccessMedicine chapter](https://accessmedicine.mhmedical.com/content.aspx?bookid=710&sectionid=46796907) |
| 2022#23 | supported_candidate | Thomas Nickles — *Thomas Kuhn* (Contemporary Philosophy in Focus) | [Cambridge book metadata](https://www.cambridge.org/core/books/thomas-kuhn/339C2A262C829739D7DC8C74AFE27280) |
| 2022#24 | supported_candidate | Susan Strasser — *Waste and Want: A Social History of Trash* | [Macmillan metadata](https://us.macmillan.com/books/9780805065121/wasteandwant/) |
| 2022#29 | supported_candidate | James D. Mauseth — *Botany: An Introduction to Plant Biology* | [Jones & Bartlett sample and metadata](https://samples.jblearning.com/9781284157352/9781284157468_FMXx_Pass04_Secured_19251_1.pdf) |
| 2022#30 | supported_candidate | *Crop Responses to Environment: Adapting to Global Climate Change* | [CRC/Routledge title metadata](https://www.routledge.com/Crop-Responses-to-Environment-Adapting-to-Global-Climate-Change/) |
| 2022#31 | supported_candidate | John Morreall — *Comic Relief: A Comprehensive Philosophy of Humor* (Chapter 5, The Negative Ethics of Humor) | [Wiley book page and contents](https://onlinelibrary.wiley.com/doi/book/10.1002/9781444307795) |
| 2022#32 | supported_candidate | Chris Barker — *The SAGE Dictionary of Cultural Studies* | [SAGE metadata](https://www.sagepub.com/shop/buy-a-book/the-sage-dictionary-of-cultural-studies-1-219252) |
| 2022#33 | supported_candidate | Bo Rothstein — *Social Traps and the Problem of Trust* | [Cambridge metadata](https://www.cambridge.org/core/books/social-traps-and-the-problem-of-trust/02225C0BB48764F18F287FD6569EEF2E) |
| 2022#34 | confirmed_exact | Frank Ankersmit — *Historical Representation* | [Searchable full-text copy](https://dokumen.pub/download/historical-representation-9781503619029.html) |
| 2022#35 | supported_candidate | Robin Teigland, Dominic Power — *The Immersive Internet* | [Springer/Palgrave metadata](https://link.springer.com/book/10.1057/9781137283023) |
| 2022#36 | supported_candidate | Paul Robbins, John Hintz, Sarah A. Moore — *Environment and Society: A Critical Introduction* | [Wiley metadata for the later edition](https://uat.store.wiley.com/en-us/environment-and-society-a-critical-introduction-2nd-edition-p-9781118451557) |
| 2022#37 | confirmed_exact | Geir Farner — *Literary Fiction: The Ways We Read Narrative Literature* | [Searchable full-text copy](https://dokumen.pub/literary-fiction-the-ways-we-read-narrative-literature-9781623564841-9781623560249-9781628926996-9781623560256.html) |
| 2022#38 | supported_candidate | Patrick Lin, Keith Abney, George A. Bekey — *Robot Ethics: The Ethical and Social Implications of Robotics* | [MIT Press metadata](https://mitpress.mit.edu/9780262526005/robot-ethics/) |
| 2022#39 | confirmed_exact | Todd McGowan — *The Real Gaze: Film Theory after Lacan* | [Searchable full-text copy](https://pdfcoffee.com/the-real-gaze-film-theory-after-lacan-pdf-free.html) |
| 2022#40 | supported_candidate | Robert N. Brandon — *Adaptation and Environment* | [WorldCat catalog search](https://search.worldcat.org/search?q=ti%3AAdaptation+and+Environment+au%3ARobert+Brandon) |
| 2022#41, 2022#42 | confirmed_exact | David Kelley — *The Art of Reasoning: An Introduction to Logic and Critical Thinking* | [W. W. Norton ebook chapter](https://nerd.wwnorton.com/ebooks/epub/artofreasoning5/EPUB/content/1.1.1-chapter01.xhtml) |
| 2024#31 | confirmed_exact | Peter Hunt — *International Companion Encyclopedia of Children's Literature* | [Searchable full-text copy](https://pubhtml5.com/iytc/jrjd/basic/) |
| 2025#37 | topic_lineage_only | Marc Bekoff — *Play Signals as Punctuation: The Structure of Social Play in Canids* | [Scholarly paper on the same study lineage](https://onlinelibrary.wiley.com/doi/abs/10.1111/j.1439-0310.1995.tb01096.x) |
| 2026#21 | supported_candidate | Jamie Woodcock, Mark Graham — *The Gig Economy: A Critical Introduction* | [Oxford Internet Institute publication record](https://www.oii.ox.ac.uk/research/publications/the-gig-economy-a-critical-introduction/) |
| 2026#22 | supported_candidate | Vanessa Ratten — *Sport Entrepreneurial Ecosystems: Technology Innovation Perspectives* | [Springer book page](https://link.springer.com/book/10.1007/978-981-97-8923-8) |
| 2026#23 | supported_candidate | Jarrett Walker — *Human Transit* | [Author's book site](https://humantransit.org/book/table-of-contents) |
| 2026#24 | supported_candidate | Stuart Moss — *The Entertainment Industry: An Introduction* (Chapter 16, Culturtainment) | [Google Books metadata and contents](https://books.google.com/books/about/The_Entertainment_Industry.html?id=n3Vi0RyXc5wC) |
| 2026#29 | supported_candidate | Joseph Henrich — *The Secret of Our Success* | [Princeton catalog](https://assets.press.princeton.edu/catalogs/F15InternationalD.pdf) |
| 2026#31 | supported_candidate | Sophia Murphy — *Strategic Issues in the Global Grain Trade* | [Exact-match attribution page](https://peshare.com/saying/view_saying.jsp?saying_id=248) |
| 2026#33 | supported_candidate | Francis D. K. Ching, Corky Binggeli — *Interior Design Illustrated* | [Wiley metadata](https://uat.store.wiley.com/en-us/interior-design-illustrated-4th-edition-p-9781119468530) |
| 2026#36 | confirmed_exact | Richard J. Bird — *Chaos and Life: Complexity and Order in Evolution and Thought* | [Publisher preview](https://api.pageplace.de/preview/DT0400.9780231501552_A25430015/preview-9780231501552_A25430015.pdf) |
| 2026#38 | supported_candidate | Brent Dykes — *Effective Data Storytelling: How to Drive Change with Data, Narrative and Visuals* | [Wiley metadata](https://uat.store.wiley.com/en-us/effective-data-storytelling-how-to-drive-change-with-data-narrative-and-visuals-p-9781119615729) |
| 2026#39 | confirmed_exact | Steve Swink — *Game Feel: A Game Designer's Guide to Virtual Sensation* | [University-hosted full text](https://studio.eecs.umich.edu/confluence/download/attachments/17827062/Game%20Feel.pdf?api=v2&modificationDate=1602432370681&version=1) |
| 2026#40 | supported_candidate | Paul Bouissac — *Semiotics at the Circus* | [De Gruyter book page](https://www.degruyterbrill.com/document/doi/10.1515/9783110218312/html) |
| M1809#36 | confirmed_exact | E. Bruce Goldstein — *Cognitive Psychology: Connecting Mind, Research, and Everyday Experience* | [Full-text copy, chapter on attention without eye movements](https://fliphtml5.com/lnym/ljxx/COGNITIVE_PSYCHOLOGY_2ND_EDITION/) |
| M1809#37 | confirmed_exact | Irina D. Costache — *The Art of Understanding Art: A Behind the Scenes Story* | [Wiley excerpt, chapter 1](https://catalogimages.wiley.com/images/db/pdf/9780470658321.excerpt.pdf) |
| M2206#22 | confirmed_exact | Wayne J. Del Pico — *Project Control: Integrating Cost and Schedule in Construction* | [Wiley excerpt, Benefits of Proper Planning](https://catalogimages.wiley.com/images/db/pdf/9781394150120.excerpt.pdf) |
| M2209#30 | confirmed_exact | Jean-Paul Rodrigue, Claude Comtois, Brian Slack — *The Geography of Transport Systems* | [Author-maintained open textbook page](https://transportgeography.org/contents/chapter1/what-is-transport-geography/transportation-derived-demand/) |
| M2209#33 | confirmed_exact | John Scott — *Conceptualising the Social World: Principles of Sociological Analysis* (Chapter 2, Culture: the Socialisation of Meaning) | [Cambridge Core chapter](https://www.cambridge.org/core/books/abs/conceptualising-the-social-world/culture-the-socialisation-of-meaning/0E91BA2F04F4A490E6D47D9BCC082F15) |
| M2209#38 | confirmed_exact | William D. Callister Jr., David G. Rethwisch — *Materials Science and Engineering: An Introduction* | [Wiley excerpt](https://catalogimages.wiley.com/images/db/pdf/9781119278566.excerpt.pdf) |
| M2406#20 | confirmed_exact | James C. Kaufman, Vlad P. Glăveanu, John Baer — *The Cambridge Handbook of Creativity across Domains* (Opportunities, Conditions, and Limitations of Cross-Domain Creativity) | [Publisher preview](https://api.pageplace.de/preview/DT0400.9781108294775_A30638556/preview-9781108294775_A30638556.pdf) |
| M2406#23 | confirmed_exact | Mirjam Brusius, Kavita Singh — *Museum Storage and Meaning: Tales from the Crypt* (Introduction) | [Publisher preview](https://api.pageplace.de/preview/DT0400.9781351659437_A30869589/preview-9781351659437_A30869589.pdf) |
| M2506#39 | confirmed_exact | Gerald C. Cupchik — *The Aesthetics of Emotion: Up the Down Staircase of the Mind-Body* | [Publisher preview](https://api.pageplace.de/preview/DT0400.9781316540541_A27168315/preview-9781316540541_A27168315.pdf) |
| M2506#40 | confirmed_exact | Jean Drèze, Amartya Sen — *Hunger and Public Action* (Experiences and Lessons) | [Oxford Academic chapter](https://academic.oup.com/book/2070/chapter/141987885) |
| M2606#37 | confirmed_exact | Richard J. Bird — *Chaos and Life: Complexity and Order in Evolution and Thought* | [Publisher preview](https://api.pageplace.de/preview/DT0400.9780231501552_A25430015/preview-9780231501552_A25430015.pdf) |
| M2606#41, M2606#42 | confirmed_exact | Fiona Andreallo — *Mapping Selfies and Memes as Touch* (Semeful Sociabilities: Socially Networked Photography as Embodied Relationships of Touch) | [Springer open-access chapter](https://link.springer.com/chapter/10.1007/978-3-030-94316-5_5) |
| M2706#24 | confirmed_exact | Leonard J. Lickorish, Carson L. Jenkins — *An Introduction to Tourism* | [Searchable book preview](https://www.perlego.com/book/1625973/introduction-to-tourism-pdf) |
| M2706#37 | confirmed_exact | John R. Gold, Margaret M. Gold — *Cities of Culture: Staging International Festivals and the Urban Agenda, 1851–2000* | [Full-text author copy](https://www.researchgate.net/publication/335925233_Cities_of_culture_staging_international_festivals_and_the_urban_agenda_1851-2000) |

## 조사 중 바로잡은 오귀속

- 2026 수능 22번은 Simon Chadwick 외가 아니라 Vanessa Ratten의 *Sport Entrepreneurial Ecosystems*가 유력하다.
- 2026 수능 24번은 다른 문화·스포츠 개론서가 아니라 Stuart Moss 편 *The Entertainment Industry*의 “Culturtainment” 장이 유력하다.
- 2026 수능 36번은 Edward T. Hall의 *The Dance of Life*가 아니라 Richard J. Bird의 *Chaos and Life*에서 문장이 직접 확인된다.
- 2026 수능 38번은 Paul Smith의 *Sell with a Story*가 아니라 Brent Dykes의 *Effective Data Storytelling* 귀속이 더 강하다.
- 2026 수능 40번은 막연한 *Semiotica* 논문이 아니라 Paul Bouissac의 *Semiotics at the Circus* 귀속이 더 강하다.
- 2022 수능 31번은 Morreall의 정치 유머 장보다 *Comic Relief*의 “The Negative Ethics of Humor”가 문맥과 문장에 맞는다.

## 한계와 DB 반영 조건

- 평가원 문제지는 영어 지문의 서지 출처를 공개하지 않으므로, 이 조사는 공식 정답표가 아니라 증거에 묶인 역추적 결과다.
- `supported_candidate`와 `topic_lineage_only`는 제품 화면에서 “출처”로 단정해 표시하면 안 된다.
- 현행 `csat_items`에는 원천 서지·근거·검증 상태 컬럼이 없다. 이번 작업은 **DB를 변경하지 않았다**.
- DB에 넣으려면 최소한 `status`, `source_title`, `source_author`, `source_url`, `evidence_url`, `verified_at`, `passage_sha256`를 함께 저장하고, 본문 해시가 달라지면 검증을 무효화해야 한다. 마이그레이션과 적재는 별도 승인 후 진행한다.

전체 713행 결과: [csat-source-origin-results-20260928.jsonl](./csat-source-origin-results-20260928.jsonl)
