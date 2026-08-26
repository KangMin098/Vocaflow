# 큐·드레인 자동화 검토 — 기능별

**작성** 2026-08-26 · **근거** DB 직접 질의 · `HELP_REGISTRY` 실덤프 · 스크립트 실계수
(문서의 수치를 근거로 쓰지 않았다 — `CLAUDE.md` §정기 진단 규칙)

---

## 0. 한 줄 결론

**자동화의 병목은 LLM 이 아니었다.** 가장 크게 밀린 큐(85,179건)는 **LLM 이 전혀 필요 없는데**
그걸 도는 유일한 방법이 브라우저 탭 하나였다. → **고쳤다**(§5 P1, 이 커밋).

⚠️ LLM 이 필요한 드레인에 대해 **API 키를 권고하지 않는다.** 이 저장소의 상시 지침은
`CLAUDE.md` §🤖 — *"ANTHROPIC_API_KEY 를 기다리며 막혔다고 보고하지 않는다.
 Claude Code(=나)가 그 LLM 이다."* 그래서 B군의 자동화는 "키를 사자" 가 아니라
**Claude Code 배치가 도는 3단 구조(export → 채움 → import)를 얼마나 손 덜 가게 만드느냐**다.

---

## 1. 실측 — 지금 큐에 무엇이 얼마나 있나

| 큐 | 대기 | 그 밖 | LLM 필요? |
|---|---:|---|---|
| `topic_corpus_queue` | **85,179** | done 1,377 · skipped 10,653 · claimed 3 | ❌ 없음 |
| `pending_words` | **8,962** | added 406 · rejected 1,702 · reviewing 11 | ✅ 판정 |
| `book_curation_jobs` | 1 | done 6 | ✅ 판정 |
| `vocab_enrichment_queue` | 0 | enriched 2,173 · flagged 39 | ✅ 생성 |
| `article_compose_jobs` | 0 | done 9 | ✅ 집필 |

⚠️ `book_quiz_jobs` 는 **DB 에 없다**(`to_regclass` = null). `CLAUDE.md` v06.114 항목이
`library_chapter_quiz`+`book_quiz_jobs` 를 만들었다고 적고 있으나 후자는 실재하지 않는다.
이 표를 믿고 자동화를 걸면 없는 테이블을 도는 워커가 된다.

## 2. 실측 — 이미 돌고 있는 자동화 (pg_cron 10종, 전부 active)

| 잡 | 주기 | 하는 일 |
|---|---|---|
| `library-pipeline-worker` | **30초** | `process_library_pipeline_batch(5)` — LCP 큐 |
| `vrl-auto-promote-daily` | 매일 18:00 | 학습자 V-Level 승급 |
| `quality-metrics-nightly` | 매일 18:10 | 품질 지표 수집 |
| `content-gate-nightly` | 매일 18:25 | 콘텐츠 게이트 |
| `classify-archaic-candidates-daily` | 매일 20:00 | 고어 후보 분류 |
| `gc-content-chunks` / `purge-cron-history-7d` / `archive-stale-drafts` / `refresh-hot-dictionary` / `recompute-kr-safe` | 각각 | 정리·갱신 |

**즉 서버측 스케줄러는 이미 있다.** 새 인프라를 만들 필요가 없고, 자동화는
"cron 잡을 하나 더 등록하는 일" 또는 "헤드리스 워커를 붙이는 일" 이다.

---

## 3. 기능별 검토 — 12 드레인

판정 기준 셋:
- **결정론적인가** — 같은 입력에 같은 출력인가
- **적재기가 나쁜 값을 막는가** — 빈 값·짧은 값을 넣으면 다음 export 가 "완료" 로 세어 구멍이 영영 남는다(`CLAUDE.md` §드레인)
- **되돌릴 수 있는가**

### A. 지금 당장 자동화 가능 — LLM 불필요

| # | 기능 | 왜 가능한가 | 하면 되는 일 |
|---|---|---|---|
| 1 | **주제 코퍼스 수확** (`/api/topic-corpus/drain`) | 순수 기계. `FOR UPDATE SKIP LOCKED` + `ingest_topic_corpus_doc` 중복 무시 → **몇 번을 눌러도 안전**. 지금은 관리자가 화면을 열어 둬야 돈다 | 서비스롤 헤드리스 루프 (아래 §4 경고 먼저) |
| 2 | **교재 기계 단계** | `store-new-types --commit` 은 유일키 `(kind, ref_id, type, paragraph_idx)` 라 **멱등** · `item-health-report`·`series-report`·`build-volume`·`write-drain-verify`·`render-volume` 은 **읽기 전용** | 야간 리포트 잡으로 묶기 |
| 3 | **LCP 파이프라인** | 이미 30초 cron. dev 에서만 `get_lcp_config()` 가 비어 못 돈다 | dev 설정 채우거나 그대로 둔다 |
| 4 | **각 드레인의 export/import 양끝** | 전부 재실행 안전으로 설계돼 있다(도움말에 명시) | 스케줄에 얹기만 하면 된다 |

