# 원문 적격 화면 재설계 — 변경 전후 대조 (2026-09-16)

대상: `/admin/csat/sources` (교재 공장 › 재료 › 원문 적격)

---

## 1. 정보 누락 대조 — 요구는 「하나도 빠지지 않을 것」

눈으로 대조하면 반드시 놓친다. 재설계 **전에** 화면을 렌더해 목록을 파일로 찍어 두고
(`apps/web/src/app/admin/csat/__tests__/sources-inventory-baseline.json`), 지금 화면이 그것을
전부 들고 있는지 **검사가 확인한다**(`sources-inventory.test.tsx` 4검사).

| 항목 | 재설계 전 | 지금 | 판정 |
|---|---:|---:|---|
| 명령·식별자 (`<code>`) | 17 | **32** | 17/17 보존 + 15 추가 |
| 절 제목 (`<h2>`) | 11 | **12** | 11/11 보존 + 「소스별 원문」 추가 |
| 표 헤더 (`<th>`) | 35 | 35 이상 | 35/35 보존 |

**변이로 확인**: 명령 하나와 표 헤더 하나를 지우자 각각 이름을 대며 걸렸다.

⚠️ 숫자는 잠그지 않았다 — 스냅샷을 다시 재면 바뀌는 값이라 고정하면 거짓 실패가 된다.
대신 **명령어**(관리자가 복사해 돌리는 것)와 **표 헤더**(데이터 열)를 잠갔다. 그 둘이 남아
있으면 그 수치를 낼 자리도 남아 있다.

### 작업 중 검사가 잡은 것 셋 — 전부 진짜 결함이었다

1. **명령을 `title` 속성에만 뒀다.** 화면 텍스트에서 사라져 가드가 걸렸는데, 검사만의 문제가
   아니었다 — **무엇을 복사하는지 안 보이는 복사 버튼**은 눌러 보기 전에 알 수 없다.
2. **「게이트를 돌려도 안 풀린다」·「분석을 기다린다」를 내 말로 고쳐 적었다.** 기존 회귀가
   문자 그대로 잠근 문구였다. 그 문장이 없으면 관리자가 **돌지 않을 배치를 돌린다**.
3. **SSR 주석 마커.** `{min}–{max}어` 를 표현식 셋으로 쓰면 사이에 `<!-- -->` 가 들어가
   「120–178어」가 한 문자열로 안 남는다. 저장소가 이미 겪고 주석에 적어 둔 함정이다.

---

## 2. 절별 변경 — 무엇이 어떻게 바뀌었나

| # | 절 | 전 | 후 |
|---|---|---|---|
| 1 | 상태 헤더 + KPI | KPI 4타일이 **「다음 한 걸음」 아래**. 분모는 각주 글자에만 | KPI 를 **최상단**으로 + 각 카드에 전체 대비 **비율 바** |
| 2 | 다음 한 걸음 | 문단 4개가 같은 톤으로 나열 — 순서가 안 보임 | **5단계 도식** + 편수 배지 + 병목 강조 + 명령 복사 |
| 3 | 판정 기준 일곱 축 | 일곱 줄이 같은 톤 | 되돌리기 불가 축에 **왼쪽 띠 + 🔒**, 탈락 수 **가로 막대**, 자의 출처 **코드 칩**, 범례 |
| 4 | 소스별 관리 뷰 | **없음** | 신설 — 7열 + 행 펼침(다음 명령) + 원천→원문 목록 드릴다운 |
| 5 | 연령 × 유형 요건 | 학년 카드 7장 × 칩 수십 개 | **유형(행) × V1~V7(열) 매트릭스** + 범례 |

### 설계 판단 셋 (요청과 다르게 한 것)

- **「마지막 GET 시각」은 `created_at`** — `source_fetched_at` 열이 있지만 PLOS 45,096편이
  전부 `NULL` 이라 쓰면 화면이 「한 번도 GET 안 함」이라고 거짓말한다.
- **「적격 통과·탈락 편수」 → 「판정 받음」으로 좁혔다** — 통과/탈락의 정본은 적격 스냅샷이다.
  이 표가 다시 세면 같은 화면의 두 표가 다른 답을 하는 날이 온다.
- **소스 표는 일곱 축 뒤에 두고 요약 한 줄만 위로** — 「소스 현황도 접힌 위」라는 완료 조건과
  「소스 표는 4번」이라는 절 순서가 충돌한다. 판정 기준을 먼저 읽어야 표가 읽히므로 순서를
  지키고, 접힌 위에는 **원천 수 · 재고 · 판정 0인 원천**만 올렸다.

---

## 3. 접힌 위 실측 — 「스크롤 없이」를 좌표로

`apps/web/tests/e2e/44-csat-sources-fold.spec.ts` · 1440×900 · Chromium

| 요소 | 아래 끝 | 한계 |
|---|---:|---:|
| KPI 4카드 | **310px** | 900 |
| 소스 현황 한 줄 | **412px** | 900 |
| 병목 단계(파이프라인) | **827px** | 900 |

