# ADR 0007 — PDCP(Vintage Comics) 트랙 전체 제거

- **Status**: Accepted — 실행 대기 (2026-08-15, 사용자 결정)
- **결정**: PD 스캔 만화 트랙(`/comics/restored` · PDCP)을 **기능·화면·프로세스·게시물 전부 제거**한다.
- **유지**: 도서→만화 트랙(CCP · `/comics/adapted`)과 **RunPod**. RunPod 은 CCP 가 쓴다.

---

## 1. 결정 근거 (실측 2026-08-15)

사용자 판단: **"학습자에게 게시할 수준이 아님."** 데이터가 이를 뒷받침한다.

| 이슈 | 상태 | 말풍선 | needsReview | 버려진 단어 |
|---|---|--:|--:|--:|
| The Odyssey | published | 2,204 | **1,964 (89%)** | 4,487 |
| Macbeth | archived | 1,669 | **1,240 (74%)** | 4,566 |

`pd_comic_issues` **7건 전부 `modernize_env = NULL`** — 즉 이 트랙의 산출물은
**AI 리스타일을 한 번도 거치지 않은 스캔 + OCR 결과**다. 보존 트랙(preserve)만 돌았다.

부수 확인: **Kaggle 산출물은 0건.** `modernize/route.ts` 가 이미 근거를 갖고 있다 —
*"edit 워크플로가 RunPod 에만 프로비저닝돼 있다(Kaggle T4 = t2i-only, 실측)."*
따라서 "Kaggle 제거" 는 본 ADR 에 흡수된다(PDCP 를 지우면 Kaggle 경로도 함께 사라진다).

---

## 2. ⚠️ 반드시 지킬 경계 — PDCP ≠ CCP

두 만화 트랙이 이름과 디렉터리를 일부 공유한다. **CCP 를 같이 지우면 안 된다.**

| | **PDCP (제거)** | **CCP (유지)** |
|---|---|---|
| 뜻 | 퍼블릭도메인 스캔 만화 복원 | 도서를 만화로 각색 |
| 학습자 라우트 | `/comics/restored` | `/comics/adapted` |
| DB | `pd_comic_issues` · `pd_comic_panels` | `comic_books` · `comic_pages` · `comic_read_progress` · `comic_panel_events` |
| GPU | (제거) | **RunPod — 유지** |

`comic_gen_models` · `comic_gen_tests` · `comic_gen_runs` 는 **CCP 의 모델 레지스트리**다.
Kaggle 실행환경 항목(6종)만 `status='제외'` 로 내리고 **표는 남긴다** — 왜 Kaggle 을 안 쓰는지의
근거이며, 지우면 같은 검토를 다시 하게 된다(`noise_blacklist` 를 DELETE 대신 플래그로 둔 판단과 동일).

---

## 3. 제거 대상 (확인된 것)

### 3.1 학습자 화면
- `/comics/restored` 라우트 일체
- `components/comic/ComicsTabs.tsx` — 2탭 → **탭 자체 폐지**(남는 것이 하나면 탭이 아니다).
  `/comics` → `/comics/adapted` 리다이렉트.
- `components/layout/sidebar-config.ts` — `Vintage Comics` 항목 삭제.
  Comics 그룹에 항목이 하나만 남으므로 **그룹 해체**를 검토(ADR 0006 D1 의 사이드바 축소와 함께).

### 3.2 Admin
- `app/admin/pd-comics/` 전체 (`AdminPdComicsClient.tsx` 포함)
- `app/admin/comic/AdminComicClient.tsx` — **파일은 유지**(CCP 모델 레지스트리).
  Kaggle 실행환경 옵션만 제거: `kaggle-t4` 항목 · `ENV_LABEL['kaggle-t4']` · `<option value="kaggle-t4">`
- `lib/admin/help/pd-comics.ts` 삭제 · `lib/admin/help/index.ts` 레지스트리에서 키 제거
- `lib/admin/help/comic.ts` — Kaggle 문구 2곳 수정(삭제 아님)

### 3.3 API
- `app/api/pdcp/` 전체 (`modernize` · `connect-check` 등)

### 3.4 스크립트
- `scripts/comic/kaggle/` 삭제
- `scripts/comic/connect-check.mjs` — Kaggle 분기 제거 또는 삭제(RunPod/ComfyUI 점검만 남긴다면 유지)
- ⚠️ **`scripts/comic/` 의 `01-script.mjs`·`02-images.mjs`·`gen-*.mjs` 등은 CCP 파이프라인이다 — 건드리지 말 것.**
  PDCP 전용 스크립트가 어디에 있는지는 다음 세션에서 `pdcp`/`pd_comic` grep 으로 확정한다.

