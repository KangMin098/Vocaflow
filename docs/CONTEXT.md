# Vocaflow — CONTEXT (Project 첫 진입 1-page 요약)

> Claude Project 가 `chat` 첫 진입 시 가장 먼저 보는 페이지.
> 정적 상태 + 자동 갱신 영역으로 구성. 변동 적은 SSoT 만 사람이 갱신, 자동 갱신 블록은 GitHub Action 이 push 마다 regenerate.

---

## 1. 한 줄 요약

**Vocaflow** = 영어 스크립트 기반 9 모듈 종합 학습 플랫폼 (한국 고등학생~성인 대상). Web (Next.js 14) + iOS/Android (RN Expo Phase 2). Supabase Cloud (vocaflow-dev `jajenrevcbmrpaliomxv`).

---

## 2. 현재 활성 영역 (변동 시 사람이 갱신)

| 영역 | 상태 | 한 줄 |
|---|---|---|
| **ACP (article curation)** | 🔥 active | 6 소스 (VOA · NASA · NIH · Simple Wikipedia · Wikinews · The Conversation) 대량 GET + 7축 필터 + 단계별 상태 + 삭제. v06.69 arxiv 제거, v06.71~75 인터페이스 전체 재설계 |
| **LCP (book curation)** | 정상 | 도서 ingest → analyze → publish → 챕터 단어장 자동 생성. 9 소스 (Gutenberg / Standard Ebooks / Lit2Go / Wikibooks / Wikisource / LibriVox / StoryWeaver / Simple Wikipedia / OpenStax) |
| **VRL (4축 분류)** | 안정 | V-Level 12단계 + Track 6 + Domain 8 + Skill 5. shared_dictionary 38,598 row 100% 분류 완성 |
| **VCB (단어집 빌더)** | cast-2000 published | run_id=1 end-to-end 완료 + dict-fill Phase 1/2/3/4 완료 |
| **Workspace (`/text/[id]`)** | v06.74 TTS 재설계 | 브라우저 TTS best voice 자동 선택 + LibriVox / article audio_url 통합 |
| **EchoMatch (v06.33)** | done | 따라읽기 4-Phase + DTW 3축 점수 |

---

## 3. 진행 중 / 잔여 작업 (변동 시 사람이 갱신)

- [ ] StoryWeaver listFeed 회수율 개선 (현재 60%)
- [ ] Wikinews 대안 endpoint 조사 (영문 사이트 사실상 비활성)
- [x] `docs/AI_CONTEXT/` 자동 mirror 도입 — pre-commit hook 으로 완료
- [x] sync-check GH Action 활성화 — `.github/workflows/sync-check.yml` 추가, 첫 PR 에서 실측 검증 대기

---

## 4. 자동 갱신 블록 (`scripts/sync-export-memory.mjs` 가 push 마다 regenerate)

<!-- auto:branch -->
**활성 브랜치**: `feat/plan-ui`
**main 으로 PR 대상**: 별도 확인
<!-- /auto:branch -->

<!-- auto:recent-commits -->
**최근 5 commit**:
- `c9158d8` docs(session-log): VCB Phase 2-B(jargon) 반영
- `002ac3f` refactor(vcb): Phase 2-B 완결 — MethodA/SeedFlow/Source 폼 jargon 정리
- `6ab04f9` refactor(vcb): Phase 2-B — step 카드 설명 운영자 언어화 (jargon 제거)
- `c4937c6` fix(plan): 탭 전환 시 우측 컴포저 초기화 (v06.153)
- `5df3707` docs(db-schema): vcb_publish_commit 발행 RPC 반영 (P0-7)
<!-- /auto:recent-commits -->

<!-- auto:recent-migrations -->
**최근 5 migration**:
- `20260706130000_drain_review_tasks_level_vocab.sql`
- `20260706120000_unify_quiz_into_curation_jobs.sql`
- `20260706024846_p1_plan_multi_entry.sql`
- `20260706010000_vrl_admin_read_policies.sql`
- `20260706000000_admin_collect_quality_metrics.sql`
<!-- /auto:recent-migrations -->

---

## 5. 지금 작업하면 좋은 후보 (사람 갱신 OK)

| 우선도 | 작업 | 영역 |
|---|---|---|
| 중 | StoryWeaver 카테고리 더 추가 (현재 2 카테고리만) | LCP |
| 중 | `docs/AI_CONTEXT/` 자동화 (#5 from sync 권장사항) | Infra |
| 낮 | Wikinews UI 비활성 처리 (label 표시 OK, 노출 자체 한 단계 더 약하게) | ACP |
| 낮 | The Conversation CC-BY-ND `display_only` 경로 검증 | ACP |

---

## 6. 채팅 시작할 때 사람이 줄 수 있는 한 줄들 (예시)

- "지금 진행 중인 게 뭐야" → 이 페이지 §2 + §3 보면 즉시 답
- "최근 며칠 무슨 commit?" → §4 auto:recent-commits
- "오늘 DB 무슨 변경?" → §4 auto:recent-migrations
- "다음에 뭐 하지?" → §5

---

## 7. 어떻게 갱신 / 자동화

| 섹션 | 갱신 주체 | 빈도 |
|---|---|---|
| §1 한 줄 요약 | 사람 (영구) | 매우 드물게 |
| §2 활성 영역 | 사람 | 영역 추가/종료 시 |
| §3 잔여 작업 | 사람 | milestone 단위 |
| §4 자동 블록 | `.githooks/pre-commit` (every commit) | 매 commit 시 |
| §5 후보 | 사람 | 검토 시 |

자동 블록은 `<!-- auto:NAME -->` ~ `<!-- /auto:NAME -->` 사이만 갱신. 사람이 직접 편집하지 말 것.

## 8. Hook 설정 (clone 직후 1회)

`pnpm install` 의 `prepare` lifecycle 이 `node scripts/setup-git-hooks.mjs` 를 자동 실행 → `git config core.hooksPath = .githooks` 설정.

수동 실행 (예: install skip 한 경우):
```bash
node scripts/setup-git-hooks.mjs    # 1회
pnpm sync:memory                    # 즉시 갱신 (옵션)
```

검증:
```bash
git config --get core.hooksPath      # → .githooks
ls .githooks/                        # → pre-commit
```

Hook 이 비활성 환경 (CI/CD 등): 스크립트가 자동 감지 (memory dir 부재 시 silent skip) → 빌드 실패 안 함.