### B. LLM 필요 — **Claude Code 배치로 이미 돈다** (자동 경로도 함께 있다)

| # | 기능 | 이미 있는 자동 경로 | 적재기의 방어 |
|---|---|---|---|
| 5 | **VCB 보강** | `scripts/vcb/05b-batch-submit.mjs` → `05b-batch-poll.mjs --watch` — **Anthropic Batch API** (50% 할인 + 프롬프트 캐시) | `05c-validate-output.mjs` |
| 6 | **만화 컷 생성** | `gen-verified.mjs --sdk` — S0 lint → preflight → 생성 → 컷 QC → 교차 일관성 → 조립, 실패 컷만 재생성(기본 3라운드). **키가 없으면 판단마다 종료코드 20 으로 멈춘다** | dry-run 스키마 검증 |
| 7 | **사전 예문 `example_en`** | `example-fill.mjs dump` → 채움 → `apply --commit` | **길이 6~240 · 한글 없음 · 어간 포함** 통과분만 UPDATE |
| 8 | **CSAT 해설 `explanation_ko`** | `explain-drain-export/import` | **20자 미만 거부** · `answer_key` **키 하나만 추가**(통째로 덮으면 정답 키가 날아간다) |
| 9 | **VCB 재보강 1건** | `/vcb-reenrich <queue_id>` | 05c 검증 |

→ 이 다섯은 **지금도 Claude Code 배치로 돈다**(export → 내가 채움 → import). 전부 적재기에
값 검증이 박혀 있어 쓰레기가 DB 에 들어가지 않으므로, **자동화 위험이 가장 낮은 묶음**이다.
괄호 안의 SDK·Batch 경로는 키가 있을 때의 대안일 뿐 **권고가 아니다**(§0).

손을 더 덜려면 키가 아니라 **오케스트레이션**이다 — 이미 `/vcb-batch-enrich` 는 chunk 당
서브에이전트를 띄우고, 교재 해설 드레인도 "청크 수만큼 동시에" 를 절차에 적어 뒀다.

**남은 팬아웃 대상을 실측으로 다시 골랐다** — 처음엔 `/vcb-reenrich` 와 사전 예문을
후보로 적었는데, 재 보니 둘 다 아니었다:

| 후보 | 실측 | 판정 |
|---|---:|---|
| `/vcb-reenrich` | 큐 항목 **1건**을 다시 만드는 절차 | 팬아웃할 대상이 없다 |
| 사전 예문 `example_en` | 결측 **232 / 47,890** | 분량이 안 된다 |
| **`pending_words`** | **14,534 대기 · 늘고 있다** | ← **여기다** (§6) |
| CSAT 해설 `explanation_ko` | 17,206 중 16,743 미작성이지만 드레인이 **권별로 범위를 좁힌다** | 평평한 백로그가 아니다 — 조판할 권이 정해질 때 |

### C. LLM 필요 — 자동화 가능하나 **게이트가 필요하다**

| # | 기능 | 왜 조심하는가 |
|---|---|---|
| 10 | **`pending_words` 판정** (검토 시작 8,962 → **14,534**, §6) | 적재기가 품사·CEFR·V-Level·레지스터·한글 뜻·예문 표제어 포함을 검증하지만, `add` 는 **사전에 새 표제어를 쓴다**. 4갈래(`add`/`proper_noun`/`noise`/`defer`) 중 오분류가 조용히 굳는다 |

→ 권고: 자동으로 돌리되 **`add` 만 사람 표본 검수**(예: 100건마다 10건), `noise`·`proper_noun`
은 표에 들어가 재출현만 막으므로 자동으로 둬도 손실이 작다.
→ **구현됨**: `/pending-words-drain`(오케스트레이터) + `pending-words-judge`(청크당 서브에이전트).
   `--pilot` 로 첫 청크만 돌려 품질을 보고, 적재는 DRY-RUN 을 먼저 읽게 절차에 박아 뒀다.

### D. 자동화하면 안 되는 것 — **판단이 산출물의 본질**