### 3.5 DB (되돌릴 수 없음 — 마이그레이션으로)
```sql
-- 순서 중요: 자식 먼저
DELETE FROM pd_comic_panels;   -- 274행
DELETE FROM pd_comic_issues;   -- 7행 (published 4 · modernized 1 · archived 1 · queued 1)
DROP TABLE IF EXISTS pd_comic_panels;
DROP TABLE IF EXISTS pd_comic_issues;
```
- Supabase Storage `comic/pd/**` 오브젝트 삭제 (cover_url 이 가리키는 경로)
- `pd_comic_*` 를 참조하는 RPC·view·트리거 확인 후 함께 정리
  (`20260719161409_drop_unused_empty_tables` 가 함수는 CASCADE 대상이 아니어서 남긴 전례가 있다 —
  **테이블만 지우고 함수를 남기면 같은 결함이 재발한다.**)

### 3.6 테스트
- `tests/e2e/13-pdcp-console.spec.ts` 삭제
- `tests/e2e/11-comic-discovery.spec.ts` · `13-comic-navigation.spec.ts` — **두 트랙을 함께 다룰 수 있다.**
  restored 관련 단언만 걷어내고 adapted 는 남긴다(파일 통째 삭제 금지).

### 3.7 문서
- `docs/CCP_LIBRARY_INTEGRATION.md` — PDCP 언급 정리
- `scripts/comic/docs/COMIC_PIPELINE_DESIGN.md` — PDCP 절 제거
- `CLAUDE.md` 문서 navigation 표의 만화 행 갱신
- `docs/CHANGELOG.md` — 제거 사유(OCR needsReview 89%)와 범위 기록
- 메모리 `project-pdcp-*` 4건(ocr-quality-finding · modernization-recipe · saddleback-not-pd ·
  feedback-pdcp-claude-code-based)은 **삭제 대상 아님** — "왜 접었는지" 의 근거다.
  다만 각 파일 머리에 "이 트랙은 ADR 0007 로 제거됨" 한 줄을 추가한다.

---

## 4. 실행 순서 (권장)

1. **게시 해제 먼저** — `UPDATE pd_comic_issues SET status='archived', published_at=NULL
   WHERE status IN ('published','modernized')`. 되돌릴 수 있고 학습자 노출이 즉시 끊긴다.
2. 학습자 화면 제거(3.1) → 타입체크 → `11-comic-discovery`·`13-comic-navigation` 회귀
3. Admin·API·스크립트 제거(3.2~3.4) → 타입체크
4. 테스트·문서 정리(3.6~3.7)
5. **마지막에 DB·Storage 삭제(3.5)** — 앞 단계가 전부 통과한 뒤에. 되돌릴 수 없다.

각 단계는 독립 커밋으로. 5번만 되돌릴 수 없다.

---

## 4.5 스크립트 목록 — 전체 grep 실측 (2026-08-15)

리포 전체 `kaggle` grep(31개 파일) + 디렉터리 구조로 확정.

**PDCP 전용 — 삭제**
```
scripts/comic/pd/compare-tracks.mjs
scripts/comic/pd/kaggle-restyle.mjs
scripts/comic/pd/pd-record.mjs
scripts/comic/pd/__tests__/compare-tracks.test.mjs
scripts/comic/kaggle/          (5 파일 — kaggle-auto-test · qwen-lightning-cell.py · setup-comfyui-comic.py · _gen-kernel.py · README)
scripts/comic/docs/PD_COMIC_PIPELINE.md
scripts/comic/docs/PD_MODERNIZE_MODEL.md
work/_kaggle-restyle/         (스크래치 산출물)
```

**CCP 공용 — 파일은 유지, Kaggle 분기만 제거**
```
scripts/comic/comfy-auth.mjs · connect-check.mjs · gen-comfy.mjs · model-runners.mjs
scripts/comic/docs/RUN_ENVIRONMENTS.md · PIPELINE_QC_DESIGN.md
scripts/lcp/test-comic-model.mjs
```

**마이그레이션** — `20260808220000_comic_gen_models_run_envs.sql` 이 실행환경 값에 `kaggle-t4` 를
포함한다. **되돌리지 말고**, 해당 모델 행을 `제외` 상태로 내리는 것으로 충분하다(§2 근거).

## 5. 미확정 (다음 세션에서 확정할 것)
- `pd_comic_*` 참조 RPC/view/트리거 존재 여부
- `11-comic-discovery`·`13-comic-navigation` 중 restored 의존 단언의 범위
- 사이드바 Comics 그룹을 해체할지, `Book Comics` 하나만 남길지 (ADR 0006 D1 과 함께 결정)
