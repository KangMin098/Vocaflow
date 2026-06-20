# ACP §18 — 소스 재설계 실행 스펙 (v06.35)

> ACP(Article Curation Pipeline) 소스 구성·파이프라인 재설계 청사진.
> 작성: 2026-06-08 · 상태: **스펙(미구현)** — 구현 전 청사진. DB 변경은 승인 후 적용([[feedback_supabase_migrations]]).
> 근거: 전부 실측(현 schema·데이터 direct query). 본 문서는 docs/LIBRARY_PIPELINE.md §ACP 의 실행 상세.

---

## 0. 현황 (실측 2026-06-08)

### 인프라 (이미 존재 — 재사용)
- 테이블: `library_articles` · `library_article_vocabularies` · `library_article_seed_catalog`.
- `library_articles` 컬럼: id, source, source_id, source_url, source_fetched_at, title, author, language,
  published_at, **license**, **copyright_safe_in_kr**, content, content_hash, **cefr_level**, cefr_confidence,
  word_count, reading_minutes, **category_tags**(text[]), status, status_message, llm_cost_usd,
  created_at, updated_at, audio_url, **article_v_level**(smallint), **vrl_components**(jsonb), vrl_calculated_at.
- status 파이프라인: `queued→ingesting→normalizing→analyzing→curating→ready→published→archived/failed`
  (도서와 동일 · 정식 게시 = status='published' + published_at).
- ingest: `packages/library-pipeline/src/ingest-article/{voa,nasa,nih,arxiv}.ts` + `_helpers.ts`
  (의존성 0 — 정규식 RSS/Atom 파싱 + `htmlToPlainText` + `fetchWithTimeout`).
- V-Level: 도서와 동일 엔진(`article_v_level` + `vrl_components`) 재사용 가능.

### 누락 (본 스펙이 추가)
- `register` — 글 유형(설명/논증/내러티브/시사). **CSAT 지문 유형 균형의 핵심 축.**
- `lexical_noise` — 수식·인용·LaTeX 오염 비율(어휘 파이프라인 청결 게이트).
- `license_class` — 자유 재배포 등급(자유 텍스트 `license` 의 정규화 enum).

### 현재 데이터 (PoC — 5건)
| source | n | published | license | CEFR | 비고 |
|---|---|---|---|---|---|
| arxiv | 2 | 0 | CC-BY-4.0 | (미산정) | 우연히 CC-BY 2건. 기본값은 비자유 |
| nasa | 2 | 0 | PD-Government | (미산정) | |
| voa | 1 | 1 | PD-Government | B1 (V4) | 유일 게시 |

→ 재설계는 **전방 설계**(소스 추가 시점부터 적용). 기존 5건 재처리 부담 없음.

---

## 1. 진단

### 1-A. arXiv — ACP 부적합 (제거/격리 1순위)
1. **라이선스** — arXiv 기본값은 "arXiv 영구·비독점 배포 라이선스"(저자 저작권 보유, 상업 재배포 불가). CC 논문은 일부뿐. 소스 단위 "PD 가정" 불가 → **항목 단위 검증 필수.**
2. **난이도·레지스터** — C2+ 전문 논문. EFL·CSAT 학습 가치 희박.
3. **텍스트 오염** — LaTeX·수식·인용이 토큰화를 오염(어휘 노이즈).

### 1-B. 구성 결함 3가지 (VOA·NASA·NIH·arXiv 합산)
1. **CEFR 쏠림** — A1~A2 공백, B1~C2+ 집중. 학습자 갭(A1~B2)을 못 메움.
2. **레지스터 단일** — 전부 설명·과학. **논증문(CSAT 최난이도 유형)·인문/사회·내러티브 부재.**
3. **주제 STEM 편중** — 심리·경제·철학·환경·문화 결여.

---

## 2. 목표 매트릭스 (CEFR × register)

현재 공백(✗)을 채우는 소스 배치:

| | A1–A2 | B1–B2 | B2–C1 |
|---|---|---|---|
| **설명(expository)** | Simple English Wikipedia | VOA · NASA(edu) · MedlinePlus | NASA · Smithsonian OA |
| **논증(argumentative)** | — | The Conversation | The Conversation · OpenStax |
| **시사(news)** | VOA | Wikinews · CIA Factbook | OpenStax(사회·경제) |
| **내러티브(narrative)** | StoryWeaver · Gutenberg | Standard Ebooks | — |

