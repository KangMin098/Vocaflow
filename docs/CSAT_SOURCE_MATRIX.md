# CSAT Source Matrix — 실측 기반 소스 아키텍처 (v1, 2026-07-09)

> CSAT(수능) stage × register × 소스 매트릭스. **실측 + 구현 실적 기반** (추측 아님).
> SSoT 원칙은 [ACP_SOURCE_REDESIGN.md](./ACP_SOURCE_REDESIGN.md) §18/§20 계승. 본 문서는
> "어떤 소스가 실제로 dependency-0 로 성립하는가"를 **feasibility 축**으로 정리한 레퍼런스.
> 표기: — 단정(실측/구현) · 추정 · 확인필요.

---

## 0. 핵심 축 — dependency-0 성패는 포맷이 가른다

이 프로젝트의 ingester 는 **의존성 0 정규식 HTML 파싱**(헤드리스 브라우저·PDF 파서 금지). 따라서
소스 채택 가능성은 3개 축의 교집합:

1. **포맷** — HTML-native(서버렌더) ✅ vs PDF-저장소/SPA/봇차단 ❌ (OBP 교훈)
2. **라이선스** — PD/CC0/CC-BY/CC-BY-SA(파생·문항 가능) vs `*-NC*`/`*-ND*`(읽기 전용 or 불가)
3. **트리거** — §18 매트릭스 빈칸 충족 여부 (커버된 register 에 "더 넣기" 금지)

> 셋 다 통과해야 신설. 하나라도 실패 시 동결(대기열) 또는 기각.

---

## 1. 현재 커버리지 스냅샷 (2026-07-09, publishable = published ∧ ¬display_only)

| register | 발행 | A2 | B1 | B2 | C1 | 소스 |
|---|---|---|---|---|---|---|
| expository | 78 | 1 | 35 | 17 | 25 | NASA·Simple Wiki·VOA |
| narrative | 13 | 1 | 7 | 5 | 0 | VOA(lets-learn-english) |
| argumentative | 8 | 0 | 0 | 7 | 1 | **OWID** |
| news | 3 | 0 | 2 | 1 | 0 | VOA(as-it-is) |
| reference | 3 | 0 | 0 | 1 | 2 | **CIA Factbook** |

**5개 코어 register 전부 publishable.** 얇은 칸 = news·argumentative·reference·A2 입문 → **깊이(드레인)** 과제이지 새 소스 아님.

---

## 2. T-1 운영 중 (기구현 · 무수정)

| 소스 | license_class | 경로 | register | 포맷 |
|---|---|---|---|---|
| VOA | public_domain | ACP | news/narrative/expository(피드별) | HTML ✅ |
| NASA · NIH | public_domain | ACP | expository | HTML ✅ |
| Simple Wikipedia | cc_by_sa | ACP | expository/reference | MediaWiki ✅ |
| Wikinews | cc_by | ACP | news | HTML ✅ (비활성) |
| The Conversation | cc_by_nd → **display_only** | ACP | argumentative | HTML(읽기 전용) |
| **OWID** (v06.163) | cc_by | ACP | argumentative | HTML ✅ |
| **CIA Factbook** (v06.167) | public_domain | ACP | **reference** | JSON 덤프 ✅ |
| Standard Ebooks · Gutenberg | public_domain | LCP | narrative | HTML ✅ |
| StoryWeaver | cc_by | LCP | narrative | API ✅ |
| **Pressbooks** (v06.163) | cc_by | LCP | 논픽션/교재 | HTML ✅ |
| LibriVox | public_domain | LCP(오디오) | — | 오디오 앵커 |

> **설계 문서 대비 이동**: OWID·Factbook·Pressbooks 는 원래 "신설/동결"이었으나 **이 세션에 구현되어 T-1 로 승격**.

---

## 3. T-2 신설 결과 (실적)

| 소스 | 결과 | 근거 |
|---|---|---|
| **OWID** | ✅ 구현·8건 발행 | 산문 730–3,600w · CC-BY · argumentative. 잔여: 논증 순도(일부 실질 expository) — 추정 |
| **OBP** | ❌ **부적합 확정** | 챕터 전문 PDF-only(`__NEXT_DATA__` = PDF URL만·산문 0) + 표본 CC-BY-**NC-ND**. β(PDF)=dependency-0 위반 — 단정(실측) |
| **Pressbooks** (OBP α 대체) | ✅ 구현·23챕터 발행 | 서버렌더 HTML 챕터 + CC-BY 4.0. **S4 라이브러리 경로의 실제 해결** — 단정 |

