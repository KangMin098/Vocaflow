# ACP §19 — OpenStax CNXML 소스 통합 설계

> 상태: **설계 + 프로토타입 ingester 완료 · DB 통합은 라이선스 결정 게이트 대기** (2026-06-28)
> 모든 구조·라이선스·파싱 결과는 **실측 검증**(GitHub API + raw CNXML fetch + DB 분류 함수 호출).

ACP §18(v06.35) 재설계에서 OpenStax 는 "웹 SPA/PDF 라 URL-HTML 추출 불가 → CNXML dump 통합 필요(별도)"로 보류됐다. 본 문서가 그 별도 설계다.

---

## 1. 소스 구조 (실측 2026-06-28)

OpenStax 교재는 `github.com/openstax/osbooks-*` 공개 repo 로 CNXML 원문이 배포된다.

```
osbooks-<book>-bundle/            (default branch = main)
├── META-INF/books.xml            ← 수록 collection 목록
├── collections/
│   └── <book>.collection.xml     ← 책 TOC + <md:license url="..."> (라이선스 권위 출처)
├── modules/
│   └── m<id>/index.cnxml         ← 모듈(섹션) 본문 — CNXML XML
└── media/                        ← 그림 (어휘 파이프라인 무관)
```

- raw fetch: `https://raw.githubusercontent.com/openstax/<repo>/main/modules/m<id>/index.cnxml`
- collection 자동 탐색: `GET api.github.com/repos/openstax/<repo>/contents/collections`
- `<col:module document="m<id>"/>` 가 책 차례 — 모듈 폴더 id 와 일치(검증: biology-2e collection 은 m66425… 신판 id 참조, modules/ 는 m45417… 구판 id 도 병존 → **collection 의 document attr 가 정본**, 폴더 직접 나열은 구판 잔존 가능).

### CNXML 본문 골격 (실측 m45417)

```xml
<document xmlns="http://cnx.rice.edu/cnxml">
<title>The Building Blocks of Molecules</title>
<metadata><md:content-id>m45417</md:content-id><md:abstract>…학습목표…</md:abstract></metadata>
<content>
  <para id="…">At its most fundamental level, life is made up of matter. <term>Matter</term> …</para>
  <section id="…"><title>Atoms</title><para>…</para></section>
  <figure><media><image src="../../media/…jpg"/></media><caption>…</caption></figure>
  <note class="evolution"><title>Carbon Dating</title><para>…</para></note>
  <!-- 수식 과목: <m:math> MathML · <equation> · <exercise> -->
</content>
</document>
```

---

## 2. 🔴 라이선스 게이트 — 통합의 결정적 제약

OpenStax **현행 표준 라이선스 = CC-BY-NC-SA 4.0 (NonCommercial)**.

실측 확인 (10종 — 전부 `licenses/by-nc-sa/`):
`biology-2e · university-physics · astronomy-2e · psychology-2e · american-government-4e · microbiology · world-history · chemistry · business-ethics …`

§18 `acp_classify_license` 직접 호출 결과:

| 라이선스 | 분류 | display_only | copyright_safe | 발행 |
|---|---|---|---|---|
| `CC-BY-NC-SA-4.0` | **`restricted`** | false | **false** | **차단** |
| `CC-BY-4.0` | `cc_by` | false | true | 가능 |

→ **OpenStax 인기 교재(NC-SA)는 §18 게이트가 정확히 차단한다** (NC = 상업적 사용 불가 = 상업 의도 서비스엔 위험). ND(NoDerivatives)와 달리 NC 는 display_only 우회도 부적절(상업 서비스 내 노출 자체가 상업적 사용 논란).

### 결정 게이트 (통합 진입 조건 — 셋 중 하나)