> 큐레이션 원칙: **"소스 더 넣기"가 아니라 "매트릭스 빈 칸 채우기"** — register×cefr 균형으로 관리.

---

## 3. 소스별 실행 스펙

`license_class` 등급: `public_domain` | `cc0` | `cc_by` | `cc_by_sa` | `cc_by_nd` | `restricted`.

| 소스 | 접근 | license_class | register | CEFR | 주제 | 조치 |
|---|---|---|---|---|---|---|
| **arXiv** | (제거) | restricted(기본) | — | C2+ | STEM | **DROP** — 별도 격리 큐만(CC-BY/CC0 필터 + C2 한정) |
| **VOA Learning English** | RSS | public_domain | news/expository | A2–B1 | 시사 | **KEEP** |
| **NASA** | RSS/API | public_domain | expository | B1–C1 | 우주·지구 | **KEEP** + 교육자료/기술문서 문서별 CEFR 분리 |
| **NIH** | RSS | public_domain | expository | B1–C2 | 의학 | **분해** → MedlinePlus(B1 평이) 위주, 연구급(C2)은 격리 |
| **Simple English Wikipedia** | REST API/덤프 | cc_by_sa | expository/reference | A2–B1 | 전 주제 | **ADD #1** |
| **The Conversation** | RSS/API | **cc_by_nd** | **argumentative** | B2–C1 | 사회·시사 | **ADD #2** — ND ⇒ 본문 불변(§7) |
| **OpenStax** | 덤프(CNXML/PDF) | cc_by | expository/argumentative | B2–C1 | 학술(사회·경제·심리) | **ADD #3** |
| **Smithsonian Open Access** | API | cc0 | expository | B1–C1 | 인문·예술·과학 | ADD |
| **CIA World Factbook** | 덤프(JSON) | public_domain | reference/expository | B1–B2 | 국가·지리 | ADD |
| **Wikinews** | RSS/덤프 | cc_by | news | A2–B2 | 시사 | ADD |
| **StoryWeaver** | API/덤프 | cc_by | narrative | A1–B1 | 동화 | ADD(내러티브 보강 · LCP 와 공유) |

**republish 규약**: cc_by/cc_by_sa 는 **출처·라이선스·변경 표기** 필수(article 상세에 source_url + license + "변경 있음" 고지). cc_by_sa 는 파생물 동일 라이선스 — 학습 가공물은 내부 사용이라 무방, 외부 재배포 시 SA 승계.

---

## 4. 파이프라인 재설계 (backbone — arXiv 가 드러낸 구조적 결함)

### 4-A. 항목 단위 라이선스 게이트
"소스=자유 가정" 폐기. **문서 단위 license_class** 로 게이트.

- 통과(학습 파이프라인 — 추출·하이라이트·가공): `public_domain · cc0 · cc_by · cc_by_sa`.
- **표시 전용**(본문 불변, 별도 플래그): `cc_by_nd` → §7.
- 차단(ingest 자체 거부): `restricted` · 모든 `*_nc`(비상업) · arXiv-default.

### 4-B. register + CEFR 태깅
- `register` enum: `expository | argumentative | narrative | news | reference`.
- 큐레이션 대시보드를 **매트릭스(register × cefr) 균형**으로 운영 — 빈 칸 우선 채움.

### 4-C. 텍스트 청결 게이트
- `lexical_noise` = (수식기호 + LaTeX 토큰 + 인용마커 `[\d+]` + URL 토큰) / 전체 토큰.
- 임계값 **0.08 초과 → 어휘 파이프라인 자동 탈락**(읽기용으로만, vocab 추출 제외) + status_message 기록.

### 4-D. 소스 ≠ 난이도 가정 폐기
- NIH·NASA 처럼 내부 편차 큰 소스는 **문서별 `article_v_level` 실측**으로만 레벨 확정(소스 일괄 CEFR 금지).

---

## 5. 스키마 변경 (SQL — 승인 후 적용)