> 설계의 "S4 = OBP(HTML/XML 제공)"는 **실측으로 반증**. S4 = **Pressbooks**.

---

## 4. T-3 동결 풀 — feasibility 재분류

### A. 청정 viable (HTML-native + CC-BY) — 실측 확인 · 트리거 비긴급
| 소스 | 실측 | stage | 비고 |
|---|---|---|---|
| **PLOS** | 서버렌더 111×`<p>` · CC-BY 확인 | S4 과학(C2) | 트리거(OBP 후) → Pressbooks 로 이미 충족 |
| **eLife digest** | API 정상 · HTML · CC-BY | S2 과학 설명 | digest 평이 → 밴드 정합. RSS 경량 |
| **Wikipedia 정규** | MediaWiki(`_mediawiki` 재사용) | S2–S3 expository(C1+) | **최저비용**. 단 narrative 아님 |
| **PMC OA subset · BMC** | JATS XML(NCBI API — dependency-0 가능) | S4 생의학(C2) | 부분 viable. 도메인 수요 시 |

### B. PDF-저장소/SPA/봇차단 — dependency-0 **블록** (OBP 동형)
| 소스 | 판정 |
|---|---|
| OECD | 봇차단 403 + PDF + CC BY-NC-ND 위험 |
| World Bank OKR | DSpace 저장소(메타+PDF). 라이선스 CC BY 3.0 IGO(파생 OK)나 **추출 불가** |
| UNDP HDR | 리포트 PDF |
| US Gov CRS·CBO·GAO | PD(라이선스 최상)지만 **전량 PDF 리포트** |
| Language Science Press·UCL·Lever | CC-BY 인문 OA 단행본 — HTML 판 개별 확인 필요, 대체로 PDF — 확인필요 |

> **⚠ 설계의 구조적 결함**: "OWID 밀도 부정 → OECD·UNDP 자동 승격"이 S3 헤지인데, **둘 다 PDF-블록**이라 **헤지가 작동하지 않음**. S3 논증-파생의 실질 백업이 부재. HTML-native 논증 소스가 현재 없음 = 실재 갭. — 단정(실측 반증)

### C. NC 오염 — 읽기 전용 강등 (파생·문항 불가)
| 소스 | 판정 |
|---|---|
| LibreTexts | 대부분 CC BY-NC-SA(NC) → 읽기용만 |
| Saylor · Lumen | CC-BY/NC 혼재 → 항목 게이트, NC분 제외 |
| UNESCO | CC BY-SA-IGO(파생 OK지만 PDF 다수) |

### D. 재분류/현상유지
- **CIA Factbook** → **T-1 구현완료** (동결 풀에서 제거).
- **Wikibooks·Wikiversity·Wikisource** → LCP 카탈로그 기존재, 현상유지.

---

## 5. 트리거 상태 — **현재 풀 대상: 없음**

5개 register 가 전부 publishable 이므로 **동결 풀 어느 소스의 승격 트리거도 미충족**. 동결 풀 = 대기열
(§18 "소스 더 넣기 금지"). 다음 병목은 **깊이**(얇은 칸 드레인)이지 신설 소스 아님.

**"다음에 하나 푼다면" ROI 순**:
1. **Wikipedia 정규** — `_mediawiki` 재사용, 거의 무비용, S3 expository.
2. **eLife digest** — CC-BY·HTML·RSS 경량, S2 과학 설명.
3. **PLOS** — CC-BY·HTML 확인, S4 과학(C2 좁음).
- ✂️ IGO/리포트(OECD·WB·UNDP·CRS·CBO·GAO) = PDF-블록 → PDF 추출 계층(β) 없이는 불가.
- ✂️ LibreTexts·Saylor·Lumen = NC → 읽기 전용.

---

## 6. T-4 기각 (사유 고정 · 재검토 트리거 없음)

Aeon·Psyche(ND+유료) · WHO·IMF·FAO(NC/상업 차단) · OpenStax 인기 10종·Khan·MIT OCW·CK-12·
TED-Ed·De Gruyter(NC 계열) · CommonLit·ReadWorks·Newsela(독점) · Smithsonian·DPLA(산문 아님) · arXiv(기본 비자유·격리 유지).

---

*CSAT_SOURCE_MATRIX v1 — 2026-07-09. 소스 신설 시 §0 3축(포맷·라이선스·트리거) 전부 통과 필수.*
