# CCP — Comic Curation Pipeline (제품 통합 설계, 검토 반영 확정본)

> book→comic 자기발전 파이프라인의 Vocaflow Admin + Hub 정식 통합. 설계 → 이중 검토(교육학·아키텍처) → 분석 → 구현.

## 1. 요지
- **Admin**: `/admin/comic` — 만화화 대상 도서를 큐 적재 → 생성(드레인) → **QC 게이트** → 발행.
- **Hub/학습자**: `/text/[id]/comic` — TextViewer **input 모드 "만화"**. 읽기 전 **동기부여 프리뷰**(Dual Coding) + effortful 모듈 유입.

## 2. 저장 (library_chapter_quiz 미러 + 발행 게이트 헤더)
- `comic_books` (헤더) — `library_book_id` PK/FK, `status(draft/published/archived)`, `qc_verdict jsonb`, `panels_pass`, `panels_total`, `style/backend`, `published_at`. **quiz엔 없던 독립 발행 게이트 + 지속 QC 판정**.
- `comic_pages` — `(library_book_id, chapter_idx, page_order)` 자연키, `image_url`(외부/서명 URL), `bubbles jsonb`, `target_vocab text[]`(정본 정합만).
- RLS: 둘 다 `FOR ALL USING(is_admin_or_curator())`. 학습자는 **발행 게이트된 DEFINER RPC**로만: `select_book_comic` / `list_book_comic_catalog` / `book_comic_available` (전부 `comic_books.status='published' AND library_books.status='published'`).
- 이미지: **공개 버킷 신설 안 함**(드래프트 유출·egress 회피) — `illustrations` 외부 URL 관례.

## 3. 큐/드레인 (기존 재사용)
- `book_curation_jobs` + `task_type='comic_gen'` + 실 컬럼 `panels_total/panels_done`.
- `enqueue_comic_jobs(uuid[])` — eligibility `status IN('ready','published')`, 헤더 draft 보장, 멱등 upsert.
- 드레인 `scripts/lcp/generate-comic.mjs` (plan/content/insert) + `drain.mjs` 등록(🎞). insert=검증→comic_pages 교체→헤더 QC 고정→job write-back.
- 발행 `admin_set_comic_published` — **panels_pass=true 강제**(QC 미통과 발행 차단).

## 4. 학습자 리더 (Calm UI · 검토 반영)
- 앱 토큰 재스킨(아티팩트 3D 쇼케이스와 분리) · **Calm 2D 전환 + prefers-reduced-motion**.
- 대사 **non-cover 대사존**(아트 온전).
- **Desirable Difficulty**: verbatim(정본) 버블 **blur→tap-reveal 기본**(회상 유도).
- **정본 정합 vocab**: `target_vocab`은 verbatim=true 버블에서만 → 원문/ScriptQuiz/Dictation과 단어 일치, orphan 방지.
- **Journey**: 마지막 = effortful 유입 CTA(본문/퀴즈). 폭죽/트로피 없음.

## 5. 자기발전 → 제품 매핑
| 자산 | 제품 |
|---|---|
| gen-verified 폐루프(S0..S4) | generate-comic.mjs insert 검증 |
| R1–R30 래칫 · verbatim-audit | qc_verdict(rule_violations/verbatim_mismatch) + panels_pass 게이트 |
| 백엔드 판정(GPT>FLUX) | comic_books.backend 기본 gpt-image-2 |
| 3D flipbook | ComicReader(앱 재스킨, 차분화) |
| target_vocab 표면화 | 리더 정본 vocab 칩 |

## 6. 검토 반영 요약 (이중 리뷰)
- **아키텍처**: 헤더 테이블 추가(발행 게이트/QC 지속) · 공개 버킷 폐기(외부 URL) · 학습자 RPC 전부 published 게이트(유출 차단) · panels_* 실 컬럼 · RPC 미적용 시 리더 EmptyState degrade.
- **교육학**: 회상 기본화(blur→reveal) · vocab는 정본만 · 프리뷰로 정직 재정의(정독 심화 아님) · 여정 방향(유입 CTA) · Calm 2D+reduced-motion(3D 남용 회피).

## 7. Phase
- **P1(구현됨)**: 마이그레이션(승인 대기) · 드레인 · 리더 모듈(EmptyState degrade) · ModePills · Admin 콘솔(Catalog/Published) · 문서.
- **P2**: blur→reveal 자가판정 → `learning_records`(FSRS) 영속 · 장면당 이해 micro-check · Studio 각색 에디터 · Carol 시드(패널 업로드).
- **P3**: 진도(module_history 'comic') · FloatingSparkle 유입 배선 · 다도서 드레인 · 모바일.
