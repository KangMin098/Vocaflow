# VCB §19 admin UI coverage — patch proposal (PR #1~#10 정리)

> 본 파일은 CLAUDE.md §19 (VCB) 에 통합할 admin UI 완성도 갱신 패치 초안입니다.
> CLAUDE.md 의 X-2 보류 상태를 존중하기 위해 별도 파일로 두며,
> 세준님이 v06.32 통합 작업 시 §19 에 머지하는 게 권장 흐름입니다.
>
> **적용 시점 추천**: PR #1~#10 머지 후 v06.32 commit 으로 §19 admin UI 갱신 + 미정 항목 표 갱신을 함께 진행.

---

## §19 추가 / 갱신 대상

### 1. §19.1 8 단계 표 갱신 — admin UI 컬럼 추가

**현재 표 (CLAUDE.md §19.1):**

```
| 단계 | 책임 |
|---|---|
| [1] Source Registration | 리소스 업로드 또는 AI 시드 생성 |
| [2] Ingest & Normalize | 원문 보존 + NFC 정규화 |
| [3] Extraction | WLP lemma + POS |
| [4] Dictionary Lookup | 내부 사전 매칭 |
...
```

**제안 갱신:**

| 단계 | 책임 | CLI | Admin UI (Method A) | Admin UI (Method B) |
|---|---|:---:|:---:|:---:|
| 1 Source Registration | 파일 / AI 시드 등록 | ✅ | ✅ `/admin/vocab/sources/new` (P5c.4) | ✅ runs/[id]/seed (P5c.3) |
| **2/3 Ingest + Extract** | Storage → WLP → seed_candidates | ✅ | ✅ **`VcbMethodACard` (P5c.11)** | (생략 — AI 시드 직접 적재) |
| 2.5 Seed Preview | AI 시드 결과 검증 | (n/a) | (n/a) | ✅ `/runs/[id]/seed/preview` (P5c.6) |
| 4 Dictionary Lookup | shared_dictionary 매칭 | ✅ | ✅ **`VcbStep4LookupCard` (P5c.7)** | ✅ 동일 |
| 5 Enrichment | Claude `/vcb-enrich` 실행 + import | ✅ | ✅ **`VcbStep5EnrichCard` (P5c.8)** | ✅ 동일 |
| 6 QA Gate | R1~R8 룰 적용 | ✅ | ✅ **`VcbStep6QaCard` (P5c.9)** | ✅ 동일 |
| 7 Curation | 큐레이션 검토 | (n/a) | ✅ `/admin/vocab/curate/[run_id]` | ✅ 동일 |
| 8 Publish | shared_word_sets 발행 | ✅ | ✅ **`VcbStep8PublishCard` (P5c.10)** | ✅ 동일 |