1280×900: 문서 가로 스크롤 **0px**. 표 자체의 `overflow-x` 는 허용한다 — 세로로 밀리는 것은
좁은 화면에서 당연하고, **문서 전체가 가로로 미는 것**만 결함이다.

스크린샷: `apps/web/playwright-report/csat-sources-1440.png` · `csat-sources-1280.png`

---

## 4. 밀집도 — 정직하게

| | 전 | 후 |
|---|---:|---:|
| 덩어리 | — | 1,563 |
| 글자 | 10,319 | **13,037** |
| 조작 | — | 87 |

**글자가 늘었다.** 소스별 재고 절(21원천 × 7열)을 새로 넣었기 때문이다. 「한눈에」는 총량이
아니라 **접힌 위**의 문제이고 그것은 §3 에서 좌표로 쟀다 — 총량을 개선으로 주장하지 않는다.

---

## 5. 데이터 경로 (작업 1 조사 결과)

**모든 소스별 GET 원문은 `library_articles` 한 표**에 있다(41열).

| 축 | 열 | 쓰는 곳 |
|---|---|---|
| 수집 | `source` `source_id` `source_url` `feed_id` `feed_label` `created_at` | 소스별 수집기 |
| 상태 | `status` `status_message` | `scripts/acp/process-queue.mjs` |
| 법적 | `license_class` `display_only` `copyright_safe_in_kr` | 수집 시 |
| 게이트 | `csat_fit.gate.{publishable,blockedBy,verdict,purpose}` | `scripts/csat/gate-import.mjs` |
| 학령 | `article_v_level` `cefr_level` `register` `syntax_score` | `scripts/acp/process-queue.mjs` |
| 규격 | `word_count` + `csat_dcp_items` 문항 보유 | `packages/library-pipeline/src/textbook/readability.ts` |

- 판정 정본: `packages/library-pipeline/src/textbook/source-eligibility.ts` (7축)
- 수집기: `scripts/acp/collect-daily.mjs` (14소스) · `scripts/csat/harvest-frontiers.mjs` ·
  `scripts/csat/harvest-nist.mjs` · `scripts/textbook/harvest-gutenberg-kid.mjs`
- 스캔: `scripts/textbook/source-eligibility-scan.mjs` (본문 읽음 · 76초) ·
  **`scripts/textbook/source-inventory-scan.mjs` (신규 · 본문 안 읽음 · 9초)**

⚠️ **화면은 실시간 집계를 못 한다** — 본문이 1.3GB 라 조건부 `count: exact` 가 8초 statement
timeout 에 걸리고 PostgREST 집계 함수도 꺼져 있다(PGRST123). 그래서 관리 뷰도 스냅샷을 읽는다.

---

## 6. 변경 파일

**신규**
- `scripts/textbook/source-inventory-scan.mjs`
- `apps/web/src/lib/textbook/source-inventory-view.ts`
- `apps/web/src/lib/textbook/source-inventory-snapshot.json`
- `apps/web/src/app/admin/csat/sources/SourceInventoryTable.tsx`
- `apps/web/src/app/admin/csat/sources/NextStepPipeline.tsx`
- `apps/web/src/app/admin/csat/__tests__/sources-inventory.test.tsx`
- `apps/web/src/app/admin/csat/__tests__/sources-inventory-baseline.json`
- `apps/web/tests/e2e/44-csat-sources-fold.spec.ts`

**수정**
- `apps/web/src/app/admin/csat/sources/SourceEligibilityClient.tsx`
- `apps/web/src/app/admin/csat/sources/page.tsx`
- `apps/web/src/lib/admin/help/textbook.ts` (화면도움말 동반 갱신 — CLAUDE.md §3️⃣)
- `apps/web/src/app/admin/csat/__tests__/sources-screen.test.tsx` (props)
- `docs/CHANGELOG.md`

---

## 7. 접근성 — 초과 개선 (2026-09-16)

| 검사 | 결과 |
|---|---|
| axe WCAG 2.1 A/AA (`main` 안) | **위반 0** |
| 44px 미만 터치 타깃 | **0** |
| 화면도움말 정합성 (help-links · help-diagram) | 40/40 통과 |

⚠️ axe 는 `main` 안만 본다 — 사이드바 같은 전역 크롬은 이 화면이 만든 것이 아니라,
섞으면 남의 위반이 이 화면의 빨간불로 남는다.

저장소 전체의 `on-p-contrast` 실패 1건은 이 화면과 무관하다 — 위반 목록이 전부
학습자·마케팅 화면이고 `csat/sources` 는 한 건도 없다.

---

## 8. 검증

- `tsc --noEmit` 통과 · `eslint` 0 errors
- 누락 가드 **4/4** · CSAT 회귀 **227/228** · e2e 접힌 위 **3/3**
- ⚠️ 남은 실패 1건 `계획이 재고보다 앞선 값으로 계산되지 않았다` — **다른 세션의 작업**이다.
  그쪽이 13:35 에 `type-inventory` 를 다시 쟀는데 `item-fill-plan` 은 13:05 값이라 어긋났다.
  내가 건드린 파일이 아니라 손대지 않았다.
