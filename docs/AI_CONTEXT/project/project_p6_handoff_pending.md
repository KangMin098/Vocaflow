> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/project_p6_handoff_pending.md
> category: project

---

# P6 handoff — 전체 종결 + F3 전면 소급 (2026-07-04)

**2026-07-04 추가**: 사용자 신규 결정으로 6/28 F 결정의 "V0 미진단 제외" 조항 해제 → **F3 전면 소급 실행**. book-origin 4,862행 DELETE(review_count=0 가드, 보호 0) → 5권 재-enroll → 4권×50행·i+1 위반 0·Ammachi 0행(밴드 밖 정상). vocabularies 6,477→1,815. P6.4/6.5 재검증 = 6/28 결론 일치. ⚠️ 교훈: MEMORY.md 인덱스 한줄("잔여 P6.4/5/6")이 본문(전체 종결)과 어긋나 있었음 — 인덱스보다 본문이 SSoT.

# (이전 기록) P6.1~P6.3 적용 완료 (2026-06-28)

**상태**: ✅ **P6.1+P6.2+P6.3 한 마이그레이션으로 적용·머지** (PR #46 `65b0980`, migration `20260628120000_p6_enroll_subscribe_i_plus_one`). P6.0 진단 + 결정표 E1~E8+F 사용자 확정(권장 default + F0) 후 구현. read-only 스모크 검증(v_n=5→cap 50·band 정합 / V0 dedup). 적용 중 `user_profiles.id`→`user_id` 컬럼 정정.
- 적용 내용: `_enroll_book_subscribe_word_sets` 에 i+1 필터(E1, N=current_v_level→book_v_level→5) + 미보유 dedup(E7 UNIQUE 존재 + ON CONFLICT, P6.2 stable dedup 포괄) + 세션 cap 50(E4, DISTINCT ON + 근접·고빈도 ORDER). 구독 set-level 불변, vocabularies import 만 필터(E8 완전분리). F0 = 소급 보류.
- **P6.4 ✅ 점검 완료 (read-only, 2026-06-28, 변경 불요)**: extract_vocabulary_for_user(_v2)=soft Gaussian v_proximity composite(글 추출 맥락), _enroll=hard band [N-1,N+1](책 구독 일괄 import Cognitive Load 게이트). 둘 다 current_v_level 중심 — 의도 일치, 맥락별 메커니즘 차이일 뿐 **모순/drift 없음** → 마이그레이션 불요.
- **P6.6 ✅ 적용 완료 (2026-06-28, PR #47, migration `20260628130000_p6_6_enroll_v0_undiagnosed_guard`)**: 핵심 발견 — P6.1 의 effective V-level COALESCE 가 `current_v_level=0`(미진단 기본값)을 유효 앵커로 써서 i+1 밴드가 `[1,1]` 로 붕괴(책 구독 시 V1 단어만 import). 수정 = `COALESCE(NULLIF(current_v_level,0), book_v_level, 5)`. V0 사용자 effective=5→band[4,6] 검증. **F 소급 = F3 채택했으나 V0/NULL 미진단 사용자 제외(사용자 결정)** → 측정 결과 유일 후보(4,862 row not-started)가 V0 사용자라 **삭제 0 건**(진도·데이터 무손실). 즉 가드는 향후 enroll 정합만 확보.
- **P6.5 ✅ 완료 (2026-06-28, PR #50, doc only)**: read-only 진단 결론 — Cold/Warm/Hot 세 계층이 P6.1~P6.4 + SRS 영속화(A1/A2) + 자동 승급(Phase 2E/G) 누적으로 **이미 기능적 통합·일관**, 별도 재설계 불요. `docs/VOCAB_LAYERS.md` 로 명문화. 검증 불변식 3: (1)전이 전부 `vocabularies.word=shared_dictionary.word` 키(auto_promote word-keyed) (2)V-level 게이트 current_v_level 중심 (3)상태분류 getMemoryState() SSoT. 보류: G1 vocab.lemma 백필=vestigial skip(핵심경로 word-keyed, Cold lemma 와 별개) · G3 통합 view=DX deferred · G4 origin taxonomy=cosmetic.
- **P6 전체 종결** (P6.1~P6.6 + P6.5). 롤백 `docs/AI_CONTEXT/rollback/P6_enroll_subscribe_원본.sql` + `P6_6_enroll_v0_guard_원본.sql`.

(이하 원래 handoff 본문 — 진단/결정 절차 기록 보존)

**원 상태**: 본문 작성 완료 (PR #25 merged, 2026-06-20), Project 측 검토 대기.

## 위치
- `docs/AI_CONTEXT/handoffs/p6_subscribe_user_filter.md` (+270 line)
- Tier 2 항상 묶음 (manifest §1) — 추출/큐레이션 채팅에 자동 attach

## C6 결함 (선행 PR #24 P0 진단에서 발견)

`_enroll_book_subscribe_word_sets(uuid, uuid)` 본문 — published set 전체 구독, **user V-level 필터 0**.

```sql
INSERT vocabularies (...)
SELECT ... FROM shared_words sw JOIN shared_word_sets sws ON ...
WHERE sws.category='library_book' AND book_id=p_book_id;
-- 책 enroll 시 V6~V11 모든 단어 일괄 import
```

**효과**: V5 사용자가 V9 책 enroll → 1,500+ 단어 import → Cognitive Load 폭발.

## P6 단계 (handoff 본문 참조 · PR #25 + 사용자 정정 갱신)

| 단계 | 내용 |
|---|---|
| **P6.0** | **진단 (read-only) + B1·B2 binary** — Project 보고 → 사용자 결정 → 그제야 P6.1 착수 |
| P6.1 | i+1 필터 (Krashen) — `v_level BETWEEN N-1 AND N+1` |
| P6.2 | stable dedup — `stability >= 21` 단어 SKIP (학습 보존) |
| P6.3 | 세션 cap — 책당 50 단어 (P3 챕터 cap 40 과 다른 layer) |
| P6.4 | `extract_vocabulary_for_user` 정합 (이미 i+1 적용된 path 와 drift 차단) |
| P6.5 | Layer 통합 — Cold (전역) / Warm (개인화) / Hot (세션 FSRS) |
| **P6.6** | **소급 정책 (F)** — 기존 4,862 vocabularies (V6~V11 전체) 를 i+1 외 처리 |

## 🔒 P6.0 게이트 (엄수 — 사용자 정정 2026-06-20)

Code 가 P6.0 단독 실행 후 P6.1 자동 진입 **금지**. 다음 게이트 필수:

```
P6.0 (read-only + B1·B2) → Project 보고 → 사용자 승인 → P6.1~P6.6
```

### P6.0 보고 필수 항목 (Project 측에 제출)

- 0-2 user_profiles V-level 충전율
- 0-3 vocabularies stable 분포 (stable_21d, not_started, warm 카운트)
- **0-4 avg 책/user** (E4 cap 산정 근거)
- 0-5 V-level gap 분포
- 0-6 enroll_library_book chain
- 0-7 extract_vocabulary_for_user 정합
- **B1: UNIQUE(user_id, word) 제약 존재 여부** → E7 확정 + dedup 식 단순화 가능성
- **B2: subscription 분리 정도** (vocab 이 sub 없이 가능?) → E8 확정 + i+1 필터 적용 layer 결정

## 결정표 E1~E8 + F (사용자 확정 대기)

| ID | 항목 | Project 예비 default | P6.0 보고 후 산정 |
|---|---|---|---|
| E1 | i+1 범위 | 3-band (N-1, N, N+1) | — |
| E2 | 진단 미완료 fallback | book_v_level 또는 V5 | — |
| E3 | stable 임계 | stability >= 21 일 | 0-3 측정 후 보정 |
| **E4** | **세션 cap** | **50** | **0-4 avg 책/user 후 최종** |
| E5 | 다국적 fallback | V5 base | — |
| E6 | book_v_level UI 차단 | DB X, UI 만 | — |
| **E7** | UNIQUE(user_id, word) 가정 | — | **B1 결과로 확정** |
| **E8** | subscription 분리 | — | **B2 결과로 확정** |
| **F** | P6.6 소급 정책 | F0 (보류) | 0-3 review_count=0 비율 후 결정 |

### F 옵션 (P6.6)

- F0 보류 — 기존 vocab 유지, 새 enroll 만 P6.1~P6.3 적용
- F1 archived 처리 (soft hide) — 진도 보존
- F2 명시 DELETE — 진도 손실 (review_count>0 보호 가드 필요)
- F3 책별 unenroll + 재enroll — review_count=0 만 영향 (현 dev 환경 안전)

## How to apply (다음 Code 세션)

1. 사용자가 "P6.0 진행" 명시 → Code 가 P6.0 read-only 실행
2. P6.0 결과 (측정 + B1·B2) 를 Project 측에 제출 — **이 시점에 P6.1 자동 진입 금지**
3. Project 가 결정 E1~E8 + F 산정 → 사용자 승인
4. 사용자가 Code 에 결정 paste → P6.1 부터 단계별 승인 게이트 진행

## Why
PR #24 (P0~P4 + 재발행) 의 후속 — 추출 layer 완성 했으나 구독 layer 가 user 무관 일괄 import 라 학습 효과 저해. P6 완료 시 Cold/Warm/Hot Layer 3 모두 작동.

관련: [[project-extraction-pipeline-p1-p4]] · [[project-doc-ai-context-3folders]]