→ **VCB 파이프라인 admin UI 100% 커버 달성** (PR #1~#10 머지 시점).

---

### 2. §19.5 (Step 5 Enrichment) 의 슬래시 명령 워크플로 갱신

**현재 (CLAUDE.md §19.5):**

```
[5b] VS Code Claude Code 세션
       /vcb-enrich exports/vcb-jobs/<file>-pending.jsonl
       → 같은 디렉토리에 <file>-enriched.jsonl 생성
       → 05c-validate-output.mjs 자동 실행
```

**제안 갱신 — 어드민 UI 자동 실행 경로 추가:**

```
[5b-1] 어드민 UI (P5c.8 — 권장 경로)
       /admin/vocab/runs/[id] → Step 5 카드 → [AI 실행] 클릭
       → 서버: spawn 'node scripts/vcb/run-enrich.mjs ...' detached
       → claude -p 가 슬래시 명령 본문 inline 으로 처리 (.md frontmatter 파싱)
       → stdin = pending JSONL 내용 (파일 redirect)
       → 5초마다 status auto-poll → 완료 시 [DB import] 활성화

[5b-2] VS Code Claude Code 세션 (수동 대체 경로)
       /vcb-enrich exports/vcb-jobs/<file>-pending.jsonl
       → 같은 디렉토리에 <file>-enriched.jsonl 생성
       → 05c-validate-output.mjs 자동 실행
```

**핵심 차이점:**
- `claude -p` 는 슬래시 명령을 **literal text 로 인식** — 본문 inline 필수
- Node detached runner (`scripts/vcb/run-enrich.mjs`) 가 stdio 정확히 캡처
- Windows `detached + stdio:'ignore' + shell redirect` 조합 불안정 → Node 위임으로 회피

---

### 3. §19.4b Method B 슬래시 명령 워크플로 갱신

**현재 (CLAUDE.md §19.4b):**

```
2. 개발자: VS Code Claude Code 세션
   /vcb-seed-list exports/vcb-jobs/<file>-seed-spec.json
   → 같은 디렉토리에 <file>-seed-list.jsonl 생성
```

**제안 갱신:**

```
2-A. 어드민 UI (P5c.4 — 권장 경로)
     /admin/vocab/runs/[id]/seed → Step 2 [AI 실행] 클릭
     → 서버: spawn 'node scripts/vcb/run-seed-list.mjs ...' detached
     → claude -p 가 vcb-seed-list.md 본문 inline 처리 ($ARGUMENTS = spec 경로)
     → 5초마다 auto-poll, 완료 시 preview 페이지로 자동 navigate (1.2s 지연)

2-B. VS Code Claude Code 세션 (수동 대체 경로)
     /vcb-seed-list exports/vcb-jobs/<file>-seed-spec.json
     → (동일 결과)
```

---

### 4. §19.6 Step 6 QA Gate — admin UI 트리거 추가

**현재 (CLAUDE.md §19.6):**

```
**결과 적재:**
- vocab_enrichment_queue.qa_flags TEXT[] 에 룰 코드 배열로 저장
- severity='reject' 1건이라도 → status='failed'
- severity='flag'만 있으면 → status='enriched_flagged'
```

**제안 추가:**

```
**트리거:**
- CLI: pnpm vcb:qa --run-id N [--requeue-flagged]
- Admin UI: /admin/vocab/runs/N → Step 6 [QA 실행] 버튼 (P5c.9)
  - DB-only, ~8ms/item (200 items → ~2s, 2000 items → ~15s)
  - "flagged 항목 다시 enrichment 대기열로" 토글로 requeueFlagged 옵션 노출
  - 결과: 8-stat 카드 (passed/flagged/failed/autofixed/payload_missing/
    requeued/NGSL 로드/denylist 카운트)
```

---

### 5. §19.7 Curation 의 진입 동선 추가

**현재 (CLAUDE.md §19.7):**

```
경로: /admin/vocab/curate/[run_id]
```

**제안 추가:**

```
경로: /admin/vocab/curate/[run_id]
진입 동선:
- /admin/vocab/runs/[id] → "Curation (Step 7)" 카드 → "큐레이션 시작" 링크
- Step 6 QA 결과 카드의 "큐레이션 화면 →" 인라인 링크 (flagged > 0 시)
```

---

### 6. §19.8 Step 8 Publish 의 어드민 트리거 추가

**현재 (CLAUDE.md §19.8):**

```
발행 = vocab_collections 생성 + shared_word_sets 연계.
```

**제안 추가:**

```
**트리거:**
- CLI: pnpm vcb:publish --run-id N
- Admin UI: /admin/vocab/runs/N → Step 8 카드 (P5c.10)
  - 4-stat precheck 요약 (publishable / enriched / flagged / rejected)
  - blockers 패널 (precheck 실패 시 빨강) + warnings 패널 (주의)
  - "발행은 immutable" 명시 + 확인 체크박스 + window.confirm 게이트
  - 발행 후 success: version / collection_id / shared_word_set_id 표시
```

---

### 7. §19.10 미정 항목 표 갱신

**현재 (CLAUDE.md §19.10):**

```
| # | 항목 | 결정 시점 | 비고 |
|---|---|---|---|
| 1 | ~~vcb_dictionary_cache 신설~~ | ✅ 해소 (v06.30) | shared_words 확장으로 자연 해소 |
| 2 | _BRAND_DENYLIST 외부 JSON 분리 | P3 06-qa.ts 작성 시 | 해소 |
| 3 | _PROFANITY_DENYLIST 외부 JSON 분리 | P3 06-qa.ts 작성 시 | 해소 |
| 4 | word_lexicon lookup 활성화 | lexicon-v2.1 DDL 적용 후 | WORD_LEXICON_ENABLED |
| 5 | vocab_qa_rules lookup 테이블 | 룰 추가 빈도 ↑ 시 | 현 코드 상수 |
| 6 | 03-extract.ts Storage 재다운로드 | P3 어드민 UI | 어드민 UI 에서 처리 |
| 7 | shared_dictionary.pos outlier 흡수 | 운영 데이터 누적 후 | idiom/phrasal/abbrev |
```

**제안 갱신:**

```
| # | 항목 | 결정 시점 | 비고 |
|---|---|---|---|
| 1 | vcb_dictionary_cache 신설 | ✅ 해소 (v06.30) | shared_words 확장 |
| 2 | _BRAND_DENYLIST 외부 JSON 분리 | ✅ 해소 | scripts/vcb/data/brand-denylist.json |
| 3 | _PROFANITY_DENYLIST 외부 JSON 분리 | ✅ 해소 | scripts/vcb/data/profanity-denylist.json |
| 4 | word_lexicon lookup 활성화 | lexicon-v2.1 DDL 적용 후 | WORD_LEXICON_ENABLED=true 변경 |
| 5 | vocab_qa_rules lookup 테이블 | 룰 추가 빈도 ↑ 시 | 현 코드 상수 |
| **6** | **03-extract.ts Storage 재다운로드** | **✅ 해소 (P5c.11)** | **`runMethodAExtract` 가 Storage 다운로드 통합** |
| 7 | shared_dictionary.pos outlier 흡수 | 운영 데이터 누적 후 | idiom/phrasal/abbrev |
| **8** | **claude -p 슬래시 명령 해석 미지원** | **✅ 해소 (P5c.5)** | **`.claude/commands/*.md` 본문 inline 패턴** |
| **9** | **Windows detached spawn + shell redirect 불안정** | **✅ 해소 (P5c.5)** | **`scripts/vcb/run-*.mjs` Node 위임 패턴** |
| **10** | **Step 5 multi-chunk import 자동화** | **현재 admin UI per-chunk 수동** | **P5c.12 후속 — chunked 자동 import (안전성 vs 편의성 trade-off)** |
| **11** | **detached runner cancellation** | **현재 admin UI 에서 취소 불가** | **`.running.json` marker 직접 삭제로 비공식 가능. 명시적 cancel UI 후속** |
```

---

### 8. §19.9 어드민 라우트 트리 갱신

**현재 (CLAUDE.md §19.9):**

```
/admin
  /vocab
    /sources
    /sources/new
    /sources/[id]              # 상세 + Ingest 트리거 (Step 2)
    /runs
    /runs/new
    /runs/[id]                 # 단일 run 상세 (Step 3~6)
    /runs/[id]/seed            # Method B seed 생성/import
    /runs/[id]/enrichment      # Step 5 export/import
    /curate/[run_id]
    /collections
    /collections/[id]/versions
    /dictionaries
```

**제안 갱신 (실제 구현 정합):**

```
/admin
  /vocab                        # → redirect /admin/vocab/runs
    /sources
    /sources/new                # P5c.4 — 파일 업로드 + Method B 분기
    /runs
    /runs/new                   # collection 메타 입력
    /runs/[id]                  # 단일 run 상세 — 모든 Step 카드 동적 표시
                                #   - Method A: VcbMethodACard (Step 2+3) P5c.11
                                #   - Method B: 시드 등록 진입 카드 P5c.3
                                #   - Step 4 VcbStep4LookupCard P5c.7
                                #   - Step 5 VcbStep5EnrichCard P5c.8
                                #   - Step 6 VcbStep6QaCard P5c.9
                                #   - Step 7 VcbStepTriggerCard → /curate
                                #   - Step 8 VcbStep8PublishCard P5c.10
    /runs/[id]/seed             # Method B Step 2 seed 생성 P5c.3 (5c.5 runner 통합)
    /runs/[id]/seed/preview     # P5c.6 미리보기 워크스페이스
    /curate/[run_id]            # P5c.1 — Curation 화면 (기존)
    /collections (예정)
    /collections/[id]/versions (예정)
    /dictionaries (예정)
```

**제거:**
- `/sources/[id]` — 현재 구현 X (필요 시 P5c.13 후속)
- `/runs/[id]/enrichment` — Step 5 카드가 Run 상세 안으로 흡수됨

---

### 9. 신규 §19.12 admin UI 컴포넌트 인벤토리

**제안 신규 섹션:**

```markdown
### §19.12 admin UI 컴포넌트 인벤토리

**Server actions** (`apps/web/src/lib/vcb/server/`):
| 파일 | 함수 | PR |
|---|---|---|
| run-create.ts | createRun | #1 |
| sources.ts | fetchSources, createSource, createSourceWithFile | #1, #3 |
| runs.ts | fetchRunDetail, fetchRuns | #1 |
| curation.ts | approve/reject/edit/reenrich + bulk | #1 |
| precheck.ts | precheckRun | #1 |
| seed.ts | generateSeedSpec, runSeedListCommand, checkSeedJobStatus, importSeedList, loadSeedPreview, deleteSeedListArtifacts | #2, #4, #5 |
| dict-lookup.ts | runDictionaryLookup | #6 |
| enrich.ts | exportEnrichmentPending, runEnrichmentCommand, checkEnrichmentStatus, importEnrichmentFile | #7 |
| qa.ts | runQaGate | #8 |
| publish.ts | runPublish | #9 |
| method-a.ts | listMethodASources, runMethodAExtract | #10 |

**Client components** (`apps/web/src/components/admin/vcb/`):
| 파일 | 역할 | PR |
|---|---|---|
| VcbRunStatusBadge / VcbRunCard / VcbStepTriggerCard | 공통 | #1 |
| VcbRunCreateForm / VcbSourceCard / VcbSourceCreateForm | 등록 폼 | #1, #3 |
| VcbCurationView + List/DetailPanel/FilterBar | Curation (#1) | #1 |
| VcbSeedFlow | Method B seed 등록 (#2, #4) | #2 |
| preview/VcbSeedPreviewClient + Hero/Filters/List/Detail/ActionBar/CefrDistributionBar | Step 2.5 미리보기 | #5 |
| VcbStep4LookupCard | Step 4 | #6 |
| VcbStep5EnrichCard | Step 5 | #7 |
| VcbStep6QaCard | Step 6 | #8 |
| VcbStep8PublishCard | Step 8 | #9 |
| VcbMethodACard | Method A Step 2+3 | #10 |

**vcb-curate-core 모듈** (SSoT — CLI + Server Action 공유):
| 파일 | 책임 |
|---|---|
| types.ts, queries.ts | 공통 타입 + 쿼리 |
| run-create.ts, sources.ts | Run / Source 생성 |
| curation.ts | Curation 비즈니스 로직 |
| precheck.ts, publish.ts | Publish 사전 검증 + 실행 |
| seed.ts | Method B seed flow (parse + import + runner 조율) |
| dict-lookup.ts | Step 4 lookup (P5c.7) |
| enrich-export.ts, enrich-import.ts | Step 5 export + import (P5c.8) |
| qa.ts | Step 6 QA (P5c.9) |
| method-a.ts | Method A 2+3 통합 (P5c.11) |

**Node 러너 스크립트** (detached 실행):
| 파일 | 슬래시 명령 inline | PR |
|---|---|---|
| scripts/vcb/run-seed-list.mjs | .claude/commands/vcb-seed-list.md | #4 |
| scripts/vcb/run-enrich.mjs | .claude/commands/vcb-enrich.md | #7 |
```

---

### 10. 버전 라인 추가 (CLAUDE.md 최상단 → CLAUDE.md 통합 시점에 추가)

```
> 문서 버전: v06.32 (VCB admin UI 100% — PR #6~#10 합본 / Step 4 lookup (P5c.7) +
> Step 5 enrichment runner (P5c.8) + Step 6 QA (P5c.9) + Step 8 publish (P5c.10) +
> Method A 2+3 통합 (P5c.11) admin UI / 추가 P5c 보강 (P5c.3 seed UI + P5c.4 file
> upload + P5c.5 runner fix + P5c.6 preview workspace + 재생성 + auto-poll +
> auto-navigate) / vcb-curate-core 9 모듈 + 2 Node 러너 + 11 컴포넌트 / claude -p
> 슬래시 명령 inline 패턴 정립 (literal text 처리 미지원 해소) / Windows detached
> + shell redirect 불안정 → Node runner 위임 패턴 / 미정 항목 #6/#8/#9 해소,
> #10/#11 신규) · v06.31 (...
```

---

## 적용 권장 순서

1. PR #1~#10 review + merge
2. v06.32 commit (CLAUDE.md 통합):
   - 본 patch 의 §19.1, §19.4b, §19.5, §19.6, §19.7, §19.8, §19.9, §19.10, §19.12 갱신
   - 버전 라인 추가
3. 본 patch 파일 (`docs/proposals/vcb-admin-ui-coverage-patch.md`) 제거 (역할 완료)

## 미정 (P5c.12+)

- **다중 chunk 자동 import** — 현재 admin UI 에서 enrichment chunk per-chunk 수동 import. 안전성 우선이라 수동 유지 권장.
- **detached runner 취소 UI** — 현재 `.running.json` marker 수동 삭제 외 cancel 경로 없음.
- **Run/new 페이지 Method 선택 + sources multi-pick** — 현재 Run 생성 시 source 미연결, Run 상세 카드에서 자유 선택. 사용자 멘탈 모델 정합성은 후속 검토.