| # | 기능 | 도움말이 명시한 이유 |
|---|---|---|
| 11 | **ACP 지문 집필** (`compose › 작성`, 10단계) | 게이트 6종(I12~I17)이 있지만 **"의의 보존 · 같은 사실의 중복 진술 · 개념 재노출 · 사실 정확성 · 소재 적절성" 은 기계가 못 본다**고 도움말이 못 박는다. 구조 독립성은 ρ 의 절대값을 보므로 **역순으로 뒤집는 것도 막힌다** |
| 12 | **교재 지문 집필** (18단계 중 집필) | 밴드는 길이가 아니라 `compute_article_vrl` 75분위가 정한다 — 파일럿 10편 중 **8편이 목표 아래로 떨어졌다**. 서사문/장문 갈래 선택(19번·43~45번 성립 조건)은 설계 판단 |
| 13 | **LCP 큐레이션 런북** | 도움말 첫 줄: "네 task 모두 **LLM 판단이 필요해 버튼만으로는 끝나지 않는다**" |
| 14 | **PDCP 대사 정제·말풍선** | 저작 판단(정제 대사 + 오버레이 스펙) |
| 15 | **발행(publish) 전부** | 교재 지문도 `ready` 로만 넣고 **발행은 사람 판단**이라고 적재기가 정해 뒀다 |

---

## 4. 가장 큰 큐 — 낭비는 피할 수 없고, **무인으로 한 번만** 치르면 된다

`topic_corpus_queue` 85,179건을 그냥 자동으로 돌리면:

```
수확률 = done 1,377 / (done 1,377 + skipped 10,653) = 11.4%
skipped 사유 = 전부 "자막 없음 (번역만 있거나 비공개)"
85,179 × 11.4% ≈ 9,750편만 실제로 수확된다
```

한 호출 상한 10편 · 편당 **1.2초 예의 지연**(외부 사이트 차단 방지, 설계상 병렬 불가)
→ 8,518 호출 × 최소 12초 = **28시간 이상**, 실제 fetch 시간을 더하면 40시간대.

**처음엔 "적재 시점에 자막 유무를 걸러라" 고 적었다. 확인해 보니 틀렸다** —
자막 유무는 `/transcript` 페이지를 받아 `__NEXT_DATA__` 를 파싱해야 알 수 있고
(`ted-transcript.ts`), 발견 API 는 slug·URL·제목만 준다(`ted-discover.ts`).
**선필터의 비용이 수확의 비용과 같다.** 저렴한 선필터는 없다.

대신 이 낭비는 **한 번만** 치른다 — `skipped` 는 다시 claim 되지 않는다.
그러면 답은 하나다: **사람이 지켜보는 49시간을 무인 49시간으로 바꾼다.**

실측(2026-08-26 시험 가동 100편): 수확 4 · 건너뜀 96 · **28.9편/분** → 잔여 약 **49시간**.

---

## 5. 권고 — 순서와 근거

| 순위 | 무엇 | 상태 | 근거 |
|---|---|---|---|
| ~~P0~~ | ~~적재 시점 자막 선필터~~ | **철회** | 자막 유무는 `/transcript` 를 받아야 알고 발견 API 도 힌트를 안 준다 — 선필터 비용 = 수확 비용 (§4) |
| **P1** | **주제 코퍼스 무인 드레인** `pnpm tcp:drain` | **완료 (이 커밋)** | 순수 기계 · 재실행 안전 · 화면과 같은 함수 · 시험 가동 28.9편/분 |
| **P2** | 교재 기계 단계 묶음 `pnpm tbp:health` | **완료** | 재고 델타 · 문항 건강 · 시리즈 사다리를 한 명령으로. **쓰기 단계는 일부러 뺐다** (실측 4.7분 · 3/3 통과) |
| **P3+P4** | `pending_words` **팬아웃 판정** — `/pending-words-drain` + `pending-words-judge` | **완료** | 큐가 8,962 → **14,534** 로 **늘고 있었다**(§6). 청크는 서로 독립이라 동시에 판정된다 |
| ~~별도 P3~~ | ~~`/vcb-reenrich` 팬아웃~~ | **불필요** | 그 드레인은 **큐 항목 하나**를 다시 만드는 것이라 팬아웃할 대상이 없다 |
| ~~별도 P4~~ | ~~사전 예문 `example_en`~~ | **보류** | 결측 **232건**뿐이다(실측). 팬아웃을 붙일 만한 분량이 아니다 |
| — | **D군은 자동화 대상이 아니다** | — | 도움말이 각각의 이유를 이미 적어 뒀다 |

### P1·P2 가 실제로 한 일

**P2 — `pnpm tbp:health`**