1. **CC-BY OpenStax 타이틀 한정** — 비-NC 책만 ingest (현재 인기 10종엔 없음, 전수 스캔 필요).
2. **비상업적 사용 commitment** — Vocaflow 가 NC 콘텐츠를 비상업 용도로만 쓴다는 비즈니스/법적 결정. 이 경우 NC 전용 `display_only` 티어(워크스페이스 읽기 + 클릭 툴팁, 파생 단어세트 발행 X)를 §18 에 추가.
3. **보류** — 현 게이트 유지, OpenStax 미통합 (현 상태).

본 설계는 1·2 결정 시 즉시 가동 가능하도록 **ingester 를 라이선스-중립으로 완성**(아래)했고, DB 소스 등록은 결정 전까지 보류한다.

---

## 3. 프로토타입 ingester (완료 · 검증)

`packages/library-pipeline/src/ingest-article/openstax.ts`

- `resolveCollectionFile(repo)` — collection.xml 자동 탐색
- `licenseFromCollection(xml)` — `<md:license url>` → CC 코드 정규화(가정 없음, 메타 권위)
- `cnxmlToPlainText(cnxml)` — `<content>` 격리 후 **MathML / figure·media·image / exercise·solution·equation·code / link** 제거 → `<para>/<section><title>/<list><item>/<term>/<emphasis>` 산문만
- `ingestOpenStaxModule({repo, moduleId, collectionFile?, branch?})` → `RawArticle` (source=`openstax`, estimated_cefr=`C1`)

### 검증 결과 (실 fetch — biology m45417)

```
title       : Biology 2e — The Building Blocks of Molecules
license     : CC-BY-NC-SA-4.0   (메타에서 읽음 → 게이트 restricted)
content len : 18,544 chars (클린 산문)
lexical_noise: 0.000  (임계 0.08 — MathML 제거로 노이즈 0; 수식 과목도 제거 후 낮음)
잔존 검사    : <math> false · <figure> false · src= false
```

---

## 4. 잔여 통합 작업 (결정 후 · 단계별)

| 단계 | 작업 | 비고 |
|---|---|---|
| O1 | `library_articles_source_check` 에 `'openstax'` 추가 (마이그레이션) | 결정 1·2 후. **NC 책은 INSERT 시 게이트가 restricted 차단 — 정상** |
| O2 | enqueue route `HOST_TO_SOURCE` (`github.com/openstax` → `openstax`) + dispatch 분기 | URL → repo/moduleId 파싱 |
| O3 | `_curation-spec.ts` openstax 스펙 (register=`academic`, estimated CEFR by 과목) | list 단계 score 가드 |
| O4 | admin AcpClient 탭 (📚 OpenStax — repo+module 입력 또는 collection 순회) | URL-only |
| O5 | (결정 2 채택 시) §18 에 NC `display_only` 티어 추가 | 단어세트 발행 차단 + 워크스페이스 허용 |

O1 마이그레이션 SQL (결정 후 적용):

```sql
ALTER TABLE public.library_articles DROP CONSTRAINT library_articles_source_check;
ALTER TABLE public.library_articles ADD CONSTRAINT library_articles_source_check
  CHECK (source = ANY (ARRAY['voa','nasa','nih','manual','cdc','medlineplus',
                             'wikinews','the_conversation','simple_wikipedia','openstax']));
```

---

## 5. 결론

- **기술 통합은 해결됨** — CNXML 파싱·라이선스 권위 읽기·게이트 연동 ingester 완성·실측 검증.
- **차단 요인은 라이선스 1건** — OpenStax 인기 교재 전부 CC-BY-NC-SA = §18 게이트가 (상업 안전 정책상 정확히) 차단.
- **다음 행동은 코드가 아니라 결정** — §2 의 1·2·3 중 택일. 결정 전까지 DB 소스 등록(O1~)은 보류, ingester 만 대기 상태로 머지.

관련: `docs/ACP_SOURCE_REDESIGN.md` · 메모리 [[project-acp-source-redesign]] · [[project-copyright-gate-us-license]]