```sql
-- ACP §18 — register / lexical_noise / license_class 추가 + 라이선스 게이트
BEGIN;

-- 1) 컬럼 추가
ALTER TABLE library_articles
  ADD COLUMN IF NOT EXISTS register text,
  ADD COLUMN IF NOT EXISTS lexical_noise numeric(4,3),
  ADD COLUMN IF NOT EXISTS license_class text,
  ADD COLUMN IF NOT EXISTS display_only boolean NOT NULL DEFAULT false;  -- ND 본문 불변 플래그

ALTER TABLE library_articles
  ADD CONSTRAINT chk_article_register CHECK (
    register IS NULL OR register IN
      ('expository','argumentative','narrative','news','reference')
  ),
  ADD CONSTRAINT chk_article_license_class CHECK (
    license_class IS NULL OR license_class IN
      ('public_domain','cc0','cc_by','cc_by_sa','cc_by_nd','restricted')
  );

-- 2) license(자유텍스트) → license_class 정규화 함수
CREATE OR REPLACE FUNCTION acp_classify_license(p_license text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_license IS NULL THEN 'restricted'
    WHEN p_license ILIKE '%public domain%' OR p_license ILIKE 'PD%' THEN 'public_domain'
    WHEN p_license ILIKE 'CC0%' OR p_license ILIKE '%CC-0%' THEN 'cc0'
    WHEN p_license ILIKE '%CC-BY-SA%' OR p_license ILIKE '%CC BY-SA%' THEN 'cc_by_sa'
    WHEN p_license ILIKE '%CC-BY-ND%' OR p_license ILIKE '%CC BY-ND%' THEN 'cc_by_nd'
    WHEN p_license ILIKE '%-NC%' OR p_license ILIKE '%noncommercial%' THEN 'restricted'  -- NC 차단
    WHEN p_license ILIKE '%CC-BY%' OR p_license ILIKE '%CC BY%' THEN 'cc_by'
    ELSE 'restricted'  -- arXiv-default 포함 보수적 기본
  END
$$;

-- 3) BEFORE INSERT/UPDATE 트리거 — license_class·display_only·copyright_safe_in_kr 자동 도출
CREATE OR REPLACE FUNCTION acp_apply_license_gate() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  NEW.license_class := acp_classify_license(NEW.license);
  NEW.display_only  := (NEW.license_class = 'cc_by_nd');
  -- copyright_safe = 학습 파이프라인 진입 가능(표시전용 ND 도 게시 가능하므로 포함)
  NEW.copyright_safe_in_kr := NEW.license_class IN
    ('public_domain','cc0','cc_by','cc_by_sa','cc_by_nd');
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_acp_license_gate ON library_articles;
CREATE TRIGGER trg_acp_license_gate
  BEFORE INSERT OR UPDATE OF license ON library_articles
  FOR EACH ROW EXECUTE FUNCTION acp_apply_license_gate();

-- 4) 기존 행 backfill
UPDATE library_articles
SET license_class = acp_classify_license(license),
    display_only  = (acp_classify_license(license) = 'cc_by_nd');

COMMIT;
```

**가공 게이트(추출·하이라이트)** 는 `license_class IN (public_domain,cc0,cc_by,cc_by_sa) AND lexical_noise <= 0.08` 인 article 만 — `library_article_vocabularies` 생성 RPC 진입 조건에 추가.

---

## 6. 인제스트 패키지 변경

`packages/library-pipeline/src/ingest-article/`:
- **arxiv.ts** — 학습 ingest 경로에서 제외. (보관: CC-BY/CC0 필터 + C2 격리 큐 전용으로만 호출.)
- **신규**: `simple-wikipedia.ts`(REST `action=query`/덤프), `the-conversation.ts`(RSS, license=CC-BY-ND 명시), `openstax.ts`(CNXML 덤프), `smithsonian.ts`(OA API), `cia-factbook.ts`(JSON 덤프), `wikinews.ts`(RSS).
- 공통: `_helpers.ts` 재사용. 각 ingester 는 반환 객체에 `license`(정확 문자열) + `register`(소스 기본값) + 본문 → `computeLexicalNoise(content)` 채움.
- `computeLexicalNoise(text)` 신규 헬퍼(_helpers.ts) — §4-C 공식.

---

## 7. The Conversation (CC-BY-ND) 분리 설계

ND = **No Derivatives** → 본문 텍스트 **변형 금지**(어휘 하이라이트·blank·재편집은 파생물).

