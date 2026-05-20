# baseline-pre-phase2.json — 측정 메타데이터

> Lexicon Unification 회귀 비교용 e2e 베이스라인
> 측정: 2026-05-21 00:19 (KST)
> 동결 결정: **5 passed / 2 failed / 0 skipped — frozen baseline**

## 측정 시점 환경

| 항목 | 값 |
|---|---|
| 날짜·시각 | 2026-05-21 00:19 KST (15:19 UTC) |
| 브랜치 | `db-통합` |
| 최신 commit | (이 commit 직전 — Phase 1 SQL + Playwright + seed 작업 모두 적용 후) |
| Phase 1 SQL 적용 | ✅ 완료 (`20260520_120000_lexicon_phase1_expand.sql`) |
| Phase 1 검증 NOTICE | 1~6 모두 통과 |
| DB 상태 | shared_dictionary=38,476 / word_lexicon=5,421 (FROZEN) / vocabularies=1,259 (test 계정 +8 포함) |
| Playwright | 1.60.0 / chromium-headless-shell 148.0.7778.96 |
| Node 환경 | local dev — `pnpm dev` Next.js 14.2.35 (cold start 포함 1.1~1.2m) |
| OS | Windows 10 (10.0.19045) |
| 테스트 계정 | `lexicon-test@vocaflow.local` / user_id `b07abaf9-2789-4d4e-9551-c0e770f2ac17` |
| seed | vocabularies 8 / texts 1 / subscription 1 (`필수2000`) — `scripts/lexicon/seed-test-account.mjs` 적용 |

## 결과 패턴 (frozen)

| # | spec.test | 결과 | 소요 |
|---|---|---|---|
| 1 | 01 · Browse seed 8개 이상 단어 리스트 | ❌ FAIL | 20.6s |
| 2 | 01 · CEFR B2 필터 ≥ 2개 | ✅ PASS (soft-skip) | 2.7s |
| 3 | 01 · 단어 검색 "abandon" | ✅ PASS | 3.3s |
| 4 | 02 · Flashcard Hub 시작 가능 | ✅ PASS | 3.2s |
| 5 | 02 · Flashcard 세션 카드 표시 | ❌ FAIL | 15.7s |
| 6 | 03 · Admin 단어장 마스터 접근 | ✅ PASS | 3.3s |
| 7 | 03 · Admin 대시보드 접근 | ✅ PASS | 3.3s |

soft-skip 1건: test #2 (CEFR B2 button not found → else 분기 PASS).

## 회귀 비교 규칙

향후 Phase 2/3/4/7 적용 직후 동일 e2e 재실행 시:

| 비교 결과 | 판정 | 대응 |
|---|---|---|
| **동일 패턴 (5/2/0, 동일 spec PASS/FAIL)** | ✅ 회귀 없음 | 다음 Phase 진행 가능 |
| 신규 FAIL 발생 (현재 PASS → 다음 FAIL) | ⚠ **회귀 의심** | 즉시 변경 사항 분석 + 롤백 검토 |
| 기존 FAIL 이 PASS 로 전환 | ✅ 부수 개선 | 향후 baseline 갱신 (현재 시점 미갱신) |
| soft-skip 패턴 변화 | ⚠ UI 컴포넌트 변경 시그널 | spec selector 재검토 필요 여부 판단 |

**중요**: "회귀 비교의 본질은 변화 없음 검증이지 100% PASS 아님". 현재 2건 FAIL 도 동결 baseline 이며, 다음 Phase 후 동일 2건이 FAIL 이면 회귀 0.

## 현재 FAIL 2건 원인 가설

### Test #1 — Browse 페이지 단어 row 미발견
- selector: `[data-testid="word-row"], [class*="WordRow"], [class*="word-row"]`
- timeout 10s, element not found
- **가설**:
  1. Browse 페이지가 vocabularies 가 아닌 다른 데이터 출처 (shared_word_sets / library_book_vocabularies 등) 표시
  2. 컴포넌트 마크업이 위 셀렉터 패턴 모두 미일치 (예: 클래스명이 `_word-row__abc123` 같은 CSS module 형식)
  3. 구독한 `필수2000` 세트의 `word_count=0` — Browse 가 세트 단어 표시 시 빈 상태
- **Phase 4 (코드 마이그) 시점 자연 해결 예상** — WordVault 도메인 코드를 lemma 기반으로 재배선하면서 컴포넌트 selector 정렬 + `data-testid` 일관 부여 가능

### Test #5 — Flashcard 세션 카드 미발견
- selector: `[data-testid="flashcard-word"], [class*="flashcard"]`
- Start 버튼 클릭 후 카드 컴포넌트 미발견
- **가설**:
  1. Start 버튼 클릭 시 라우팅이 `/flashcard/play` 가 아닌 modal/inline 카드 컴포넌트로 전환
  2. seed 8개 단어가 SRS 큐에 진입하기 위한 조건 (next_review_at NULL 또는 과거 등) 부재 — Hub 시작이 빈 큐 페이지로
  3. Flashcard 컴포넌트가 mock 상태 (Phase 1.5 dev 단계)
- **Phase 4 시점 자연 해결 예상** — vocabularies 의 lemma 기반 큐 로직 정립 + Flashcard 컴포넌트 `data-testid="flashcard-word"` 부여

## 향후 측정 시점 명명 규칙

```
docs/proposals/lexicon-unification/
  ├── baseline-pre-phase2.json         ← 본 측정 (Phase 1 적용 후, Phase 2 적용 전)
  ├── baseline-pre-phase2-meta.md      ← 본 파일
  ├── baseline-pre-phase3.json         ← Phase 2 적용 후 측정
  ├── baseline-pre-phase3-meta.md
  ├── baseline-pre-phase4.json         ← Phase 3 적용 후 측정
  ├── baseline-pre-phase4-meta.md
  ├── baseline-pre-phase7.json         ← Phase 6 안정화 후 측정 (최종)
  └── baseline-pre-phase7-meta.md
```

각 측정 시점마다 `*-meta.md` 에 측정 환경 + 결과 패턴 + 회귀 판정 결과 기록.

## 첨부

- 실패 스크린샷·video·trace: `apps/web/test-results/` (gitignore 권장)
- HTML report: `apps/web/playwright-report/index.html`
- JSON report: `apps/web/playwright-report/results.json` → 본 폴더 `baseline-pre-phase2.json` 복사본

## e2e 강화 보류 결정

현재 spec selector 가 컴포넌트 mock 상태에 의존적. Phase 4 (코드 마이그) 시점에 `data-testid` 일관 부여 + selector 정확화 작업 진행 예정. **지금은 e2e 강화 X — 회귀 baseline 동결이 우선**.