- 교재 18단계 중 **판단이 필요 없는 셋**을 한 명령으로 묶었다:
  재고 델타(`store-new-types.mjs` 인자 없음) · 문항 건강 · 시리즈 사다리.
  사람이 순서를 기억해 하나씩 치고 있었다 — **기억이 자동화의 반대말이다**.
- **쓰기 단계는 일부러 넣지 않았다** — `--prune`(되돌릴 수 없다) · `--commit` ·
  `render-volume`(파일 덮어쓰기). 이 묶음의 계약은 "돌려도 아무것도 안 변한다" 이고,
  그래야 스케줄러에 올려도 안전하다. 하나라도 실패하면 종료 코드 1.
- 실측: 3/3 통과 · 4.7분 · 쓰기 0.

**P1 — `pnpm tcp:drain`**

- 드레인 본체를 `app/api/topic-corpus/drain/route.ts` 에서 `lib/topic-corpus/drain.ts` 로 옮겼다.
  **라우트와 CLI 가 같은 함수를 부른다** — 두 벌로 짜면 한쪽만 고쳐지고 그 차이는 아무도 안 본다.
- `scripts/topic-corpus/drain-loop.mts` (`pnpm tcp:drain`) — 큐가 마를 때까지 무인.
  10배치마다 편/분·잔여 시간을 찍고, Ctrl+C 는 **이번 배치를 끝내고** 멈춘다
  (배치 중간에 죽으면 claim 된 행이 `claimed` 로 남는다). claim 실패 3회 연속이면 중단한다.
- 화면 도움말(`help/topic-corpus.ts`)에 CLI 절차를 같은 커밋에서 추가했다
  (`CLAUDE.md` §3 화면도움말 동반 갱신).
- 시험 가동 실측: 100편 처리 → 수확 4 · 건너뜀 96 · 28.9편/분 · 대기 85,179 → 85,026.
- 자격 로딩을 **환경변수 우선**으로 바꿨다(`scripts/lib/supabase-env.mts`). 이 저장소 스크립트는
  관행적으로 `apps/web/.env.local` 을 강제하는데, 그 한 줄이 **스케줄러에서 못 쓰게 만든다** —
  CI(`.github/workflows/ci.yml`)는 시크릿을 환경변수로 준다. 사람 없이 도는 것이 목적인
  스크립트가 정작 **사람의 로컬 파일**을 요구하고 있었다.

## 6. ⚠️ 큐끼리 물려 있다 — 하나를 자동화하면 다른 하나가 찬다

2026-08-26 하루 동안 TCP 드레인을 무인으로 돌리면서 두 큐를 함께 쟀다:

| | 검토 시작 | 몇 시간 뒤 |
|---|---:|---:|
| `topic_corpus_queue` 대기 | 85,179 | **43,036** |
| `pending_words` 대기 | 8,962 | **14,534** |

**TCP 수확이 사전 갭을 `pending_words` 에 쌓는다.** 즉 자동화한 큐가 자동화 안 된 큐를
채우고 있었다. 이걸 모르고 TCP 만 계속 돌리면 "큐를 비웠다" 고 말하면서 실제로는
**병목을 다음 칸으로 옮기는 것**이 된다.

그래서 P3(팬아웃)과 P4(`pending_words`)를 하나로 합쳤다 — `/pending-words-drain` +
`pending-words-judge` 서브에이전트. 청크는 서로 독립이라 동시에 판정된다.

⚠️ `add` 판정은 **사전에 새 표제어를 쓴다**. 그래서 오케스트레이터가 `--pilot`(첫 청크만)을
갖고 있고, 적재 전 DRY-RUN 을 절차에 박아 뒀다. 자동으로 돌리되 **첫 판은 사람이 본다**.

---

## 7. 함께 고칠 것 (이번 검토에서 드러난 사실 오류)

- `CLAUDE.md` 가 `book_quiz_jobs` 테이블을 만들었다고 적고 있으나 **DB 에 없다**.
  이 표를 근거로 워커를 걸면 없는 테이블을 돈다.

## 8. 재현

```sql
-- 큐 깊이
select 'topic_corpus_queue' q, status::text, count(*) from topic_corpus_queue group by 2;
-- 수확 실패 사유
select left(last_error,60), count(*) from topic_corpus_queue where status='skipped' group by 1 order by 2 desc;
-- 돌고 있는 스케줄
select jobname, schedule, active from cron.job order by jobname;
```

```bash
# 선언된 드레인 12종 전수 덤프 (HELP_REGISTRY 에서 직접)
#   apps/web 에서 tsx 로 HELP_REGISTRY 를 재귀 순회해 drain.what / procedure[].title 출력
```