- `display_only = true` article 은:
  - 본문 **원문 그대로** 렌더(워크스페이스 인라인 단어 주석 오버레이 **off**).
  - 단어 학습은 **별도 레이어**(클릭 시 `lookup_word_meaning` 툴팁 — 원문 불변, 파생물 아님) 로만 제공.
  - `library_article_vocabularies` 추출은 **읽기 보조 메타**로만(세트 발행 X) 또는 생략.
  - 상세에 출처·저자·라이선스·"원문 링크" 고지 필수(CC-BY-ND attribution).
- 워크스페이스 분기: `display_only` → ReadingUniverse 의 word-annotation 비활성 + WordLookupPopover(원문 위 오버레이 아님, 클릭 조회)만.

---

## 8. 우선순위 / 롤아웃

1. **arXiv 학습경로 제거 + 라이선스 게이트(§5)** — 리스크 제거. 즉시.
2. **Simple English Wikipedia 추가** — A1~B2 갭, 노력 대비 임팩트 최고.
3. **The Conversation 추가** — CSAT 논증 정합(§7 ND 분리 설계 동반).
4. **NIH→MedlinePlus 분리 + OpenStax/Smithsonian/Wikinews** — 주제·레지스터 확장.
5. **텍스트 청결 게이트(§4-C) + register/cefr 매트릭스 대시보드** — 운영 backbone.

---

## 구현 현황 (2026-06-08)

| Step | 상태 | 비고 |
|---|---|---|
| 1. arXiv 제거 + 라이선스 게이트 | ✅ 적용 | migration `20260608120000` · admin UI arXiv 제거 |
| 2. Simple English Wikipedia | ✅ 구현 | MediaWiki extract(`_mediawiki` 공용) · 📘 탭 · 라이브 검증 대기 |
| 3. The Conversation (+ND) | ✅ 구현 | `the-conversation.ts` · ND 게이트 migration `20260608123000` · 📣 탭 |
| 4. Wikinews | ✅ 구현 | MediaWiki extract · 🗞 탭 |
| 4. NIH→MedlinePlus 분리 | ◐ 부분 | 문서별 `article_v_level` 실측이 난이도 분리 담당(§4-D) · MedlinePlus 가 NIH 탭 우선 feed. 별도 source 분리 보류 |
| 4. OpenStax | ⚠️ 재판정 | 웹=SPA/PDF → URL-HTML 추출 불가. **CNXML/archive API dump 통합 필요**(별도 작업) |
| 4. Smithsonian OA | ❌ 제외 | CC0 OA = 소장품 메타데이터(api.si.edu)이지 산문 아님 · Magazine 기사는 무료 아님 → 부적합. 학술 산문은 OpenStax(dump)로 |
| 5. 청결 게이트 + register/cefr 매트릭스 | ✅ 구현 | `computeLexicalNoise`(dev-process 산출) + 발행 트리거 noise≤0.08 게이트(migration `20260608126000`) + register 소스 시드 + admin register×cefr 매트릭스 |

구현 ingester 4종(Wikipedia·Conversation·Wikinews + 기존 VOA/NASA/NIH)은 항목단위 라이선스 게이트와 자동 연동.

### Step 5 게이트 요약
- `lexical_noise`(numeric 4,3) = dev-process 가 정규화 본문에서 산출 후 저장.
- `register` = 소스별 기본값(REGISTER_BY_SOURCE) dev-process 시드 — 문서별 재분류 가능.
- 발행 트리거 `trg_publish_article_word_set`: `status→published AND NOT display_only AND lexical_noise≤0.08` 일 때만 단어세트 발행. 노이즈/ND 글은 본문 읽기만(파생 어휘 미배포).
- admin `/admin/articles` 상단에 register×cefr 매트릭스(빈 칸 = 큐레이션 우선).

## 부록 A — register 소스 기본값
expository: NASA·NIH·Simple Wikipedia / argumentative: The Conversation·OpenStax(dump 후) /
news: VOA·Wikinews / reference: CIA Factbook·Simple Wikipedia(정의문) / narrative: StoryWeaver.
(문서별 재분류 가능 — 기본값은 ingest 시 시드.)

## 부록 B — 차단 규칙 요약
`restricted`·`*_nc`·arXiv-default → ingest 거부. `cc_by_nd` → 게시 가능하나 `display_only`(본문 불변).
나머지(PD·CC0·CC-BY·CC-BY-SA) → 학습 가공 허용(단 lexical_noise ≤ 0.08).
